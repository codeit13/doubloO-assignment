from ast import List
from typing import Annotated, TypedDict, Any
from langchain_core.messages import AnyMessage
import urllib
from recruiter_agent.nodes import parse_jd_node, parse_resume_node, web_research_node, fit_score_node
from recruiter_agent.pydantic_types import JobDescription, Resume, WebResearch, FitAssessment
from langgraph.graph import StateGraph, START, END, add_messages
from pypdf import PdfReader
from docx import Document
import os
from typing import Dict, Any
import argparse
import time
import json

def create_graph():
    class State(TypedDict):
        """State definition for the recruitment agent graph"""
        candidate_name: str
        job_description: str
        resume_text: str
        jd_structured: JobDescription
        resume_structured: Resume
        extracted_urls: Any
        web_structured: WebResearch
        fit_assessment: FitAssessment

    workflow = StateGraph(State)

    # Add nodes
    workflow.add_node("JDParser", parse_jd_node)
    workflow.add_node("ResumeParser", parse_resume_node)
    workflow.add_node("WebResearcher", web_research_node)
    workflow.add_node("FitScorer", fit_score_node)

    # Add Edges
    workflow.add_edge(START, "JDParser")
    workflow.add_edge("JDParser", "ResumeParser")
    workflow.add_edge("ResumeParser", "WebResearcher")
    workflow.add_edge("WebResearcher", "FitScorer")
    workflow.add_edge("FitScorer", END)

    graph = workflow.compile()

    try:
        graph.get_graph().draw_mermaid_png(
            output_file_path='tmp/graph.png')
        print("✅ Graph visualization saved to tmp/graph.png")
    except Exception as e:
        print(f"Warning: Could not generate graph visualization: {str(e)}")

    return graph


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file.

    Args:
        file_path (str): Path to the PDF file.

    Returns:
        str: Extracted text.
    """
    try:
        reader = PdfReader(file_path)
        text = ""
        links = []

        for page in reader.pages:
            text += page.extract_text() + "\n"

            if "/Annots" in page:
                for annot in page["/Annots"]:
                    obj = annot.get_object()
                    if obj.get("/Subtype") == "/Link":
                        # Get URI if it's a URI action
                        if "/A" in obj and "/URI" in obj["/A"]:
                            uri = obj["/A"]["/URI"]
                            # Optionally, use rectangle coordinates to find link text (advanced)
                            links.append(uri)

        return text + "\n\nLinks:\n" + "\n".join(links)

    except Exception as e:
        print(f"Error extracting text from PDF: {str(e)}")
        return ""


def extract_text_from_docx(file_path: str) -> str:
    """
    Extract text from a DOCX file.

    Args:
        file_path (str): Path to the DOCX file.

    Returns:
        str: Extracted text.
    """
    try:
        doc = Document(file_path)
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from DOCX: {str(e)}")
        return ""


def extract_text_from_file(file_path: str) -> str:
    """
    Extract text from a file based on its extension.

    Args:
        file_path (str): Path to the file.

    Returns:
        str: Extracted text.
    """
    file_extension = os.path.splitext(file_path)[1].lower()

    if file_extension == ".pdf":
        return extract_text_from_pdf(file_path)
    elif file_extension == ".docx":
        return extract_text_from_docx(file_path)
    elif file_extension == ".txt":
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        print(f"Unsupported file format: {file_extension}")
        return ""


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


def run_recruiting_assistant(candidate_name: str, resume_text: str, job_description: str) -> dict:
    """
    Executes the compiled LangGraph with the given inputs and returns the full state including
    structured JD, resume, web research, and fit assessment.

    :param candidate_name: Candidate's full name
    :param resume_text: Plain-text extracted from candidate resume (PDF or DOCX)
    :param job_description: Raw job description text (string)
    :return: A dict containing keys 'jd_structured', 'resume_structured', 'web_structured', 'fit_assessment'
    """
    initial_state = {
        "candidate_name": candidate_name,
        "job_description": job_description,
        "resume_text": resume_text
    }
    graph = create_graph()
    result = graph.invoke(initial_state)
    return result


def main():
    parser = argparse.ArgumentParser(description="AI Recruiting Assistant")
    parser.add_argument("--candidate-name", type=str, nargs="?",
                        help="Name of the candidate")
    parser.add_argument("--resume", type=str, required=True,
                        help="Path to resume file (PDF or DOCX)")
    parser.add_argument("--job-description", type=str, required=True,
                        help="Path to job description file or text")
    parser.add_argument("--output", type=str,
                        default="assessment.md", help="Output file path")

    args = parser.parse_args()

    # Extract text from resume
    print(f"📄 Extracting text from resume: {args.resume}")
    resume_text = extract_text_from_file(args.resume)

    if not resume_text:
        print("Error: Failed to extract text from resume")
        return

    # Extract text from job description if it's a file
    if os.path.isfile(args.job_description):
        print(
            f"📄 Extracting text from job description: {args.job_description}")
        job_description = extract_text_from_file(args.job_description)

        if not job_description:
            print("Error: Failed to extract text from job description")
            return
    else:
        # Assume the job description is directly provided as text
        job_description = args.job_description

    # Create initial state
    initial_state = {
        "candidate_name": urllib.parse.unquote(args.candidate_name) if args.candidate_name else "",
        "resume_text": resume_text,
        "job_description": job_description
    }

    # Create and run the graph
    print("🔄 Creating agent graph...")
    graph = create_graph()

    print("🚀 Running recruiting agent...")
    start_time = time.time()

    # Execute the graph
    result = graph.invoke(initial_state)

    end_time = time.time()
    print(f"✅ Agent completed in {end_time - start_time:.2f} seconds")

    # Format and output the results
    formatted_output = format_output(result["fit_assessment"])

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(formatted_output)

    print(f"✅ Assessment saved to {args.output}")
    print("\nSummary:")
    print(f"- Fit Score: {result['fit_assessment']['fit_score']}")

    # Also save the full structured results
    with open(f"{os.path.splitext(args.output)[0]}_full.json", "w", encoding="utf-8") as f:
        json.dump({
            "job_description": result["jd_structured"],
            "resume": result["resume_structured"],
            "web_research": result["web_structured"],
            "assessment": result["fit_assessment"]
        }, f, indent=2)

    print(
        f"✅ Full structured results saved to {os.path.splitext(args.output)[0]}_full.json")


if __name__ == "__main__":
    main()
