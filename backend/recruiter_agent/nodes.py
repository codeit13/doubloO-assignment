import json
from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, START, END
from langchain_tavily import TavilySearch
from config import settings
from recruiter_agent.llm import create_llm
from recruiter_agent.pydantic_types import JobDescription, Resume, WebResearch, FitAssessment
from recruiter_agent.utils import (
    extract_links_from_text, get_url_content, extract_username_from_url,
    calculate_result_relevance, generate_search_queries, generate_llm_search_queries, format_output
)

def parse_jd_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured job fields from raw job_description text.
    """
    jd_text = state["job_description"]
    jd_llm = create_llm().with_structured_output(JobDescription)

    messages = [
        (
            "system",
            f"""
            Extract the following information from this job description in structured format:
            - Job title
            - Location (if available)
            - List of key responsibilities
            - List of required qualifications
            - List of preferred qualifications (if available)
            - List of key skills extracted from the job description

            The job description text is:
            {jd_text}
            """
        )
    ]

    try:
        jd_structured = jd_llm.invoke(messages)
        jd_structured = jd_structured.model_dump()
        print("✅ Job Description Parsed")
    except Exception as e:
        print(f"Error parsing job description: {str(e)}")
        # Fallback structure
        jd_structured = {
            "title": "Unknown Position",
            "location": None,
            "responsibilities": [],
            "required_qualifications": [],
            "preferred_qualifications": None,
            "top_skills": []
        }

    return {**state, "jd_structured": jd_structured}


def parse_resume_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured resume fields from plain-text resume.
    """
    resume_text = state["resume_text"]
    candidate_name = state.get("candidate_name", "")

    # Extract URLs from resume text first
    urls = extract_links_from_text(resume_text)

    resume_llm = create_llm().with_structured_output(Resume)
    messages = [
        (
            "system",
            f"""
            Extract the following detailed information from this resume:
            - Personal information (name, email, phone)
            - Education history (with degree, institution, and years)
            - Work experience (with title, company, dates, and descriptions)
            - Skills
            - Certifications (if available)
            - Projects (if available)
            
            If the candidate name is not in the resume, use: {candidate_name}
            
            The resume text is:
            {resume_text}
            
            These URLs were found in the resume: {', '.join(urls)}
            Please ensure they're properly included in the appropriate sections.
            """
        )
    ]

    try:
        resume_structured = resume_llm.invoke(messages)
        resume_structured = resume_structured.model_dump()
        print("✅ Resume Parsed")

        # Extract candidate name if not already in state
        if not candidate_name and resume_structured.get("personal", {}).get("name"):
            candidate_name = resume_structured["personal"]["name"]

        # Add extracted URLs to state for later use
        state["extracted_urls"] = urls
    except Exception as e:
        print(f"Error parsing resume: {str(e)}")
        # Fallback structure
        resume_structured = {
            "personal": {"name": candidate_name or "Unknown", "email": None, "phone": None},
            "education": [],
            "experience": [],
            "skills": [],
            "certifications": None,
            "projects": None
        }

    return {**state, "resume_structured": resume_structured, "candidate_name": candidate_name}


def web_research_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform improved web research with better content extraction and processing.
    """
    candidate_name = state["candidate_name"]
    resume_structured = state["resume_structured"]
    extracted_urls = state.get("extracted_urls", [])

    # Initialize search tool
    search_tool = TavilySearch(
        tavily_api_key=settings.TAVILY_SEARCH_API_KEY,
        max_results=3,
        topic="general",
    )

    # Create context for collecting information
    search_context = []
    search_results = []

    # Extract usernames from URLs
    usernames = {}
    for url in extracted_urls:
        username, platform = extract_username_from_url(url)
        if username:
            usernames[platform] = username
            search_context.append(
                f"{platform.capitalize()} username: {username}")

    # 1. Process URLs directly found in resume first
    web_contents = []
    for url in extracted_urls:
        print(f"Fetching content from: {url}")
        content_data = get_url_content(url)
        if content_data:
            web_contents.append(content_data)

            # Log successful extraction
            search_context.append(f"Extracted content from {url}")
            search_results.append({
                'title': content_data['title'],
                'url': url,
                # Truncate for logging
                'content': content_data['content'][:300],
                'relevance': 10,  # High relevance since it's from resume
                'source': 'direct_url'
            })

    # 2. Create optimized search queries
    search_queries = generate_search_queries(state)

    # 3. Perform searches with the generated queries
    for query in search_queries:
        try:
            print(f"Searching: {query}")
            results = search_tool.invoke({"query": query})

            # Extract results from response
            if isinstance(results, dict) and 'results' in results:
                results = results.get('results', [])

            if results:
                # Add query context
                search_context.append(f"\nSEARCH RESULTS FOR: '{query}'")

                # Process each result
                for result in results:
                    # Skip if we already have this URL
                    if any(r['url'] == result.get('url') for r in search_results):
                        continue

                    # Process the result with improved relevance calculation
                    relevance = calculate_result_relevance(
                        result, candidate_name, resume_structured, usernames)

                    if relevance >= 3:  # Only include reasonably relevant results
                        search_results.append({
                            'title': result.get('title', ''),
                            'url': result.get('url', ''),
                            # Truncate for context
                            'content': result.get('content', '')[:300],
                            'relevance': relevance,
                            'source': 'search'
                        })
            else:
                search_context.append(f"No results found for: {query}")

        except Exception as e:
            print(f"Error performing search for '{query}': {str(e)}")

    # Sort results by relevance
    search_results.sort(key=lambda x: x['relevance'], reverse=True)

    # 4. Fetch content for high-relevance search results we don't already have
    for result in search_results[:5]:  # Process top 5 results
        if result['source'] == 'search':  # Only process search results, not direct URLs
            content_data = get_url_content(result['url'])
            if content_data:
                web_contents.append(content_data)
                # Update with full content
                result['content'] = content_data['content']

    # 5. Structure the web research findings using LLM
    web_llm = create_llm().with_structured_output(WebResearch)

    # Prepare context for LLM
    web_content_summary = []
    # Limit to top 5 to avoid context length issues
    for content in web_contents[:5]:
        summary = f"URL: {content['url']}\nTitle: {content['title']}\n"
        # Limit content length
        summary += f"Content: {content['content'][:1500]}...\n\n"
        web_content_summary.append(summary)

    messages = [
        (
            "system",
            f"""
            Analyze these web findings about candidate {candidate_name} and extract verified information.
            
            VERIFICATION RULES:
            1. Only include information that clearly belongs to THIS specific candidate
            2. Look for multiple signals confirming identity (name + company, name + education, etc.)
            3. If uncertain about information, DO NOT include it
            4. When results are ambiguous or could belong to another person with the same name, exclude them
            
            Based on the web research results provided, extract:
            1. GitHub repositories (list only repositories that are definitely by this candidate)
            2. Blog posts written by the candidate (only if clearly authored by them)
            3. Conference talks or presentations given by this specific candidate
            4. Social media or professional mentions (only those relevant to this candidate)
            
            CANDIDATE INFORMATION FOR VERIFICATION:
            Name: {candidate_name}
            Education: {', '.join([edu.get('institution', '') for edu in resume_structured.get('education', [])])}
            Companies: {', '.join([exp.get('company', '') for exp in resume_structured.get('experience', [])])}
            
            WEB RESEARCH CONTENT:
            {chr(10).join(web_content_summary)}
            
            IMPORTANT: Quality over quantity. It's better to return fewer highly-confident results than many uncertain ones.
            If you cannot find verified information for a category, state "No verified information found" instead of making assumptions.
            """
        )
    ]

    try:
        web_structured = web_llm.invoke(messages)
        web_structured = web_structured.model_dump()
        print("✅ Web Research Completed")
    except Exception as e:
        print(f"Error in web research analysis: {str(e)}")
        # Fallback structure
        web_structured = {
            "github_repos": ["No verified repositories found"],
            "blogs": ["No verified blog posts found"],
            "conference_talks": ["No verified conference talks found"],
            "social_mentions": ["No verified social mentions found"]
        }

    # Add usernames to state for other nodes
    return {**state, "web_structured": web_structured, "usernames": usernames}


def fit_score_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare JD, resume, and web research to produce a fit score and reasoning.
    Uses a more balanced approach that considers potential and transferable skills.
    """
    jd_structured = state["jd_structured"]
    resume_structured = state["resume_structured"]
    web_structured = state["web_structured"]

    # Create LLM and set up structured output
    fit_llm = create_llm().with_structured_output(FitAssessment)

    # Get candidate skills from resume
    candidate_skills = resume_structured.get('skills', [])

    # Get required skills from JD
    jd_skills = jd_structured.get('top_skills', [])

    # Extract projects from resume if available
    projects = resume_structured.get('projects', [])

    # Format experience for better assessment
    experience_formatted = []
    for exp in resume_structured.get('experience', []):
        exp_entry = f"{exp.get('title')} at {exp.get('company')}"
        if exp.get('start_date') and exp.get('end_date'):
            exp_entry += f" ({exp.get('start_date')} to {exp.get('end_date')})"
        elif exp.get('start_date'):
            exp_entry += f" (from {exp.get('start_date')} to Present)"

        if exp.get('description'):
            exp_entry += f": {exp.get('description')}"

        experience_formatted.append(exp_entry)

    # Check for GitHub repositories that might indicate relevant skills
    github_repos = web_structured.get("github_repos", [])
    has_github_projects = any(
        repo != "No verified repositories found" for repo in github_repos)

    messages = [
        (
            "system",
            f"""
            Evaluate this candidate against the job requirements with a focus on potential and transferable skills:
            
            JOB DESCRIPTION:
            Title: {jd_structured.get("title")}
            Location: {jd_structured.get("location") if jd_structured.get("location") else 'Not specified'}
            
            Required Qualifications:
            {chr(10).join(f"- {qual}" for qual in jd_structured.get("required_qualifications", []))}
            
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
            
            Total Experience: {resume_structured.get("personal").get("work_experience") if resume_structured.get("personal") else 'Not specified'} years
            
            Skills:
            {chr(10).join(f"- {skill}" for skill in resume_structured.get("skills")) if resume_structured.get("skills") else 'Not specified'}
            
            Projects:
            {chr(10).join(f"- {project}" for project in projects) if projects else 'None specified in resume'}
            
            WEB RESEARCH FINDINGS:
            GitHub: {chr(10).join(f"- {repo}" for repo in web_structured.get("github_repos")) if web_structured.get("github_repos") else 'None found'}
            
            Blogs: {chr(10).join(f"- {blog}" for blog in web_structured.get("blogs")) if web_structured.get("blogs") else 'None found'}
            
            Conference Talks: {chr(10).join(f"- {talk}" for talk in web_structured.get("conference_talks")) if web_structured.get("conference_talks") else 'None found'}
            
            Social/Professional Mentions: {chr(10).join(f"- {mention}" for mention in web_structured.get("social_mentions")) if web_structured.get("social_mentions") else 'None found'}
            
            ASSESSMENT GUIDELINES:
            1. Create a detailed comparison matrix showing each required skill and whether the candidate has it
            2. Calculate:
               - Skill match percentage (% of required skills candidate has)
               - Approximate experience years in relevant roles
               - Domain signal strength based on web findings (High/Medium/Low)
            3. Determine overall fit: "Strong Fit", "Moderate Fit", or "Not a Fit"
            4. Provide clear reasoning for your assessment
            
            IMPORTANT EVALUATION CONSIDERATIONS:
            - Look for transferable skills that could apply to the job requirements
            - Consider project work and GitHub repositories as evidence of practical skills
            - Value potential and ability to learn, especially for junior to mid-level positions
            - Recognize that candidates may have relevant experience even if job titles don't exactly match
            - Consider education and certifications as indicators of knowledge in required areas
            - Be generous in skill assessment - if the candidate shows adjacent skills, count them as partial matches
            - For technical roles, give significant weight to demonstrated coding abilities in projects
            - Consider quality of work over quantity of experience
            
            Be balanced and fair in your assessment, considering both current skills and growth potential.
            """
        )
    ]
    
    fit_assessment = fit_llm.invoke(messages)
    fit_assessment = fit_assessment.model_dump()
    print("✅ Fit Assessment Completed:")
    print(json.dumps(fit_assessment, indent=2))
    
    # Generate formatted markdown output
    formatted_output = format_output(fit_assessment)
    print(f"✅ Generated formatted markdown assessment")
    
    # Return both the structured assessment and the formatted markdown
    return {**state, "fit_assessment": fit_assessment, "formatted_output": formatted_output}
