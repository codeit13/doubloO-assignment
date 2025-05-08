from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse
import tempfile
import shutil
from typing import Union, Any
from recruiter_agent.graph import run_recruiting_assistant, extract_text_from_file
from models.run_history import AgentRun, AgentRunInput, AgentRunOutput

router = APIRouter()

@router.post("/run-agent/")
async def run_agent(
    candidate_name: str = Form(...),
    resume: Union[UploadFile, str] = Form(...),
    job_description: Union[UploadFile, str] = Form(...),
):
    # Process resume based on its type
    if isinstance(resume, UploadFile):
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=resume.filename[-5:]) as tmp_resume:
                shutil.copyfileobj(resume.file, tmp_resume)
                resume_path = tmp_resume.name
            resume_text = extract_text_from_file(resume_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process resume file: {str(e)}")
    elif isinstance(resume, str):
        resume_text = resume
    else:
        raise HTTPException(status_code=400, detail="Resume must be either a file or text")

    # Process job description based on its type
    if isinstance(job_description, UploadFile):
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=job_description.filename[-5:]) as tmp_jd:
                shutil.copyfileobj(job_description.file, tmp_jd)
                jd_path = tmp_jd.name
            job_description_text = extract_text_from_file(jd_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process job description file: {str(e)}")
    elif isinstance(job_description, str):
        job_description_text = job_description
    else:
        raise HTTPException(status_code=400, detail="Job description must be either a file or text")

    # Run the recruiting agent
    try:
        result = run_recruiting_assistant(candidate_name, resume_text, job_description_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # Store the run in MongoDB
    agent_run = AgentRun(
        input=AgentRunInput(
            candidate_name=candidate_name,
            resume_text=resume_text,
            job_description=job_description_text
        ),
        output=AgentRunOutput(
            jd_structured=result.get("jd_structured"),
            resume_structured=result.get("resume_structured"),
            web_structured=result.get("web_structured"),
            fit_assessment=result.get("fit_assessment")
        )
    )
    await agent_run.insert()

    return JSONResponse(content=result)

@router.get("/runs/")
async def get_latest_runs(limit: int = Query(10, ge=1, le=100)):
    runs = await AgentRun.find_all().sort("-timestamp").limit(limit).to_list()
    return [run.dict() for run in runs]
