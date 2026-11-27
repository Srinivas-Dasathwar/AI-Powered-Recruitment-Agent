
import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://127.0.0.1:8000";

function getError(error) {
  return (
    error.response?.data?.detail ||
    error.response?.data?.message ||
    "Something went wrong. Check that the backend is running."
  );
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("access_token") || ""
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("login");

  async function loadUser(accessToken) {
    const response = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setUser(response.data);
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    loadUser(token)
      .catch(() => {
        localStorage.removeItem("access_token");
        setToken("");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAuth(form) {
    setError("");
    setNotice("");

    try {
      const response = await axios.post(
        `${API}/auth/${mode === "login" ? "login" : "register"}`,
        form
      );

      if (mode === "register") {
        setNotice("Account created. Please log in.");
        setMode("login");
        return;
      }

      const accessToken = response.data.access_token;
      localStorage.setItem("access_token", accessToken);
      setToken(accessToken);
      setUser({
        user_id: response.data.user_id,
        name: response.data.name,
        email: response.data.email,
        role: response.data.role,
      });
    } catch (err) {
      setError(getError(err));
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    setToken("");
    setUser(null);
    setError("");
    setNotice("");
  }

  if (loading) {
    return <div className="loading-screen">Loading your dashboard…</div>;
  }

  if (!token || !user) {
    return (
      <AuthScreen
        mode={mode}
        setMode={setMode}
        onSubmit={handleAuth}
        error={error}
        notice={notice}
      />
    );
  }

  if (user.role === "recruiter") {
    return <RecruiterDashboard user={user} token={token} logout={logout} />;
  }

  return <ApplicantDashboard user={user} token={token} logout={logout} />;
}

function AuthScreen({ mode, setMode, onSubmit, error, notice }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("applicant");

  function submit(event) {
    event.preventDefault();
    const payload = { email, password };

    if (mode === "register") {
      payload.name = name;
      payload.role = role;
    }

    onSubmit(payload);
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand-mark">AI</div>
        <p className="eyebrow">SMARTER CAREER CONNECTIONS</p>
        <h1>Find the right match.</h1>
        <p>
          Match skills to opportunities with AI-powered resume analysis.
        </p>
        <div className="auth-points">
          <span>✓ Skill matching</span>
          <span>✓ Resume insights</span>
          <span>✓ Hiring workspace</span>
        </div>
      </section>

      <section className="auth-card">
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to continue to your workspace."
            : "Choose how you want to use AI Resume Matcher."}
        </p>

        {error && <div className="alert error">{String(error)}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Your name"
                />
              </label>

              <label>
                I am a
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="applicant">Applicant — looking for jobs</option>
                  <option value="recruiter">Recruiter — hiring candidates</option>
                </select>
              </label>
            </>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              maxLength={72}
              placeholder="Enter your password"
            />
          </label>

          <button className="primary-button" type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}

function DashboardLayout({ user, logout, children, recruiter = false }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark small">AI</span>
          <span>Resume Matcher</span>
        </div>

        <p className="sidebar-label">WORKSPACE</p>
        <div className="sidebar-link active">
          <span>▦</span> Dashboard
        </div>
        <div className="sidebar-link">
          <span>{recruiter ? "▤" : "◇"}</span>
          {recruiter ? "Job postings" : "Job opportunities"}
        </div>
        <div className="sidebar-link">
          <span>{recruiter ? "♙" : "◎"}</span>
          {recruiter ? "Candidates" : "Resume & skills"}
        </div>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <strong>{user.name}</strong>
            <span>{recruiter ? "Recruiter" : "Applicant"}</span>
          </div>
          <button className="logout-button" onClick={logout} title="Log out">
            ↗
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="muted">Workspace / </span>
            {recruiter ? "Recruiter" : "Applicant"}
          </div>
          <button className="outline-button" onClick={logout}>
            Log out
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}

function ApplicantDashboard({ user, token, logout }) {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  async function refresh() {
    setError("");
    try {
      const [jobResponse, resumeResponse] = await Promise.all([
        axios.get(`${API}/jobs/`, { headers }),
        axios.get(`${API}/resume/list`, { headers }),
      ]);

      setJobs(jobResponse.data);
      setResumes(resumeResponse.data);
      setSelectedResume((current) => {
        if (current && resumeResponse.data.some(
          (resume) => String(resume.resume_id) === current
        )) return current;
        return resumeResponse.data.length
          ? String(resumeResponse.data[0].resume_id)
          : "";
      });
    } catch (err) {
      setError(getError(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [token]);

  async function uploadResume(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    const data = new FormData();
    data.append("file", file);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await axios.post(`${API}/resume/upload`, data, {
        headers,
      });
      setNotice(`Resume uploaded: ${response.data.filename}`);
      await refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }

  async function matchJob(jobId) {
    if (!selectedResume) {
      setError("Upload a resume before matching it with a job.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await axios.post(
        `${API}/match/${selectedResume}/${jobId}`,
        {},
        { headers }
      );
      setResults((previous) => ({ ...previous, [jobId]: response.data }));
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout user={user} logout={logout}>
      <section className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">APPLICANT WORKSPACE</p>
            <h1>Welcome, {user.name} 👋</h1>
            <p className="muted">Discover roles that match your skills.</p>
          </div>
          <label className="primary-button upload-button">
            {busy ? "Please wait…" : "+ Upload resume"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={uploadResume}
              disabled={busy}
              hidden
            />
          </label>
        </div>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <div className="stats-grid">
          <StatCard label="Available jobs" value={jobs.length} icon="▤" />
          <StatCard label="My resumes" value={resumes.length} icon="▧" />
          <StatCard
            label="Matches calculated"
            value={Object.keys(results).length}
            icon="◎"
          />
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Your resumes</h2>
              <p className="muted">Choose a resume for job matching.</p>
            </div>
          </div>

          {resumes.length === 0 ? (
            <p className="empty-state">
              No resumes yet. Upload a PDF resume to get started.
            </p>
          ) : (
            <div className="resume-picker">
              <select
                value={selectedResume}
                onChange={(e) => setSelectedResume(e.target.value)}
              >
                {resumes.map((resume) => (
                  <option key={resume.resume_id} value={resume.resume_id}>
                    {resume.filename}
                  </option>
                ))}
              </select>
              <span className="muted">
                {resumes.length} resume{resumes.length === 1 ? "" : "s"} uploaded
              </span>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Explore job opportunities</h2>
              <p className="muted">
                Compare your resume against each job's requirements.
              </p>
            </div>
            <button className="outline-button" onClick={refresh}>Refresh</button>
          </div>

          {jobs.length === 0 ? (
            <p className="empty-state">
              No jobs are available yet. Check back after recruiters post openings.
            </p>
          ) : (
            <div className="job-list">
              {jobs.map((job) => {
                const result = results[job.job_id];
                return (
                  <article className="job-card" key={job.job_id}>
                    <div className="job-icon">▤</div>
                    <div className="job-main">
                      <h3>{job.title}</h3>
                      <p className="muted">{job.company}</p>
                      <p className="job-description">{job.description}</p>
                      <div className="skill-list">
                        {(job.required_skills || "")
                          .split(",")
                          .map((skill) => skill.trim())
                          .filter(Boolean)
                          .map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}
                      </div>

                      {result && (
                        <div className="match-result">
                          <strong>{result.match_percentage}% match</strong>
                          <p>Matched skills: {result.matched_skills?.join(", ") || "None identified"}</p>
                          <p>Skills to develop: {result.missing_skills?.join(", ") || "None identified"}</p>
                        </div>
                      )}
                    </div>
                    <button
                      className="primary-button match-button"
                      onClick={() => matchJob(job.job_id)}
                      disabled={busy || resumes.length === 0}
                    >
                      {result ? "Recalculate match" : "Match resume"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </DashboardLayout>
  );
}

function RecruiterDashboard({ user, token, logout }) {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  async function refresh() {
    try {
      const response = await axios.get(`${API}/jobs/`, { headers });
      setJobs(response.data);
      setError("");
    } catch (err) {
      setError(getError(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [token]);

  async function createJob(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await axios.post(
        `${API}/jobs/`,
        null,
        {
          headers,
          params: {
            title,
            company,
            description,
            required_skills: skills,
          },
        }
      );

      setTitle("");
      setCompany("");
      setDescription("");
      setSkills("");
      setNotice("Job posting created successfully.");
      await refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout user={user} logout={logout} recruiter>
      <section className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">RECRUITER WORKSPACE</p>
            <h1>Hiring dashboard</h1>
            <p className="muted">
              Create job postings and find candidates with relevant skills.
            </p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <div className="stats-grid">
          <StatCard label="Job postings" value={jobs.length} icon="▤" />
          <StatCard label="Open positions" value={jobs.length} icon="◎" />
          <StatCard label="Candidates" value="—" icon="♙" />
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Create a job posting</h2>
              <p className="muted">Describe the role and its required skills.</p>
            </div>
          </div>

          <form className="job-form" onSubmit={createJob}>
            <div className="form-row">
              <label>
                Job title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="e.g. Python Developer" />
              </label>
              <label>
                Company
                <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={200} placeholder="Company name" />
              </label>
            </div>
            <label>
              Job description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Responsibilities and qualifications…" />
            </label>
            <label>
              Required skills
              <input value={skills} onChange={(e) => setSkills(e.target.value)} required placeholder="Python, FastAPI, PostgreSQL" />
              <span className="field-help">Separate skills with commas.</span>
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "Publishing…" : "Publish job"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Job postings</h2>
              <p className="muted">Jobs currently returned by the platform.</p>
            </div>
            <button className="outline-button" onClick={refresh}>Refresh</button>
          </div>

          {jobs.length === 0 ? (
            <p className="empty-state">You haven't posted any jobs yet.</p>
          ) : (
            <div className="job-list">
              {jobs.map((job) => (
                <article className="job-card" key={job.job_id}>
                  <div className="job-icon">▤</div>
                  <div className="job-main">
                    <h3>{job.title}</h3>
                    <p className="muted">{job.company}</p>
                    <p className="job-description">{job.description}</p>
                    <p className="field-help">Required skills: {job.required_skills || "Not specified"}</p>
                  </div>
                  <span className="status-pill">Posted</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="info-note">
          Candidate lists and hiring stages require an applications workflow,
          which we'll add next. These counts do not yet represent actual applicants.
        </div>
      </section>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="muted">{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default App;
