from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, BackgroundTasks, status
from fastapi.responses import JSONResponse
import tempfile
import shutil
from typing import Union, Any, Dict, Optional
from recruiter_agent.graph import run_recruiting_assistant, extract_text_from_file
from models.run_history import AgentRun, AgentRunInput, AgentRunOutput
from models.task import Task, TaskStatus
from utils.task_manager import TaskManager

router = APIRouter()

async def process_agent_run(
    candidate_name: str,
    resume_text: str,
    job_description_text: str,
    task_id: str
) -> Dict[str, Any]:
    """Process the agent run in the background"""
    try:
        # Run the recruiting agent
        result = run_recruiting_assistant(candidate_name, resume_text, job_description_text)
        
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
                fit_assessment=result.get("fit_assessment"),
                formatted_output=result.get("formatted_output")  # Include the formatted markdown output
            )
        )
        await agent_run.insert()
        
        # Add the agent run ID to the result
        result["agent_run_id"] = str(agent_run.id)
        return result
    except Exception as e:
        raise e

@router.post("/run-agent/", status_code=status.HTTP_202_ACCEPTED)
async def run_agent(
    background_tasks: BackgroundTasks,
    candidate_name: str = Form(...),
    resume: UploadFile = File(None),
    resume_text: str = Form(None),
    job_description: UploadFile = File(None),
    job_description_text: str = Form(None),
):
    
    # Process resume input
    if resume and resume.filename:
        try:
            # Check if file has content
            if resume.size == 0:
                raise HTTPException(status_code=400, detail="Resume file is empty")
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=resume.filename[-5:]) as tmp_resume:
                shutil.copyfileobj(resume.file, tmp_resume)
                resume_path = tmp_resume.name
            resume_text_content = extract_text_from_file(resume_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process resume file: {str(e)}")
    elif resume_text:
        # Use the provided text directly
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Resume text is empty")
        resume_text_content = resume_text
    else:
        raise HTTPException(status_code=400, detail="Resume is required. Please provide either a file or text.")

    # Process job description input
    if job_description and job_description.filename:
        try:
            # Check if file has content
            if job_description.size == 0:
                raise HTTPException(status_code=400, detail="Job description file is empty")
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=job_description.filename[-5:]) as tmp_jd:
                shutil.copyfileobj(job_description.file, tmp_jd)
                jd_path = tmp_jd.name
            job_description_text_content = extract_text_from_file(jd_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process job description file: {str(e)}")
    elif job_description_text:
        # Use the provided text directly
        if not job_description_text.strip():
            raise HTTPException(status_code=400, detail="Job description text is empty")
        job_description_text_content = job_description_text
    else:
        raise HTTPException(status_code=400, detail="Job description is required. Please provide either a file or text.")

    # Create a new task
    task = await TaskManager.create_task()
    
    # Start the background task
    background_tasks.add_task(
        TaskManager.run_background_task,
        task.task_id,
        process_agent_run,
        candidate_name,
        resume_text_content,
        job_description_text_content,
        task.task_id
    )
    
    # Return the task ID
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"task_id": task.task_id, "status": TaskStatus.PENDING}
    )

@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a task without blocking"""
    # Use find_one instead of get_task to avoid awaiting the entire task
    task = await Task.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    
    response = {
        "task_id": task.task_id,
        "status": task.status,
        "created_at": task.created_at,
        "updated_at": task.updated_at
    }
    
    # Include result if task is completed
    if task.status == TaskStatus.COMPLETED and task.result:
        response["result"] = task.result
    
    # Include error if task failed
    if task.status == TaskStatus.FAILED and task.error:
        response["error"] = task.error
    
    # Include agent_run_id if available
    if task.agent_run_id:
        response["agent_run_id"] = task.agent_run_id
    
    return response

@router.get("/runs/")
async def get_latest_runs(limit: int = Query(10, ge=1, le=100)):
    runs = await AgentRun.find_all().sort("-timestamp").limit(limit).to_list()
    return [run.dict() for run in runs]
