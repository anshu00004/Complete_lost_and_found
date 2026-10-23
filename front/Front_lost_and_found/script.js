const API_BASE = 'http://127.0.0.1:8000/api/v1';

let items = [];
let currentMainFilter = 'all';
let currentCategoryFilter = 'all';
let selectedItemId = null;

// ── 1. AUTHENTICATION HELPERS ──

function getAuthToken() {
  const rawToken =
    localStorage.getItem('campus_token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
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


document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();

  const dateInput = document.getElementById('item-date');

  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  loadItemsFromBackend();
});


function normalizeItem(item, type) {
  const rawCategory = String(item.category || '').toLowerCase();

  return {
    id: Number(item.id),
    type: type,
    name: item.title || item.name || 'Untitled item',

    category:
      rawCategory === 'electronics'
        ? 'Electronics'
        : 'Other Items',

    location:
      item.location_lost ||
      item.location_found ||
      item.location ||
      '',

    date:
      item.date_lost ||
      item.date_found ||
      item.created_at ||
      '',

    contact:
      item.reporter?.phone ||
      item.contact ||
      'Contact through the portal',

    desc: item.description || item.desc || '',
    img: item.image_url || item.img || ''
  };
}


async function loadItemsFromBackend() {
  const container = document.getElementById('portal-content');

  if (container) {
    container.innerHTML =
      '<p style="padding:1rem;">Loading items...</p>';
  }

  try {
    // Get the token saved during login
    const rawToken = localStorage.getItem('campus_token');

    if (!rawToken) {
      throw new Error('You are not logged in. Please log in again.');
    }

    // Handle tokens stored either with or without "Bearer "
    const token = rawToken.replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '');

    const headers = {
      Authorization: `Bearer ${token}`
    };

    const [lostResponse, foundResponse] = await Promise.all([
      fetch(`${API_BASE}/lost-items/`, { headers }),
      fetch(`${API_BASE}/found-items/`, { headers })
    ]);

    if (lostResponse.status === 401 || foundResponse.status === 401) {
      throw new Error(
        'Your session is invalid or expired. Please log out and log in again.'
      );
    }

    if (!lostResponse.ok || !foundResponse.ok) {
      throw new Error(
        `API error. Lost items: ${lostResponse.status}; ` +
        `Found items: ${foundResponse.status}.`
      );
    }

    const [lostData, foundData] = await Promise.all([
      lostResponse.json(),
      foundResponse.json()
    ]);

    // Your API response may contain { items: [...] } rather than a raw array
    const lostItems = Array.isArray(lostData)
      ? lostData
      : lostData.items;

    const foundItems = Array.isArray(foundData)
      ? foundData
      : foundData.items;

    if (!Array.isArray(lostItems) || !Array.isArray(foundItems)) {
      throw new Error(
        'Unexpected API response format. Check the Swagger response.'
      );
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
          <button
            type="button"
            class="btn"
            onclick="loadItemsFromBackend()">
            Retry
          </button>
        </div>
      `;
    }
  }
}



function checkAuthState() {
  const userArea = document.getElementById('nav-user-area');

  if (!userArea) return;

  const token = localStorage.getItem('campus_token');
  const userJson = localStorage.getItem('campus_user');

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      const displayName = user.full_name || user.email || 'Student';

      userArea.innerHTML = `
        <span class="user-greeting">
          👤 ${escapeHtml(displayName)}
        </span>

        <button
          type="button"
          class="btn-outline"
          onclick="logoutUser()">
          Log Out
        </button>
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
    <a href="login.html" class="btn-auth-link">
      🔐 Login / Register
    </a>
  `;
}

function logoutUser() {
  localStorage.removeItem('campus_token');
  localStorage.removeItem('campus_user');

  checkAuthState();

  alert('You have been logged out.');
}


function setMainFilter(mainType, element) {
  currentMainFilter = mainType;

  document
    .querySelectorAll(
      '#chip-main-all, #chip-main-lost, #chip-main-found'
    )
    .forEach(button => button.classList.remove('active'));

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

  document
    .querySelectorAll('.chip-sub')
    .forEach(button => button.classList.remove('active'));

  if (element) {
    element.classList.add('active');
  }

  filterItems();
}


function filterItems() {
  const searchInput = document.getElementById('search-input');

  const query = (
    searchInput ? searchInput.value : ''
  ).toLowerCase().trim();

  const filtered = items.filter(item => {
    const matchesMain =
      currentMainFilter === 'all' ||
      item.type === currentMainFilter;

    const matchesCategory =
      currentCategoryFilter === 'all' ||
      item.category === currentCategoryFilter;

    const matchesQuery =
      String(item.name).toLowerCase().includes(query) ||
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
      <div style="
        text-align:center;
        padding:3rem;
        color:#888;
        background:#fafafa;
        border:1px dashed #ccc;
        border-radius:8px;
      ">
        <h3>No matching items found</h3>
        <p>Try adjusting your search or category filter.</p>
      </div>
    `;
    return;
  }

  let html = '';

  const sectionTypes = [
    {
      type: 'Lost',
      title: '🔴 Lost Items',
      className: 'lost-section',
      badge: 'badge-lost-header'
    },
    {
      type: 'Found',
      title: '🟢 Found Items',
      className: 'found-section',
      badge: 'badge-found-header'
    }
  ];

  sectionTypes.forEach(section => {
    if (
      currentMainFilter !== 'all' &&
      currentMainFilter !== section.type
    ) {
      return;
    }

    const sectionItems = filteredList.filter(
      item => item.type === section.type
    );

    if (sectionItems.length === 0) return;

    const electronics = sectionItems.filter(
      item => item.category === 'Electronics'
    );

    const otherItems = sectionItems.filter(
      item => item.category !== 'Electronics'
    );

    html += `
      <div class="section-container ${section.className}">
        <div class="section-header">
          <div class="section-title">${section.title}</div>

          <span class="section-badge ${section.badge}">
            ${sectionItems.length}
            Item${sectionItems.length !== 1 ? 's' : ''}
          </span>
        </div>
    `;

    if (
      (currentCategoryFilter === 'all' ||
        currentCategoryFilter === 'Electronics') &&
      electronics.length > 0
    ) {
      html += `
        <div class="category-block">
          <div class="category-header">
            <span class="category-name">💻 Electronics</span>
            <span class="category-count">${electronics.length}</span>
          </div>

          <div class="grid">
            ${electronics.map(createCardHtml).join('')}
          </div>
        </div>
      `;
    }

    if (
      (currentCategoryFilter === 'all' ||
        currentCategoryFilter === 'Other Items') &&
      otherItems.length > 0
    ) {
      html += `
        <div class="category-block">
          <div class="category-header">
            <span class="category-name">📦 Other Items</span>
            <span class="category-count">${otherItems.length}</span>
          </div>

          <div class="grid">
            ${otherItems.map(createCardHtml).join('')}
          </div>
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

  const fallbackImage =
    'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=500&q=80';

  let actionButtonHtml = '';

  if (isLost) {
    actionButtonHtml = `
      <button
        type="button"
        class="btn card-btn"
        onclick="contactOwner(${Number(item.id)})">
        📞 Contact Owner
      </button>
    `;
  } else {
    actionButtonHtml = `
      <button
        type="button"
        class="btn card-btn"
        data-item-id="${Number(item.id)}"
        data-item-name="${escapeHtml(String(item.name || ''))}"
        onclick="openClaim(
          Number(this.dataset.itemId),
          this.dataset.itemName
        )">
        🤝 Claim Item
      </button>
    `;
  }

  return `
    <div class="card">
      <img
        src="${escapeHtml(item.img || fallbackImage)}"
        class="card-img"
        alt="${escapeHtml(item.name)}"
        onerror="this.onerror=null;this.src='${fallbackImage}'"
      >

      <div class="card-body">
        <div class="card-meta">
          <span class="${tagClass}">
            ${tagText} &bull; ${escapeHtml(item.category)}
          </span>

          <span style="font-size:.75rem;color:#888;">
            ${escapeHtml(formatDate(item.date))}
          </span>
        </div>

        <div class="card-title">
          ${escapeHtml(item.name)}
        </div>

        <div class="card-desc">
          ${escapeHtml(item.desc)}
        </div>

        <div class="card-info">
          📍 <strong>Location:</strong>
          ${escapeHtml(item.location)}<br>

          📞 <strong>Contact:</strong>
          ${escapeHtml(item.contact)}
        </div>

        ${actionButtonHtml}
      </div>
    </div>
  `;
}

function contactOwner(itemId) {
  const item = items.find(
    currentItem =>
      currentItem.id === itemId &&
      currentItem.type === 'Lost'
  );

  if (!item) {
    alert('Item details are unavailable.');
    return;
  }

  if (
    !item.contact ||
    item.contact === 'Contact through the portal'
  ) {
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

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  const originalButtonText = submitButton
    ? submitButton.textContent
    : 'Submit Report';

  const type = document.getElementById('item-type').value;
  const category = document.getElementById('item-category').value;
  const title = document.getElementById('item-name').value.trim();
  const location = document.getElementById('item-location').value.trim();
  const date = document.getElementById('item-date').value;
  const contact = document.getElementById('item-contact').value.trim();
  const description = document.getElementById('item-desc').value.trim();

  const imageInput = document.getElementById('item-image');
  const imageFile = imageInput?.files?.[0];

  if (!title || !location || !date || !contact || !description) {
    alert('Please complete all required fields.');
    return;
  }

  const token = getAuthToken();

  if (!token) {
    alert(
      'Please log in using a valid backend account before reporting an item.'
    );
    return;
  }

  let imageUrl = null;

  if (imageFile) {
    if (!imageFile.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    // The backend schema must accept image_url for this approach.
    try {
      imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve(String(reader.result));
        };

        reader.onerror = () => {
          reject(new Error('Could not read the selected image.'));
        };

        reader.readAsDataURL(imageFile);
      });
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  const normalizedCategory =
    category.toLowerCase() === 'electronics'
      ? 'electronics'
      : 'other';

  let payload;

  if (type === 'Lost') {
    payload = {
      title,
      description,
      category: normalizedCategory,
      date_lost: `${date}T00:00:00`,
      location_lost: location,
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
      image_url: imageUrl
    };
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  try {
    const endpoint =
      type === 'Lost' ? 'lost-items/' : 'found-items/';

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
      const detail =
        typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data.detail || data);

      console.error('Report failed:', response.status, data);

      if (response.status === 401 || response.status === 403) {
        alert(
          `Authentication error (${response.status}). ` +
          'Please log in again using a valid backend account.\n\n' +
          detail
        );
      } else if (response.status === 422) {
        alert(
          'The backend rejected the report data. Check the request schema.\n\n' +
          detail
        );
      } else {
        alert(
          `Report failed (${response.status}).\n\n${detail}`
        );
      }

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

    alert(
      'Could not connect to FastAPI. Confirm that the backend is running.'
    );

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

  const proofInput = document.getElementById('claim-proof');
  const contactInput = document.getElementById('claim-contact');

  const proofDescription = proofInput
    ? proofInput.value.trim()
    : '';

  const claimantContact = contactInput
    ? contactInput.value.trim()
    : '';

  if (!selectedItemId || !Number.isInteger(selectedItemId)) {
    alert('Please select a valid found item.');
    return;
  }

  if (proofDescription.length < 20) {
    alert(
      'Please provide at least 20 characters describing your proof of ownership.'
    );

    if (proofInput) proofInput.focus();

    return;
  }

  if (!claimantContact) {
    alert('Please enter your phone number or roll number.');

    if (contactInput) contactInput.focus();

    return;
  }

  const lostItemIdText = window.prompt(
    'Enter the database ID of the lost item you reported. ' +
    'This claim links it to the selected found item.'
  );

  if (lostItemIdText === null) return;

  const lostItemId = Number.parseInt(lostItemIdText.trim(), 10);

  if (!Number.isInteger(lostItemId) || lostItemId <= 0) {
    alert('Enter a valid positive lost-item database ID.');
    return;
  }

  const token = getAuthToken();

  if (!token) {
    alert(
      'Your session does not contain a valid backend access token. ' +
      'Please log in again.'
    );

    return;
  }

  const form = event.currentTarget;

  const submitButton = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  const originalButtonText = submitButton
    ? (
      submitButton.tagName === 'INPUT'
        ? submitButton.value
        : submitButton.textContent
    )
    : 'Submit Claim';

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
          `${proofDescription}\n` +
          `Claimant phone/roll number: ${claimantContact}`
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
      const detail =
        data.detail ||
        data.message ||
        `HTTP ${response.status}`;

      console.error('Claim failed:', response.status, data);

      if (response.status === 401 || response.status === 403) {
        alert(
          `Authentication/permission error: ${detail}\n\n` +
          'Please log in again using a valid backend account.'
        );
      } else if (response.status === 404) {
        alert(
          `Claim failed: ${detail}\n\n` +
          'Check that both database IDs exist.'
        );
      } else if (response.status === 422) {
        alert(
          `The backend rejected the claim data: ${detail}\n\n` +
          'Check the required claim fields.'
        );
      } else {
        alert(`Could not submit claim: ${detail}`);
      }

      return;
    }

    closeModal('claim-modal');

    const claimForm = document.querySelector('#claim-modal form');

    if (claimForm) {
      claimForm.reset();
    }

    selectedItemId = null;

    alert('Claim request successfully submitted to the backend.');

  } catch (error) {
    console.error('Claim network error:', error);

    alert(
      'Could not reach FastAPI. Check the backend and browser console.'
    );

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

// ── 14. HTML ESCAPING ──

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