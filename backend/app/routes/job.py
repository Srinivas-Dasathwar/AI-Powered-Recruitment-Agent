
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.job import Job
from ..models.user import User
from ..dependencies import get_db, get_current_user, require_recruiter


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def clean_field(value: str, field_name: str) -> str:
    """Strip whitespace and reject empty values."""
    cleaned = value.strip()

    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} cannot be empty."
        )

    return cleaned


def job_to_dict(job: Job) -> dict:
    return {
        "job_id": job.id,
        "title": job.title,
        "company": job.company,
        "description": job.description,
        "required_skills": job.required_skills,
        "is_active": job.is_active,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_job(
    title: str = Query(..., min_length=1, max_length=150),
    company: str = Query(..., min_length=1, max_length=150),
    description: str = Query(..., min_length=1, max_length=10000),
    required_skills: str = Query(..., min_length=1, max_length=3000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter),
):
    new_job = Job(
        title=clean_field(title, "Title"),
        company=clean_field(company, "Company"),
        description=clean_field(description, "Description"),
        required_skills=clean_field(required_skills, "Required skills"),
        user_id=current_user.id,
        is_active=True,
    )

    try:
        db.add(new_job)
        db.commit()
        db.refresh(new_job)

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Job creation failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create job. Please try again later."
        )

    return {
        "message": "Job created successfully",
        **job_to_dict(new_job),
    }


@router.get("/")
def get_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Job)

    if current_user.role == "recruiter":
        query = query.filter(Job.user_id == current_user.id)

    elif current_user.role == "applicant":
        query = query.filter(Job.is_active.is_(True))

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role"
        )

    jobs = query.order_by(Job.id.desc()).all()

    return [job_to_dict(job) for job in jobs]


@router.put("/{job_id}")
def update_job(
    job_id: int,
    title: str = Query(..., min_length=1, max_length=150),
    company: str = Query(..., min_length=1, max_length=150),
    description: str = Query(..., min_length=1, max_length=10000),
    required_skills: str = Query(..., min_length=1, max_length=3000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or you do not own this job"
        )

    job.title = clean_field(title, "Title")
    job.company = clean_field(company, "Company")
    job.description = clean_field(description, "Description")
    job.required_skills = clean_field(required_skills, "Required skills")

    try:
        db.commit()
        db.refresh(job)

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Job update failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update job. Please try again later."
        )

    return {
        "message": "Job updated successfully",
        **job_to_dict(job),
    }


@router.delete("/{job_id}")
def archive_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or you do not own this job"
        )

    if not job.is_active:
        return {
            "message": "Job is already archived",
            **job_to_dict(job),
        }

    job.is_active = False

    try:
        db.commit()
        db.refresh(job)

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Job archiving failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to archive job. Please try again later."
        )

    return {
        "message": "Job archived successfully",
        **job_to_dict(job),
    }


@router.post("/{job_id}/reactivate")
def reactivate_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_recruiter),
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.user_id == current_user.id,
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or you do not own this job"
        )

    if job.is_active:
        return {
            "message": "Job is already active",
            **job_to_dict(job),
        }

    job.is_active = True

    try:
        db.commit()
        db.refresh(job)

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Job reactivation failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reactivate job. Please try again later."
        )

    return {
        "message": "Job reactivated successfully",
        **job_to_dict(job),
    }
