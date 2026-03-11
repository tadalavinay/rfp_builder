// ========================================================================
// RFP Response Library — App Entry Point
// ========================================================================
import './index.css';
import { icons } from './components/icons.js';
import { getStats } from './services/db.js';
import { renderUploadView } from './views/upload.js';
import { renderLibraryView } from './views/library.js';
import { renderCategoriesView } from './views/categories.js';
import { renderDocumentsView } from './views/documents.js';

const app = document.getElementById('app');

// Current view state
let currentView = 'library';

// ---- Render the shell ----
function renderShell() {
    app.innerHTML = `
    <!-- Mobile menu button -->
    <button class="icon-btn mobile-menu-btn" id="mobile-menu-btn" style="position:fixed;top:var(--space-4);left:var(--space-4);z-index:200;background:var(--color-bg-secondary);border:1px solid var(--color-border);width:40px;height:40px;">
      ${icons.menu}
    </button>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">R</div>
          <div>
            <div class="sidebar-logo-text">RFP Library</div>
            <div class="sidebar-logo-sub">Response Manager</div>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="sidebar-nav-label">Main</div>
        <div class="nav-item ${currentView === 'library' ? 'active' : ''}" data-view="library">
          <span class="nav-item-icon">${icons.library}</span>
          <span class="nav-item-text">Response Library</span>
          <span class="nav-item-badge" id="badge-responses">0</span>
        </div>
        <div class="nav-item ${currentView === 'upload' ? 'active' : ''}" data-view="upload">
          <span class="nav-item-icon">${icons.upload}</span>
          <span class="nav-item-text">Upload</span>
        </div>

        <div class="sidebar-nav-label">Organize</div>
        <div class="nav-item ${currentView === 'categories' ? 'active' : ''}" data-view="categories">
          <span class="nav-item-icon">${icons.category}</span>
          <span class="nav-item-text">Categories</span>
          <span class="nav-item-badge" id="badge-categories">0</span>
        </div>
        <div class="nav-item ${currentView === 'documents' ? 'active' : ''}" data-view="documents">
          <span class="nav-item-icon">${icons.documents}</span>
          <span class="nav-item-text">Documents</span>
          <span class="nav-item-badge" id="badge-documents">0</span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-stats">
          <div class="sidebar-stat">
            <span>Total Responses</span>
            <span class="sidebar-stat-value" id="stat-responses">0</span>
          </div>
          <div class="sidebar-stat">
            <span>Categories</span>
            <span class="sidebar-stat-value" id="stat-categories">0</span>
          </div>
          <div class="sidebar-stat">
            <span>Documents</span>
            <span class="sidebar-stat-value" id="stat-documents">0</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content" id="main-content"></main>
  `;

    // Nav click handlers
    app.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view && view !== currentView) {
                currentView = view;
                updateActiveNav();
                renderView();
            }
            // Close mobile sidebar
            app.querySelector('#sidebar').classList.remove('open');
        });
    });

    // Mobile menu toggle
    app.querySelector('#mobile-menu-btn').addEventListener('click', () => {
        app.querySelector('#sidebar').classList.toggle('open');
    });

    refreshStats();
    renderView();
}

function updateActiveNav() {
    app.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.view === currentView);
    });
}

function renderView() {
    const mainContent = app.querySelector('#main-content');
    switch (currentView) {
        case 'upload':
            renderUploadView(mainContent, {
                onComplete: () => {
                    refreshStats();
                },
            });
            break;
        case 'library':
            renderLibraryView(mainContent, { refreshStats });
            break;
        case 'categories':
            renderCategoriesView(mainContent, { refreshStats });
            break;
        case 'documents':
            renderDocumentsView(mainContent, { refreshStats });
            break;
        default:
            renderLibraryView(mainContent, { refreshStats });
    }
}

async function refreshStats() {
    try {
        const stats = await getStats();
        const el = (id) => document.getElementById(id);
        if (el('badge-responses')) el('badge-responses').textContent = stats.totalResponses;
        if (el('badge-categories')) el('badge-categories').textContent = stats.totalCategories;
        if (el('badge-documents')) el('badge-documents').textContent = stats.totalDocuments;
        if (el('stat-responses')) el('stat-responses').textContent = stats.totalResponses;
        if (el('stat-categories')) el('stat-categories').textContent = stats.totalCategories;
        if (el('stat-documents')) el('stat-documents').textContent = stats.totalDocuments;
    } catch (e) {
        console.error('Failed to refresh stats:', e);
    }
}

// ---- Initialize ----
renderShell();
