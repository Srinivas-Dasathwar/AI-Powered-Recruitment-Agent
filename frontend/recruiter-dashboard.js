
const API_URL = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

// ==================================================
// AUTHENTICATION
// ==================================================

function token() {
  return localStorage.getItem("access_token");
}

function headers() {
  return {
    Authorization: `Bearer ${token()}`
  };
}

// ==================================================
// NOTIFICATIONS
// ==================================================

function showMessage(text, type = "success") {
  const element = $("message");

  if (!element) return;

  element.textContent = text;
  element.classList.remove("success", "error");
  element.classList.add("message", type);

  element.setAttribute(
    "role",
    type === "error" ? "alert" : "status"
  );

  element.hidden = false;
}

// ==================================================
// LOADING BUTTON HELPER
// ==================================================

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = loadingText;

  return () => {
    button.disabled = false;
    button.textContent = originalText;
  };
}

// ==================================================
// API HELPER
// ==================================================

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");

    window.location.href = "login.html";

    throw new Error("Please log in again.");
  }

  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(", ")
      : data.detail;

    throw new Error(detail || "Request failed.");
  }

  return data;
}

// ==================================================
// GENERAL HELPERS
// ==================================================

function addText(parent, tag, text, className = "") {
  const element = document.createElement(tag);

  element.textContent = text ?? "";

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);

  return element;
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = className;
  button.textContent = label;

  button.addEventListener("click", onClick);

  return button;
}

// ==================================================
// APPLICATION STATUSES
// ==================================================

const APPLICATION_STATUSES = [
  "pending",
  "shortlisted",
  "rejected",
  "hired"
];

function formatStatus(status) {
  const normalized = String(status || "pending").toLowerCase();

  return normalized.charAt(0).toUpperCase() +
    normalized.slice(1);
}

function createStatusSelect(currentStatus) {
  const select = document.createElement("select");

  select.className = "application-status-select";
  select.setAttribute("aria-label", "Application status");

  APPLICATION_STATUSES.forEach((status) => {
    const option = document.createElement("option");

    option.value = status;
    option.textContent = formatStatus(status);

    select.appendChild(option);
  });

  select.value = APPLICATION_STATUSES.includes(
    String(currentStatus || "").toLowerCase()
  )
    ? String(currentStatus).toLowerCase()
    : "pending";

  return select;
}

// ==================================================
// RECRUITER STATISTICS
// ==================================================

function updateJobStatistics(jobs) {
  const count = Array.isArray(jobs) ? jobs.length : 0;

  if ($("totalJobsStat")) {
    $("totalJobsStat").textContent = count;
  }

  if ($("jobCount")) {
    $("jobCount").textContent = count;
  }
}

function updateApplicationStatistics(applicants) {
  const applications = Array.isArray(applicants)
    ? applicants
    : [];

  const counts = {
    total: applications.length,
    pending: 0,
    shortlisted: 0,
    rejected: 0,
    hired: 0
  };

  applications.forEach((applicant) => {
    const status = String(
      applicant.application_status || "pending"
    ).toLowerCase();

    if (APPLICATION_STATUSES.includes(status)) {
      counts[status]++;
    } else {
      counts.pending++;
    }
  });

  if ($("totalApplicationsStat")) {
    $("totalApplicationsStat").textContent = counts.total;
  }

  if ($("pendingStat")) {
    $("pendingStat").textContent = counts.pending;
  }

  if ($("shortlistedStat")) {
    $("shortlistedStat").textContent = counts.shortlisted;
  }

  if ($("rejectedStat")) {
    $("rejectedStat").textContent = counts.rejected;
  }

  if ($("hiredStat")) {
    $("hiredStat").textContent = counts.hired;
  }
}

// ==================================================
// DISPLAY SKILLS
// ==================================================

function displaySkills(parent, title, skills) {
  addText(parent, "h4", title);

  const container = document.createElement("div");
  container.className = "skills-list";

  if (!Array.isArray(skills) || skills.length === 0) {
    addText(container, "span", "None");
  } else {
    skills.forEach((skill) => {
      const badge = document.createElement("span");

      badge.className = "skill-badge";
      badge.textContent = skill;

      container.appendChild(badge);
    });
  }

  parent.appendChild(container);
}

// ==================================================
// AI APPLICANT ANALYSIS
// ==================================================

async function analyzeApplicant(matchId, button, resultContainer) {
  if (!matchId) {
    showMessage("Match ID is missing.", "error");
    return;
  }

  const restoreButton = setButtonLoading(
    button,
    "Analyzing with AI..."
  );

  resultContainer.replaceChildren();

  addText(
    resultContainer,
    "p",
    "AI is reviewing the applicant's resume and job requirements...",
    "ai-loading"
  );

  try {
    const data = await api(
      `/recruiter-agent/analyze-applicant/${encodeURIComponent(matchId)}`,
      { method: "POST" }
    );

    resultContainer.replaceChildren();

    addText(resultContainer, "h4", "AI Applicant Analysis");

    addText(
      resultContainer,
      "p",
      `Applicant: ${data.applicant_name || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Position: ${data.job_title || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Match Score: ${Number(data.match_percentage || 0).toFixed(2)}%`
    );

    addText(
      resultContainer,
      "p",
      `Application Status: ${formatStatus(data.application_status)}`
    );

    const analysis = addText(
      resultContainer,
      "div",
      data.ai_analysis || "The AI did not return an analysis.",
      "ai-analysis-text"
    );

    analysis.style.whiteSpace = "pre-wrap";

    addText(
      resultContainer,
      "p",
      "Note: AI analysis is advisory only. Verify actual qualifications and make hiring decisions through human review.",
      "ai-disclaimer"
    );

    showMessage("AI applicant analysis completed successfully.");

  } catch (error) {
    resultContainer.replaceChildren();

    addText(
      resultContainer,
      "p",
      `AI analysis failed: ${error.message}`
    );

    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// AI INTERVIEW QUESTION GENERATOR
// ==================================================

async function generateInterviewQuestions(
  matchId,
  button,
  resultContainer,
  evaluationInput
) {
  if (!matchId) {
    showMessage("Match ID is missing.", "error");
    return;
  }

  const restoreButton = setButtonLoading(
    button,
    "Generating Questions..."
  );

  resultContainer.replaceChildren();

  addText(
    resultContainer,
    "p",
    "Ollama AI is preparing interview questions...",
    "interview-loading"
  );

  try {
    const data = await api(
      `/recruiter-agent/generate-interview-questions/${encodeURIComponent(matchId)}`,
      { method: "POST" }
    );

    resultContainer.replaceChildren();

    addText(
      resultContainer,
      "h4",
      "AI-Generated Interview Questions"
    );

    addText(
      resultContainer,
      "p",
      `Applicant: ${data.applicant_name || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Position: ${data.job_title || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Company: ${data.company || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Match Score: ${Number(data.match_percentage || 0).toFixed(2)}%`
    );

    const questionsText = String(
      data.interview_questions || ""
    );

    if (!questionsText.trim()) {
      addText(
        resultContainer,
        "p",
        "The AI did not return any interview questions."
      );
      return;
    }

    const questionDisplay = addText(
      resultContainer,
      "div",
      questionsText,
      "interview-questions-text"
    );

    questionDisplay.style.whiteSpace = "pre-wrap";
    questionDisplay.setAttribute("tabindex", "0");

    const copyButton = makeButton(
      "Copy Questions",
      "copy-questions-button",
      async () => {
        const restoreCopyButton = setButtonLoading(
          copyButton,
          "Copying..."
        );

        try {
          await copyTextToClipboard(questionsText);
          showMessage("Interview questions copied successfully.");
        } catch (error) {
          showMessage("Could not copy automatically.", "error");
        } finally {
          restoreCopyButton();
        }
      }
    );

    resultContainer.appendChild(copyButton);

    evaluationInput.value =
      questionsText +
      "\n\n" +
      "==================================================\n" +
      "APPLICANT ANSWERS\n" +
      "==================================================\n\n" +
      "For each question, enter the applicant's actual answer below.\n\n" +
      "Example:\n" +
      "Applicant Answer: [Enter the applicant's answer here]\n";

    addText(
      resultContainer,
      "p",
      "Generated questions have been added to the Interview Evaluation text area. Enter the applicant's actual answers there."
    );

    addText(
      resultContainer,
      "p",
      "Review and adapt generated questions to the role. Evaluate applicants fairly using consistent, job-related criteria.",
      "interview-disclaimer"
    );

    showMessage("Interview questions generated successfully.");

  } catch (error) {
    resultContainer.replaceChildren();

    addText(
      resultContainer,
      "p",
      `Question generation failed: ${error.message}`
    );

    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// COPY TEXT TO CLIPBOARD
// ==================================================

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");

  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

// ==================================================
// INTERVIEW EVALUATION HISTORY
// ==================================================

function getEvaluationRecords(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.evaluations)) {
    return data.evaluations;
  }

  if (Array.isArray(data?.history)) {
    return data.history;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function formatEvaluationDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function displayEvaluationRecord(evaluation, index, total) {
  const card = document.createElement("article");
  card.className = "item evaluation-history-card";

  addText(
    card,
    "h4",
    `Evaluation #${total - index}`
  );

  addText(
    card,
    "p",
    `Evaluation ID: ${evaluation.evaluation_id ?? evaluation.id ?? "Not available"}`
  );

  const score = evaluation.overall_score;

  addText(
    card,
    "p",
    `Overall Score: ${
      score !== null && score !== undefined && score !== ""
        ? `${score}/100`
        : "Not available"
    }`
  );

  const recommendation = evaluation.recommendation ??
    evaluation.hiring_recommendation ??
    "Not available";

  addText(
    card,
    "p",
    `Recommendation: ${recommendation}`
  );

  addText(
    card,
    "p",
    `Evaluated On: ${formatEvaluationDate(
      evaluation.created_at ?? evaluation.evaluated_at
    )}`
  );

  const details = document.createElement("details");
  details.className = "evaluation-details";

  const summary = document.createElement("summary");
  summary.textContent = "View Full Evaluation";

  details.appendChild(summary);

  addText(
    details,
    "h5",
    "Interview Questions and Applicant Answers"
  );

  const questions = addText(
    details,
    "div",
    evaluation.questions_and_answers ??
      evaluation.interview_questions_and_answers ??
      "No questions and answers available.",
    "evaluation-questions-text"
  );

  questions.style.whiteSpace = "pre-wrap";

  addText(details, "h5", "AI Evaluation");

  const aiEvaluation = addText(
    details,
    "div",
    evaluation.evaluation ??
      evaluation.ai_evaluation ??
      "No AI evaluation available.",
    "evaluation-ai-text"
  );

  aiEvaluation.style.whiteSpace = "pre-wrap";

  card.appendChild(details);

  return card;
}

async function loadInterviewEvaluationHistory(matchId, container) {
  if (!matchId || !container) return;

  container.replaceChildren();

  addText(
    container,
    "p",
    "Loading interview evaluation history..."
  );

  try {
    const data = await api(
      `/recruiter-agent/interview-evaluations/${encodeURIComponent(matchId)}`
    );

    container.replaceChildren();

    addText(
      container,
      "h4",
      "Previous Interview Evaluations"
    );

    addText(
      container,
      "p",
      `Applicant: ${data.applicant_name || "Not available"}`
    );

    addText(
      container,
      "p",
      `Position: ${data.job_title || "Not available"}`
    );

    addText(
      container,
      "p",
      `Company: ${data.company || "Not available"}`
    );

    const evaluations = getEvaluationRecords(data);

    addText(
      container,
      "p",
      `Total Evaluations: ${data.total_evaluations ?? evaluations.length}`
    );

    if (evaluations.length === 0) {
      addText(
        container,
        "p",
        "No previous interview evaluations found."
      );
      return;
    }

    evaluations.forEach((evaluation, index) => {
      container.appendChild(
        displayEvaluationRecord(
          evaluation,
          index,
          evaluations.length
        )
      );
    });

  } catch (error) {
    container.replaceChildren();

    addText(
      container,
      "p",
      `Could not load evaluation history: ${error.message}`
    );
  }
}

// ==================================================
// REFRESH INTERVIEW HISTORY
// ==================================================

async function refreshInterviewHistory(matchId, container) {
  if (!container) return;

  await loadInterviewEvaluationHistory(matchId, container);
}

// ==================================================
// AI INTERVIEW EVALUATION
// ==================================================

async function evaluateInterview(
  matchId,
  button,
  evaluationInput,
  resultContainer,
  historyContainer = null
) {
  if (!matchId) {
    showMessage("Match ID is missing.", "error");
    return;
  }

  const questionsAndAnswers = evaluationInput.value.trim();

  if (questionsAndAnswers.length < 20) {
    showMessage(
      "Please enter interview questions and applicant answers first.",
      "error"
    );

    evaluationInput.focus();
    return;
  }

  if (
    !questionsAndAnswers.toLowerCase().includes("applicant answer:")
  ) {
    showMessage(
      "Please include 'Applicant Answer:' and enter the applicant's answers.",
      "error"
    );

    evaluationInput.focus();
    return;
  }

  const restoreButton = setButtonLoading(
    button,
    "Evaluating Interview..."
  );

  resultContainer.replaceChildren();

  addText(
    resultContainer,
    "p",
    "Ollama AI is evaluating the applicant's answers. This may take a little time...",
    "interview-loading"
  );

  try {
    const data = await api(
      `/recruiter-agent/evaluate-interview/${encodeURIComponent(matchId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          questions_and_answers: questionsAndAnswers
        })
      }
    );

    resultContainer.replaceChildren();

    addText(
      resultContainer,
      "h3",
      "AI Interview Evaluation Results"
    );

    addText(
      resultContainer,
      "p",
      `Applicant: ${data.applicant_name || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Position: ${data.job_title || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Company: ${data.company || "Not available"}`
    );

    addText(
      resultContainer,
      "p",
      `Resume Match Score: ${Number(
        data.resume_match_percentage ?? data.match_percentage ?? 0
      ).toFixed(2)}%`
    );

    if (
      data.overall_score !== undefined &&
      data.overall_score !== null &&
      data.overall_score !== ""
    ) {
      addText(
        resultContainer,
        "p",
        `Interview Score: ${data.overall_score}/100`
      );
    }

    if (data.recommendation) {
      addText(
        resultContainer,
        "p",
        `Recommendation: ${data.recommendation}`
      );
    }

    const evaluationText = addText(
      resultContainer,
      "div",
      data.evaluation || "No evaluation was returned.",
      "interview-evaluation-text"
    );

    evaluationText.style.whiteSpace = "pre-wrap";
    evaluationText.setAttribute("tabindex", "0");

    const copyEvaluationButton = makeButton(
      "Copy Evaluation",
      "copy-questions-button",
      async () => {
        const restoreCopyButton = setButtonLoading(
          copyEvaluationButton,
          "Copying..."
        );

        try {
          await copyTextToClipboard(
            `Applicant: ${data.applicant_name || ""}\n` +
            `Position: ${data.job_title || ""}\n` +
            `Interview Score: ${data.overall_score ?? "Not available"}\n` +
            `Recommendation: ${data.recommendation || "Not available"}\n\n` +
            (data.evaluation || "")
          );

          showMessage("Interview evaluation copied successfully.");

        } catch (error) {
          showMessage(
            "Could not copy the evaluation. Please copy it manually.",
            "error"
          );

        } finally {
          restoreCopyButton();
        }
      }
    );

    resultContainer.appendChild(copyEvaluationButton);

    addText(
      resultContainer,
      "p",
      "Important: AI evaluation is decision support only. The recruiter must review the answers and make the final hiring decision.",
      "interview-disclaimer"
    );

    showMessage("AI interview evaluation completed successfully.");

    // Automatically refresh saved history after evaluation.

    if (historyContainer) {
      await refreshInterviewHistory(
        matchId,
        historyContainer
      );
    }

  } catch (error) {
    resultContainer.replaceChildren();

    addText(
      resultContainer,
      "p",
      `Interview evaluation failed: ${error.message}`
    );

    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// EDIT JOB
// ==================================================

async function editJob(job, button) {
  const title = prompt("Edit job title:", job.title);
  if (title === null) return;

  const company = prompt("Edit company:", job.company);
  if (company === null) return;

  const description = prompt(
    "Edit job description:",
    job.description
  );
  if (description === null) return;

  const requiredSkills = prompt(
    "Edit required skills (comma-separated):",
    job.required_skills || ""
  );
  if (requiredSkills === null) return;

  if (!title.trim() || !company.trim() || !description.trim()) {
    showMessage(
      "Title, company, and description are required.",
      "error"
    );
    return;
  }

  const params = new URLSearchParams({
    title: title.trim(),
    company: company.trim(),
    description: description.trim(),
    required_skills: requiredSkills.trim()
  });

  const restoreButton = setButtonLoading(button, "Updating...");

  try {
    const data = await api(
      `/jobs/${job.job_id}?${params.toString()}`,
      { method: "PUT" }
    );

    showMessage(data.message || "Job updated successfully!");

    await refreshDashboard();

  } catch (error) {
    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// DELETE JOB
// ==================================================

async function deleteJob(job, button) {
  const confirmed = confirm(
    `Delete "${job.title}" at ${job.company}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  const restoreButton = setButtonLoading(button, "Deleting...");

  try {
    const data = await api(`/jobs/${job.job_id}`, {
      method: "DELETE"
    });

    showMessage(data.message || "Job deleted successfully!");

    await refreshDashboard();

  } catch (error) {
    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// LOAD JOBS
// ==================================================

async function loadJobs() {
  try {
    const jobs = await api("/jobs/");

    updateJobStatistics(jobs);

    const list = $("jobsList");
    if (!list) return;

    list.replaceChildren();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      addText(list, "p", "No jobs have been posted yet.");
      return;
    }

    jobs.forEach((job) => {
      const item = document.createElement("article");
      item.className = "item";

      addText(item, "h3", job.title);
      addText(item, "p", `Company: ${job.company}`);
      addText(item, "p", `Job ID: ${job.job_id}`);
      addText(item, "p", job.description);

      addText(
        item,
        "p",
        `Required skills: ${job.required_skills || "Not specified"}`
      );

      const actions = document.createElement("div");
      actions.className = "job-actions";

      const editButton = makeButton(
        "Edit Job",
        "secondary-button",
        () => editJob(job, editButton)
      );

      const deleteButton = makeButton(
        "Delete Job",
        "delete-button",
        () => deleteJob(job, deleteButton)
      );

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      item.appendChild(actions);
      list.appendChild(item);
    });

  } catch (error) {
    showMessage(error.message, "error");
  }
}

// ==================================================
// VIEW AND DOWNLOAD APPLICANT RESUMES
// ==================================================

async function fetchResumeFile(resumeId, action) {
  const response = await fetch(
    `${API_URL}/resume/${action}/${encodeURIComponent(resumeId)}`,
    {
      method: "GET",
      headers: headers()
    }
  );

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");

    window.location.href = "login.html";

    throw new Error("Please log in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data.detail || "Could not access the resume."
    );
  }

  return await response.blob();
}

// ==================================================
// VIEW APPLICANT RESUME
// ==================================================

async function viewApplicantResume(resumeId, button) {
  if (!resumeId) {
    showMessage("Resume ID is missing.", "error");
    return;
  }

  const previewWindow = window.open("about:blank", "_blank");

  if (!previewWindow) {
    showMessage(
      "Please allow pop-ups to view applicant resumes.",
      "error"
    );
    return;
  }

  const restoreButton = setButtonLoading(button, "Opening...");

  try {
    const blob = await fetchResumeFile(resumeId, "view");

    const objectUrl = URL.createObjectURL(blob);

    previewWindow.location.href = objectUrl;

    showMessage("Resume opened successfully.");

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);

  } catch (error) {
    previewWindow.close();
    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// DOWNLOAD APPLICANT RESUME
// ==================================================

async function downloadApplicantResume(resumeId, filename, button) {
  if (!resumeId) {
    showMessage("Resume ID is missing.", "error");
    return;
  }

  const restoreButton = setButtonLoading(button, "Downloading...");

  try {
    const blob = await fetchResumeFile(resumeId, "download");

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;

    const safeFilename = (
      filename || `resume_${resumeId}.pdf`
    ).replace(/[\\/:*?"<>|]/g, "_");

    link.download = safeFilename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);

    showMessage("Resume downloaded successfully.");

  } catch (error) {
    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// UPDATE APPLICATION STATUS
// ==================================================

async function updateApplicantStatus(matchId, statusSelect, button) {
  const newStatus = statusSelect.value;

  if (!APPLICATION_STATUSES.includes(newStatus)) {
    showMessage("Please select a valid application status.", "error");
    return;
  }

  const restoreButton = setButtonLoading(button, "Saving...");

  try {
    const data = await api(
      `/match/recruiter/status/${encodeURIComponent(matchId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: newStatus
        })
      }
    );

    showMessage(
      data.message || "Application status updated successfully."
    );

    await Promise.all([
      loadApplicants(),
      loadMatchResults()
    ]);

  } catch (error) {
    showMessage(error.message, "error");

  } finally {
    restoreButton();
  }
}

// ==================================================
// LOAD APPLICANTS
// ==================================================

async function loadApplicants() {
  const list = $("applicantsList");
  if (!list) return;

  list.replaceChildren();
  addText(list, "p", "Loading applicants...");

  try {
    const data = await api("/match/recruiter/applicants");

    list.replaceChildren();

    const applicants = Array.isArray(data.applicants)
      ? data.applicants
      : [];

    updateApplicationStatistics(applicants);

    if (applicants.length === 0) {
      addText(
        list,
        "p",
        "No matched applicants found for your jobs yet."
      );
      return;
    }

    applicants.forEach((applicant) => {
      const card = document.createElement("article");
      card.className = "item applicant-card";

      addText(card, "h3", applicant.applicant_name);
      addText(card, "p", `Email: ${applicant.applicant_email}`);
      addText(card, "p", `Resume: ${applicant.resume_filename}`);
      addText(card, "p", `Resume ID: ${applicant.resume_id}`);
      addText(card, "p", `Job: ${applicant.job_title}`);
      addText(card, "p", `Company: ${applicant.company}`);

      addText(
        card,
        "p",
        `AI Match: ${Number(applicant.match_percentage || 0).toFixed(2)}%`
      );

      // APPLICATION STATUS

      const rawStatus = String(
        applicant.application_status || "pending"
      ).toLowerCase();

      const currentStatus = APPLICATION_STATUSES.includes(rawStatus)
        ? rawStatus
        : "pending";

      const statusRow = document.createElement("div");
      statusRow.className = "application-status-row";

      addText(statusRow, "strong", "Current Status:");

      const statusBadge = document.createElement("span");

      statusBadge.className =
        `application-status status-${currentStatus}`;

      statusBadge.textContent = formatStatus(currentStatus);

      statusRow.appendChild(statusBadge);
      card.appendChild(statusRow);

      // UPDATE STATUS

      addText(card, "h4", "Update Application Status");

      const statusActions = document.createElement("div");
      statusActions.className = "job-actions status-actions";

      const statusSelect = createStatusSelect(currentStatus);

      const updateButton = makeButton(
        "Update Status",
        "primary-button",
        () => updateApplicantStatus(
          applicant.match_id,
          statusSelect,
          updateButton
        )
      );

      statusActions.appendChild(statusSelect);
      statusActions.appendChild(updateButton);

      card.appendChild(statusActions);

      // RESUME ACTIONS

      const resumeActions = document.createElement("div");
      resumeActions.className = "job-actions";

      const viewButton = makeButton(
        "View Resume",
        "secondary-button",
        () => viewApplicantResume(
          applicant.resume_id,
          viewButton
        )
      );

      const downloadButton = makeButton(
        "Download Resume",
        "primary-button",
        () => downloadApplicantResume(
          applicant.resume_id,
          applicant.resume_filename,
          downloadButton
        )
      );

      resumeActions.appendChild(viewButton);
      resumeActions.appendChild(downloadButton);

      card.appendChild(resumeActions);

      // AI APPLICANT ANALYSIS

      const aiSection = document.createElement("div");
      aiSection.className = "ai-applicant-section";

      const aiResult = document.createElement("div");
      aiResult.className = "ai-result";
      aiResult.setAttribute("aria-live", "polite");

      const aiButton = makeButton(
        "Analyze with AI",
        "primary-button",
        () => analyzeApplicant(
          applicant.match_id,
          aiButton,
          aiResult
        )
      );

      aiSection.appendChild(aiButton);
      aiSection.appendChild(aiResult);

      card.appendChild(aiSection);

      // AI INTERVIEW QUESTION GENERATOR

      const interviewSection = document.createElement("div");
      interviewSection.className = "ai-interview-section";

      addText(
        interviewSection,
        "h4",
        "AI Interview Question Generator"
      );

      const interviewResult = document.createElement("div");
      interviewResult.className = "interview-result";
      interviewResult.setAttribute("aria-live", "polite");

      const evaluationInput = document.createElement("textarea");

      evaluationInput.className = "interview-answer-input";
      evaluationInput.rows = 14;

      evaluationInput.placeholder =
        "Click Generate Interview Questions first. Then enter the applicant's actual answer under each question using the format:\n\nApplicant Answer: [Enter the applicant's answer here]";

      evaluationInput.setAttribute(
        "aria-label",
        "Interview questions and applicant answers"
      );

      const generateButton = makeButton(
        "Generate Interview Questions",
        "ai-interview-button",
        () => generateInterviewQuestions(
          applicant.match_id,
          generateButton,
          interviewResult,
          evaluationInput
        )
      );

      interviewSection.appendChild(generateButton);
      interviewSection.appendChild(interviewResult);

      addText(
        interviewSection,
        "h4",
        "Enter Applicant's Interview Answers"
      );

      addText(
        interviewSection,
        "p",
        "Generate the questions first. Then enter the applicant's actual answers below the corresponding questions. Do not submit placeholder text as an answer.",
        "interview-disclaimer"
      );

      interviewSection.appendChild(evaluationInput);

      // INTERVIEW EVALUATION RESULT

      const evaluationResult = document.createElement("div");

      evaluationResult.className = "interview-evaluation-result";
      evaluationResult.setAttribute("aria-live", "polite");

      // INTERVIEW HISTORY CONTAINER

      const historySection = document.createElement("div");
      historySection.className = "interview-history-section";

      addText(
        historySection,
        "h4",
        "Interview Evaluation History"
      );

      const historyContainer = document.createElement("div");
      historyContainer.className = "interview-history-list";
      historyContainer.dataset.historyMatchId = applicant.match_id;

      historyContainer.setAttribute("aria-live", "polite");

      // EVALUATE INTERVIEW

      const evaluateButton = makeButton(
        "Evaluate Interview",
        "primary-button",
        () => evaluateInterview(
          applicant.match_id,
          evaluateButton,
          evaluationInput,
          evaluationResult,
          historyContainer
        )
      );

      interviewSection.appendChild(evaluateButton);
      interviewSection.appendChild(evaluationResult);

      // VIEW HISTORY BUTTON

      const historyButton = makeButton(
        "View Evaluation History",
        "primary-button",
        async () => {
          const restoreButton = setButtonLoading(
            historyButton,
            "Loading History..."
          );

          try {
            await loadInterviewEvaluationHistory(
              applicant.match_id,
              historyContainer
            );
          } finally {
            restoreButton();
          }
        }
      );

      historySection.appendChild(historyButton);
      historySection.appendChild(historyContainer);

      card.appendChild(interviewSection);
      card.appendChild(historySection);

      list.appendChild(card);
    });

  } catch (error) {
    list.replaceChildren();

    addText(
      list,
      "p",
      `Could not load applicants: ${error.message}`
    );

    showMessage(error.message, "error");
  }
}

// ==================================================
// LOAD MATCH RESULTS
// ==================================================

async function loadMatchResults() {
  const list = $("matchResultsList");
  if (!list) return;

  list.replaceChildren();
  addText(list, "p", "Loading match results...");

  try {
    const data = await api("/match/recruiter/applicants");

    list.replaceChildren();

    const applicants = Array.isArray(data.applicants)
      ? data.applicants
      : [];

    if (applicants.length === 0) {
      addText(list, "p", "No AI match results available yet.");
      return;
    }

    applicants.forEach((applicant) => {
      const card = document.createElement("article");
      card.className = "item match-card";

      addText(card, "h3", applicant.applicant_name);

      addText(
        card,
        "p",
        `${applicant.job_title} - ${applicant.company}`
      );

      const percentage = Math.max(
        0,
        Math.min(100, Number(applicant.match_percentage) || 0)
      );

      const score = addText(
        card,
        "h2",
        `${percentage.toFixed(2)}%`
      );

      score.className = "match-score";

      const progress = document.createElement("div");
      progress.className = "match-progress";

      const bar = document.createElement("div");
      bar.className = "match-progress-bar";
      bar.style.width = `${percentage}%`;

      progress.appendChild(bar);
      card.appendChild(progress);

      addText(
        card,
        "p",
        `Application Status: ${formatStatus(applicant.application_status)}`
      );

      displaySkills(
        card,
        "Matched Skills",
        applicant.matched_skills
      );

      displaySkills(
        card,
        "Missing Skills",
        applicant.missing_skills
      );

      list.appendChild(card);
    });

  } catch (error) {
    list.replaceChildren();

    addText(
      list,
      "p",
      `Could not load match results: ${error.message}`
    );

    showMessage(error.message, "error");
  }
}

// ==================================================
// REFRESH DASHBOARD
// ==================================================

async function refreshDashboard() {
  await Promise.all([
    loadJobs(),
    loadApplicants(),
    loadMatchResults()
  ]);
}

// ==================================================
// CREATE JOB
// ==================================================

if ($("jobForm")) {
  $("jobForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("jobTitle").value.trim();
    const company = $("company").value.trim();
    const description = $("description").value.trim();
    const requiredSkills = $("requiredSkills").value.trim();

    if (!title || !company || !description) {
      showMessage(
        "Please enter the job title, company, and description.",
        "error"
      );
      return;
    }

    const params = new URLSearchParams({
      title,
      company,
      description,
      required_skills: requiredSkills
    });

    const submitButton = $("jobForm").querySelector(
      'button[type="submit"]'
    );

    const restoreButton = setButtonLoading(
      submitButton,
      "Publishing..."
    );

    try {
      const data = await api(`/jobs/?${params.toString()}`, {
        method: "POST"
      });

      showMessage(
        `Job published successfully! Job ID: ${data.job_id}`
      );

      $("jobForm").reset();

      await refreshDashboard();

    } catch (error) {
      showMessage(error.message, "error");

    } finally {
      restoreButton();
    }
  });
}

// ==================================================
// REFRESH BUTTON
// ==================================================

if ($("loadJobsButton")) {
  $("loadJobsButton").addEventListener("click", async () => {
    const button = $("loadJobsButton");

    const restoreButton = setButtonLoading(
      button,
      "Refreshing..."
    );

    try {
      await refreshDashboard();

      showMessage("Recruiter dashboard refreshed successfully.");

    } finally {
      restoreButton();
    }
  });
}

// ==================================================
// LOGOUT
// ==================================================

if ($("logoutButton")) {
  $("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");

    window.location.href = "home.html";
  });
}

// ==================================================
// INITIALIZE DASHBOARD
// ==================================================

async function init() {
  if (!token()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const user = await api("/auth/me");

    if (user.role !== "recruiter") {
      window.location.href = "applicant-dashboard.html";
      return;
    }

    if ($("userName")) {
      $("userName").textContent = user.name || "Recruiter";
    }

    await refreshDashboard();

  } catch (error) {
    showMessage(error.message, "error");

    if (error.message !== "Please log in again.") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");

      window.location.href = "login.html";
    }
  }
}

// ==================================================
// START DASHBOARD
// ==================================================

init();
