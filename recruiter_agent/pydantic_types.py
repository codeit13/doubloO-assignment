from datetime import date
from pydantic import BaseModel, Field, EmailStr, HttpUrl
from typing import Optional, List, Union

# ── 1. Job Description


class JobDescription(BaseModel):
    title: str = Field(..., description="Job title")
    location: Optional[str] = Field(None, description="Job location")
    responsibilities: List[str] = Field(...,
                                        description="Key responsibilities")
    required_qualifications: List[str] = Field(
        ..., description="Must‑have quals")
    preferred_qualifications: Optional[List[str]] = Field(
        None, description="Nice‑to‑have quals"
    )
    top_skills: List[str] = Field(..., description="Extracted skill keywords")

# ── 2. Resume ───────────────────────────────────────────────────────────────────


class Personal(BaseModel):
    name: str = Field(..., description="Candidate full name")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Contact number")
    work_experience: Optional[float] = Field(
        None, description="Years of work experience")


class EducationEntry(BaseModel):
    degree: str = Field(..., description="Degree and field")
    institution: str = Field(..., description="University/College name")
    start_year: Optional[int] = Field(None, description="Start year")
    end_year: Optional[int] = Field(None, description="End year")


class ExperienceEntry(BaseModel):
    title: str = Field(..., description="Role title")
    company: str = Field(..., description="Company name")
    start_date: Optional[str] = Field(
        None, description="Start date in YYYY-MM-DD format")
    end_date: Optional[str] = Field(
        None, description="End date in YYYY-MM-DD format")
    description: Optional[str] = Field(None, description="Brief summary")
    location: Optional[str] = Field(None, description="Location")


class Resume(BaseModel):
    personal: Personal
    education: List[EducationEntry] = Field(...,
                                            description="Education history")
    experience: List[ExperienceEntry] = Field(...,
                                              description="Work experience")
    skills: List[str] = Field(..., description="List of skills")
    certifications: Optional[List[str]] = Field(
        None, description="Certifications")
    projects: Optional[List[str]] = Field(None, description="Project titles")

# ── 3. Web Research ────────────────────────────────────────────────────────────


class GitHubRepo(BaseModel):
    name: str = Field(..., description="Repository name")
    url: str = Field(..., description="Repo URL")
    description: Optional[str] = Field(
        None, description="Repository description")
    stars: Optional[int] = Field(None, description="Number of stars")
    last_updated: Optional[str] = Field(None, description="Last update date")


class BlogEntry(BaseModel):
    title: str = Field(..., description="Blog post title")
    url: str = Field(..., description="Post URL")
    published_date: Optional[str] = Field(None, description="Publication date")
    platform: Optional[str] = Field(None, description="Blog platform")
    summary: Optional[str] = Field(
        None, description="Brief summary of content")


class ConferenceTalk(BaseModel):
    title: str = Field(..., description="Talk title")
    event: Optional[str] = Field(None, description="Conference name")
    year: Optional[int] = Field(None, description="Year of talk")
    url: Optional[str] = Field(None, description="URL to talk or event")
    description: Optional[str] = Field(None, description="Talk description")


class SocialMention(BaseModel):
    platform: str = Field(..., description="Social platform")
    url: str = Field(..., description="Mention URL")
    context_snippet: Optional[str] = Field(None, description="Excerpt")
    date: Optional[str] = Field(None, description="Date of mention")
    username: Optional[str] = Field(None, description="Username on platform")


class WebResearch(BaseModel):
    github_repos: List[str] = Field(..., description="GitHub findings")
    blogs: List[str] = Field(..., description="Blog findings")
    conference_talks: List[str] = Field(..., description="Talks")
    social_mentions: List[str] = Field(
        ..., description="Social mentions")

# ── 4. Fit Assessment ──────────────────────────────────────────────────────────


class ComparisonMatrixEntry(BaseModel):
    skill: str = Field(..., description="Skill name")
    required: bool = Field(..., description="Is it required by JD?")
    candidate_has: bool = Field(..., description="Does candidate have it?")


class ScoreDetails(BaseModel):
    skill_match_percentage: float = Field(..., description="Matched skill %")
    experience_years: float = Field(..., description="Total years exp")
    domain_signal: str = Field(..., description="High/Medium/Low web signal")


class FitAssessment(BaseModel):
    fit_score: str = Field(..., description="Strong/Moderate/Not a Fit")
    score_details: ScoreDetails
    comparison_matrix: List[ComparisonMatrixEntry]
    reasoning: str = Field(..., description="Explanation of the decision")
