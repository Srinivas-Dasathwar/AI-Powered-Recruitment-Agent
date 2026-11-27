from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import json
import re


# Load AI model once when the application starts
model = SentenceTransformer("all-MiniLM-L6-v2")


def calculate_semantic_match(resume_text: str, job_description: str) -> float:
    """
    Calculate semantic similarity between resume text and job description.
    Returns a percentage from 0 to 100.
    """
    if not resume_text or not job_description:
        return 0.0

    resume_embedding = model.encode([resume_text])
    job_embedding = model.encode([job_description])

    similarity = cosine_similarity(
        resume_embedding,
        job_embedding
    )[0][0]

    # Keep the score inside the valid percentage range
    similarity = max(0.0, min(1.0, float(similarity)))

    return round(similarity * 100, 2)


def _parse_resume_skills(resume_skills):
    """
    Convert stored JSON skills into a normalized Python list.
    """
    if isinstance(resume_skills, str):
        try:
            resume_skills = json.loads(resume_skills)
        except json.JSONDecodeError:
            return []

    if not isinstance(resume_skills, list):
        return []

    return [
        str(skill).strip().lower()
        for skill in resume_skills
        if str(skill).strip()
    ]


def _parse_required_skills(required_skills):
    """
    Convert comma-separated required skills into a normalized list.
    """
    if isinstance(required_skills, str):
        return [
            skill.strip().lower()
            for skill in required_skills.split(",")
            if skill.strip()
        ]

    if isinstance(required_skills, list):
        return [
            str(skill).strip().lower()
            for skill in required_skills
            if str(skill).strip()
        ]

    return []


def find_missing_skills(resume_skills, required_skills):
    """
    Return required skills that are not present in the resume.
    """
    resume_skill_list = _parse_resume_skills(resume_skills)
    required_skill_list = _parse_required_skills(required_skills)

    return [
        skill
        for skill in required_skill_list
        if skill not in resume_skill_list
    ]


def find_matched_skills(resume_skills, required_skills):
    """
    Return required skills that are present in the resume.
    """
    resume_skill_list = _parse_resume_skills(resume_skills)
    required_skill_list = _parse_required_skills(required_skills)

    return [
        skill
        for skill in required_skill_list
        if skill in resume_skill_list
    ]


def calculate_skill_match(resume_skills, required_skills) -> float:
    """
    Calculate required-skill coverage as a percentage.
    """
    required_skill_list = _parse_required_skills(required_skills)

    if not required_skill_list:
        return 0.0

    matched_skills = find_matched_skills(
        resume_skills,
        required_skill_list
    )

    return round(
        len(matched_skills) / len(required_skill_list) * 100,
        2
    )


def calculate_match(resume_text, job_description, resume_skills=None, required_skills=None):
    """
    Calculate a combined match score.

    Weighting:
    - 70% skill coverage
    - 30% semantic similarity

    If skill data is unavailable, use semantic similarity only.
    """
    semantic_score = calculate_semantic_match(
        resume_text,
        job_description
    )

    if resume_skills is None or required_skills is None:
        return semantic_score

    skill_score = calculate_skill_match(
        resume_skills,
        required_skills
    )

    combined_score = (
        skill_score * 0.70
        + semantic_score * 0.30
    )

    return round(combined_score, 2)