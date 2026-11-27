
import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.match_result import MatchResult
from ..models.resume import Resume
from ..models.job import Job
from ..models.user import User

from ..services.matching_service import (
    calculate_match,
    find_missing_skills,
    find_matched_skills,
)

from ..dependencies import (
    get_db,
    require_applicant,
    require_recruiter,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/match",
    tags=["AI Matching"]
)


class ApplicationStatusUpdate(BaseModel):
    status: Literal[
        "pending",
        "shortlisted",
        "rejected",
        "hired"
    ]

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


def parse_skill_list(value):
    """Safely parse stored JSON skill lists."""
    if not value:
        return []

    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []

    if not isinstance(parsed, list):
        return []

    return [
        skill.strip()
        for skill in parsed
        if isinstance(skill, str) and skill.strip()
    ]


@router.post("/{resume_id}/{job_id}")
def match_resume_with_job(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant)
):
    # Only the owner of the resume can use it.
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()

    if resume is None:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    # New applications are allowed only for active jobs.
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.is_active.is_(True)
    ).first()

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found or no longer accepting applications"
        )

    try:
        match_percentage = calculate_match(
            resume.resume_text,
            job.description,
            resume.skills,
            job.required_skills
        )

        missing_skills = find_missing_skills(
            resume.skills,
            job.required_skills
        )

        matched_skills = find_matched_skills(
            resume.skills,
            job.required_skills
        )

    except Exception:
        logger.exception("Resume matching calculation failed.")

        raise HTTPException(
            status_code=500,
            detail="Unable to calculate resume match. Please try again."
        )

    existing_result = db.query(MatchResult).filter(
        MatchResult.resume_id == resume.id,
        MatchResult.job_id == job.id
    ).first()

    if existing_result:
        existing_result.match_percentage = match_percentage
        existing_result.missing_skills = json.dumps(missing_skills)

        # Preserve the applicant's existing application status.
        match_result = existing_result
        result_status = "updated"

    else:
        match_result = MatchResult(
            resume_id=resume.id,
            job_id=job.id,
            match_percentage=match_percentage,
            missing_skills=json.dumps(missing_skills),
            application_status="pending"
        )

        db.add(match_result)
        result_status = "created"

    try:
        db.commit()
        db.refresh(match_result)

    except IntegrityError:
        # Another simultaneous request may have inserted
        # the same resume/job application first.
        db.rollback()

        concurrent_result = db.query(MatchResult).filter(
            MatchResult.resume_id == resume.id,
            MatchResult.job_id == job.id
        ).first()

        if concurrent_result is None:
            logger.exception(
                "Unique constraint violation without an existing application."
            )

            raise HTTPException(
                status_code=500,
                detail="Unable to save resume matching result."
            )

        # Reuse the existing application instead of creating a duplicate.
        concurrent_result.match_percentage = match_percentage
        concurrent_result.missing_skills = json.dumps(missing_skills)

        # Preserve its application status.
        match_result = concurrent_result
        result_status = "updated"

        try:
            db.commit()
            db.refresh(match_result)

        except SQLAlchemyError:
            db.rollback()
            logger.exception(
                "Updating concurrently created application failed."
            )

            raise HTTPException(
                status_code=500,
                detail="Unable to save resume matching result."
            )

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Saving resume matching result failed.")

        raise HTTPException(
            status_code=500,
            detail="Unable to save resume matching result."
        )

    return {
        "message": "Resume matched with job successfully",
        "result_status": result_status,
        "match_id": match_result.id,
        "resume_id": resume.id,
        "job_id": job.id,
        "job_title": job.title,
        "company": job.company,
        "match_percentage": round(
            float(match_result.match_percentage), 2
        ),
        "missing_skills": missing_skills,
        "matched_skills": matched_skills,
        "application_status": match_result.application_status
    }


@router.get("/history/{resume_id}")
def get_match_history(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant)
):
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()

    if resume is None:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    results = (
        db.query(MatchResult, Job)
        .join(Job, MatchResult.job_id == Job.id)
        .filter(MatchResult.resume_id == resume_id)
        .order_by(MatchResult.created_at.desc())
        .all()
    )

    history = []

    for result, job in results:
        matched_skills = find_matched_skills(
            resume.skills,
            job.required_skills
        )

        history.append({
            "match_id": result.id,
            "job_id": result.job_id,
            "job_title": job.title,
            "company": job.company,
            "match_percentage": result.match_percentage,
            "application_status": result.application_status,
            "missing_skills": parse_skill_list(
                result.missing_skills
            ),
            "matched_skills": matched_skills,
            "created_at": result.created_at
        })

    return history


@router.get("/recruiter/applicants")
def get_recruiter_applicants(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter)
):
    # Archived jobs remain visible to their owning recruiter.
    results = (
        db.query(MatchResult, Resume, Job, User)
        .join(Resume, MatchResult.resume_id == Resume.id)
        .join(Job, MatchResult.job_id == Job.id)
        .join(User, Resume.user_id == User.id)
        .filter(Job.user_id == current_user.id)
        .order_by(MatchResult.created_at.desc())
        .all()
    )

    applicants = []

    for result, resume, job, applicant in results:
        missing_skills = parse_skill_list(
            result.missing_skills
        )

        matched_skills = find_matched_skills(
            resume.skills,
            job.required_skills
        )

        applicants.append({
            "match_id": result.id,

            "applicant_id": applicant.id,
            "applicant_name": applicant.name,
            "applicant_email": applicant.email,

            "resume_id": resume.id,
            "resume_filename": resume.filename,

            "job_id": job.id,
            "job_title": job.title,
            "company": job.company,
            "job_is_active": job.is_active,

            "match_percentage": round(
                float(result.match_percentage), 2
            ),

            "matched_skills": matched_skills,
            "missing_skills": missing_skills,

            "application_status": result.application_status,
            "matched_at": result.created_at
        })

    return {
        "total_applicants": len(applicants),
        "applicants": applicants
    }


@router.patch("/recruiter/status/{match_id}")
def update_application_status(
    match_id: int,
    status_data: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter)
):
    match_result = (
        db.query(MatchResult)
        .join(Job, MatchResult.job_id == Job.id)
        .filter(
            MatchResult.id == match_id,
            Job.user_id == current_user.id
        )
        .first()
    )

    if match_result is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found for your jobs"
        )

    match_result.application_status = status_data.status

    try:
        db.commit()
        db.refresh(match_result)

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Application status update failed.")

        raise HTTPException(
            status_code=500,
            detail="Unable to update application status."
        )

    return {
        "message": "Application status updated successfully",
        "match_id": match_result.id,
        "application_status": match_result.application_status
    }


@router.get("/applicant/status")
def get_applicant_application_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant)
):
    results = (
        db.query(MatchResult, Resume, Job)
        .join(Resume, MatchResult.resume_id == Resume.id)
        .join(Job, MatchResult.job_id == Job.id)
        .filter(Resume.user_id == current_user.id)
        .order_by(MatchResult.created_at.desc())
        .all()
    )

    applications = []

    for result, resume, job in results:
        applications.append({
            "match_id": result.id,
            "resume_id": resume.id,
            "resume_filename": resume.filename,
            "job_id": job.id,
            "job_title": job.title,
            "company": job.company,
            "job_is_active": job.is_active,
            "match_percentage": round(
                float(result.match_percentage), 2
            ),
            "application_status": result.application_status,
            "applied_at": result.created_at
        })

    return {
        "total_applications": len(applications),
        "applications": applications
    }
