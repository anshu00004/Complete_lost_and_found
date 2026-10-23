
/* ==========================================================================
   LOGIN.JS — Backend-connected Authentication
   Uses the FastAPI backend for registration and login.
   No fake tokens or local-only accounts.
   ========================================================================== */

const BACKEND_URL = "http://127.0.0.1:8000";
const AUTH_URL = `${BACKEND_URL}/api/v1/auth`;

// ── 1. TAB SWITCHING ──
function showTab(tab) {
  clearMessages();

  const loginTab = document.getElementById("tab-login");
  const regTab = document.getElementById("tab-register");
  const loginForm = document.getElementById("form-login");
  const regForm = document.getElementById("form-register");

  if (tab === "login") {
    loginTab.classList.add("active");
    regTab.classList.remove("active");
    loginForm.style.display = "block";
    regForm.style.display = "none";
  } else {
    regTab.classList.add("active");
    loginTab.classList.remove("active");
    regForm.style.display = "block";
    loginForm.style.display = "none";
  }
}

// ── 2. TEST ACCOUNT HELPER ──
// These credentials work only if this account exists in the backend.
function fillTestAccount() {
  document.getElementById("login-email").value =
    "student@bitmesra.ac.in";
  document.getElementById("login-password").value = "Student123";
}

// ── 3. LOGIN ──
async function handleLogin(e) {
  e.preventDefault();
  clearMessages();

  const email = document
    .getElementById("login-email")
    .value.trim()
    .toLowerCase();

  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  try {
    // Backend /auth/login uses OAuth2PasswordRequestForm — send form-data with 'username' = email.
    const response = await fetch(`${AUTH_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        username: email,   // OAuth2 spec uses 'username' even though it's an email
        password: password
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(
        data.detail || `Login failed (HTTP ${response.status}).`
      );
      return;
    }

    const token = data.access_token || data.token;

    if (!token) {
      console.error("Login response did not contain a token:", data);
      showError("Login response did not contain an access token.");
      return;
    }

    // Store the actual backend-issued tokens.
    localStorage.setItem("campus_token", token);

    const refreshToken = data.refresh_token;
    if (refreshToken) {
      localStorage.setItem("campus_refresh_token", refreshToken);
    }

    // Clear any old demo-session data.
    localStorage.removeItem("lostfound_users");

    // Save the returned user details if the API provides them.
    let user = data.user || data.profile || null;

    if (!user) {
      try {
        const profileResponse = await fetch(`${AUTH_URL}/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (profileResponse.ok) {
          user = await profileResponse.json();
        }
      } catch (error) {
        console.warn("Could not load user profile:", error);
      }
    }

    localStorage.setItem(
      "campus_user",
      JSON.stringify({
        ...(user || {}),
        email: user?.email || email,
        full_name:
          user?.full_name ||
          user?.name ||
          email.split("@")[0],
        role: user?.role || "user"
      })
    );

    showSuccess("Login successful! Redirecting to portal...");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);

  } catch (error) {
    console.error("Login network error:", error);
    showError(
      "Could not reach the backend. Check that the server is running."
    );
  }
}

// ── 4. REGISTRATION ──
async function handleRegister(e) {
  e.preventDefault();
  clearMessages();

  const name = document.getElementById("reg-name").value.trim();
  const email = document
    .getElementById("reg-email")
    .value.trim()
    .toLowerCase();
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;

  if (!name || !email || !password) {
    showError("Please complete all required fields.");
    return;
  }

  if (password.length < 8) {
    showError("Password must be at least 8 characters long.");
    return;
  }

  if (!/[A-Z]/.test(password)) {
    showError("Password must contain at least one uppercase letter.");
    return;
  }

  if (!/[0-9]/.test(password)) {
    showError("Password must contain at least one digit.");
    return;
  }

  try {
    const response = await fetch(`${AUTH_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        full_name: name,
        email: email,
        password: password,
        phone: phone || null
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail;
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg).join(", ")
        : detail;

      showError(
        message || `Registration failed (HTTP ${response.status}).`
      );
      return;
    }

    // Registration succeeded. Sign in using the new backend account.
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = password;

    showTab("login");
    showSuccess("Account created! Please sign in.");

  } catch (error) {
    console.error("Registration network error:", error);
    showError(
      "Could not reach the backend. Check that the server is running."
    );
  }
}

// ── 5. MESSAGE HELPERS ──
function showError(message) {
  const el = document.getElementById("msg-error");
  const successEl = document.getElementById("msg-success");

  if (successEl) successEl.style.display = "none";

  if (el) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    alert(message);
  }
}

function showSuccess(message) {
  const el = document.getElementById("msg-success");
  const errorEl = document.getElementById("msg-error");

  if (errorEl) errorEl.style.display = "none";

  if (el) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    alert(message);
  }
}

function clearMessages() {
  const errorEl = document.getElementById("msg-error");
  const successEl = document.getElementById("msg-success");

  if (errorEl) errorEl.style.display = "none";
  if (successEl) successEl.style.display = "none";
}

// ── 6. PASSWORD VISIBILITY ──
function togglePasswordVisibility() {
  const passwordInput = document.getElementById("login-password");

  if (passwordInput) {
    passwordInput.type =
      passwordInput.type === "password" ? "text" : "password";
  }
}
