from datetime import datetime
from typing import Optional, Dict, Any
from beanie import Document
from pydantic import BaseModel, Field

class AgentRunInput(BaseModel):
    candidate_name: str
    resume_text: str
    job_description: str

class AgentRunOutput(BaseModel):
    jd_structured: Optional[Dict[str, Any]] = None
    resume_structured: Optional[Dict[str, Any]] = None
    web_structured: Optional[Dict[str, Any]] = None
    fit_assessment: Optional[Dict[str, Any]] = None
    formatted_output: Optional[str] = None  # Markdown formatted assessment

class AgentRun(Document):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    input: AgentRunInput
    output: AgentRunOutput
    class Settings:
        name = "agent_runs"
