import re


# Canonical skill names mapped to possible spellings and aliases
SKILL_ALIASES = {
    "python": [
        "python",
        "python3",
    ],
    "java": [
        "java",
    ],
    "c++": [
        "c++",
        "cpp",
    ],
    "sql": [
        "sql",
    ],
    "mysql": [
        "mysql",
    ],
    "postgresql": [
        "postgresql",
        "postgres",
        "postgre sql",
    ],
    "fastapi": [
        "fastapi",
        "fast api",
    ],
    "django": [
        "django",
    ],
    "flask": [
        "flask",
    ],
    "react": [
        "react",
        "reactjs",
        "react.js",
    ],
    "javascript": [
        "javascript",
        "js",
        "ecmascript",
    ],
    "typescript": [
        "typescript",
        "ts",
    ],
    "html": [
        "html",
        "html5",
    ],
    "css": [
        "css",
        "css3",
    ],
    "machine learning": [
        "machine learning",
        "machine-learning",
        "ml",
    ],
    "deep learning": [
        "deep learning",
        "deep-learning",
        "dl",
    ],
    "artificial intelligence": [
        "artificial intelligence",
        "ai",
    ],
    "data science": [
        "data science",
    ],
    "data analytics": [
        "data analytics",
        "data analysis",
    ],
    "pandas": [
        "pandas",
    ],
    "numpy": [
        "numpy",
    ],
    "scikit-learn": [
        "scikit-learn",
        "scikit learn",
        "sklearn",
    ],
    "tensorflow": [
        "tensorflow",
    ],
    "pytorch": [
        "pytorch",
        "py torch",
    ],
    "nlp": [
        "nlp",
        "natural language processing",
    ],
    "git": [
        "git",
    ],
    "github": [
        "github",
        "git hub",
    ],
    "docker": [
        "docker",
    ],
    "aws": [
        "aws",
        "amazon web services",
    ],
    "azure": [
        "azure",
        "microsoft azure",
    ],
    "power bi": [
        "power bi",
        "powerbi",
    ],
    "rest api": [
        "rest api",
        "restful api",
        "restful",
        "rest-api",
    ],
    "sqlalchemy": [
        "sqlalchemy",
        "sql alchemy",
    ],
    "mongodb": [
        "mongodb",
        "mongo db",
    ],
    "linux": [
        "linux",
    ],
}


def _contains_skill(text: str, alias: str) -> bool:
    """
    Check whether an alias appears as a complete term.

    Special handling is included for symbols such as '+' and '#',
    which do not work reliably with normal word boundaries.
    """
    escaped_alias = re.escape(alias.lower())

    # Use lookarounds instead of \b so aliases like c++ work correctly.
    pattern = rf"(?<![a-z0-9+#]){escaped_alias}(?![a-z0-9+#])"

    return re.search(pattern, text) is not None


def extract_skills(text: str) -> list[str]:
    """
    Extract canonical skill names from resume text.
    """
    if not text:
        return []

    normalized_text = " ".join(text.lower().split())

    found_skills = []

    for canonical_skill, aliases in SKILL_ALIASES.items():
        for alias in aliases:
            if _contains_skill(normalized_text, alias):
                found_skills.append(canonical_skill)
                break

    return found_skills