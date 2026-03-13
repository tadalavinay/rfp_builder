// ========================================================================
// Documents View — see all uploaded source documents
// ========================================================================
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { getAllDocuments, deleteDocument } from '../services/db.js';

export function renderDocumentsView(container, { refreshStats }) {
    container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1 class="view-title">Source Documents</h1>
        <p class="view-subtitle">All RFP response documents you have uploaded.</p>
      </div>
      <div class="documents-list" id="documents-list"></div>
      <div class="empty-state" id="documents-empty" style="display:none;">
        <div class="empty-state-icon">${icons.documents}</div>
        <div class="empty-state-title">No documents uploaded</div>
        <div class="empty-state-text">Upload RFP response files to start building your library.</div>
      </div>
    </div>
  `;

    const list = container.querySelector('#documents-list');
    const emptyState = container.querySelector('#documents-empty');

    async function loadAndRender() {
        const documents = await getAllDocuments();

        if (documents.length === 0) {
            list.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        list.style.display = 'flex';
        emptyState.style.display = 'none';

        documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        list.innerHTML = documents
            .map((doc) => {
                const typeClass = doc.type === 'docx' || doc.type === 'doc' ? 'docx' : doc.type === 'pdf' ? 'pdf' : 'txt';
                const sizeStr = formatSize(doc.size);
                const dateStr = new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
                return `
          <div class="processing-item">
            <div class="processing-item-icon ${typeClass}">
              ${icons.fileText}
            </div>
            <div class="processing-item-info">
              <div class="processing-item-name">${escapeHtml(doc.name)}</div>
              <div class="processing-item-status">${sizeStr} · ${dateStr} · ${doc.entryCount || 0} responses extracted</div>
            </div>
            <button class="icon-btn delete-doc-btn" data-id="${doc.id}" data-name="${escapeAttr(doc.name)}" title="Delete document and its responses">
              ${icons.trash}
            </button>
          </div>
        `;
            })
            .join('');

        list.querySelectorAll('.delete-doc-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                confirmDeleteDocument(btn.dataset.id, btn.dataset.name);
            });
        });
    }

    function confirmDeleteDocument(docId, docName) {
        openModal({
            title: 'Delete Document',
            body: `<p style="color:var(--color-text-secondary);line-height:1.6">Delete <strong style="color:var(--color-text-primary)">"${escapeHtml(docName)}"</strong> and all its extracted responses?<br>This cannot be undone.</p>`,
            actions: [
                { label: 'Cancel', className: 'btn-secondary', onClick: (close) => close() },
                {
                    label: 'Delete',
                    className: 'btn-danger',
                    onClick: async (close) => {
                        await deleteDocument(docId);
                        showToast('Document and responses deleted', 'info');
                        close();
                        loadAndRender();
                        if (refreshStats) refreshStats();
                    },
                },
            ],
        });
    }

    function formatSize(bytes) {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
