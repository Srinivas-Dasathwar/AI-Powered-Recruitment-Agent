
from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from ..database import Base


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, index=True)

    match_id = Column(
        Integer,
        ForeignKey("match_results.id"),
        nullable=False,
        index=True
    )

    applicant_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    recruiter_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    questions_and_answers = Column(
        Text,
        nullable=False
    )

    evaluation = Column(
        Text,
        nullable=False
    )

    overall_score = Column(
        Float,
        nullable=True
    )

    recommendation = Column(
        String(100),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
