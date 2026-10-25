const API_BASE = 'http://127.0.0.1:8000/api/v1';

let items = [];
let currentMainFilter = 'all';
let currentCategoryFilter = 'all';
let selectedItemId = null;

// ── 1. AUTHENTICATION HELPERS ──

function getAuthToken() {
  const rawToken =
     sessionStorage.getItem('campus_token') ||
     sessionStorage.getItem('access_token') ||
     sessionStorage.getItem('token') ||
    '';

  const token = rawToken.replace(/^Bearer\s+/i, '').trim();

  if (!token || /^bearer[_-]/i.test(token)) {
    return '';
  }

  return token;
}

function authHeaders(includeJson = false) {
  const headers = {};

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function refreshAccessToken() {
  const refreshToken =  sessionStorage.getItem('campus_refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      sessionStorage.removeItem('campus_token');
       sessionStorage.removeItem('campus_refresh_token');
      return null;
    }

    const data = await response.json();
    const newToken = data.access_token;
    const newRefresh = data.refresh_token;

    if (newToken)  sessionStorage.setItem('campus_token', newToken);
    if (newRefresh)  sessionStorage.setItem('campus_refresh_token', newRefresh);

    return newToken || null;
  } catch {
    return null;
  }
}

async function fetchWithAuth(url, options = {}) {
  options.headers = { ...authHeaders(), ...(options.headers || {}) };
  let response = await fetch(url, options);

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, options);
    }
  }

  return response;
}
document.addEventListener('DOMContentLoaded', () => {
  // 🟢 Session check: if brwser tab is closed and started again clear the token
  if (!sessionStorage.getItem('session_active')) {
    sessionStorage.removeItem('campus_token');
    sessionStorage.removeItem('campus_refresh_token');
    sessionStorage.removeItem('campus_user');
  }
  // New session marked as active
  sessionStorage.setItem('session_active', 'true');

  checkAuthState();

  const dateInput = document.getElementById('item-date');

  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  loadItemsFromBackend();
});
function normalizeItem(item, type) {
  const rawCategory = String(item.category || '').toLowerCase();
  
  // Agar Found item hai toh contact number hide karke portal/office message dikhayein
  let contactText = '';
  if (type === 'Found') {
    contactText = 'BIT Lalpur Office / Portal Desk (Verified via Claim)';
  } else {
    contactText = item.reporter?.phone || item.contact || 'Contact through the portal';
  }

  return {
    id: Number(item.id),
    type: type,
    name: item.title || item.name || 'Untitled item',
    category: rawCategory === 'electronics' ? 'Electronics' : 'Other Items',
    location: item.location_lost || item.location_found || item.location || '',
    date: item.date_lost || item.date_found || item.created_at || '',
    contact: contactText,
    desc: item.description || item.desc || '',
    img: item.image_url || item.img || ''
  };
}

async function loadItemsFromBackend() {
  
  const container = document.getElementById('portal-content');

  if (container) {
    container.innerHTML = '<p style="padding:1rem;">Loading items...</p>';
  }

  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('You are not logged in. Please log in again.');
    }

    // 🟢 new thing added
    const [lostResponse, foundResponse] = await Promise.all([
      fetchWithAuth(`${API_BASE}/lost-items/?status=open`),
      fetchWithAuth(`${API_BASE}/found-items/?status=open`)
    ]);

    if (lostResponse.status === 401 || foundResponse.status === 401) {
      throw new Error('Your session is invalid or expired. Please log out and log in again.');
    }

    if (!lostResponse.ok || !foundResponse.ok) {
      throw new Error(`API error. Lost items: ${lostResponse.status}; Found items: ${foundResponse.status}.`);
    }

    const [lostData, foundData] = await Promise.all([
      lostResponse.json(),
      foundResponse.json()
    ]);

    const lostItems = Array.isArray(lostData) ? lostData : lostData.items;
    const foundItems = Array.isArray(foundData) ? foundData : foundData.items;

    if (!Array.isArray(lostItems) || !Array.isArray(foundItems)) {
      throw new Error('Unexpected API response format. Check the Swagger response.');
    }

    items = [
      ...lostItems.map(item => normalizeItem(item, 'Lost')),
      ...foundItems.map(item => normalizeItem(item, 'Found'))
    ];

    filterItems();

  } catch (error) {
    console.error('Failed to load items:', error);

    if (container) {
      container.innerHTML = `
        <div style="padding:1.5rem;color:#b91c1c;">
          <h3>Unable to load items</h3>
          <p>${escapeHtml(error.message)}</p>
          <button type="button" class="btn" onclick="loadItemsFromBackend()">Retry</button>
        </div>
      `;
    }
  }
}

function checkAuthState() {
  const userArea = document.getElementById('nav-user-area');

  if (!userArea) return;

  const token =  sessionStorage.getItem('campus_token');
  const userJson =  sessionStorage.getItem('campus_user');

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      const displayName = user.full_name || user.email || 'Student';
      const isAdmin = (user.email === 'adminbitmesralalpur@gmail.com');

      userArea.innerHTML = `
        <span class="user-greeting">👤 ${escapeHtml(displayName)}</span>
        ${isAdmin ? `<a href="admin.html" class="btn btn-outline" style="text-decoration: none;">🛡️ Admin Panel</a>` : ''}
        <button type="button" class="btn-outline" onclick="logoutUser()">Log Out</button>
      `;

      const contactInput = document.getElementById('item-contact');
      if (contactInput && !contactInput.value) {
        contactInput.value = user.phone || user.email || '';
      }

      return;
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }

  userArea.innerHTML = `
    <a href="login.html" class="btn-auth-link">🔐 Login / Register</a>
  `;
}

function logoutUser() {
  sessionStorage.removeItem('campus_token');
   sessionStorage.removeItem('campus_refresh_token');
  sessionStorage.removeItem('campus_user');
  checkAuthState();
  alert('You have been logged out.');
}

function setMainFilter(mainType, element) {
  currentMainFilter = mainType;

  document.querySelectorAll('#chip-main-all, #chip-main-lost, #chip-main-found').forEach(button => button.classList.remove('active'));

  if (element) {
    element.classList.add('active');
  }

  const subLabel = document.getElementById('sub-filter-label');
  if (subLabel) {
    if (mainType === 'Lost') {
      subLabel.textContent = 'Categories inside Lost Items:';
    } else if (mainType === 'Found') {
      subLabel.textContent = 'Categories inside Found Items:';
    } else {
      subLabel.textContent = 'Categories inside items:';
    }
  }

  filterItems();
}

function setCategoryFilter(category, element) {
  currentCategoryFilter = category;

  document.querySelectorAll('.chip-sub').forEach(button => button.classList.remove('active'));

  if (element) {
    element.classList.add('active');
  }

  filterItems();
}

function filterItems() {
  const searchInput = document.getElementById('search-input');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filtered = items.filter(item => {
    const matchesMain = currentMainFilter === 'all' || item.type === currentMainFilter;
    const matchesCategory = currentCategoryFilter === 'all' || item.category === currentCategoryFilter;
    const matchesQuery = String(item.name).toLowerCase().includes(query) ||
                         String(item.desc).toLowerCase().includes(query) ||
                         String(item.location).toLowerCase().includes(query);

    return matchesMain && matchesCategory && matchesQuery;
  });

  renderSections(filtered);
}

function renderSections(filteredList) {
  const container = document.getElementById('portal-content');

  if (!container) return;

  if (filteredList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;color:#888;background:#fafafa;border:1px dashed #ccc;border-radius:8px;">
        <h3>No matching items found</h3>
        <p>Try adjusting your search or category filter.</p>
      </div>
    `;
    return;
  }

  let html = '';

  const sectionTypes = [
    { type: 'Lost', title: '🔴 Lost Items', className: 'lost-section', badge: 'badge-lost-header' },
    { type: 'Found', title: '🟢 Found Items', className: 'found-section', badge: 'badge-found-header' }
  ];

  sectionTypes.forEach(section => {
    if (currentMainFilter !== 'all' && currentMainFilter !== section.type) {
      return;
    }

    const sectionItems = filteredList.filter(item => item.type === section.type);
    if (sectionItems.length === 0) return;

    const electronics = sectionItems.filter(item => item.category === 'Electronics');
    const otherItems = sectionItems.filter(item => item.category !== 'Electronics');

    html += `
      <div class="section-container ${section.className}">
        <div class="section-header">
          <div class="section-title">${section.title}</div>
          <span class="section-badge ${section.badge}">
            ${sectionItems.length} Item${sectionItems.length !== 1 ? 's' : ''}
          </span>
        </div>
    `;

    if ((currentCategoryFilter === 'all' || currentCategoryFilter === 'Electronics') && electronics.length > 0) {
      html += `
        <div class="category-block">
          <div class="category-header">
            <span class="category-name">💻 Electronics</span>
            <span class="category-count">${electronics.length}</span>
          </div>
          <div class="grid">${electronics.map(createCardHtml).join('')}</div>
        </div>
      `;
    }

    if ((currentCategoryFilter === 'all' || currentCategoryFilter === 'Other Items') && otherItems.length > 0) {
      html += `
        <div class="category-block">
          <div class="category-header">
            <span class="category-name">📦 Other Items</span>
            <span class="category-count">${otherItems.length}</span>
          </div>
          <div class="grid">${otherItems.map(createCardHtml).join('')}</div>
        </div>
      `;
    }

    html += '</div>';
  });

  container.innerHTML = html;
}

function createCardHtml(item) {
  const isLost = item.type === 'Lost';
  const tagClass = isLost ? 'tag-lost' : 'tag-found';
  const tagText = isLost ? 'LOST' : 'FOUND';
  const fallbackImage = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=500&q=80';

  let actionButtonHtml = '';
  if (isLost) {
    actionButtonHtml = `
      <button type="button" class="btn card-btn" onclick="contactOwner(${Number(item.id)})">
        📞 Contact Owner
      </button>
    `;
  } else {
    actionButtonHtml = `
      <button type="button" class="btn card-btn" data-item-id="${Number(item.id)}" data-item-name="${escapeHtml(String(item.name || ''))}" onclick="openClaim(Number(this.dataset.itemId), this.dataset.itemName)">
        🤝 Claim Item
      </button>
    `;
  }

  return `
    <div class="card">
      <img src="${escapeHtml(item.img || fallbackImage)}" class="card-img" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <div class="card-body">
        <div class="card-meta">
          <span class="${tagClass}">${tagText} &bull; ${escapeHtml(item.category)} (ID: ${item.id})</span>
          <span style="font-size:.75rem;color:#888;">${escapeHtml(formatDate(item.date))}</span>
        </div>
        <div class="card-title">${escapeHtml(item.name)}</div>
        <div class="card-desc">${escapeHtml(item.desc)}</div>
        <div class="card-info">
          📍 <strong>Location:</strong> ${escapeHtml(item.location)}<br>
          📞 <strong>Contact:</strong> ${escapeHtml(item.contact)}
        </div>
        ${actionButtonHtml}
      </div>
    </div>
  `;
}

function contactOwner(itemId) {
  const item = items.find(currentItem => currentItem.id === itemId && currentItem.type === 'Lost');
  if (!item) {
    alert('Item details are unavailable.');
    return;
  }
  if (!item.contact || item.contact === 'Contact through the portal') {
    alert('No contact information is available for this item.');
    return;
  }
  alert(`Contact information: ${item.contact}`);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString();
}

async function handleReportSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.textContent : 'Submit Report';

  const type = document.getElementById('item-type').value;
  const category = document.getElementById('item-category').value;
  const title = document.getElementById('item-name').value.trim();
  const location = document.getElementById('item-location').value.trim();
  const date = document.getElementById('item-date').value;
  const contact = document.getElementById('item-contact').value.trim();
  const description = document.getElementById('item-desc').value.trim();
  const rollNumber = document.getElementById('item-roll').value.trim(); 
  const imageInput = document.getElementById('item-image');
  const imageFile = imageInput?.files?.[0];
  

  if (!title || !location || !date || !contact || !rollNumber || !description) {
    alert('Please complete all required fields.');
    return;
  }

  if (type === 'Lost') {
    if (!contact) {
      alert('Please enter your contact number. Providing a contact number is mandatory for reporting lost items.');
      document.getElementById('item-contact').focus();
      return;
    }
    if (contact.includes('@')) {
      alert('Email is not allowed in contact info. Please enter a valid phone number only.');
      document.getElementById('item-contact').focus();
      return;
    }
    if (contact.length < 10 || contact.length > 11) {
      alert('Please enter a valid phone number (10 digits).');
      document.getElementById('item-contact').focus();
      return;
    }
  } else {
    if (contact && contact.includes('@')) {
      alert('Email is not allowed in contact info. Please enter a valid phone number only.');
      document.getElementById('item-contact').focus();
      return;
    }
  }


  if (type === 'Found' && !imageFile) {
    alert('Please upload an image for the found item. Image upload is mandatory when reporting a found item.');
    if (imageInput) imageInput.focus();
    return;
  }

  const token = getAuthToken();
  if (!token) {
    alert('Please log in using a valid backend account before reporting an item.');
    return;
  }

  let imageUrl = null;
  if (imageFile) {
    try {
      imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(imageFile);
      });
    } catch (error) {
      alert(error.message);
      return;
    }
  }

const normalizedCategory = category.toLowerCase() === 'electronics' ? 'electronics' : 'other';
  const secretInput = document.getElementById('item-secret');
  const secretText = secretInput ? secretInput.value.trim() : '';

  let payload;

  if (type === 'Lost') {
    payload = {
      title,
      description,
      category: normalizedCategory,
      date_lost: `${date}T00:00:00`,
      location_lost: location,
      contact: `Roll: ${rollNumber} | Contact: ${contact} | Secret/Mark: ${secretText || 'None'}`,
      reward_offered: false,
      reward_amount: null,
      image_url: imageUrl
    };
  } else {
    payload = {
      title,
      description,
      category: normalizedCategory,
      date_found: `${date}T00:00:00`,
      location_found: location,
      contact: `Roll: ${rollNumber} | Contact: ${contact} | Secret/Mark: ${secretText || 'None'}`,
      image_url: imageUrl
    };
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  try {
    const endpoint = type === 'Lost' ? 'lost-items/' : 'found-items/';
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { detail: responseText };
      }
    }

    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
      console.error('Report failed:', response.status, data);
      alert(`Report failed (${response.status}).\n\n${detail}`);
      return;
    }

    closeModal('report-modal');
    form.reset();

    const dateInput = document.getElementById('item-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    await loadItemsFromBackend();
    alert('Item reported successfully!');

  } catch (error) {
    console.error('Report network error:', error);
    alert('Could not connect to FastAPI. Confirm that the backend is running.');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || 'Submit Report';
    }
  }
}

function openClaim(itemId, itemName) {
  selectedItemId = Number(itemId);
  const titleElement = document.getElementById('claim-title');
  if (titleElement) {
    titleElement.textContent = `Claiming: "${itemName}"`;
  }
  openModal('claim-modal');
}

async function handleClaimSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const imageInput = document.getElementById('claim-image');
  const imageFile = imageInput?.files?.[0];

  let imageUrl = null;
  if (imageFile) {
    try {
      imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(imageFile);
      });
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  const proofInput = document.getElementById('claim-proof');
  const rollInput = document.getElementById('claim-roll');
  const contactInput = document.getElementById('claim-contact');
  const semSelect = document.getElementById('claim-semester');
  const claimantRoll = rollInput ? rollInput.value.trim() : '';
  const claimantSem = semSelect ? semSelect.value : '';
  const secretInput = document.getElementById('claim-secret');
  const claimantSecret = secretInput ? secretInput.value.trim() : '';

  const proofDescription = proofInput ? proofInput.value.trim() : '';
  const claimantContact = contactInput ? contactInput.value.trim() : '';

  if (!selectedItemId || !Number.isInteger(selectedItemId)) {
    alert('Please select a valid found item.');
    return;
  }

  if (proofDescription.length < 20) {
    alert('Please provide at least 20 characters describing your proof of ownership.');
    if (proofInput) proofInput.focus();
    return;
  }

  if (!claimantRoll || !claimantContact || !claimantSem) {
    alert('Roll Number, Contact Number aur Semester bharna anivarya hai.');
    return;
  }

  const lostItemIdText = window.prompt(
    'Please enter the ID allocated to you while reporting your lost item. If you have not reported your lost item, kindly report it first.'
  );
  if (lostItemIdText === null) return;

  const lostItemId = Number.parseInt(lostItemIdText.trim(), 10);

  if (!Number.isInteger(lostItemId) || lostItemId <= 0) {
    alert('Enter a valid positive lost-item database ID.');
    return;
  }

  const token = getAuthToken();
  if (!token) {
    alert('Your session does not contain a valid backend access token. Please log in again.');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
  const originalButtonText = submitButton ? (submitButton.tagName === 'INPUT' ? submitButton.value : submitButton.textContent) : 'Submit Claim';

  if (submitButton) {
    submitButton.disabled = true;
    if (submitButton.tagName === 'INPUT') {
      submitButton.value = 'Submitting...';
    } else {
      submitButton.textContent = 'Submitting...';
    }
  }

  try {
    const response = await fetch(`${API_BASE}/claims/`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        lost_item_id: lostItemId,
        found_item_id: selectedItemId,
        proof_description: 
          `Proof: ${proofDescription}\n` +
          `Roll Number: ${claimantRoll}\n` +
          `Contact: ${claimantContact}\n` +
          `Semester: ${claimantSem}\n` +
          `Claimant's Secret Detail: ${claimantSecret}`,
        proof_image_url: imageUrl
      })
    });

    const responseText = await response.text();
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { detail: responseText };
      }
    }

    if (!response.ok) {
      const detail = data.detail || data.message || `HTTP ${response.status}`;
      console.error('Claim failed:', response.status, data);
      alert(`Could not submit claim: ${detail}`);
      return;
    }

    closeModal('claim-modal');

    if (form && typeof form.reset === 'function') {
      form.reset();
    }

    selectedItemId = null;
    alert('Your claim has been successfully submitted to the admin backend! We will verify your details and update you soon.');

  } catch (error) {
    console.error('Claim network error:', error);
    alert('Could not reach FastAPI. Check the backend and browser console.');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      if (submitButton.tagName === 'INPUT') {
        submitButton.value = originalButtonText || 'Submit Claim';
      } else {
        submitButton.textContent = originalButtonText || 'Submit Claim';
      }
    }
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
// Function to open user's claims status modal
async function openMyClaimsModal() {
  openModal('my-claims-modal');
  const container = document.getElementById('my-claims-list');
  container.innerHTML = '<p>Loading your claims...</p>';

  const token = getAuthToken();
  if (!token) {
    container.innerHTML = '<p style="color: #b91c1c;">Please log in first to view your claims.</p>';
    return;
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/claims/`);
    if (!response.ok) {
      throw new Error('Failed to fetch your claims');
    }

    const data = await response.json();
    const claims = Array.isArray(data) ? data : data.items || [];

    if (claims.length === 0) {
      container.innerHTML = '<p style="color: #666;">You have not submitted any claims yet.</p>';
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

    claims.forEach(claim => {
      const statusLower = (claim.status || 'pending').toLowerCase();
      let statusColor = '#2563eb';
      if (statusLower === 'approved') statusColor = '#16a34a';
      else if (statusLower === 'rejected') statusColor = '#dc2626';

      html += `
        <div style="background: #f9fafb; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 6px;">
          <p style="margin: 0 0 0.4rem 0;"><strong>Claim ID:</strong> ${claim.id} | <strong>Found Item ID:</strong> ${claim.found_item_id}</p>
          <p style="margin: 0 0 0.4rem 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${claim.status || 'Pending'}</span></p>
          <p style="margin: 0 0 0.4rem 0; font-size: 0.9rem; color: #4b5563;"><strong>Your Proof:</strong> ${escapeHtml(claim.proof_description)}</p>
          ${claim.admin_notes ? `
            <div style="margin-top: 0.6rem; padding: 0.6rem; background: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 4px;">
              <strong style="color: #0369a1;">📢 Admin Instructions / Message:</strong><br>
              <span style="color: #0c4a6e; font-size: 0.95rem;">${escapeHtml(claim.admin_notes)}</span>
            </div>
          ` : ''}
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

  } catch (error) {
    console.error('Error loading my claims:', error);
    container.innerHTML = `<p style="color: #b91c1c;">Could not load claims: ${error.message}</p>`;
  }
}
// Function: Fetch and display all reported Lost & Found items with contact details
  async function loadAllReportedItems() {
  const container = document.getElementById('all-items-container');
  const token = getAuthToken();
  if (!token) return;

  try {
    // Admin specific endpoints call karein
    const [lostRes, foundRes] = await Promise.all([
      fetch(`${API_BASE}/admin/all-lost-items`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE}/admin/all-found-items`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (!lostRes.ok || !foundRes.ok) {
      throw new Error('Failed to fetch items from admin endpoints.');
    }

    const lostList = await lostRes.json();
    const foundList = await foundRes.json();

    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
    
// Lost Items List Rendering
    html += '<h4 style="color: #dc2626; margin-top: 0.5rem;">🔴 Lost Items Reports</h4>';
    if (lostList.length === 0) {
      html += '<p style="color: #666; font-size: 0.9rem;">No lost items reported yet.</p>';
    } else {
      lostList.forEach(item => {
        const reporterName = item.reporter ? item.reporter.full_name || 'N/A' : 'N/A';
        const reporterEmail = item.reporter ? item.reporter.email || 'N/A' : 'N/A';
        const reporterPhone = item.reporter ? item.reporter.phone || 'N/A' : 'N/A';
        
        html += `
          <div style="background: #ffffff; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.8rem;">
            <p><strong>Item ID:</strong> ${item.id} | <strong>Title:</strong> ${item.title}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #4b5563;"><strong>Description:</strong> ${item.description || 'N/A'}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #4b5563;"><strong>Location:</strong> ${item.location_lost || 'N/A'} | <strong>Date:</strong> ${item.date_lost || 'N/A'}</p>
            <!-- 🟢 Yeh line add karni hai taaki Roll & Secret Mark dikhe -->
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #1e3a8a;"><strong>Roll & Secret Info:</strong> ${item.contact || 'N/A'}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #16a34a; font-weight: bold;"><strong>Reporter Details:</strong> ${reporterName} (${reporterEmail}) - Phone: ${reporterPhone}</p>
          </div>
        `;
      });
    }

    // Found Items List Rendering
    html += '<h4 style="color: #16a34a; margin-top: 1.5rem;">🟢 Found Items Reports</h4>';
    if (foundList.length === 0) {
      html += '<p style="color: #666; font-size: 0.9rem;">No found items reported yet.</p>';
    } else {
      foundList.forEach(item => {
        const reporterName = item.reporter ? item.reporter.full_name || 'N/A' : 'N/A';
        const reporterEmail = item.reporter ? item.reporter.email || 'N/A' : 'N/A';
        const reporterPhone = item.reporter ? item.reporter.phone || 'N/A' : 'N/A';

        html += `
          <div style="background: #ffffff; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.8rem;">
            <p><strong>Item ID:</strong> ${item.id} | <strong>Title:</strong> ${item.title}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #4b5563;"><strong>Description:</strong> ${item.description || 'N/A'}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #4b5563;"><strong>Location:</strong> ${item.location_found || 'N/A'} | <strong>Date:</strong> ${item.date_found || 'N/A'}</p>
            <!-- 🟢 Yahan bhi yeh line add karni hai -->
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #1e3a8a;"><strong>Roll & Secret Info:</strong> ${item.contact || 'N/A'}</p>
            <p style="margin-top: 0.3rem; font-size: 0.9rem; color: #16a34a; font-weight: bold;"><strong>Reporter Details:</strong> ${reporterName} (${reporterEmail}) - Phone: ${reporterPhone}</p>
          </div>
        `;
      });
    }

    html += '</div>';
    container.innerHTML = html;

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Error loading items: ${error.message}</p>`;
  }
}