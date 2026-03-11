// ========================================================================
// Categories View
// ========================================================================
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import {
    getAllCategories,
    getAllResponses,
    addCategory,
    deleteCategory,
    updateResponse,
} from '../services/db.js';

export function renderCategoriesView(container, { refreshStats }) {
    container.innerHTML = `
    <div class="view-container">
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-4)">
        <div>
          <h1 class="view-title">Categories</h1>
          <p class="view-subtitle">Organize and manage your response categories.</p>
        </div>
        <button class="btn btn-primary" id="add-category-btn">
          ${icons.plus} New Category
        </button>
      </div>

      <div class="categories-grid" id="categories-grid"></div>

      <div class="empty-state" id="categories-empty" style="display:none;">
        <div class="empty-state-icon">${icons.category}</div>
        <div class="empty-state-title">No categories yet</div>
        <div class="empty-state-text">
          Categories are automatically created when you upload documents. You can also add custom categories.
        </div>
      </div>
    </div>
  `;

    const grid = container.querySelector('#categories-grid');
    const emptyState = container.querySelector('#categories-empty');
    const addBtn = container.querySelector('#add-category-btn');

    addBtn.addEventListener('click', openAddModal);

    async function loadAndRender() {
        const [categories, responses] = await Promise.all([getAllCategories(), getAllResponses()]);

        // Count responses per category
        const catCounts = {};
        let maxCount = 0;
        for (const r of responses) {
            catCounts[r.category] = (catCounts[r.category] || 0) + 1;
            if (catCounts[r.category] > maxCount) maxCount = catCounts[r.category];
        }

        if (categories.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = categories
            .sort((a, b) => (catCounts[b.name] || 0) - (catCounts[a.name] || 0))
            .map((cat) => {
                const count = catCounts[cat.name] || 0;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return `
          <div class="card category-card" data-id="${cat.id}">
            <div class="category-card-header">
              <span class="category-card-name">${escapeHtml(cat.name)}</span>
              <div style="display:flex;gap:var(--space-1);align-items:center">
                <span class="category-card-count">${count} responses</span>
                <button class="icon-btn rename-btn" data-id="${cat.id}" data-name="${escapeAttr(cat.name)}" title="Rename">
                  ${icons.edit}
                </button>
                <button class="icon-btn delete-cat-btn" data-id="${cat.id}" data-name="${escapeAttr(cat.name)}" title="Delete">
                  ${icons.trash}
                </button>
              </div>
            </div>
            <div class="category-card-bar">
              <div class="category-card-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
            })
            .join('');

        // Event listeners
        grid.querySelectorAll('.rename-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const catName = btn.dataset.name;
                openRenameModal(btn.dataset.id, catName);
            });
        });

        grid.querySelectorAll('.delete-cat-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteCategory(btn.dataset.id, btn.dataset.name);
            });
        });
    }

    function openAddModal() {
        const bodyEl = document.createElement('div');
        bodyEl.innerHTML = `
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="new-cat-name">Category Name</label>
        <input class="form-input" id="new-cat-name" placeholder="e.g. Technical Capabilities" autofocus />
      </div>
    `;

        openModal({
            title: 'New Category',
            body: bodyEl,
            actions: [
                { label: 'Cancel', className: 'btn-secondary', onClick: (close) => close() },
                {
                    label: 'Create',
                    className: 'btn-primary',
                    onClick: async (close) => {
                        const name = bodyEl.querySelector('#new-cat-name').value.trim();
                        if (!name) {
                            showToast('Please enter a name', 'error');
                            return;
                        }
                        await addCategory({
                            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
                            name,
                            createdAt: new Date().toISOString(),
                        });
                        showToast(`Category "${name}" created`, 'success');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    function openRenameModal(catId, oldName) {
        const bodyEl = document.createElement('div');
        bodyEl.innerHTML = `
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="rename-cat">New Name</label>
        <input class="form-input" id="rename-cat" value="${escapeAttr(oldName)}" />
      </div>
    `;

        openModal({
            title: 'Rename Category',
            body: bodyEl,
            actions: [
                { label: 'Cancel', className: 'btn-secondary', onClick: (close) => close() },
                {
                    label: 'Rename',
                    className: 'btn-primary',
                    onClick: async (close) => {
                        const newName = bodyEl.querySelector('#rename-cat').value.trim();
                        if (!newName) {
                            showToast('Please enter a name', 'error');
                            return;
                        }
                        // Update the category
                        await deleteCategory(catId);
                        await addCategory({
                            id: catId,
                            name: newName,
                            createdAt: new Date().toISOString(),
                        });
                        // Update all responses with old category
                        const allResp = await getAllResponses();
                        for (const r of allResp) {
                            if (r.category === oldName) {
                                await updateResponse({ ...r, category: newName });
                            }
                        }
                        showToast(`Category renamed to "${newName}"`, 'success');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    function confirmDeleteCategory(catId, catName) {
        openModal({
            title: 'Delete Category',
            body: `<p style="color:var(--color-text-secondary);line-height:1.6">Delete category <strong style="color:var(--color-text-primary)">"${escapeHtml(catName)}"</strong>?<br>Responses will be moved to "General".</p>`,
            actions: [
                { label: 'Cancel', className: 'btn-secondary', onClick: (close) => close() },
                {
                    label: 'Delete',
                    className: 'btn-danger',
                    onClick: async (close) => {
                        const allResp = await getAllResponses();
                        for (const r of allResp) {
                            if (r.category === catName) {
                                await updateResponse({ ...r, category: 'General' });
                            }
                        }
                        await deleteCategory(catId);
                        showToast(`Category "${catName}" deleted`, 'info');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    loadAndRender();
}
