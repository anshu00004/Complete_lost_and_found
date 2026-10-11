/* ==========================================================================
   LOGIN.JS — Authentication Logic for Login & Registration Page
   
   HOW IT WORKS:
   1. Connects to login.html
   2. Manages registered accounts in localStorage
   3. Validates password rules matching anshu00004/lost-and-found
   4. On login success, saves session and redirects to index.html
   ========================================================================== */

// ── 1. DEFAULT USER DATABASE ──
// Uses the exact fields from anshu00004/lost-and-found schemas:
// (full_name, email, password, phone, role)
const BACKEND_URL = "http://127.0.0.1:8000";

// When user press login button
async function sendLoginData(email, password) {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/login`, { // Jo bhi aapka backend ka route ho
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email: email, password: password })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log("Login Successful!", data);
            alert("Login ho gaya!");
        } else {
            console.log("Login Failed:", data.detail);
        }
    } catch (error) {
        console.error("Connection Error:", error);
    }
}
const DEFAULT_USERS = [
  {
    full_name: "Rishav Raj",
    email: "student@bitmesra.ac.in",
    password: "Student123",
    phone: "7488402331",
    role: "user"
  },
  {
    full_name: "Campus Admin",
    email: "admin@bitmesra.ac.in",
    password: "Admin123",
    phone: "9142433107",
    role: "admin"
  }
];

/**
 * Retrieves the users list from localStorage.
 * If first time running, initializes with DEFAULT_USERS.
 */
function getUsers() {
  const stored = localStorage.getItem('lostfound_users');
  if (!stored) {
    localStorage.setItem('lostfound_users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEFAULT_USERS;
  }
}

/**
 * Saves updated users list back to localStorage.
 */
function saveUsers(usersList) {
  localStorage.setItem('lostfound_users', JSON.stringify(usersList));
}

// ── 2. TAB SWITCHING (Sign In vs Register) ──
function showTab(tab) {
  clearMessages();
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');

  if (tab === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
  } else {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
}

// ── 3. QUICK 1-CLICK TEST CREDENTIALS ──
function fillTestAccount() {
  document.getElementById('login-email').value = 'student@bitmesra.ac.in';
  document.getElementById('login-password').value = 'Student123';
}

// ── 4. SIGN IN FORM HANDLER ──
function handleLogin(e) {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  const users = getUsers();
  const matchedUser = users.find(u => u.email.toLowerCase() === email && u.password === password);

  if (!matchedUser) {
    showError('Invalid email or password. Please try again.');
    return;
  }

  // Create session token (compatible with TokenResponse schema)
  const token = 'bearer_' + btoa(matchedUser.email + ':' + Date.now());

  // Store in localStorage for index.html to read
  localStorage.setItem('campus_token', token);
  localStorage.setItem('campus_user', JSON.stringify({
    full_name: matchedUser.full_name,
    email: matchedUser.email,
    phone: matchedUser.phone,
    role: matchedUser.role || 'user'
  }));

  showSuccess(`Welcome back, ${matchedUser.full_name}! Redirecting to Face of Project...`);

  // Redirect to main Face of Project page
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 900);
}

// ── 5. REGISTRATION FORM HANDLER ──
function handleRegister(e) {
  e.preventDefault();
  clearMessages();

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;

  // Validate rules from anshu00004 schemas.py
  if (password.length < 8) {
    showError('Password must be at least 8 characters long.');
    return;
  }
  if (!/[A-Z]/.test(password)) {
    showError('Password must contain at least one uppercase letter (A-Z).');
    return;
  }
  if (!/[0-9]/.test(password)) {
    showError('Password must contain at least one digit (0-9).');
    return;
  }

  const users = getUsers();

  // Check if email already registered
  if (users.some(u => u.email.toLowerCase() === email)) {
    showError('An account with this email already exists. Please Sign In.');
    return;
  }

  // Add new user
  const newUser = {
    full_name: name,
    email: email,
    password: password,
    phone: phone || '',
    role: 'user'
  };

  users.push(newUser);
  saveUsers(users);

  // Auto-login newly registered user
  const token = 'bearer_' + btoa(newUser.email + ':' + Date.now());
  localStorage.setItem('campus_token', token);
  localStorage.setItem('campus_user', JSON.stringify({
    full_name: newUser.full_name,
    email: newUser.email,
    phone: newUser.phone,
    role: newUser.role
  }));

  showSuccess('Account created successfully! Redirecting to Face of Project...');

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 900);
}

// ── 6. UI ALERT HELPERS ──
function showError(msg) {
  const el = document.getElementById('msg-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function showSuccess(msg) {
  const el = document.getElementById('msg-success');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearMessages() {
  document.getElementById('msg-error').style.display = 'none';
  document.getElementById('msg-success').style.display = 'none';
}

// Initialize database on page load
document.addEventListener('DOMContentLoaded', () => {
  getUsers();
});
