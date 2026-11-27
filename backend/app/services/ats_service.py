import re


COMMON_SECTIONS = [
    "summary",
    "objective",
    "education",
    "experience",
    "work experience",
    "skills",
    "projects",
    "certifications",
]

ACTION_WORDS = [
    "developed",
    "created",
    "implemented",
    "designed",
    "managed",
    "built",
    "improved",
    "analyzed",
    "led",
    "optimized",
    "automated",
    "tested",
]


def calculate_ats_score(
    resume_text: str,
    resume_skills: list[str],
    required_skills: str | None = None,
):
    resume_text_lower = resume_text.lower()

    score = 0
    suggestions = []

    # ---------------------------------
    # 1. Required skills: 40 points
    # ---------------------------------
    required_skill_list = []

    if required_skills:
        required_skill_list = [
            skill.strip().lower()
            for skill in required_skills.split(",")
            if skill.strip()
        ]

    matched_skills = []

    for skill in required_skill_list:
        if skill in resume_text_lower or skill in resume_skills:
            matched_skills.append(skill)

    if required_skill_list:
        skill_score = round(
            (len(matched_skills) / len(required_skill_list)) * 40
        )
    else:
        skill_score = 40

    score += skill_score

    missing_skills = [
        skill
        for skill in required_skill_list
        if skill not in matched_skills
    ]

    if missing_skills:
        suggestions.append(
            "Consider adding these relevant skills: "
            + ", ".join(missing_skills)
        )

    # ---------------------------------
    # 2. Resume sections: 25 points
    # ---------------------------------
    found_sections = [
        section
        for section in COMMON_SECTIONS
        if section in resume_text_lower
    ]

    section_score = min(
        round((len(found_sections) / len(COMMON_SECTIONS)) * 25),
        25,
    )

    score += section_score

    if "experience" not in resume_text_lower:
        suggestions.append("Add a work experience section.")

    if "education" not in resume_text_lower:
        suggestions.append("Add an education section.")

    if "skills" not in resume_text_lower:
        suggestions.append("Add a clearly labeled skills section.")

    # ---------------------------------
    # 3. Resume length: 15 points
    # ---------------------------------
    word_count = len(resume_text.split())

    if 300 <= word_count <= 1000:
        length_score = 15
    elif 150 <= word_count < 300 or 1000 < word_count <= 1500:
        length_score = 10
    elif word_count > 0:
        length_score = 5
    else:
        length_score = 0

    score += length_score

    if word_count < 300:
        suggestions.append(
            "Your resume may be too short. Add relevant achievements and projects."
        )

    if word_count > 1500:
        suggestions.append(
            "Your resume may be too long. Consider making it more concise."
        )

    # ---------------------------------
    # 4. Contact information: 10 points
    # ---------------------------------
    has_email = bool(
        re.search(
            r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
            resume_text,
        )
    )

    has_phone = bool(
        re.search(
            r"(\+?\d[\d\s().-]{8,}\d)",
            resume_text,
        )
    )

    contact_score = 0

    if has_email:
        contact_score += 5

    if has_phone:
        contact_score += 5

    score += contact_score

    if not has_email:
        suggestions.append("Add a professional email address.")

    if not has_phone:
        suggestions.append("Add a phone number.")

    # ---------------------------------
    # 5. Action words: 10 points
    # ---------------------------------
    found_action_words = [
        word
        for word in ACTION_WORDS
        if re.search(r"\b" + re.escape(word) + r"\b", resume_text_lower)
    ]

    action_score = min(
        round((len(found_action_words) / 5) * 10),
        10,
    )

    score += action_score

    if len(found_action_words) < 3:
        suggestions.append(
            "Use more action words such as developed, implemented, designed, or improved."
        )

    return {
        "ats_score": min(score, 100),
        "word_count": word_count,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "found_sections": found_sections,
        "suggestions": suggestions,
    }