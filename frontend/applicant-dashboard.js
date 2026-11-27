
const API_URL = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

let jobs = [];
let resumes = [];

const APPLICATION_STATUSES = [
  "pending",
  "shortlisted",
  "rejected",
  "hired"
];

// -----------------------------
// AUTHENTICATION
// -----------------------------

function token() {
  return localStorage.getItem("access_token");
}

function headers() {
  return {
    Authorization: `Bearer ${token()}`
  };
}

// -----------------------------
// API HELPER
// -----------------------------

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

    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(", ")
      : data.detail;

    throw new Error(detail || "Something went wrong. Please try again.");
  }

  return data;
}

// -----------------------------
// NOTIFICATION HELPER
// -----------------------------

function message(text, type = "success") {
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

// -----------------------------
// LOADING BUTTON HELPER
// -----------------------------

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

// -----------------------------
// GENERAL HELPERS
// -----------------------------

function addText(parent, tag, text, className = "") {
  const element = document.createElement(tag);

  element.textContent = text ?? "";

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);

  return element;
}

function addOption(select, value, label) {
  const option = document.createElement("option");

  option.value = value;
  option.textContent = label;

  select.appendChild(option);
}

function getResumeId(resume) {
  return resume.resume_id ?? resume.id;
}

function getJobId(job) {
  return job.job_id ?? job.id;
}

function parseSkills(skills) {
  if (Array.isArray(skills)) {
    return skills;
  }

  if (typeof skills === "string") {
    try {
      const parsed = JSON.parse(skills);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
    }
  }

  return [];
}

// -----------------------------
// APPLICATION STATUS HELPERS
// -----------------------------

function formatStatus(status) {
  const normalized = String(status || "pending").toLowerCase();

  return normalized.charAt(0).toUpperCase() +
    normalized.slice(1);
}

function createStatusBadge(status) {
  const normalized = String(status || "pending").toLowerCase();

  const validStatus = APPLICATION_STATUSES.includes(normalized)
    ? normalized
    : "pending";

  const badge = document.createElement("span");

  badge.className = `application-status status-${validStatus}`;
  badge.textContent = formatStatus(validStatus);

  return badge;
}

// -----------------------------
// APPLICANT AI AGENT
// -----------------------------


function createApplicantAISection() {
  let section = $("applicantAISection");

  if (section) {
    return section;
  }

  // Create the AI Assistant as a normal dashboard card.
  section = document.createElement("section");
  section.id = "applicantAISection";
  section.className = "dashboard-card applicant-ai-section";

  // Card heading
  const heading = document.createElement("div");
  heading.className = "card-heading";

  addText(heading, "div", "✦", "heading-icon purple");

  const headingContent = document.createElement("div");

  addText(headingContent, "h2", "AI Resume Assistant");

  addText(
    headingContent,
    "p",
    "Get AI-powered feedback on your resume, skills, and job readiness."
  );

  heading.appendChild(headingContent);
  section.appendChild(heading);

  // Form layout
  const formGrid = document.createElement("div");
  formGrid.className = "form-grid applicant-ai-form";

  // Resume selection
  const resumeGroup = document.createElement("div");
  resumeGroup.className = "form-group";

  const resumeLabel = addText(
    resumeGroup,
    "label",
    "Select Your Resume"
  );
  resumeLabel.htmlFor = "aiResumeId";

  const resumeSelect = document.createElement("select");
  resumeSelect.id = "aiResumeId";
  resumeSelect.required = true;

  addOption(resumeSelect, "", "Select a saved resume");
  resumeGroup.appendChild(resumeSelect);

  // Job selection
  const jobGroup = document.createElement("div");
  jobGroup.className = "form-group";

  const jobLabel = addText(
    jobGroup,
    "label",
    "Select a Job (Optional)"
  );
  jobLabel.htmlFor = "aiJobId";

  const jobSelect = document.createElement("select");
  jobSelect.id = "aiJobId";

  addOption(jobSelect, "", "General Resume Analysis");
  jobGroup.appendChild(jobSelect);

  formGrid.appendChild(resumeGroup);
  formGrid.appendChild(jobGroup);

  // Analyze button
  const action = document.createElement("div");
  action.className = "form-action";

  const analyzeButton = document.createElement("button");
  analyzeButton.type = "button";
  analyzeButton.id = "analyzeResumeButton";
  analyzeButton.className = "primary-button";
  analyzeButton.textContent = "Analyze My Resume";

  action.appendChild(analyzeButton);
  formGrid.appendChild(action);

  section.appendChild(formGrid);

  // Analysis result
  const result = document.createElement("div");
  result.id = "applicantAIResult";
  result.className = "result applicant-ai-result";
  result.hidden = true;

  section.appendChild(result);

  // IMPORTANT:
  // Insert the AI section inside dashboard-container,
  // immediately before the footer.
  const container = document.querySelector(".dashboard-container");
  const footer = container?.querySelector(".dashboard-footer");

  if (container) {
    if (footer) {
      container.insertBefore(section, footer);
    } else {
      container.appendChild(section);
    }
  }

  analyzeButton.addEventListener("click", analyzeMyResume);

  return section;
}


// -----------------------------
// FILL AI AGENT DROPDOWNS
// -----------------------------

function fillAISelects() {
  const resumeSelect = $("aiResumeId");
  const jobSelect = $("aiJobId");

  if (!resumeSelect || !jobSelect) return;

  const previousResume = resumeSelect.value;
  const previousJob = jobSelect.value;

  resumeSelect.replaceChildren();

  addOption(
    resumeSelect,
    "",
    "Select a saved resume"
  );

  resumes.forEach((resume) => {
    addOption(
      resumeSelect,
      getResumeId(resume),
      resume.filename || "My Resume"
    );
  });

  jobSelect.replaceChildren();

  addOption(
    jobSelect,
    "",
    "General Resume Analysis"
  );

  jobs.forEach((job) => {
    addOption(
      jobSelect,
      getJobId(job),
      `${job.title} - ${job.company || "Unknown Company"}`
    );
  });

  if (
    resumes.some(
      (resume) => String(getResumeId(resume)) === previousResume
    )
  ) {
    resumeSelect.value = previousResume;
  }

  if (
    jobs.some(
      (job) => String(getJobId(job)) === previousJob
    )
  ) {
    jobSelect.value = previousJob;
  }
}

// -----------------------------
// DISPLAY AI ANALYSIS
// -----------------------------

function displayAIAnalysis(data) {
  const result = $("applicantAIResult");

  result.replaceChildren();
  result.hidden = false;

  addText(
    result,
    "h3",
    "Your AI Resume Analysis"
  );

  addText(
    result,
    "p",
    `Resume: ${data.resume_filename || "Selected Resume"}`
  );

  if (data.job_title) {
    addText(
      result,
      "p",
      `Target Job: ${data.job_title}`
    );
  } else {
    addText(
      result,
      "p",
      "Analysis Type: General Resume Analysis"
    );
  }

  addText(
    result,
    "h4",
    "Identified Skills"
  );

  const skills = data.identified_skills || [];

  if (skills.length) {
    skills.forEach((skill) => {
      addText(
        result,
        "span",
        skill,
        "skill"
      );
    });
  } else {
    addText(
      result,
      "p",
      "No skills were identified."
    );
  }

  addText(
    result,
    "h4",
    "AI Recommendations"
  );

  // Use textContent rather than innerHTML because
  // the AI-generated response is untrusted text.
  const analysis = document.createElement("div");

  analysis.className = "ai-analysis-text";
  analysis.style.whiteSpace = "pre-wrap";
  analysis.textContent =
    data.ai_analysis || "No AI analysis was returned.";

  result.appendChild(analysis);

  addText(
    result,
    "p",
    "Note: AI recommendations are suggestions. Review them and verify all information before making career decisions.",
    "ai-disclaimer"
  );

  result.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// -----------------------------
// ANALYZE MY RESUME
// -----------------------------

async function analyzeMyResume() {
  const resumeId = $("aiResumeId").value;
  const jobId = $("aiJobId").value;

  if (!resumeId) {
    message("Please select a saved resume first.", "error");
    return;
  }

  const button = $("analyzeResumeButton");

  const restoreButton = setButtonLoading(
    button,
    "Analyzing with AI..."
  );

  const result = $("applicantAIResult");

  result.hidden = false;
  result.replaceChildren();

  addText(
    result,
    "p",
    "Your resume is being analyzed by the local AI model. This may take a little time."
  );

  try {
    let endpoint =
      `/applicant-agent/analyze-resume/${encodeURIComponent(resumeId)}`;

    if (jobId) {
      endpoint += `?job_id=${encodeURIComponent(jobId)}`;
    }

    const data = await api(endpoint, {
      method: "POST"
    });

    displayAIAnalysis(data);

    message("Your AI resume analysis is complete.");

  } catch (error) {
    result.replaceChildren();

    addText(
      result,
      "p",
      `AI analysis failed: ${error.message}`,
      "error"
    );

    message(error.message, "error");

  } finally {
    restoreButton();
  }
}

// -----------------------------
// APPLICATION STATUS SECTION
// -----------------------------

function createApplicationStatusSection() {
  let section = $("applicationStatusSection");

  if (section) {
    return section;
  }

  section = document.createElement("section");

  section.id = "applicationStatusSection";
  section.className = "application-status-section";

  const heading = document.createElement("h2");

  heading.textContent = "My Application Status";

  const description = document.createElement("p");

  description.textContent =
    "Track the latest status of your resume matches and applications.";

  const refreshButton = document.createElement("button");

  refreshButton.type = "button";
  refreshButton.id = "refreshApplicationStatusButton";
  refreshButton.className = "secondary-button";
  refreshButton.textContent = "Refresh Status";

  const list = document.createElement("div");

  list.id = "applicantApplicationsList";
  list.className = "items";

  section.appendChild(heading);
  section.appendChild(description);
  section.appendChild(refreshButton);
  section.appendChild(list);

  const historyList = $("historyList");

  const historySection = historyList
    ? historyList.closest("section")
    : null;

  if (historySection && historySection.parentNode) {
    historySection.parentNode.insertBefore(
      section,
      historySection
    );
  } else {
    const main = document.querySelector("main") || document.body;

    main.appendChild(section);
  }

  refreshButton.addEventListener("click", async () => {
    const restoreButton = setButtonLoading(
      refreshButton,
      "Refreshing..."
    );

    try {
      await loadApplicationStatuses();

      message("Application statuses refreshed successfully.");
    } catch (error) {
      message(error.message, "error");
    } finally {
      restoreButton();
    }
  });

  return section;
}

// -----------------------------
// LOAD APPLICATION STATUSES
// -----------------------------

async function loadApplicationStatuses() {
  const section = createApplicationStatusSection();

  const list = section.querySelector("#applicantApplicationsList");

  list.replaceChildren();

  addText(list, "p", "Loading application statuses...");

  try {
    const data = await api("/match/applicant/status");

    list.replaceChildren();

    const applications = data.applications || [];

    if (!applications.length) {
      addText(
        list,
        "p",
        "You haven't matched your resume with any jobs yet. Match your resume with an available job to start tracking your application."
      );

      return;
    }

    applications.forEach((application) => {
      const card = document.createElement("article");

      card.className = "item application-card";

      addText(
        card,
        "h3",
        application.job_title || "Job application"
      );

      addText(
        card,
        "p",
        `Company: ${application.company || "Not specified"}`
      );

      addText(
        card,
        "p",
        `Resume: ${application.resume_filename || "My Resume"}`
      );

      addText(
        card,
        "p",
        `AI Match: ${Number(
          application.match_percentage || 0
        ).toFixed(2)}%`
      );

      const statusRow = document.createElement("div");

      statusRow.className = "application-status-row";

      addText(
        statusRow,
        "strong",
        "Application Status: "
      );

      statusRow.appendChild(
        createStatusBadge(application.application_status)
      );

      card.appendChild(statusRow);

      if (application.applied_at) {
        const appliedDate = new Date(application.applied_at);

        if (!Number.isNaN(appliedDate.getTime())) {
          addText(
            card,
            "p",
            `Applied: ${appliedDate.toLocaleDateString("en-IN")}`
          );
        }
      }

      list.appendChild(card);
    });

  } catch (error) {
    list.replaceChildren();

    addText(
      list,
      "p",
      `Could not load application statuses: ${error.message}`
    );

    message(error.message, "error");
  }
}

// -----------------------------
// SAVED RESUMES
// -----------------------------

function renderSavedResumes() {
  const list = $("savedResumesList");

  list.replaceChildren();

  if (!resumes.length) {
    addText(
      list,
      "p",
      "You haven't uploaded a resume yet. Upload your first resume above."
    );

    return;
  }

  resumes.forEach((resume) => {
    const item = document.createElement("article");

    item.className = "item";

    addText(
      item,
      "h3",
      `📄 ${resume.filename || "My Resume"}`
    );

    addText(item, "p", "Saved in your account");

    if (resume.created_at) {
      const date = new Date(resume.created_at);

      if (!Number.isNaN(date.getTime())) {
        addText(
          item,
          "p",
          `Uploaded: ${date.toLocaleDateString("en-IN")}`
        );
      }
    }

    const skills = parseSkills(resume.skills);

    if (skills.length) {
      addText(
        item,
        "p",
        `Skills: ${skills.join(", ")}`
      );
    }

    // ANALYZE RESUME WITH AI BUTTON

    const analyzeButton = document.createElement("button");

    analyzeButton.type = "button";
    analyzeButton.className = "primary-button";
    analyzeButton.textContent = "Analyze with AI";

    analyzeButton.addEventListener("click", () => {
      createApplicantAISection();

      fillAISelects();

      $("aiResumeId").value = getResumeId(resume);

      $("applicantAIResult").hidden = true;

      $("applicantAISection").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    item.appendChild(analyzeButton);

    // DELETE RESUME BUTTON

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete Resume";

    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${resume.filename}"? Its match history will also be deleted.`
      );

      if (!confirmed) return;

      const restoreButton = setButtonLoading(
        deleteButton,
        "Deleting..."
      );

      try {
        await api(`/resume/${getResumeId(resume)}`, {
          method: "DELETE"
        });

        await loadResumes();
        await loadApplicationStatuses();

        $("matchResult").hidden = true;
        $("atsResult").hidden = true;

        $("applicantAIResult").hidden = true;

        message("Resume deleted successfully.");

      } catch (error) {
        message(error.message, "error");

      } finally {
        restoreButton();
      }
    });

    item.appendChild(deleteButton);

    list.appendChild(item);
  });
}

// -----------------------------
// RESUME DROPDOWNS
// -----------------------------

function fillResumeSelects() {
  const previousMatchResume = $("resumeId").value;
  const previousAtsResume = $("atsResumeId").value;

  ["resumeId", "atsResumeId"].forEach((id) => {
    const select = $(id);

    select.replaceChildren();

    addOption(select, "", "Select a saved resume");

    resumes.forEach((resume) => {
      const idValue = getResumeId(resume);

      addOption(
        select,
        idValue,
        resume.filename || "My Resume"
      );
    });
  });

  if (
    resumes.some(
      (resume) =>
        String(getResumeId(resume)) === previousMatchResume
    )
  ) {
    $("resumeId").value = previousMatchResume;
  }

  if (
    resumes.some(
      (resume) =>
        String(getResumeId(resume)) === previousAtsResume
    )
  ) {
    $("atsResumeId").value = previousAtsResume;
  }

  fillAISelects();
}

// -----------------------------
// LOAD SAVED RESUMES
// -----------------------------

async function loadResumes() {
  const previousMatchResume = $("resumeId").value;
  const previousAtsResume = $("atsResumeId").value;

  const data = await api("/resume/list");

  resumes = Array.isArray(data) ? data : [];

  renderSavedResumes();
  fillResumeSelects();

  if (
    resumes.some(
      (resume) =>
        String(getResumeId(resume)) === previousMatchResume
    )
  ) {
    $("resumeId").value = previousMatchResume;
  }

  if (
    resumes.some(
      (resume) =>
        String(getResumeId(resume)) === previousAtsResume
    )
  ) {
    $("atsResumeId").value = previousAtsResume;
  }
}

// -----------------------------
// JOB DROPDOWNS
// -----------------------------

function fillJobSelects() {
  ["jobId", "atsJobId"].forEach((id) => {
    const select = $(id);

    const previousValue = select.value;

    select.replaceChildren();

    addOption(select, "", "Select a job");

    jobs.forEach((job) => {
      const idValue = getJobId(job);

      addOption(
        select,
        idValue,
        `${job.title} - ${job.company}`
      );
    });

    if (
      jobs.some(
        (job) => String(getJobId(job)) === previousValue
      )
    ) {
      select.value = previousValue;
    }
  });

  fillAISelects();
}

// -----------------------------
// LOAD AVAILABLE JOBS
// -----------------------------

async function loadJobs() {
  try {
    jobs = await api("/jobs/");

    if (!Array.isArray(jobs)) {
      jobs = [];
    }

    fillJobSelects();

    const list = $("jobsList");

    list.replaceChildren();

    if (!jobs.length) {
      addText(list, "p", "No jobs are available yet.");

      return;
    }

    jobs.forEach((job) => {
      const item = document.createElement("article");

      item.className = "item";

      addText(item, "h3", job.title);
      addText(item, "p", `Company: ${job.company}`);
      addText(item, "p", job.description);

      addText(
        item,
        "p",
        `Required skills: ${job.required_skills || "Not specified"}`
      );

      const button = document.createElement("button");

      button.className = "primary-button";
      button.textContent = "Match My Resume";
      button.type = "button";

      button.addEventListener("click", () => {
        $("jobId").value = getJobId(job);
        $("atsJobId").value = getJobId(job);

        $("matchForm").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      item.appendChild(button);

      list.appendChild(item);
    });

  } catch (error) {
    message(error.message, "error");
  }
}

// -----------------------------
// UPLOAD RESUME
// -----------------------------

$("uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = $("resumeFile").files[0];

  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    message("Please choose a PDF resume.", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    message("The PDF must be 5 MB or smaller.", "error");
    return;
  }

  const formData = new FormData();

  formData.append("file", file);

  const uploadButton = $("uploadForm").querySelector(
    'button[type="submit"]'
  );

  const restoreButton = setButtonLoading(
    uploadButton,
    "Uploading..."
  );

  try {
    const data = await api("/resume/upload", {
      method: "POST",
      body: formData
    });

    const uploadResult = $("uploadResult");

    uploadResult.textContent = "✓ Resume uploaded successfully!";

    uploadResult.classList.remove("error");
    uploadResult.classList.add("message", "success");

    uploadResult.setAttribute("role", "status");
    uploadResult.hidden = false;

    await loadResumes();

    const uploadedResume = resumes.find(
      (resume) =>
        String(getResumeId(resume)) === String(data.resume_id)
    );

    if (uploadedResume) {
      const newestId = getResumeId(uploadedResume);

      $("resumeId").value = newestId;
      $("atsResumeId").value = newestId;
      $("aiResumeId").value = newestId;
    }

    $("uploadForm").reset();

    message("Your resume has been saved to your account.");

  } catch (error) {
    message(error.message, "error");

    const uploadResult = $("uploadResult");

    uploadResult.textContent = error.message;

    uploadResult.classList.remove("success");
    uploadResult.classList.add("message", "error");

    uploadResult.setAttribute("role", "alert");
    uploadResult.hidden = false;

  } finally {
    restoreButton();
  }
});

// -----------------------------
// REFRESH SAVED RESUMES
// -----------------------------

$("refreshResumesButton").addEventListener("click", async () => {
  const button = $("refreshResumesButton");

  const restoreButton = setButtonLoading(
    button,
    "Refreshing..."
  );

  try {
    await loadResumes();

    message("Saved resumes refreshed successfully.");

  } catch (error) {
    message(error.message, "error");

  } finally {
    restoreButton();
  }
});

// -----------------------------
// REFRESH JOBS
// -----------------------------

$("loadJobsButton").addEventListener("click", async () => {
  const button = $("loadJobsButton");

  const restoreButton = setButtonLoading(
    button,
    "Loading jobs..."
  );

  try {
    await loadJobs();

    if (jobs.length) {
      message("Available jobs loaded successfully.");
    }

  } catch (error) {
    message(error.message, "error");

  } finally {
    restoreButton();
  }
});

// -----------------------------
// MATCH RESUME WITH JOB
// -----------------------------

$("matchForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedResume = $("resumeId").value;
  const selectedJob = $("jobId").value;

  if (!selectedResume || !selectedJob) {
    message("Select a saved resume and a job first.", "error");
    return;
  }

  const matchButton = $("matchForm").querySelector(
    'button[type="submit"]'
  );

  const restoreButton = setButtonLoading(
    matchButton,
    "Matching..."
  );

  try {
    const data = await api(
      `/match/${encodeURIComponent(selectedResume)}/${encodeURIComponent(selectedJob)}`,
      {
        method: "POST"
      }
    );

    const result = $("matchResult");

    result.replaceChildren();
    result.hidden = false;

    addText(result, "h3", "Your Resume Match");

    addText(
      result,
      "div",
      `${data.match_percentage ?? 0}%`,
      "score"
    );

    addText(
      result,
      "p",
      `Job: ${data.job_title || "Selected job"}`
    );

    addText(
      result,
      "p",
      `Company: ${data.company || "Not specified"}`
    );

    addText(
      result,
      "p",
      `Application Status: ${formatStatus(data.application_status)}`
    );

    addText(result, "h4", "Matched Skills");

    const matchedSkills = data.matched_skills || [];

    if (matchedSkills.length) {
      matchedSkills.forEach((skill) => {
        addText(result, "span", skill, "skill");
      });
    } else {
      addText(result, "p", "No matched skills found.");
    }

    addText(result, "h4", "Missing Skills");

    const missingSkills = data.missing_skills || [];

    if (missingSkills.length) {
      missingSkills.forEach((skill) => {
        addText(result, "span", skill, "skill missing");
      });
    } else {
      addText(result, "p", "No missing skills found.");
    }

    await loadApplicationStatuses();

    message("Resume matching completed successfully.");

  } catch (error) {
    message(error.message, "error");

  } finally {
    restoreButton();
  }
});

// -----------------------------
// ATS SCORE CHECKER
// -----------------------------

$("atsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const resume = $("atsResumeId").value;
  const job = $("atsJobId").value;

  if (!resume || !job) {
    message("Select a saved resume and a job.", "error");
    return;
  }

  const atsButton = $("atsForm").querySelector(
    'button[type="submit"]'
  );

  const restoreButton = setButtonLoading(
    atsButton,
    "Calculating..."
  );

  try {
    const data = await api(
      `/resume/ats-score/${encodeURIComponent(resume)}/${encodeURIComponent(job)}`,
      {
        method: "POST"
      }
    );

    const result = $("atsResult");

    result.replaceChildren();
    result.hidden = false;

    addText(result, "h3", "ATS Score");

    addText(
      result,
      "div",
      `${data.ats_score ?? 0}/100`,
      "score"
    );

    addText(
      result,
      "p",
      `Word count: ${data.word_count ?? "N/A"}`
    );

    addText(result, "h4", "Matched Skills");

    const matchedSkills = data.matched_skills || [];

    if (matchedSkills.length) {
      matchedSkills.forEach((skill) => {
        addText(result, "span", skill, "skill");
      });
    } else {
      addText(result, "p", "No matched skills found.");
    }

    addText(result, "h4", "Missing Skills");

    const missingSkills = data.missing_skills || [];

    if (missingSkills.length) {
      missingSkills.forEach((skill) => {
        addText(result, "span", skill, "skill missing");
      });
    } else {
      addText(result, "p", "No missing skills found.");
    }

    addText(result, "h4", "Suggestions");

    const suggestions = data.suggestions || [];

    if (suggestions.length) {
      suggestions.forEach((suggestion) => {
        addText(result, "p", suggestion);
      });
    } else {
      addText(result, "p", "No additional suggestions.");
    }

    message("ATS score calculated successfully.");

  } catch (error) {
    message(error.message, "error");

  } finally {
    restoreButton();
  }
});

// -----------------------------
// MATCH HISTORY
// -----------------------------

$("loadHistoryButton").addEventListener("click", async () => {
  const selectedResume = $("resumeId").value;

  if (!selectedResume) {
    message("Select a saved resume first.", "error");
    return;
  }

  const historyButton = $("loadHistoryButton");

  const restoreButton = setButtonLoading(
    historyButton,
    "Loading history..."
  );

  try {
    const history = await api(
      `/match/history/${encodeURIComponent(selectedResume)}`
    );

    const list = $("historyList");

    list.replaceChildren();

    if (!Array.isArray(history) || !history.length) {
      addText(list, "p", "No match history found.");

      message("No match history is available for this resume.");

      return;
    }

    history.forEach((match) => {
      const item = document.createElement("article");

      item.className = "item";

      addText(
        item,
        "h3",
        match.job_title || "Job match"
      );

      addText(
        item,
        "p",
        `Company: ${match.company || "Unknown"}`
      );

      addText(
        item,
        "p",
        `Match: ${match.match_percentage ?? 0}%`
      );

      const statusRow = document.createElement("p");

      addText(statusRow, "strong", "Application Status: ");

      statusRow.appendChild(
        createStatusBadge(match.application_status)
      );

      item.appendChild(statusRow);

      addText(
        item,
        "p",
        `Matched skills: ${(match.matched_skills || []).join(", ") || "None"}`
      );

      addText(
        item,
        "p",
        `Missing skills: ${(match.missing_skills || []).join(", ") || "None"}`
      );

      list.appendChild(item);
    });

    message("Match history loaded successfully.");

  } catch (error) {
    message(error.message, "error");

  } finally {
    restoreButton();
  }
});

// -----------------------------
// LOGOUT
// -----------------------------

$("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");

  window.location.href = "home.html";
});

// -----------------------------
// INITIALIZE DASHBOARD
// -----------------------------

async function init() {
  if (!token()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const user = await api("/auth/me");

    if (user.role !== "applicant") {
      window.location.href = "recruiter-dashboard.html";
      return;
    }

    $("userName").textContent = user.name || "Applicant";

    createApplicantAISection();
    createApplicationStatusSection();

    await Promise.all([
      loadResumes(),
      loadJobs(),
      loadApplicationStatuses()
    ]);

    fillAISelects();

  } catch (error) {
    message(error.message, "error");
  }
}

// Start dashboard.

init();
