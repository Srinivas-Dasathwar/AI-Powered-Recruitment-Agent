from matching_service import calculate_match, find_missing_skills


resume_text = """
Python developer with experience in FastAPI,
PostgreSQL, SQL and REST APIs.
"""

job_description = """
Looking for a Python backend developer with
FastAPI, PostgreSQL, SQL, REST API and Docker experience.
"""


resume_skills = [
    "python",
    "fastapi",
    "postgresql",
    "sql"
]

required_skills = "Python, FastAPI, PostgreSQL, SQL, REST API, Docker"


match = calculate_match(
    resume_text,
    job_description
)

missing = find_missing_skills(
    resume_skills,
    required_skills
)


print("Match Percentage:", match, "%")
print("Missing Skills:")

for skill in missing:
    print("-", skill)