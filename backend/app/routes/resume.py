
import json
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pypdf import PdfReader

from ..models.match_result import MatchResult
from ..dependencies import get_db, get_current_user
from ..models.resume import Resume
from ..models.job import Job
from ..services.nlp_service import extract_skills
from ..services.ats_service import calculate_ats_score


router = APIRouter(
    prefix="/resume",
    tags=["Resume"]
)


logger = logging.getLogger(__name__)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

# Project root: AI_Powered_Recruitment_Agent
PROJECT_ROOT = Path(__file__).resolve().parents[3]

UPLOAD_FOLDER = PROJECT_ROOT / "uploads" / "resumes"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_PDF_PAGES = 100

PDF_SIGNATURE = b"%PDF-"


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def require_applicant(current_user):
    if current_user.role != "applicant":
        raise HTTPException(
            status_code=403,
            detail="Only applicants can perform this action."
        )


def parse_skill_list(value):
    if not value:
        return []

    if isinstance(value, list):
        return value

    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return [
            skill.strip()
            for skill in str(value).split(",")
            if skill.strip()
        ]

    if isinstance(parsed, list):
        return parsed

    return []


def resolve_resume_file_path(stored_path):
    """
    Resolve both new absolute paths and legacy relative paths.
    Ensure the resulting path remains inside uploads/resumes.
    """

    if not stored_path:
        raise HTTPException(
            status_code=404,
            detail="Resume file path is unavailable."
        )

    raw_path = Path(stored_path)

    if raw_path.is_absolute():
        file_path = raw_path.resolve()
    else:
        file_path = (PROJECT_ROOT / raw_path).resolve()

    upload_root = UPLOAD_FOLDER.resolve()

    try:
        file_path.relative_to(upload_root)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Access to this file is not allowed."
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Resume PDF file is missing from the server."
        )

    return file_path


def get_recruiter_resume(
    resume_id: int,
    db: Session,
    current_user
):
    if current_user.role != "recruiter":
        raise HTTPException(
            status_code=403,
            detail="Only recruiters can access applicant resumes."
        )

    resume = (
        db.query(Resume)
        .join(
            MatchResult,
            MatchResult.resume_id == Resume.id
        )
        .join(
            Job,
            Job.id == MatchResult.job_id
        )
        .filter(
            Resume.id == resume_id,
            Job.user_id == current_user.id
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found or you are not authorized to access it."
        )

    file_path = resolve_resume_file_path(resume.file_path)

    return resume, file_path


# --------------------------------------------------
# UPLOAD RESUME
# --------------------------------------------------

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    require_applicant(current_user)

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required."
        )

    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    safe_filename = f"{uuid4().hex}.pdf"
    file_path = UPLOAD_FOLDER / safe_filename

    file_size = 0

    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. Maximum size is 5 MB."
                    )

                buffer.write(chunk)

        if file_size < len(PDF_SIGNATURE):
            raise HTTPException(
                status_code=400,
                detail="Invalid or corrupted PDF file."
            )

        with open(file_path, "rb") as pdf_file:
            signature = pdf_file.read(len(PDF_SIGNATURE))

        if signature != PDF_SIGNATURE:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid PDF."
            )

        try:
            reader = PdfReader(str(file_path), strict=True)

            if reader.is_encrypted:
                raise HTTPException(
                    status_code=400,
                    detail="Password-protected PDFs are not supported."
                )

            if len(reader.pages) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="The PDF contains no pages."
                )

            if len(reader.pages) > MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=400,
                    detail="PDF exceeds the maximum limit of 100 pages."
                )

            text = ""

            for page in reader.pages:
                page_text = page.extract_text()

                if page_text:
                    text += page_text + "\n"

        except HTTPException:
            raise

        except Exception:
            raise HTTPException(
                status_code=400,
                detail="The PDF is invalid, corrupted, or cannot be processed."
            )

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract readable text from this PDF."
            )

        skills = extract_skills(text)

        new_resume = Resume(
            user_id=current_user.id,
            filename=Path(file.filename).name,
            file_path=str(file_path.resolve()),
            resume_text=text,
            skills=json.dumps(skills)
        )

        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)

        return {
            "message": "Resume uploaded and analyzed successfully",
            "resume_id": new_resume.id,
            "filename": new_resume.filename,
            "skills": skills
        }

    except HTTPException:
        db.rollback()

        if file_path.exists():
            file_path.unlink(missing_ok=True)

        raise

    except Exception:
        db.rollback()

        logger.exception("Resume upload or processing failed.")

        if file_path.exists():
            file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Could not process the resume."
        )

    finally:
        await file.close()


# --------------------------------------------------
# LIST APPLICANT RESUMES
# --------------------------------------------------

@router.get("/list")
def get_resumes(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    require_applicant(current_user)

    resumes = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
        .all()
    )

    return [
        {
            "resume_id": resume.id,
            "filename": resume.filename,
            "skills": parse_skill_list(resume.skills),
            "created_at": resume.created_at
        }
        for resume in resumes
    ]


# --------------------------------------------------
# VIEW APPLICANT RESUME (RECRUITER)
# --------------------------------------------------

@router.get("/view/{resume_id}")
def view_applicant_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    resume, file_path = get_recruiter_resume(
        resume_id,
        db,
        current_user
    )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=Path(resume.filename).name,
        content_disposition_type="inline"
    )


# --------------------------------------------------
# DOWNLOAD APPLICANT RESUME (RECRUITER)
# --------------------------------------------------

@router.get("/download/{resume_id}")
def download_applicant_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    resume, file_path = get_recruiter_resume(
        resume_id,
        db,
        current_user
    )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=Path(resume.filename).name,
        content_disposition_type="attachment"
    )


# --------------------------------------------------
# ATS SCORE
# --------------------------------------------------

@router.post("/ats-score/{resume_id}/{job_id}")
def calculate_resume_ats_score(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_applicant(current_user)

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found."
        )

    job = (
        db.query(Job)
        .filter(
            Job.id == job_id,
            Job.is_active.is_(True)
        )
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found or no longer accepting applications."
        )

    resume_skills = parse_skill_list(resume.skills)

    result = calculate_ats_score(
        resume_text=resume.resume_text or "",
        resume_skills=resume_skills,
        required_skills=job.required_skills,
    )

    return {
        "message": "ATS score calculated successfully",
        "resume_id": resume.id,
        "job_id": job.id,
        "job_title": job.title,
        "company": job.company,
        **result,
    }


# --------------------------------------------------
# DELETE APPLICANT'S OWN RESUME
# --------------------------------------------------

@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_applicant(current_user)

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found."
        )

    # Preserve applications and interview evaluation history.
    existing_application = (
        db.query(MatchResult.id)
        .filter(MatchResult.resume_id == resume.id)
        .first()
    )

    if existing_application:
        raise HTTPException(
            status_code=409,
            detail=(
                "This resume has application history and cannot be deleted. "
                "This restriction protects application and interview records."
            )
        )

    file_path = None

    try:
        file_path = resolve_resume_file_path(resume.file_path)

    except HTTPException as exc:
        # A missing file should not prevent removal of an unused DB record.
        if exc.status_code != 404:
            raise

    try:
        db.delete(resume)
        db.commit()

    except Exception:
        db.rollback()

        logger.exception("Resume database deletion failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not delete the resume."
        )

    if file_path and file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            logger.exception(
                "Resume database record deleted, but physical file cleanup failed."
            )

    return {
        "message": "Resume deleted successfully"
    }
