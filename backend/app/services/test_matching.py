from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


model = SentenceTransformer("all-MiniLM-L6-v2")


resume_text = """
Python developer with experience in FastAPI,
PostgreSQL, SQL and REST APIs.
"""


job_text = """
Looking for a Python backend developer with
FastAPI, PostgreSQL, SQL and REST API experience.
"""


resume_embedding = model.encode([resume_text])
job_embedding = model.encode([job_text])


score = cosine_similarity(
    resume_embedding,
    job_embedding
)[0][0]


print("Similarity Score:", score)
print("Match Percentage:", round(score * 100, 2), "%")