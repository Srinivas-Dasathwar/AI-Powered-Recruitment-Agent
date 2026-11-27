from nlp_service import extract_skills


resume_text = """
I am a Python developer with experience in FastAPI,
PostgreSQL, SQL, Machine Learning, Pandas and Git.
"""


skills = extract_skills(resume_text)

print("Detected Skills:")
for skill in skills:
    print("-", skill)