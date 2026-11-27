
const API_URL = "http://127.0.0.1:8000";

// Display readable API error messages
function getErrorMessage(data, fallbackMessage) {
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item.msg || "Invalid input")
      .join(", ");
  }

  return data.detail || fallbackMessage;
}

// ==================== LOGIN ====================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const selectedRole = document.getElementById("loginRole").value;
    const messageElement = document.getElementById("message");

    try {
      messageElement.textContent = "Signing in...";

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Login failed"));
      }

      // Fetch actual user details
      const userResponse = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error(
          "Login succeeded, but user details could not be loaded."
        );
      }

      const user = await userResponse.json();
      const actualRole = user.role || data.role;

      if (actualRole !== "applicant" && actualRole !== "recruiter") {
        throw new Error("User role is missing or invalid.");
      }

      // Check selected role
      if (selectedRole !== actualRole) {
        throw new Error(
          `This account is registered as ${actualRole}. Please select ${actualRole}.`
        );
      }

      // Save login information
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", actualRole);

      messageElement.textContent =
        "Login successful! Opening dashboard...";

      // Redirect according to role
      window.location.replace(
        actualRole === "recruiter"
          ? "recruiter-dashboard.html"
          : "applicant-dashboard.html"
      );

    } catch (error) {
      console.error("Login error:", error);

      messageElement.textContent =
        error.message || "Could not connect to the server.";
    }
  });
}

// ==================== REGISTRATION ====================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    // Get selected role from radio cards
    const selectedRole = document.querySelector(
      'input[name="registerRole"]:checked'
    );

    const messageElement = document.getElementById("message");

    if (!selectedRole) {
      messageElement.textContent = "Please select Applicant or Recruiter.";
      return;
    }

    const role = selectedRole.value;

    try {
      messageElement.textContent = "Creating your account...";

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Registration failed")
        );
      }

      messageElement.style.color = "#16a34a";
      messageElement.textContent =
        "Registration successful! You can now sign in.";

      registerForm.reset();

      // Restore Applicant as the default selected role
      const applicantRole = document.getElementById("applicantRole");
      if (applicantRole) {
        applicantRole.checked = true;

        document.querySelectorAll(".role-card").forEach((card) => {
          card.classList.remove("selected");
        });

        applicantRole.closest(".role-card")?.classList.add("selected");
      }

    } catch (error) {
      console.error("Registration error:", error);

      messageElement.style.color = "#dc2626";
      messageElement.textContent =
        error.message || "Could not connect to the server.";
    }
  });
}
