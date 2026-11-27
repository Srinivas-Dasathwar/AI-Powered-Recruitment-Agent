
from sqlalchemy import (
    Column,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint
)
from sqlalchemy.sql import func

from ..database import Base


class MatchResult(Base):
    __tablename__ = "match_results"

    __table_args__ = (
        UniqueConstraint(
            "resume_id",
            "job_id",
            name="uq_match_resume_job"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    resume_id = Column(
        Integer,
        ForeignKey("resumes.id"),
        nullable=False
    )

    job_id = Column(
        Integer,
        ForeignKey("jobs.id"),
        nullable=False
    )

    match_percentage = Column(
        Float,
        nullable=False
    )

    missing_skills = Column(
        Text,
        nullable=True
    )

    application_status = Column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
