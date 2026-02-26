/**
 * Cyber Sweeft Project Store - Google Sheets Edition
 * Fetches projects from Google Sheets via opensheet API
 */

// ==========================================
// STATE
// ==========================================
let allProjects = [];
let filteredProjects = [];
let schoolsData = [];
let currentPurchase = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await loadProjects();
  setupEventListeners();
});

// ==========================================
// LOAD PROJECTS FROM GOOGLE SHEETS
// ==========================================
async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  const filters = document.getElementById('categoryFilters');
  
  showLoading(true);
  
  try {
    // Use opensheet.elk.sh for public sheet access (no auth needed)
    const url = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}/${encodeURIComponent(CONFIG.SHEET_NAME)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch projects');
    
    const rows = await response.json();
    
    // Transform sheet rows to project objects
    allProjects = rows
      .filter(row => row.status === 'active' || !row.status) // Only active projects
      .map(row => ({
        id: row.id,
        name: row.projectName,
        school: row.school || '', // Added school column
        category: row.department,
        price: parseInt(row.price) || CONFIG.PRICE,
        driveId: row.fileId,
        description: row.description,
        driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${row.fileId}`,
        viewUrl: `https://drive.google.com/file/d/${row.fileId}/view`
      }));
    
    filteredProjects = [...allProjects];
    
    // Build schools data from projects (since sheet doesn't have separate schools table)
    buildSchoolsData();
    
    renderFilters();
    renderProjects();
    
  } catch (error) {
    console.error('Load error:', error);
    if (grid) {
      grid.innerHTML = `
        <div class="no-results">
          <p>Failed to load projects. Please check your connection and refresh.</p>
          <p class="error-detail">${error.message}</p>
        </div>
      `;
    }
  } finally {
    showLoading(false);
  }
}

// Build schools/departments structure from projects data
function buildSchoolsData() {
  const schoolMap = new Map();
  
  allProjects.forEach(project => {
    if (!schoolMap.has(project.school)) {
      schoolMap.set(project.school, new Set());
    }
    schoolMap.get(project.school).add(project.category);
  });
  
  schoolsData = Array.from(schoolMap.entries()).map(([name, departments]) => ({
    name,
    departments: Array.from(departments).sort()
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function showLoading(show) {
  const grid = document.getElementById('projectsGrid');
  if (grid) {
    grid.style.display = show ? 'none' : 'grid';
  }
  const loading = document.getElementById('loadingIndicator');
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

// ==========================================
// RENDER FILTERS (Dropdowns)
// ==========================================
function renderFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  
  container.innerHTML = `
    <div class="filters-wrapper">
      <div class="filter-group">
        <label class="filter-label">Select School:</label>
        <select id="schoolSelect" class="filter-select">
          <option value="all">All Schools</option>
          ${schoolsData.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Select Department:</label>
        <select id="deptSelect" class="filter-select">
          <option value="all">All Departments</option>
        </select>
      </div>
    </div>
  `;
  
  // Event listeners
  const schoolSelect = document.getElementById('schoolSelect');
  const deptSelect = document.getElementById('deptSelect');
  
  if (schoolSelect) {
    schoolSelect.addEventListener('change', (e) => {
      updateDepartmentOptions(e.target.value);
      applyFilters();
    });
  }
  
  if (deptSelect) {
    deptSelect.addEventListener('change', applyFilters);
  }
  
  // Populate initial departments
  updateDepartmentOptions('all');
}

function updateDepartmentOptions(selectedSchool) {
  const deptSelect = document.getElementById('deptSelect');
  if (!deptSelect) return;
  
  let departments = [];
  
  if (selectedSchool === 'all') {
    // Get all unique departments
    const deptSet = new Set();
    allProjects.forEach(p => deptSet.add(p.category));
    departments = Array.from(deptSet).sort();
  } else {
    // Get departments for selected school
    const school = schoolsData.find(s => s.name === selectedSchool);
    departments = school ? school.departments : [];
  }
  
  deptSelect.innerHTML = `
    <option value="all">${selectedSchool === 'all' ? 'All Departments' : 'All Departments in School'}</option>
    ${departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
  `;
}

// ==========================================
// RENDER PROJECTS
// ==========================================
function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (filteredProjects.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <p>No projects found for this selection.</p>
        <p class="hint">Try adjusting your filters or search query.</p>
      </div>
    `;
    return;
  }
  
  const purchased = getPurchasedProjects();
  
  filteredProjects.forEach(project => {
    const isPurchased = purchased.includes(project.id);
    const card = createProjectCard(project, isPurchased);
    grid.appendChild(card);
  });
}

function createProjectCard(project, isPurchased) {
  const div = document.createElement('div');
  div.className = 'project-card';
  
  div.innerHTML = `
    <div class="project-header">
      <span class="project-category">${escapeHtml(project.category)}</span>
      ${isPurchased ? '<span class="purchased-badge"><i class="fas fa-check"></i> Owned</span>' : ''}
    </div>
    <div class="school-badge">
      <i class="fas fa-university"></i> ${escapeHtml(project.school)}
    </div>
    <h3 class="project-title">${escapeHtml(project.name)}</h3>
    <p class="project-desc">${escapeHtml(project.description)}</p>
    <div class="project-footer">
      <span class="project-price">₦${CONFIG.PRICE.toLocaleString()}</span>
      ${isPurchased 
        ? `<button class="download-btn-sm" onclick="handleDownload('${project.id}')">
             <i class="fas fa-download"></i> Download
           </button>`
        : `<button class="buy-btn" onclick="initiatePurchase('${project.id}')">
             <i class="fas fa-lock"></i> Buy Now
           </button>`
      }
    </div>
  `;
  
  return div;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// FILTER LOGIC
// ==========================================
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
}

function applyFilters() {
  const schoolSelect = document.getElementById('schoolSelect');
  const deptSelect = document.getElementById('deptSelect');
  const searchInput = document.getElementById('searchInput');
  
  const selectedSchool = schoolSelect ? schoolSelect.value : 'all';
  const selectedDept = deptSelect ? deptSelect.value : 'all';
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  filteredProjects = allProjects.filter(project => {
    if (selectedSchool !== 'all' && project.school !== selectedSchool) return false;
    if (selectedDept !== 'all' && project.category !== selectedDept) return false;
    if (searchTerm) {
      const text = `${project.name} ${project.category} ${project.school} ${project.description}`.toLowerCase();
      if (!text.includes(searchTerm)) return false;
    }
    return true;
  });
  
  renderProjects();
}

// ==========================================
// PURCHASE FLOW
// ==========================================
function initiatePurchase(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  
  if (getPurchasedProjects().includes(projectId)) {
    handleDownload(projectId);
    return;
  }
  
  currentPurchase = project;
  openModal();
}

function openModal() {
  const modal = document.getElementById('purchaseModal');
  const title = document.getElementById('modalProjectTitle');
  const emailInput = document.getElementById('buyerEmail');
  
  if (!modal || !currentPurchase) return;
  
  if (title) title.textContent = currentPurchase.name;
  if (emailInput) {
    emailInput.value = '';
    emailInput.focus();
  }
  
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('purchaseModal');
  if (modal) modal.classList.remove('show');
  currentPurchase = null;
}

function confirmPurchase() {
  const emailInput = document.getElementById('buyerEmail');
  const email = emailInput ? emailInput.value.trim() : '';
  
  if (!email || !email.includes('@')) {
    showModalError('Please enter a valid email address');
    return;
  }
  
  if (!currentPurchase) return;
  
  processPayment(email, currentPurchase);
}

function processPayment(email, project) {
  const btn = document.getElementById('confirmBuyBtn');
  if (!btn) return;
  
  if (!window.PaystackPop) {
    showModalError('Payment system not loaded. Please refresh.');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  
  const handler = window.PaystackPop.setup({
    key: CONFIG.PAYSTACK_KEY,
    email: email,
    amount: CONFIG.PRICE * 100,
    currency: 'NGN',
    ref: `PRJ_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    metadata: {
      custom_fields: [
        { display_name: 'Project', variable_name: 'project_name', value: project.name },
        { display_name: 'Project ID', variable_name: 'project_id', value: project.id },
        { display_name: 'Department', variable_name: 'department', value: project.category },
        { display_name: 'School', variable_name: 'school', value: project.school }
      ],
      project_id: project.id
    },
    callback: (response) => onPaymentSuccess(response, project),
    onClose: () => {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-lock"></i> Pay ₦${CONFIG.PRICE.toLocaleString()}`;
    }
  });
  
  handler.openIframe();
}

function onPaymentSuccess(response, project) {
  closeModal();
  recordPurchase(project.id);
  showDownloadScreen(project, response.reference);
  
  setTimeout(() => {
    executeDownload(project);
  }, 1000);
}

// ==========================================
// DOWNLOAD HANDLING (UNCHANGED)
// ==========================================
function handleDownload(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  
  if (!getPurchasedProjects().includes(projectId)) {
    initiatePurchase(projectId);
    return;
  }
  
  executeDownload(project);
}

function executeDownload(project) {
  if (!project.driveId) return;
  
  // EXACTLY as requested - unchanged download logic
  window.location.href = `https://drive.google.com/uc?export=download&id=${project.driveId}`;
}

function showDownloadScreen(project, reference) {
  const screen = document.getElementById('downloadScreen');
  const title = document.getElementById('downloadProjectTitle');
  const ref = document.getElementById('transactionRef');
  
  if (title) title.textContent = project.name;
  if (ref) ref.textContent = reference;
  
  // Hide main content
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mainContent.style.display = 'none';
  
  if (screen) screen.classList.add('show');
}

function retryDownload() {
  const lastPurchase = sessionStorage.getItem('last_purchase');
  if (lastPurchase) {
    const project = JSON.parse(lastPurchase);
    executeDownload(project);
  }
}

function returnToStore() {
  const screen = document.getElementById('downloadScreen');
  const mainContent = document.getElementById('mainContent');
  
  if (screen) screen.classList.remove('show');
  if (mainContent) mainContent.style.display = 'block';
  currentPurchase = null;
}

// ==========================================
// PURCHASE TRACKING
// ==========================================
function getPurchasedProjects() {
  try {
    const data = localStorage.getItem(CONFIG.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { 
    return []; 
  }
}

function recordPurchase(projectId) {
  const purchased = getPurchasedProjects();
  if (!purchased.includes(projectId)) {
    purchased.push(projectId);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(purchased));
  }
  const project = allProjects.find(p => p.id === projectId);
  if (project) {
    sessionStorage.setItem('last_purchase', JSON.stringify(project));
  }
}

// ==========================================
// UI HELPERS
// ==========================================
function showModalError(msg) {
  const err = document.getElementById('modalError');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  updateThemeIcon(!isDark);
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  }
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}
