import json
from typing import Dict, Any, TypedDict, List, Optional
from langgraph.graph import StateGraph, START, END
from langchain_tavily import TavilySearch
from config import settings
from recruiter_agent.llm import create_llm
from recruiter_agent.pydantic_types import JobDescription, Resume, WebResearch, FitAssessment, GitHubRepo, BlogEntry, ConferenceTalk, SocialMention
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse


def parse_jd_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured job fields from raw job_description text.
    """
    jd_text = state["job_description"]
    # Bind the JobDescription schema to the LLM for JSON mode output
    jd_llm = create_llm()
    messages = [
        (
            "system",
            f"""
            You are a job description parser that extracts key details from job descriptions.
            Extract the following information in structured format:
            - Job title
            - Location (if available)
            - List of key responsibilities
            - List of required qualifications
            - List of preferred qualifications (if available)
            - List of key skills extracted from the job description

            The job description text is as follows:
            {jd_text}
            """
        )
    ]
    jd_llm = jd_llm.with_structured_output(JobDescription)

    # jd_structured = jd_llm.invoke(messages)
    # jd_structured = jd_structured.model_dump()

    jd_structured = {
        "title": "Full Stack Engineer (Backend)",
        "location": None,
        "responsibilities": [
            "Write well-architected, tested, secure, and scalable code",
            "Work directly on the product",
            "Collaborate with product managers, designers, and front-end engineers to solve common goals"
        ],
        "required_qualifications": [
            "Raw intellectual horsepower and ability to learn quickly",
            "Experience contributing to open source (GitHub)",
            "Experience working on apps that have supported 10,000+ concurrent users",
            "Ability to design and build scalable infrastructure",
            "Experience with real-time apps using OT or CRDT",
            "Understanding of sound architecture principles and ability to build end-to-end",
            "Meaningful time spent as a Senior engineer or higher",
            "Passion for productivity tools and supporting power users"
        ],
        "preferred_qualifications": None,
        "top_skills": [
            "Full Stack Development",
            "Scalable Infrastructure Design",
            "Real-time Application Development",
            "Open Source Contribution",
            "Software Architecture Principles",
            "Communication Skills",
            "Data-driven Decision Making",
            "Incremental Engineering"
        ]
    }
    print("✅ Job Description Parsed:")
    print(json.dumps(jd_structured, indent=2))
    return {**state, "jd_structured": jd_structured}


def parse_resume_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured resume fields from plain-text resume.
    """
    resume_text = state["resume_text"]
    candidate_name = state.get("candidate_name", "")

    resume_llm = create_llm()
    resume_llm = resume_llm.with_structured_output(Resume)
    messages = [
        (
            "system",
            f"""
            You are a resume parser that extracts detailed information from candidate resumes.
            
            Extract the following information in structured format:
            - Personal information (name, email, phone)
            - Education history (with degree, institution, and years)
            - Detailed work experience (with title, company, dates, and descriptions)
            - Complete list of skills
            - Certifications (if available)
            - Projects (if available)
            - Any URLs (personal websites, LinkedIn, GitHub, etc.)
            
            If the candidate name is not found in the resume, use this provided name: {candidate_name}
            
            The resume text is as follows:
            {resume_text}
            """
        )
    ]
    # resume_structured = resume_llm.invoke(messages)
    # resume_structured = resume_structured.model_dump()

    resume_structured = {
        "personal": {
            "name": "Sumit Chauhan",
            "email": "sumit17me@gmail.com",
            "phone": "+919027293112"
        },
        "education": [
            {
                "degree": "Bachelor's Degree",
                "institution": "Birla Institute Of Applied Sciences",
                "start_year": 2018,
                "end_year": 2022
            }
        ],
        "experience": [
            {
                "title": "Software Developer",
                "company": "Mall91 - Roviri Innovations",
                "start_date": "2022-04-01",
                "end_date": "2022-11-30",
                "description": "Architected a decentralized platform (rovi.money) and developed a JavaScript SDK to enable seamless crypto transactions across partner sites. Spearheaded the design and deployment of AI-driven tools\u2014powering functionalities like AI based email outreach for clients based on a RAG of the company's previous projects. Developed various apps like Chat91, a high-fidelity audio chat solution using WebRTC, socket.io, and ION-SFU for fluid, real-time conversations."
            },
            {
                "title": "Software Developer",
                "company": "Health & Glow",
                "start_date": "2022-11-01",
                "end_date": None,
                "description": "Enhanced the e-commerce website by implementing new features and resolving critical bugs using React, Redux, and JavaScript within an Agile framework."
            },
            {
                "title": "Software Analyst",
                "company": "Ongraph Technologies",
                "start_date": "2021-09-01",
                "end_date": "2022-03-31",
                "description": "Built a word-based game (inspired by Wordle) using VueJS and Express (Node.js) to create engaging REST APIs."
            }
        ],
        "skills": [
            "NodeJS",
            "Python",
            "ExpressJS",
            "EthereumJS",
            "Flask",
            "FastAPI",
            "MongoDB",
            "VueJS",
            "NextJS",
            "Langchain",
            "ChromaDB",
            "Tailwind CSS",
            "Docker",
            "Nginx",
            "Telegram Bots",
            "AWS"
        ],
        "certifications": None,
        "projects": [
            "Converge - AI Agent",
            "Agentic RAG Apps",
            "Unified Payment & User-Auth Server",
            "Web3 Wallets",
            "Polymarket Clone"
        ]
    }

    print("✅ Resume Parsed:")
    print(json.dumps(resume_structured, indent=2))

    # Extract candidate name if not already in state
    if not candidate_name and resume_structured.personal and resume_structured.personal.name:
        candidate_name = resume_structured.personal.name

    return {**state, "resume_structured": resume_structured, "candidate_name": candidate_name}


def extract_links_from_text(text: str) -> List[str]:
    """Extract URLs from text."""
    url_pattern = r'https?://[^\s<>"]+|www\.[^\s<>"]+|linkedin\.com/[^\s<>"]+|github\.com/[^\s<>"]+|twitter\.com/[^\s<>"]+|medium\.com/[^\s<>"]+|facebook\.com/[^\s<>"]+|gitlab\.com/[^\s<>"]+|stackoverflow\.com/[^\s<>"]+|dribbble\.com/[^\s<>"]+|behance\.net/[^\s<>"]+|instagram\.com/[^\s<>"]+|scholar\.google\.com/[^\s<>"]+|researchgate\.net/[^\s<>"]+|orcid\.org/[^\s<>"]+|kaggle\.com/[^\s<>"]+|dev\.to/[^\s<>"]+|[^\s<>"]+\.medium\.com'

    # Find all matches in the text
    matches = re.findall(url_pattern, text)

    # Ensure URLs have proper prefix
    processed_urls = []
    for url in matches:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        processed_urls.append(url)

    return processed_urls


def safe_get_url_content(url: str) -> Optional[str]:
    """Safely fetch URL content with error handling."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract main content (basic approach)
        content = ""
        for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            content += tag.get_text() + "\n"

        return content[:5000]  # Limit length to avoid overloading the model
    except Exception as e:
        print(f"Error fetching {url}: {str(e)}")
        return None


def extract_github_username(url: str) -> Optional[str]:
    """
    Extract GitHub username from a GitHub URL with improved robustness.
    Handles various GitHub URL formats.
    """
    patterns = [
        # Main profile pattern
        r'github\.com/([a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38})',
        r'github\.com/orgs/([^/]+)',  # Organization pattern
        r'gist\.github\.com/([^/]+)'  # Gist pattern
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            username = match.group(1)
            # Filter out common non-username paths
            if username not in ['search', 'trending', 'collections', 'events', 'topics',
                                'marketplace', 'pulls', 'issues', 'explore']:
                return username
    return None


def extract_linkedin_username(url: str) -> Optional[str]:
    """
    Extract LinkedIn username from a LinkedIn URL.
    Handles various LinkedIn URL formats.
    """
    patterns = [
        r'linkedin\.com/in/([^/]+)',  # Standard profile URL
        r'linkedin\.com/pub/([^/]+)'  # Alternative profile URL format
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_twitter_username(url: str) -> Optional[str]:
    """
    Extract Twitter/X username from a Twitter URL.
    """
    patterns = [
        r'twitter\.com/([^/]+)',  # Twitter URL
        r'x\.com/([^/]+)'         # X.com URL
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match and match.group(1) not in ['home', 'search', 'explore', 'notifications', 'messages', 'i', 'settings']:
            return match.group(1)
    return None


def web_research_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform name-based searches and extract GitHub, blog, conference, and social mentions.
    With improved relevance filtering and LLM-generated search queries.
    """
    candidate_name = state["candidate_name"]
    resume_structured = state["resume_structured"]
    resume_text = state["resume_text"]
    jd_structured = state.get("jd_structured", {})

    # Extract any URLs from the resume text
    urls_from_resume = extract_links_from_text(resume_text)
    print("URLs from resume: ", urls_from_resume)

    # Initialize search tool
    search_tool = TavilySearch(
        tavily_api_key=settings.TAVILY_SEARCH_API_KEY,
        max_results=10,
        topic="general",
    )

    # Create context for web research
    context = []
    github_username = None
    linkedin_username = None
    twitter_username = None
    unique_identifiers = []

    # Extract unique profile identifiers from resume URLs
    for url in urls_from_resume:
        if "github.com" in url:
            github_username = extract_github_username(url)
            if github_username:
                unique_identifiers.append(f"github:{github_username}")
                context.append(
                    f"GitHub username found in resume: {github_username}")
                print(
                    f"GitHub username extracted: {github_username} from {url}")

        if "linkedin.com/in/" in url:
            linkedin_username = extract_linkedin_username(url)
            if linkedin_username:
                unique_identifiers.append(f"linkedin:{linkedin_username}")
                context.append(
                    f"LinkedIn username found in resume: {linkedin_username}")
                print(
                    f"LinkedIn username extracted: {linkedin_username} from {url}")

        if "twitter.com" in url or "x.com" in url:
            twitter_username = extract_twitter_username(url)
            if twitter_username:
                unique_identifiers.append(f"twitter:{twitter_username}")
                context.append(
                    f"Twitter username found in resume: {twitter_username}")

    # Extract educational institutions and companies for disambiguation
    education_institutions = []
    companies = []

    if hasattr(resume_structured, 'education') and resume_structured.education:
        for edu in resume_structured.education:
            if hasattr(edu, 'institution') and edu.institution:
                education_institutions.append(edu.institution)

    if hasattr(resume_structured, 'experience') and resume_structured.experience:
        for exp in resume_structured.experience:
            if hasattr(exp, 'company') and exp.company:
                companies.append(exp.company)

    # Use LLM to generate targeted search queries based on resume content
    query_gen_llm = create_llm()

    query_gen_prompt = f"""
    You are an expert at creating effective search queries to find information about job candidates.
    
    I need to find accurate information about a candidate named: {candidate_name}
    
    Details from their resume:
    - Education: {', '.join(education_institutions) if education_institutions else 'Not specified'}
    - Companies worked at: {', '.join(companies) if companies else 'Not specified'}
    - Skills: {', '.join(resume_structured.skills) if hasattr(resume_structured, 'skills') and resume_structured.skills else 'Not specified'}
    
    Unique identifiers found:
    {chr(10).join(unique_identifiers) if unique_identifiers else 'None found'}
    
    Job they're applying for: {jd_structured.title if hasattr(jd_structured, 'title') else 'Not specified'}
    
    Generate 5-7 highly specific search queries that will help me find the following about this exact candidate:
    1. Their GitHub repositories and contributions
    2. Blog posts or articles they've written
    3. Conference talks or presentations they've given
    4. Professional profiles and activities
    5. Research papers or publications
    
    Each query should be carefully constructed to avoid finding information about other people with similar names.
    Include disambiguating information like companies, universities, or unique usernames where possible.
    
    Format: Return only the search queries, one per line, without numbering or additional text.
    """

    try:
        generated_queries_response = query_gen_llm.invoke(query_gen_prompt)
        generated_queries = [q.strip(
        ) for q in generated_queries_response.content.strip().split('\n') if q.strip()]
        print(f"LLM generated {len(generated_queries)} search queries")
    except Exception as e:
        print(f"Error generating search queries: {str(e)}")
        generated_queries = []

    # Base search queries with unique identifiers when available
    base_queries = []

    # If we have a GitHub username, use it directly
    if github_username:
        base_queries.append(f"github.com/{github_username}")
    else:
        # More specific GitHub query
        github_query = f"{candidate_name}"
        if companies and education_institutions:
            # Add most recent company and education for disambiguation
            github_query += f" {companies[0]} {education_institutions[0]} github"
        else:
            github_query += " github profile"
        base_queries.append(github_query)

    # LinkedIn specific query
    if linkedin_username:
        base_queries.append(f"linkedin.com/in/{linkedin_username}")
    else:
        linkedin_query = f"{candidate_name}"
        if companies:
            linkedin_query += f" {companies[0]} linkedin"
        else:
            linkedin_query += " linkedin profile"
        base_queries.append(linkedin_query)

    # Add disambiguation to common queries
    disambig = ""
    if companies:
        disambig = f" {companies[0]}"
    elif education_institutions:
        disambig = f" {education_institutions[0]}"

    # Blog and conference queries with disambiguation
    base_queries.append(f"{candidate_name}{disambig} blog post article")
    base_queries.append(
        f"{candidate_name}{disambig} conference talk presentation")
    base_queries.append(
        f"{candidate_name}{disambig} research paper publication")

    # Skills-based query for most relevant skills
    if hasattr(resume_structured, 'skills') and resume_structured.skills:
        top_skills = resume_structured.skills[:2]  # Use top 2 skills
        for skill in top_skills:
            base_queries.append(f"{candidate_name}{disambig} {skill} project")

    # Combine base queries with generated queries, removing duplicates
    all_queries = list(set(base_queries + generated_queries))

    # Create a fingerprint of the candidate for matching
    candidate_fingerprint = {
        'name': candidate_name,
        'education': education_institutions,
        'companies': companies,
        'skills': resume_structured.skills if hasattr(resume_structured, 'skills') else [],
        'unique_ids': unique_identifiers
    }

    # Perform searches
    search_results = []
    context.append(
        f"SEARCH FINGERPRINT FOR CANDIDATE: {json.dumps(candidate_fingerprint)}")

    for query in all_queries:
        try:
            print(f"Searching: {query}")
            results = search_tool.invoke({"query": query})

            # Extract results from response
            if isinstance(results, dict) and 'results' in results:
                results = results.get('results', [])

            if results:
                # Add query context
                context.append(f"\nSEARCH RESULTS FOR: '{query}'")

                # Filter results for relevance using simple heuristics
                filtered_results = []
                for result in results:
                    # Skip results that don't seem related to the person
                    content = result.get('content', '').lower()
                    title = result.get('title', '').lower()
                    url = result.get('url', '').lower()

                    # Calculate a simple relevance score
                    relevance_score = 0

                    # Check for name match
                    name_parts = candidate_name.lower().split()
                    if all(part in content[:500] for part in name_parts):
                        relevance_score += 5
                    elif any(part in content[:500] for part in name_parts):
                        relevance_score += 2

                    # Check for company/education matches
                    for company in companies:
                        if company.lower() in content[:1000]:
                            relevance_score += 3

                    for school in education_institutions:
                        if school.lower() in content[:1000]:
                            relevance_score += 3

                    # Check unique identifiers
                    for uid in unique_identifiers:
                        uid_value = uid.split(':', 1)[1].lower()
                        if uid_value in url or uid_value in content[:500]:
                            relevance_score += 10

                    # Only include reasonably relevant results
                    if relevance_score >= 3:
                        filtered_results.append({
                            'title': result.get('title', ''),
                            'url': result.get('url', ''),
                            # Truncate for LLM context
                            'content': result.get('content', '')[:300],
                            'relevance': relevance_score
                        })

                # Sort by relevance
                filtered_results.sort(
                    key=lambda x: x['relevance'], reverse=True)

                # Add top results to context
                # Only use top 3 results
                for idx, result in enumerate(filtered_results[:3]):
                    context.append(
                        f"[{result['relevance']}] {result['title']}: {result['url']}")
                    context.append(f"EXCERPT: {result['content']}...")

                search_results.extend(filtered_results)
            else:
                context.append(f"No results found for: {query}")

        except Exception as e:
            print(f"Error performing search for '{query}': {str(e)}")

    # Use LLM to analyze search results and structure web findings with verification
    web_llm = create_llm()
    web_llm = web_llm.with_structured_output(WebResearch)

    messages = [
        (
            "system",
            f"""
            You are a web researcher specialized in extracting structured information about job candidates.
            
            Your task is to analyze search results and extract verified information about a specific candidate.
            
            CANDIDATE INFORMATION:
            Name: {candidate_name}
            Education: {', '.join(education_institutions) if education_institutions else 'Not specified'}
            Companies: {', '.join(companies) if companies else 'Not specified'}
            
            VERIFICATION RULES:
            1. Only include information that clearly belongs to THIS specific candidate
            2. Look for multiple signals confirming identity (name + company, name + education, etc.)
            3. If you're uncertain about information, DO NOT include it
            4. When results are ambiguous or could belong to another person with the same name, exclude them
            5. DO NOT HALLUCINATE any information that is not clearly present in the search results
            
            Based on the web search results provided, extract:
            1. GitHub repositories (list only repositories that are definitely by this candidate)
            2. Blog posts written by the candidate (only if clearly authored by them)
            3. Conference talks or presentations given by this specific candidate
            4. Social media or professional mentions (only those relevant to this candidate)
            
            For each item you include, note the confidence level (High/Medium/Low) and brief reasoning.
            
            SEARCH CONTEXT:
            {chr(10).join(context)}
            
            IMPORTANT: Quality over quantity. It's better to return fewer highly-confident results than many uncertain ones.
            If you cannot find verified information for a category, state "No verified information found" instead of making assumptions.
            """
        )
    ]

    try:
        web_structured = web_llm.invoke(messages)
        web_structured = web_structured.model_dump()
        print("✅ Web Research Completed:")
        print(json.dumps(web_structured, indent=2))
    except Exception as e:
        print(f"Error in web research analysis: {str(e)}")
        # Provide fallback empty structure
        web_structured = {
            "github_repos": ["No verified repositories found"],
            "blogs": ["No verified blog posts found"],
            "conference_talks": ["No verified conference talks found"],
            "social_mentions": ["No verified social mentions found"]
        }

    return {**state, "web_structured": web_structured}


def verify_candidate_identity(result_content: str, candidate_fingerprint: dict) -> float:
    """
    Verifies if a search result likely refers to the target candidate.

    Args:
        result_content (str): The content text from a search result
        candidate_fingerprint (dict): Dictionary containing candidate identifiers

    Returns:
        float: Confidence score from 0.0 to 1.0
    """
    content = result_content.lower()
    name = candidate_fingerprint['name'].lower()
    companies = [c.lower() for c in candidate_fingerprint['companies'] if c]
    education = [e.lower() for e in candidate_fingerprint['education'] if e]
    skills = [s.lower() for s in candidate_fingerprint['skills'] if s]
    unique_ids = candidate_fingerprint['unique_ids']

    score = 0.0
    max_score = 10.0  # Baseline for perfect match

    # Check for full name - essential criterion
    name_parts = name.split()
    if len(name_parts) >= 2:
        if all(part in content for part in name_parts):
            # Full name exact match is a strong signal
            score += 3.0
        elif any(part in content for part in name_parts):
            # Partial name match
            matching_parts = sum(1 for part in name_parts if part in content)
            score += (matching_parts / len(name_parts)) * 1.5
    else:
        # Single name might be too common
        if name in content:
            score += 1.0

    # Check for unique identifiers - very strong signals
    for uid in unique_ids:
        uid_type, uid_value = uid.split(':', 1)
        uid_value = uid_value.lower()

        if uid_value in content:
            if uid_type == 'github':
                score += 4.0
            elif uid_type == 'linkedin':
                score += 3.5
            else:
                score += 3.0

    # Check for company affiliations
    company_matches = sum(1 for company in companies if company in content)
    if company_matches > 0:
        score += min(company_matches * 1.0, 2.0)  # Cap at 2.0

    # Check for educational background
    edu_matches = sum(1 for school in education if school in content)
    if edu_matches > 0:
        score += min(edu_matches * 0.8, 1.6)  # Cap at 1.6

    # Check for skills (weaker signal)
    skills_matches = sum(1 for skill in skills if skill in content)
    if skills_matches > 0:
        # Only count if we have other signals first
        if score > 1.0:
            score += min(skills_matches * 0.2, 1.0)  # Cap at 1.0

    # Normalize score between 0 and 1
    return min(score / max_score, 1.0)


def generate_search_queries(candidate_data: Dict[str, Any], num_queries: int = 7) -> List[str]:
    """
    Generate intelligent search queries for a candidate using LLM.

    Args:
        candidate_data (Dict): Dictionary containing candidate information
        num_queries (int): Number of queries to generate

    Returns:
        List[str]: List of optimized search queries
    """
    llm = create_llm()

    # Extract relevant information
    name = candidate_data.get("name", "")
    companies = candidate_data.get("companies", [])
    education = candidate_data.get("education", [])
    skills = candidate_data.get("skills", [])
    unique_ids = candidate_data.get("unique_ids", [])
    job_title = candidate_data.get("job_title", "")

    # Create a detailed prompt for query generation
    prompt = f"""
    As an expert in creating effective search queries, generate {num_queries} highly specific search queries to find accurate information about this professional:

    CANDIDATE:
    - Name: {name}
    - Work history: {', '.join(companies) if companies else 'Unknown'}
    - Education: {', '.join(education) if education else 'Unknown'}
    - Skills: {', '.join(skills[:5]) if skills else 'Unknown'}  # Limit to top 5 skills
    - Online identifiers: {', '.join(unique_ids) if unique_ids else 'None found'}
    - Current/target role: {job_title if job_title else 'Unknown'}

    REQUIREMENTS:
    1. Each query should be designed to find specific professional information about this exact person.
    2. Include disambiguating information to avoid finding other people with similar names.
    3. Create specialized queries for:
       - GitHub repositories and open source contributions
       - Technical blog posts or articles
       - Conference presentations or talks
       - Research papers or publications
       - Professional profiles and activities
    4. Use advanced search operators where helpful (e.g., exact phrases, site-specific searches)
    5. Prioritize uniqueness - each query should target different information

    FORMAT:
    Return only the search queries, one per line. No introductions, explanations, or numbering.
    
    EXAMPLES OF GOOD QUERIES:
    "John Smith Facebook engineer Stanford University github"
    "site:github.com JohnSmith39 machine learning contributions"
    "Jane Doe Amazon AWS conference talk cloud computing"
    "site:linkedin.com/in/ 'John Smith' software architect Microsoft"
    """

    # Generate queries
    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(
            response, 'content') else str(response)

        # Process the response to extract queries
        queries = [q.strip() for q in content.strip().split('\n') if q.strip()]

        # Ensure we don't have duplicates
        unique_queries = list(dict.fromkeys(queries))

        print(f"Generated {len(unique_queries)} unique search queries")
        for q in unique_queries:
            print(f"  - {q}")

        return unique_queries

    except Exception as e:
        print(f"Error generating search queries: {str(e)}")

        # Fallback to basic queries
        fallback_queries = [
            f"{name} github",
            f"{name} linkedin",
            f"{name} conference talk",
            f"{name} blog post",
        ]

        if companies:
            fallback_queries.append(f"{name} {companies[0]}")

        if education:
            fallback_queries.append(f"{name} {education[0]}")

        if skills and len(skills) > 0:
            fallback_queries.append(f"{name} {skills[0]}")

        return fallback_queries


def extract_resume_search_data(resume: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract search-relevant data from resume structure

    Args:
        resume (Dict): Structured resume data

    Returns:
        Dict: Extracted search data
    """
    search_data = {
        "name": "",
        "companies": [],
        "education": [],
        "skills": [],
        "unique_ids": [],
        "job_title": ""
    }

    # Extract name
    if "personal" in resume and resume["personal"]:
        if isinstance(resume["personal"], dict):
            search_data["name"] = resume["personal"].get("name", "")
        else:
            search_data["name"] = resume["personal"].name if hasattr(
                resume["personal"], "name") else ""

    # Extract companies
    if "experience" in resume and resume["experience"]:
        for exp in resume["experience"]:
            if isinstance(exp, dict):
                company = exp.get("company", "")
                if company:
                    search_data["companies"].append(company)

                # Also grab the most recent job title
                if not search_data["job_title"] and "title" in exp:
                    search_data["job_title"] = exp["title"]
            else:
                company = exp.company if hasattr(exp, "company") else ""
                if company:
                    search_data["companies"].append(company)

                # Also grab the most recent job title
                if not search_data["job_title"] and hasattr(exp, "title"):
                    search_data["job_title"] = exp.title

    # Extract education institutions
    if "education" in resume and resume["education"]:
        for edu in resume["education"]:
            if isinstance(edu, dict):
                institution = edu.get("institution", "")
                if institution:
                    search_data["education"].append(institution)
            else:
                institution = edu.institution if hasattr(
                    edu, "institution") else ""
                if institution:
                    search_data["education"].append(institution)

    # Extract skills
    if "skills" in resume and resume["skills"]:
        search_data["skills"] = resume["skills"]

    return search_data


def filter_search_results(results, candidate_fingerprint, threshold=0.3):
    """
    Filters search results to only include those likely about the candidate.

    Args:
        results (list): List of search result objects
        candidate_fingerprint (dict): Dictionary containing candidate identifiers
        threshold (float): Minimum confidence score (0.0-1.0) to keep a result

    Returns:
        list: Filtered results with confidence scores
    """
    filtered_results = []

    for result in results:
        content = result.get('content', '')
        title = result.get('title', '')
        url = result.get('url', '')

        # Combine all text for identity verification
        full_text = f"{title} {content}"

        # Calculate confidence score
        confidence = verify_candidate_identity(
            full_text, candidate_fingerprint)

        # Only keep results above threshold
        if confidence >= threshold:
            result['confidence'] = confidence
            filtered_results.append(result)

    # Sort by confidence score (highest first)
    filtered_results.sort(key=lambda x: x.get('confidence', 0), reverse=True)

    return filtered_results


def fit_score_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare JD, resume, and web research to produce a fit score and reasoning.
    """
    jd_structured = state["jd_structured"]
    resume_structured = state["resume_structured"]
    web_structured = state["web_structured"]

    fit_llm = create_llm()
    fit_llm = fit_llm.with_structured_output(FitAssessment)

    messages = [
        (
            "system",
            f"""
            You are a recruiting specialist who evaluates candidates against job requirements.
            
            Evaluate the candidate based on the following information:
            
            JOB DESCRIPTION:
            Title: {jd_structured.get("title")}
            Location: {jd_structured.get("location") if jd_structured.get("location") else 'Not specified'}
            
            Required Qualifications:
            {chr(10).join(f"- {qual}" for qual in jd_structured.get("required_qualifications"))}
            
            Preferred Qualifications:
            {chr(10).join(f"- {qual}" for qual in jd_structured.get("preferred_qualifications")) if jd_structured.get("preferred_qualifications") else 'None specified'}
            
            Top Skills Required:
            {chr(10).join(f"- {skill}" for skill in jd_structured.get("top_skills"))}
            
            CANDIDATE RESUME:
            Name: {resume_structured.get("personal").get("name") if resume_structured.get("personal") else 'Not specified'}
            
            Education:
            {chr(10).join(f"- {edu.get("degree")} from {edu.get("institution")} ({edu.get("start_year")}-{edu.get("end_year") if edu.get("end_year") else 'Present'})" for edu in resume_structured.get("education")) if resume_structured.get("education") else 'Not specified'}
            
            Experience:
            {chr(10).join(f"- {exp.get("title")} at {exp.get("company")} ({exp.get("start_date")}-{exp.get("end_date") if exp.get("end_date") else 'Present'})" for exp in resume_structured.get("experience")) if resume_structured.get("experience") else 'Not specified'}
            
            Skills
            {chr(10).join(f"- {skill}" for skill in resume_structured.get("skills")) if resume_structured.get("skills") else 'Not specified'}
            
            WEB RESEARCH FINDINGS:
            GitHub: {chr(10).join(f"- {repo}" for repo in web_structured.get("github_repos")) if web_structured.get("github_repos") else 'None found'}
            
            Blogs: {chr(10).join(f"- {blog}" for blog in web_structured.get("blogs")) if web_structured.get("blogs") else 'None found'}
            
            Conference Talks: {chr(10).join(f"- {talk}" for talk in web_structured.get("conference_talks")) if web_structured.get("conference_talks") else 'None found'}
            
            Social/Professional Mentions: {chr(10).join(f"- {mention}" for mention in web_structured.get("social_mentions")) if web_structured.get("social_mentions") else 'None found'}
            
            INSTRUCTIONS:
            1. Create a detailed comparison matrix showing each required skill and whether the candidate has it
            2. Calculate:
               - Skill match percentage (% of required skills candidate has)
               - Approximate experience years in relevant roles
               - Domain signal strength based on web findings (High/Medium/Low)
            3. Determine overall fit: "Strong Fit", "Moderate Fit", or "Not a Fit"
            4. Provide clear reasoning for your assessment
            
            Be objective and thorough. Consider both resume content and web research findings.
            """
        )
    ]

    fit_assessment = fit_llm.invoke(messages)
    fit_assessment = fit_assessment.model_dump()
    print("✅ Fit Assessment Completed:")
    print(json.dumps(fit_assessment, indent=2))

    return {**state, "fit_assessment": fit_assessment}
