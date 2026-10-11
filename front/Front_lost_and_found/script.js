/* ==========================================================================
   SCRIPT.JS — JavaScript Logic for Smart Campus Lost & Found Portal
   
   ORGANIZATION:
   • Top Level: Lost Items & Found Items
   • Inside Each: Electronics & Other Items (NOT side by side!)
   • Authentication: Connects to login.html and FastAPI backend
   ========================================================================== */

// ── 1. SAMPLE DATA ──
let items = [
  // --- LOST ITEMS: Electronics ---
  {
    id: 1,
    type: 'Lost',
    name: 'Apple MacBook Air M2 (Midnight)',
    category: 'Electronics',
    location: 'Computer Lab 3, Academic Block',
    date: '2026-09-28',
    contact: '7488402331',
    desc: 'Left in Computer Lab 3 near desk #14. Has a transparent protective shell.',
    img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=500&q=80'
  },
  {
    id: 2,
    type: 'Lost',
    name: 'Sony WH-1000XM5 Headphones',
    category: 'Electronics',
    location: 'Student Canteen Lawn',
    date: '2026-09-29',
    contact: '7903164020',
    desc: 'Silver noise canceling headphones inside a dark grey zippered hard case.',
    img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80'
  },

  // --- LOST ITEMS: Other Items ---
  {
    id: 3,
    type: 'Lost',
    name: 'Student ID Card & Room Keys',
    category: 'Other Items',
    location: 'Library Reading Hall 2nd Floor',
    date: '2026-09-30',
    contact: '8969945857',
    desc: 'BIT Mesra student ID card with a bunch of 3 keys attached to a blue lanyard.',
    img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=500&q=80'
  },

  // --- FOUND ITEMS: Electronics ---
  {
    id: 4,
    type: 'Found',
    name: 'Casio Scientific Calculator fx-991CW',
    category: 'Electronics',
    location: 'Mechanical Dept Seminar Hall',
    date: '2026-09-29',
    contact: '9142433107',
    desc: 'Black scientific calculator with slide-on case left on front row chair.',
    img: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=500&q=80'
  },

  // --- FOUND ITEMS: Other Items ---
  {
    id: 5,
    type: 'Found',
    name: 'Black Leather Wallet with Cards',
    category: 'Other Items',
    location: 'Central Library 1st Floor',
    date: '2026-09-29',
    contact: '9142433107',
    desc: 'Found near reading table. Contains student ID card belonging to Rishav Raj.',
    img: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=500&q=80'
  },
  {
    id: 6,
    type: 'Found',
    name: 'Hydro Flask Water Bottle',
    category: 'Other Items',
    location: 'Sports Complex Basketball Court',
    date: '2026-09-27',
    contact: '8969945857',
    desc: 'Blue 32oz Hydroflask water bottle with mountain stickers found on bench.',
    img: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=500&q=80'
  }
];

// Current filter state
let currentMainFilter = 'all';       // 'all', 'Lost', or 'Found'
let currentCategoryFilter = 'all';   // 'all', 'Electronics', or 'Other Items'

// ── 2. INITIALIZATION ON PAGE LOAD ──
document.addEventListener('DOMContentLoaded', () => {
  // Check user login session
  checkAuthState();

  // Set default date in modal to today
  const dateInput = document.getElementById('item-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Initial render of all sections
  filterItems();
});

// ── 3. AUTHENTICATION & SESSION STATE ──
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
        <span class="user-greeting">👤 ${escapeHtml(displayName)}</span>
        <button type="button" class="btn-outline" onclick="logoutUser()" title="Sign out of your account">Log Out</button>
      `;

      // Pre-fill contact info in report form if available
      const contactInput = document.getElementById('item-contact');
      if (contactInput && !contactInput.value) {
        contactInput.value = user.phone || user.email || '';
      }
      return;
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }

  // Not logged in: Show Login button
  userArea.innerHTML = `
    <a href="login.html" class="btn-auth-link">🔐 Login / Register</a>
  `;
}

function logoutUser() {
  localStorage.removeItem('campus_token');
  localStorage.removeItem('campus_user');
  checkAuthState();
  alert('You have been logged out.');
}

// ── 4. HIERARCHICAL FILTER HANDLERS ──

/**
 * Sets top-level filter: All, Lost Items, or Found Items
 */
function setMainFilter(mainType, element) {
  currentMainFilter = mainType;

  // Update active state on main filter buttons
  document.querySelectorAll('#chip-main-all, #chip-main-lost, #chip-main-found')
    .forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');

  // Update sub-filter label to show that categories are INSIDE the selected status
  const subLabel = document.getElementById('sub-filter-label');
  if (mainType === 'Lost') {
    subLabel.textContent = 'Categories inside Lost Items:';
  } else if (mainType === 'Found') {
    subLabel.textContent = 'Categories inside Found Items:';
  } else {
    subLabel.textContent = 'Categories inside items:';
  }

  filterItems();
}

/**
 * Sets category sub-filter: All Categories, Electronics, or Other Items
 */
function setCategoryFilter(category, element) {
  currentCategoryFilter = category;

  // Update active state on category chips
  document.querySelectorAll('.chip-sub').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');

  filterItems();
}

/**
 * Main filter function combining Search + Main Status + Category inside Status
 */
function filterItems() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();

  // Filter the items list
  const filtered = items.filter(item => {
    // 1. Matches Main Status (Lost / Found / All)
    const matchesMain = (currentMainFilter === 'all') || (item.type === currentMainFilter);

    // 2. Matches Category inside Status (Electronics / Other Items / All)
    const matchesCategory = (currentCategoryFilter === 'all') || 
                            (item.category === currentCategoryFilter) ||
                            (currentCategoryFilter === 'Other Items' && item.category !== 'Electronics');

    // 3. Matches Search query text
    const matchesQuery = item.name.toLowerCase().includes(query) ||
                         item.desc.toLowerCase().includes(query) ||
                         item.location.toLowerCase().includes(query);

    return matchesMain && matchesCategory && matchesQuery;
  });

  renderSections(filtered);
}

// ── 5. RENDER SECTIONS (Lost Items & Found Items containing Electronics & Other Items) ──

/**
 * Renders the sections so Electronics and Other Items are INSIDE Lost Items and Found Items
 */
function renderSections(filteredList) {
  const container = document.getElementById('portal-content');

  if (filteredList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #888; background: #fafafa; border: 1px dashed #ccc; border-radius: 8px;">
        <h3>No matching items found</h3>
        <p style="margin-top: 0.5rem; font-size: 0.9rem;">Try adjusting your search or category filter.</p>
      </div>
    `;
    return;
  }

  let html = '';

  // 1. SECTION: LOST ITEMS (render if user chose 'all' or 'Lost')
  if (currentMainFilter === 'all' || currentMainFilter === 'Lost') {
    const lostItems = filteredList.filter(i => i.type === 'Lost');
    const lostElectronics = lostItems.filter(i => i.category === 'Electronics');
    const lostOther = lostItems.filter(i => i.category !== 'Electronics');

    // Only render section if it has matching items
    if (lostItems.length > 0) {
      html += `
        <div class="section-container lost-section">
          <div class="section-header">
            <div class="section-title">🔴 Lost Items</div>
            <span class="section-badge badge-lost-header">${lostItems.length} Item${lostItems.length > 1 ? 's' : ''}</span>
          </div>

          <!-- Electronics Category INSIDE Lost Items -->
          ${(currentCategoryFilter === 'all' || currentCategoryFilter === 'Electronics') && lostElectronics.length > 0 ? `
            <div class="category-block">
              <div class="category-header">
                <span class="category-name">💻 Electronics</span>
                <span class="category-count">${lostElectronics.length}</span>
              </div>
              <div class="grid">
                ${lostElectronics.map(item => createCardHtml(item)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Other Items Category INSIDE Lost Items -->
          ${(currentCategoryFilter === 'all' || currentCategoryFilter === 'Other Items') && lostOther.length > 0 ? `
            <div class="category-block">
              <div class="category-header">
                <span class="category-name">📦 Other Items</span>
                <span class="category-count">${lostOther.length}</span>
              </div>
              <div class="grid">
                ${lostOther.map(item => createCardHtml(item)).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  // 2. SECTION: FOUND ITEMS (render if user chose 'all' or 'Found')
  if (currentMainFilter === 'all' || currentMainFilter === 'Found') {
    const foundItems = filteredList.filter(i => i.type === 'Found');
    const foundElectronics = foundItems.filter(i => i.category === 'Electronics');
    const foundOther = foundItems.filter(i => i.category !== 'Electronics');

    // Only render section if it has matching items
    if (foundItems.length > 0) {
      html += `
        <div class="section-container found-section">
          <div class="section-header">
            <div class="section-title">🟢 Found Items</div>
            <span class="section-badge badge-found-header">${foundItems.length} Item${foundItems.length > 1 ? 's' : ''}</span>
          </div>

          <!-- Electronics Category INSIDE Found Items -->
          ${(currentCategoryFilter === 'all' || currentCategoryFilter === 'Electronics') && foundElectronics.length > 0 ? `
            <div class="category-block">
              <div class="category-header">
                <span class="category-name">💻 Electronics</span>
                <span class="category-count">${foundElectronics.length}</span>
              </div>
              <div class="grid">
                ${foundElectronics.map(item => createCardHtml(item)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Other Items Category INSIDE Found Items -->
          ${(currentCategoryFilter === 'all' || currentCategoryFilter === 'Other Items') && foundOther.length > 0 ? `
            <div class="category-block">
              <div class="category-header">
                <span class="category-name">📦 Other Items</span>
                <span class="category-count">${foundOther.length}</span>
              </div>
              <div class="grid">
                ${foundOther.map(item => createCardHtml(item)).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  container.innerHTML = html;
}

/**
 * Creates HTML string for a single item card
 */
function createCardHtml(item) {
  const isLost = item.type === 'Lost';
  const tagClass = isLost ? 'tag-lost' : 'tag-found';
  const tagText = isLost ? 'LOST' : 'FOUND';

  return `
    <div class="card">
      <img 
        src="${item.img}" 
        class="card-img" 
        alt="${escapeHtml(item.name)}" 
        onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=500&q=80'"
      >
      <div class="card-body">
        <div class="card-meta">
          <span class="${tagClass}">${tagText} &bull; ${escapeHtml(item.category)}</span>
          <span style="font-size: 0.75rem; color: #888;">${item.date}</span>
        </div>

        <div class="card-title">${escapeHtml(item.name)}</div>
        <div class="card-desc">${escapeHtml(item.desc)}</div>

        <div class="card-info">
          📍 <strong>Location:</strong> ${escapeHtml(item.location)}<br>
          📞 <strong>Contact:</strong> ${escapeHtml(item.contact)}
        </div>

        <button class="btn card-btn" onclick="openClaim('${escapeHtml(item.name.replace(/'/g, "\\'"))}')">
          🤝 Claim Item
        </button>
      </div>
    </div>
  `;
}

// ── 6. REPORT FORM SUBMISSION ──
async function handleReportSubmit(e) {
  e.preventDefault();

  const newItem = {
    id: Date.now(),
    type: document.getElementById('item-type').value,
    name: document.getElementById('item-name').value.trim(),
    category: document.getElementById('item-category').value,
    location: document.getElementById('item-location').value.trim(),
    date: document.getElementById('item-date').value,
    contact: document.getElementById('item-contact').value.trim(),
    desc: document.getElementById('item-desc').value.trim(),
    img: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=500&q=80'
  };

  // Add new item to beginning of items array
  items.unshift(newItem);

  // Close modal and reset form
  closeModal('report-modal');
  document.getElementById('report-form').reset();

  filterItems();

  alert('Item reported successfully!');
}

// ── 7. CLAIM FORM HANDLER ──
function openClaim(itemName) {
  document.getElementById('claim-title').textContent = `Claiming: "${itemName}"`;
  openModal('claim-modal');
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  closeModal('claim-modal');
  alert('Claim request submitted to owner/admin!');
}

// ── 8. MODAL UTILITIES ──
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// ── 9. XSS PROTECTION ──
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}
