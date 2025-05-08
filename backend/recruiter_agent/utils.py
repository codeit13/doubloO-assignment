import functools
import traceback
import json
import re
from typing import Callable, TypeVar, ParamSpec, Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from langchain_core.runnables import RunnableLambda
from langgraph.prebuilt import ToolNode
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

# from utils.utils import count_tokens

console = Console()

# Type variables for generic function typing
P = ParamSpec('P')  # For parameters
R = TypeVar('R')    # For return type


def error_handler(func: Callable[P, R]) -> Callable[P, R]:
    """Decorator that provides detailed error handling and tracing.

    Args:
        func: The function to wrap with error handling

    Returns:
        Wrapped function with error handling
    """
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return func(*args, **kwargs)
        except Exception as e:
            console.print(f"\n[red]{'='*50}[/red]")
            console.print(
                f"[red bold]Error in function:[/red bold] [yellow]{func.__name__}[/yellow]")
            console.print(
                f"[red bold]Error type:[/red bold] [yellow]{type(e).__name__}[/yellow]")
            console.print(
                f"[red bold]Error message:[/red bold] [yellow]{str(e)}[/yellow]")
            console.print("\n[red bold]Traceback:[/red bold]")
            console.print(f"[yellow]{traceback.format_exc()}[/yellow]")
            console.print(f"[red]{'='*50}[/red]\n")
            raise
    return wrapper


@error_handler
def pretty_print_messages(messages):
    """Pretty print messages for debugging"""
    table = Table(
        show_header=True,
        header_style="bold white",
        style="blue",
        row_styles=["green", "green"],
        border_style="white"
    )
    table.add_column("Role")
    table.add_column("Content")
    table.add_column("Tokens (I/O)")

    for msg in messages:
        role = msg.__class__.__name__

        if not msg.content:
            if hasattr(msg, 'tool_calls'):
                content = 'Call these tools: ' + \
                    ', '.join([tc['name'] for tc in msg.tool_calls])
            else:
                content = 'N/A'
        else:
            content = msg.content

        total_tokens = msg.response_metadata.get(
            'token_usage', {}).get('total_tokens', 0)

        table.add_row(
            role,
            content,
            str(total_tokens)
        )

    console.print(Panel(table, title="Prompt to LLM"))


@error_handler
def handle_tool_error(state) -> dict:
    """Handle tool execution errors and generate appropriate error messages"""
    print("\033[93m[Error Handler] 🔍 Processing error state\033[0m")
    error = state.get("error")
    tool_calls = state["messages"][-1].tool_calls

    print(f"\033[91m[Error Handler] ❌ Error details: {error}\033[0m")
    print(
        f"\033[93m[Error Handler] 🔄 Tool calls involved: {len(tool_calls)}\033[0m")

    error_messages = [
        ToolMessage(
            content=f"Error: {repr(error)}\nPlease fix your mistakes.",
            tool_call_id=tc["id"],
        )
        for tc in tool_calls
    ]

    print("\033[92m[Error Handler] ✅ Error response generated\033[0m")
    return {"messages": error_messages}


@error_handler
def create_tool_node_with_fallback(tools: list) -> dict:
    return ToolNode(tools).with_fallbacks(
        [RunnableLambda(handle_tool_error)],
        exception_key="error"
    )


# Web content extraction utilities

def extract_links_from_text(text: str) -> List[str]:
    """
    Extract URLs from text with improved pattern matching.
    """
    # More comprehensive pattern for URLs - using non-capturing groups
    url_pattern = r'(?:https?://[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[-a-zA-Z0-9_%]+)*|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[-a-zA-Z0-9_%]+)*)'

    # Common domains to check
    domains_of_interest = [
        'linkedin.com', 'github.com', 'gitlab.com', 'bitbucket.org',
        'medium.com', 'dev.to', 'twitter.com', 'x.com', 'facebook.com',
        'stackoverflow.com', 'kaggle.com', 'scholar.google.com',
        'researchgate.net', 'orcid.org', 'behance.net', 'dribbble.com'
    ]

    # Find all matches in the text
    matches = re.findall(url_pattern, text)
    processed_urls = []

    for url in matches:
        # Ensure url is a string (not a tuple from regex capturing groups)
        if isinstance(url, tuple):
            url = url[0]  # Take the first element if it's a tuple

        # Check if it's a valid URL or just a domain name
        if not url.startswith(('http://', 'https://')):
            # Check if it's a known domain of interest
            if any(domain in url.lower() for domain in domains_of_interest):
                url = 'https://' + url
            else:
                # Skip if not clearly a domain of interest
                continue

        # Simple validation - if URL has a valid domain structure
        if '.' in urlparse(url).netloc:
            processed_urls.append(url)

    return processed_urls


def get_url_content(url: str, max_chars: int = 5000) -> Optional[Dict[str, Any]]:
    """
    Enhanced URL content fetcher with better error handling and content extraction.
    Returns the content and metadata about the URL.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        # Parse with BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()

        # Get page title
        title = soup.title.string if soup.title else "No title"

        # Determine content extraction strategy based on URL
        domain = urlparse(url).netloc.lower()

        if 'github.com' in domain:
            # Special handling for GitHub - look for README content
            content = extract_github_content(soup, url)
        elif 'linkedin.com' in domain:
            # Handle LinkedIn profile pages
            content = extract_linkedin_content(soup)
        elif 'medium.com' in domain or 'dev.to' in domain:
            # Blog content extraction
            content = extract_blog_content(soup)
        else:
            # Generic content extraction
            content = extract_generic_content(soup)

        # Truncate to avoid overloading the model
        content = content[:max_chars]

        return {
            "url": url,
            "title": title,
            "content": content,
            "domain": domain
        }
    except Exception as e:
        print(f"Error fetching {url}: {str(e)}")
        return None


def extract_generic_content(soup: BeautifulSoup) -> str:
    """Extract content from a generic webpage."""
    # Try to find main content
    main_content = soup.find('main') or soup.find('article') or soup.find(
        'div', class_=re.compile(r'content|article|post|main'))

    if main_content:
        # Extract from main content area
        paragraphs = main_content.find_all(
            ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'])
    else:
        # Fall back to all paragraphs and headings
        paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

    # Join extracted text
    content = "\n".join(p.get_text().strip()
                        for p in paragraphs if p.get_text().strip())

    # If we got very little content, try a more aggressive approach
    if len(content) < 200:
        content = soup.get_text(separator="\n", strip=True)

    return content


def extract_github_content(soup: BeautifulSoup, url: str) -> str:
    """Extract content from GitHub page, with special handling for READMEs."""
    # Check if we're on a repository page
    if '/blob/' not in url and re.search(r'github\.com/[^/]+/[^/]+$', url):
        # Try to find README content
        readme = soup.find('article', class_='markdown-body')
        if readme:
            return readme.get_text(separator="\n", strip=True)

    # For other GitHub pages (profiles, etc)
    profile_info = ""

    # Extract profile information if available
    profile_name = soup.find('span', class_='p-name')
    if profile_name:
        profile_info += f"Name: {profile_name.get_text(strip=True)}\n"

    bio = soup.find('div', class_='p-note')
    if bio:
        profile_info += f"Bio: {bio.get_text(strip=True)}\n\n"

    # Extract pinned repositories if available
    pinned_repos = soup.find_all(
        'div', class_=re.compile(r'pinned-item-list-item'))
    if pinned_repos:
        profile_info += "Pinned Repositories:\n"
        for repo in pinned_repos[:5]:  # Limit to first 5
            repo_name = repo.find('a', class_=re.compile(r'repo'))
            repo_desc = repo.find('p', class_=re.compile(r'description'))

            if repo_name:
                profile_info += f"- {repo_name.get_text(strip=True)}"
                if repo_desc:
                    profile_info += f": {repo_desc.get_text(strip=True)}"
                profile_info += "\n"

    # If we have profile info, return it
    if profile_info:
        return profile_info

    # Fallback to generic extraction
    return extract_generic_content(soup)


def extract_linkedin_content(soup: BeautifulSoup) -> str:
    """Extract profile information from LinkedIn pages."""
    content = ""

    # Try to extract profile highlights
    profile_sections = soup.find_all('section', class_=re.compile(
        r'profile-section|experience|education'))

    if profile_sections:
        for section in profile_sections:
            section_text = section.get_text(separator="\n", strip=True)
            content += section_text + "\n\n"
    else:
        # Fallback to more generic extraction for LinkedIn
        content = extract_generic_content(soup)

    return content


def extract_blog_content(soup: BeautifulSoup) -> str:
    """Extract content from blog posts."""
    # Look for article content
    article = soup.find('article') or soup.find(
        'div', class_=re.compile(r'article|post|blog|content'))

    if article:
        # Get all text content from paragraphs inside the article
        paragraphs = article.find_all(['p', 'h1', 'h2', 'h3', 'blockquote'])
        content = "\n".join(p.get_text().strip()
                            for p in paragraphs if p.get_text().strip())
        return content
    else:
        # Fallback to generic content
        return extract_generic_content(soup)


def extract_username_from_url(url: str) -> Tuple[Optional[str], str]:
    """
    Extract username from social media URLs with improved pattern matching.
    Returns (username, platform).
    """
    url_lower = url.lower()

    # GitHub username extraction
    if 'github.com' in url_lower:
        patterns = [
            r'github\.com/([a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38})(?:/|$)',
            r'github\.com/orgs/([^/]+)(?:/|$)',
            r'gist\.github\.com/([^/]+)(?:/|$)'
        ]

        for pattern in patterns:
            match = re.search(pattern, url_lower)
            if match:
                username = match.group(1)
                # Filter out common non-username paths
                if username not in ['search', 'trending', 'collections', 'events', 'topics',
                                    'marketplace', 'pulls', 'issues', 'explore']:
                    return username, 'github'

    # LinkedIn username extraction
    elif 'linkedin.com' in url_lower:
        patterns = [
            r'linkedin\.com/in/([^/]+)(?:/|$)',
            r'linkedin\.com/pub/([^/]+)(?:/|$)'
        ]

        for pattern in patterns:
            match = re.search(pattern, url_lower)
            if match:
                return match.group(1), 'linkedin'

    # Twitter/X username extraction
    elif 'twitter.com' in url_lower or 'x.com' in url_lower:
        patterns = [
            r'(?:twitter|x)\.com/([^/]+)(?:/|$)'
        ]

        for pattern in patterns:
            match = re.search(pattern, url_lower)
            if match and match.group(1) not in ['home', 'search', 'explore', 'notifications',
                                                'messages', 'i', 'settings']:
                return match.group(1), 'twitter'

    return None, 'unknown'


# Search-related utility functions

def calculate_result_relevance(result: Dict[str, Any], candidate_name: str,
                               resume_structured: Dict[str, Any], usernames: Dict[str, str]) -> float:
    """
    Calculate relevance score for a search result with improved matching heuristics.
    """
    content = result.get('content', '').lower()
    title = result.get('title', '').lower()
    url = result.get('url', '').lower()

    # Initialize relevance score
    relevance = 0.0

    # Check for name match (essential)
    name_parts = candidate_name.lower().split()
    if len(name_parts) >= 2:
        if all(part in content[:500] or part in title for part in name_parts):
            # Full name match is strong signal
            relevance += 5.0
        elif any(part in content[:500] or part in title for part in name_parts):
            # Partial name match
            matching_parts = sum(
                1 for part in name_parts if part in content[:500] or part in title)
            relevance += (matching_parts / len(name_parts)) * 2.5

    # Check for username matches (very strong signal)
    for platform, username in usernames.items():
        username_lower = username.lower()

        # Direct username match in URL
        if platform == 'github' and 'github.com/' + username_lower in url:
            relevance += 8.0  # Almost certainly relevant
        elif platform == 'linkedin' and 'linkedin.com/in/' + username_lower in url:
            relevance += 8.0
        elif platform == 'twitter' and ('twitter.com/' + username_lower in url or 'x.com/' + username_lower in url):
            relevance += 7.0

        # Username mention in content
        if username_lower in content[:1000]:
            relevance += 2.0

    # Check for company/education matches
    # Extract companies and education from resume
    companies = [exp.get('company', '').lower()
                 for exp in resume_structured.get('experience', [])]
    education = [edu.get('institution', '').lower()
                 for edu in resume_structured.get('education', [])]

    # Check for matches in the content
    company_matches = sum(
        1 for company in companies if company and company in content[:1000])
    edu_matches = sum(
        1 for school in education if school and school in content[:1000])

    relevance += min(company_matches * 1.5, 3.0)  # Cap at 3.0 for companies
    relevance += min(edu_matches * 1.0, 2.0)      # Cap at 2.0 for education

    return relevance


def generate_search_queries(state: Dict[str, Any]) -> List[str]:
    """
    Generate optimized search queries based on candidate information.
    """
    candidate_name = state["candidate_name"]
    resume_structured = state["resume_structured"]
    usernames = state.get("usernames", {})
    jd_structured = state.get("jd_structured", {})

    # Create base queries using available information
    queries = []

    # 1. GitHub queries
    if 'github' in usernames:
        # Direct username query - highest specificity
        queries.append(f"github.com/{usernames['github']}")
        queries.append(f"site:github.com {usernames['github']} repositories")
    else:
        # More general GitHub query with disambiguation
        companies = [exp.get('company', '') for exp in resume_structured.get(
            'experience', []) if exp.get('company')]
        if companies:
            queries.append(f"{candidate_name} {companies[0]} github")
        else:
            queries.append(f"{candidate_name} github profile")

    # 2. LinkedIn queries
    if 'linkedin' in usernames:
        queries.append(f"site:linkedin.com/in/{usernames['linkedin']}")
    else:
        # General LinkedIn query
        if companies:
            queries.append(f"{candidate_name} {companies[0]} linkedin")
        else:
            queries.append(f"{candidate_name} linkedin profile")

    # 3. Technical/professional content queries
    skills = resume_structured.get('skills', [])
    if skills and len(skills) >= 2:
        # Use specific skills in queries
        queries.append(
            f"{candidate_name} {skills[0]} {skills[1]} project blog")
        queries.append(f"{candidate_name} {skills[0]} conference talk")

    # 4. Company-specific queries
    if companies and len(companies) >= 1:
        queries.append(
            f"{candidate_name} {companies[0]} portfolio work achievements")

    # 5. Education-specific queries
    education = [edu.get('institution', '') for edu in resume_structured.get(
        'education', []) if edu.get('institution')]
    if education:
        queries.append(
            f"{candidate_name} {education[0]} research paper project")

    # 6. Use job title for relevance
    job_titles = [exp.get('title', '') for exp in resume_structured.get(
        'experience', []) if exp.get('title')]
    if job_titles:
        queries.append(f"{candidate_name} {job_titles[0]} portfolio project")

    # 7. Add job-specific query using JD
    if jd_structured and jd_structured.get('title'):
        # Create query relevant to the job being applied for
        jd_title = jd_structured.get('title', '')
        jd_skill = jd_structured.get('top_skills', [''])[
            0] if jd_structured.get('top_skills') else ''
        if jd_title and jd_skill:
            queries.append(f"{candidate_name} {jd_title} {jd_skill}")

    # 8. Use LLM to generate additional queries if needed
    if len(queries) < 6:
        additional_queries = generate_llm_search_queries(state)
        queries.extend(additional_queries)

    # Remove duplicates and limit to 10 queries
    unique_queries = list(dict.fromkeys(queries))
    return unique_queries[:10]


def generate_llm_search_queries(state: Dict[str, Any], num_queries: int = 3) -> List[str]:
    """
    Use LLM to generate targeted search queries for a candidate.
    """
    from recruiter_agent.llm import create_llm

    llm = create_llm()
    candidate_name = state["candidate_name"]
    resume_structured = state["resume_structured"]
    usernames = state.get("usernames", {})

    # Extract key information for query generation
    companies = [exp.get('company', '')
                 for exp in resume_structured.get('experience', [])]
    education = [edu.get('institution', '')
                 for edu in resume_structured.get('education', [])]
    skills = resume_structured.get('skills', [])

    prompt = f"""
    Generate {num_queries} highly specific search queries to find professional information about:
    
    Name: {candidate_name}
    Work history: {', '.join(companies) if companies else 'Unknown'}
    Education: {', '.join(education) if education else 'Unknown'}
    Skills: {', '.join(skills[:5]) if skills else 'Unknown'}
    Usernames: {json.dumps(usernames)}
    
    Each query should:
    1. Be designed to find specific content about this exact person
    2. Include disambiguating information to avoid finding other people with similar names
    3. Focus on professional achievements, contributions, or publications
    4. Use specialized search operators when helpful (e.g., site:github.com)
    
    Return only the search queries, one per line, without numbering or explanation.
    """

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(
            response, 'content') else str(response)

        # Process the response to extract queries
        queries = [q.strip() for q in content.strip().split('\n') if q.strip()]

        return queries
    except Exception as e:
        print(f"Error generating search queries with LLM: {str(e)}")
        return []


def format_output(fit_assessment: Dict[str, Any]) -> str:
    """
    Format the fit assessment output in a readable format.

    Args:
        fit_assessment (Dict[str, Any]): The fit assessment data.

    Returns:
        str: Formatted output.
    """
    output = []

    # Overall fit
    output.append(f"# Candidate Assessment: {fit_assessment['fit_score']}\n")

    # Score details
    output.append("## Score Details")
    output.append(
        f"- Skill match: {fit_assessment['score_details']['skill_match_percentage']:.1f}%")
    output.append(
        f"- Experience: {fit_assessment['score_details']['experience_years']} years")
    output.append(
        f"- Domain signal: {fit_assessment['score_details']['domain_signal']}\n")

    # Comparison matrix
    output.append("## Skills Comparison Matrix")
    output.append("| Skill | Required | Candidate Has |")
    output.append("| ----- | -------- | ------------ |")

    for entry in fit_assessment['comparison_matrix']:
        required = "✅" if entry['required'] else "❌"
        has = "✅" if entry['candidate_has'] else "❌"
        output.append(f"| {entry['skill']} | {required} | {has} |")

    output.append("\n## Detailed Assessment")
    output.append(fit_assessment['reasoning'])

    return "\n".join(output)
