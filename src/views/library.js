// ========================================================================
// Library View — browse, search, filter, edit responses
// ========================================================================
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import {
    getAllResponses,
    searchResponses,
    updateResponse,
    deleteResponse,
    getAllCategories,
    addCategory,
} from '../services/db.js';
import {
    exportAsJSON,
    exportAsCSV,
    exportAsMarkdown,
    copyToClipboard,
} from '../services/export.js';

let currentCategory = null;
let currentQuery = '';
let currentSort = 'newest';
let allResponses = [];
let debounceTimer = null;

export function renderLibraryView(container, { refreshStats }) {
    container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1 class="view-title">Response Library</h1>
        <p class="view-subtitle">
          Browse, search, and reuse your extracted RFP responses.
        </p>
      </div>

      <!-- Search & Filter Bar -->
      <div class="search-filter-bar">
        <div class="search-wrapper">
          ${icons.search}
          <input
            type="text"
            class="search-input"
            id="library-search"
            placeholder="Search questions and answers..."
            value="${currentQuery}"
          />
        </div>
        <select class="sort-select" id="library-sort">
          <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="oldest" ${currentSort === 'oldest' ? 'selected' : ''}>Oldest first</option>
          <option value="alpha" ${currentSort === 'alpha' ? 'selected' : ''}>A → Z</option>
          <option value="category" ${currentSort === 'category' ? 'selected' : ''}>By category</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="export-btn">
          ${icons.download} Export
        </button>
      </div>

      <!-- Category Filter Chips -->
      <div class="filter-chips" id="filter-chips"></div>

      <!-- Response Grid -->
      <div class="response-grid" id="response-grid"></div>

      <!-- Empty State -->
      <div class="empty-state" id="library-empty" style="display:none;">
        <div class="empty-state-icon">${icons.library}</div>
        <div class="empty-state-title">No responses yet</div>
        <div class="empty-state-text">
          Upload RFP documents to start building your response library. Click "Upload" in the sidebar to get started.
        </div>
      </div>
    </div>
  `;

    const searchInput = container.querySelector('#library-search');
    const sortSelect = container.querySelector('#library-sort');
    const exportBtn = container.querySelector('#export-btn');
    const grid = container.querySelector('#response-grid');
    const emptyState = container.querySelector('#library-empty');
    const filterChips = container.querySelector('#filter-chips');

    // --- Search (debounced) ---
    searchInput.addEventListener('input', () => {
        currentQuery = searchInput.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadAndRender(), 200);
    });

    // --- Sort ---
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderGrid();
    });

    // --- Export ---
    exportBtn.addEventListener('click', showExportMenu);

    // --- Load data ---
    async function loadAndRender() {
        allResponses = currentQuery
            ? await searchResponses(currentQuery)
            : await getAllResponses();
        await renderCategoryChips();
        renderGrid();
    }

    async function renderCategoryChips() {
        const categories = await getAllCategories();
        const catCounts = {};
        for (const r of allResponses) {
            catCounts[r.category] = (catCounts[r.category] || 0) + 1;
        }

        filterChips.innerHTML = `
      <button class="filter-chip ${!currentCategory ? 'active' : ''}" data-cat="">
        All <span class="filter-chip-count">${allResponses.length}</span>
      </button>
      ${categories
                .filter((c) => catCounts[c.name])
                .map(
                    (c) => `
        <button class="filter-chip ${currentCategory === c.name ? 'active' : ''}" data-cat="${c.name}">
          ${c.name} <span class="filter-chip-count">${catCounts[c.name] || 0}</span>
        </button>
      `
                )
                .join('')}
    `;

        filterChips.querySelectorAll('.filter-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                currentCategory = chip.dataset.cat || null;
                renderCategoryChips();
                renderGrid();
            });
        });
    }

    function renderGrid() {
        let filtered = currentCategory
            ? allResponses.filter((r) => r.category === currentCategory)
            : allResponses;

        // Sort
        switch (currentSort) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'alpha':
                filtered.sort((a, b) => a.question.localeCompare(b.question));
                break;
            case 'category':
                filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
                break;
        }

        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            if (currentQuery) {
                emptyState.querySelector('.empty-state-title').textContent = 'No matching responses';
                emptyState.querySelector('.empty-state-text').textContent =
                    'Try a different search term or clear filters.';
            } else {
                emptyState.querySelector('.empty-state-title').textContent = 'No responses yet';
                emptyState.querySelector('.empty-state-text').textContent =
                    'Upload RFP documents to start building your response library.';
            }
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = filtered
            .map(
                (r) => `
      <div class="card response-card" data-id="${r.id}">
        <div class="card-body">
          <div class="response-card-header">
            <span class="response-card-category">${escapeHtml(r.category || 'General')}</span>
            <div class="response-card-actions">
              <button class="icon-btn copy-btn" data-id="${r.id}" title="Copy answer">
                ${icons.copy}
              </button>
              <button class="icon-btn edit-btn" data-id="${r.id}" title="Edit">
                ${icons.edit}
              </button>
              <button class="icon-btn delete-btn" data-id="${r.id}" title="Delete">
                ${icons.trash}
              </button>
            </div>
          </div>
          <div class="response-card-question">${highlightText(escapeHtml(r.question), currentQuery)}</div>
          <div class="response-card-answer">${highlightText(escapeHtml(r.answer), currentQuery)}</div>
          <div class="response-card-footer">
            <div class="response-card-tags">
              ${(r.tags || [])
                        .slice(0, 3)
                        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
                        .join('')}
            </div>
            <span class="response-card-source" title="${escapeHtml(r.sourceFile || '')}">${escapeHtml(r.sourceFile || '')}</span>
          </div>
        </div>
      </div>
    `
            )
            .join('');

        // Event listeners
        grid.querySelectorAll('.response-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                // Don't open if action button was clicked
                if (e.target.closest('.icon-btn')) return;
                const id = card.dataset.id;
                const resp = filtered.find((r) => r.id === id);
                if (resp) openDetailModal(resp);
            });
        });

        grid.querySelectorAll('.copy-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const resp = filtered.find((r) => r.id === btn.dataset.id);
                if (resp) {
                    await copyToClipboard(resp.answer);
                    showToast('Answer copied to clipboard', 'success');
                }
            });
        });

        grid.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const resp = filtered.find((r) => r.id === btn.dataset.id);
                if (resp) openEditModal(resp);
            });
        });

        grid.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const resp = filtered.find((r) => r.id === btn.dataset.id);
                if (resp) confirmDelete(resp);
            });
        });
    }

    // --- Detail Modal ---
    function openDetailModal(response) {
        openModal({
            title: 'Response Details',
            body: `
        <div class="form-group">
          <label class="form-label">Category</label>
          <span class="response-card-category">${escapeHtml(response.category || 'General')}</span>
        </div>
        <div class="form-group">
          <label class="form-label">Question / Heading</label>
          <p style="color:var(--color-text-primary);line-height:1.6">${escapeHtml(response.question)}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Answer / Content</label>
          <p style="color:var(--color-text-secondary);line-height:1.7;white-space:pre-wrap">${escapeHtml(response.answer)}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(response.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
            ${(response.tags || []).length === 0 ? '<span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">No tags</span>' : ''}
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Source</label>
          <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${escapeHtml(response.sourceFile || 'Unknown')}</span>
        </div>
      `,
            actions: [
                {
                    label: `${icons.copy} Copy Answer`,
                    className: 'btn-primary',
                    onClick: async (close) => {
                        await copyToClipboard(response.answer);
                        showToast('Answer copied to clipboard', 'success');
                        close();
                    },
                },
                {
                    label: 'Edit',
                    className: 'btn-secondary',
                    onClick: (close) => {
                        close();
                        openEditModal(response);
                    },
                },
            ],
        });
    }

    // --- Edit Modal ---
    async function openEditModal(response) {
        const categories = await getAllCategories();

        const bodyEl = document.createElement('div');
        bodyEl.innerHTML = `
      <div class="form-group">
        <label class="form-label" for="edit-question">Question / Heading</label>
        <input class="form-input" id="edit-question" value="${escapeAttr(response.question)}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-answer">Answer / Content</label>
        <textarea class="form-textarea" id="edit-answer" rows="6">${escapeHtml(response.answer)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-category">Category</label>
        <select class="form-select" id="edit-category">
          ${categories.map((c) => `<option value="${escapeAttr(c.name)}" ${c.name === response.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          <option value="__new__">+ New Category</option>
        </select>
      </div>
      <div class="form-group" id="new-cat-group" style="display:none">
        <label class="form-label" for="edit-new-cat">New Category Name</label>
        <input class="form-input" id="edit-new-cat" placeholder="Enter category name" />
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="edit-tags">Tags (comma-separated)</label>
        <input class="form-input" id="edit-tags" value="${escapeAttr((response.tags || []).join(', '))}" />
      </div>
    `;

        // Toggle new category input
        const catSelect = bodyEl.querySelector('#edit-category');
        const newCatGroup = bodyEl.querySelector('#new-cat-group');
        catSelect.addEventListener('change', () => {
            newCatGroup.style.display = catSelect.value === '__new__' ? 'block' : 'none';
        });

        openModal({
            title: 'Edit Response',
            body: bodyEl,
            actions: [
                {
                    label: 'Cancel',
                    className: 'btn-secondary',
                    onClick: (close) => close(),
                },
                {
                    label: 'Save Changes',
                    className: 'btn-primary',
                    onClick: async (close) => {
                        let category = catSelect.value;
                        if (category === '__new__') {
                            const newCatName = bodyEl.querySelector('#edit-new-cat').value.trim();
                            if (!newCatName) {
                                showToast('Please enter a category name', 'error');
                                return;
                            }
                            category = newCatName;
                            await addCategory({
                                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
                                name: newCatName,
                                createdAt: new Date().toISOString(),
                            });
                        }

                        const updated = {
                            ...response,
                            question: bodyEl.querySelector('#edit-question').value.trim(),
                            answer: bodyEl.querySelector('#edit-answer').value.trim(),
                            category,
                            tags: bodyEl
                                .querySelector('#edit-tags')
                                .value.split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                        };

                        await updateResponse(updated);
                        showToast('Response updated', 'success');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    // --- Delete ---
    function confirmDelete(response) {
        openModal({
            title: 'Delete Response',
            body: `<p style="color:var(--color-text-secondary);line-height:1.6">Are you sure you want to delete this response?<br><strong style="color:var(--color-text-primary)">"${escapeHtml(response.question.substring(0, 80))}"</strong><br>This action cannot be undone.</p>`,
            actions: [
                {
                    label: 'Cancel',
                    className: 'btn-secondary',
                    onClick: (close) => close(),
                },
                {
                    label: 'Delete',
                    className: 'btn-danger',
                    onClick: async (close) => {
                        await deleteResponse(response.id);
                        showToast('Response deleted', 'info');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    // --- Export Menu ---
    function showExportMenu() {
        openModal({
            title: 'Export Library',
            body: `
        <p style="color:var(--color-text-secondary);margin-bottom:var(--space-5);line-height:1.6">
          Export ${allResponses.length} response${allResponses.length !== 1 ? 's' : ''} in your preferred format.
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <button class="btn btn-secondary" id="export-json" style="justify-content:flex-start">
            ${icons.download} Export as JSON (full backup)
          </button>
          <button class="btn btn-secondary" id="export-csv" style="justify-content:flex-start">
            ${icons.download} Export as CSV (spreadsheet)
          </button>
          <button class="btn btn-secondary" id="export-md" style="justify-content:flex-start">
            ${icons.download} Export as Markdown
          </button>
        </div>
      `,
            actions: [],
        });

        setTimeout(() => {
            document.getElementById('export-json')?.addEventListener('click', async () => {
                const data = await import('../services/db.js').then((m) => m.exportAllData());
                exportAsJSON(data);
                showToast('Exported as JSON', 'success');
            });
            document.getElementById('export-csv')?.addEventListener('click', () => {
                exportAsCSV(allResponses);
                showToast('Exported as CSV', 'success');
            });
            document.getElementById('export-md')?.addEventListener('click', () => {
                exportAsMarkdown(allResponses);
                showToast('Exported as Markdown', 'success');
            });
        }, 100);
    }

    // --- Helpers ---
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function highlightText(text, query) {
        if (!query || !query.trim()) return text;
        const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
    }

    // Initial load
    loadAndRender();
}
