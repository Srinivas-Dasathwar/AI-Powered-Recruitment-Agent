
(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000";
  const CHAT_ENDPOINT = "/chatbot/chat";

  const elements = {
    toggle: document.getElementById("chatbotToggle"),
    panel: document.getElementById("chatbotPanel"),
    close: document.getElementById("chatbotClose"),
    clear: document.getElementById("chatbotClear"),
    messages: document.getElementById("chatbotMessages"),
    form: document.getElementById("chatbotForm"),
    input: document.getElementById("chatbotInput"),
    send: document.getElementById("chatbotSend"),
    title: document.getElementById("chatbotTitle"),
    subtitle: document.getElementById("chatbotSubtitle")
  };

  // Do nothing on pages that do not contain the chatbot.
  if (Object.values(elements).some((element) => !element)) {
    return;
  }

  const role = document.body.dataset.chatbotRole;
  const validRole = ["applicant", "recruiter"].includes(role)
    ? role
    : "applicant";

  let conversationHistory = [];
  let isSending = false;

  const welcomeMessage = validRole === "recruiter"
    ? "Hello! I'm your AI Recruitment Assistant. I can help with job descriptions, candidate screening, interview questions, and hiring workflows. What would you like help with?"
    : "Hello! I'm your AI Career Assistant. I can help with resume improvements, ATS scores, skills, job applications, and interview preparation. What would you like help with?";

  elements.title.textContent = validRole === "recruiter"
    ? "AI Recruitment Assistant"
    : "AI Career Assistant";

  elements.subtitle.textContent = "Powered by Ollama Qwen";

  function addMessage(content, sender) {
    const wrapper = document.createElement("div");
    wrapper.className = `chatbot-message chatbot-${sender}`;

    const label = document.createElement("span");
    label.className = "chatbot-message-label";
    label.textContent = sender === "user" ? "You" : "AI Assistant";

    const text = document.createElement("div");
    text.className = "chatbot-message-text";
    text.textContent = content;

    wrapper.appendChild(label);
    wrapper.appendChild(text);

    elements.messages.appendChild(wrapper);
    elements.messages.scrollTop = elements.messages.scrollHeight;

    return wrapper;
  }

  function showWelcomeMessage() {
    addMessage(welcomeMessage, "assistant");
  }

  function setSending(sending) {
    isSending = sending;
    elements.send.disabled = sending;
    elements.input.disabled = sending;
    elements.send.textContent = sending ? "Sending..." : "Send";
  }

  function openChat() {
    elements.panel.hidden = false;
    elements.toggle.setAttribute("aria-expanded", "true");
    elements.input.focus();
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function closeChat() {
    elements.panel.hidden = true;
    elements.toggle.setAttribute("aria-expanded", "false");
    elements.toggle.focus();
  }

  function clearChat() {
    if (isSending) return;

    conversationHistory = [];
    elements.messages.replaceChildren();
    showWelcomeMessage();
    elements.input.focus();
  }

  async function sendMessage(message) {
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
      addMessage("Your session has expired. Please log in again.", "assistant");
      window.location.href = "login.html";
      return;
    }

    const previousHistory = conversationHistory.slice(-10);

    addMessage(message, "user");

    const typingIndicator = addMessage("Thinking...", "assistant");

    setSending(true);

    try {
      const response = await fetch(`${API_URL}${CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message,
          history: previousHistory
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");

        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Your account is not authorized to use this chatbot.");
      }

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg).join(", ")
          : data.detail;

        throw new Error(
          detail || "The chatbot could not process your request."
        );
      }

      if (!data.reply || typeof data.reply !== "string") {
        throw new Error("The AI returned an empty response.");
      }

      typingIndicator.remove();

      addMessage(data.reply, "assistant");

      conversationHistory = [
        ...previousHistory,
        { role: "user", content: message },
        { role: "assistant", content: data.reply }
      ].slice(-10);

    } catch (error) {
      typingIndicator.remove();

      addMessage(
        error.message.includes("Failed to fetch")
          ? "Cannot connect to the backend. Check that FastAPI and Ollama are running."
          : error.message,
        "assistant"
      );

      if (error.message.includes("session has expired")) {
        window.location.href = "login.html";
      }

    } finally {
      setSending(false);
      elements.input.focus();
    }
  }

  elements.toggle.addEventListener("click", () => {
    if (elements.panel.hidden) {
      openChat();
    } else {
      closeChat();
    }
  });

  elements.close.addEventListener("click", closeChat);
  elements.clear.addEventListener("click", clearChat);

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSending) return;

    const message = elements.input.value.trim();

    if (!message) return;

    if (message.length > 2000) {
      addMessage("Please keep your message under 2,000 characters.", "assistant");
      return;
    }

    elements.input.value = "";
    await sendMessage(message);
  });

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  showWelcomeMessage();
})();
