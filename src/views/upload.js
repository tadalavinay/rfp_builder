// ========================================================================
// Upload View
// ========================================================================
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { parseFile } from '../services/parser.js';
import { extractResponses } from '../services/extractor.js';
import { addResponses, addDocument, addCategory, getAllCategories } from '../services/db.js';

export function renderUploadView(container, { onComplete }) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1 class="view-title">Upload RFP Documents</h1>
        <p class="view-subtitle">
          Drag and drop your past RFP response files or click to browse. Supported formats: DOCX, PDF, TXT, Excel.
        </p>
      </div>

      <div class="upload-zone" id="upload-zone">
        <input type="file" id="file-input" multiple accept=".docx,.doc,.pdf,.txt,.text,.md,.csv,.xlsx,.xls" style="display:none" />
        <div class="upload-zone-icon">${icons.upload}</div>
        <div class="upload-zone-title">Drop files here or click to upload</div>
        <div class="upload-zone-subtitle">Upload your past RFP responses to build your library</div>
        <div class="upload-zone-formats">
          <span class="format-badge">.DOCX</span>
          <span class="format-badge">.PDF</span>
          <span class="format-badge">.XLSX</span>
          <span class="format-badge">.TXT</span>
        </div>
      </div>

      <div class="processing-list" id="processing-list"></div>
    </div>
  `;

  const uploadZone = container.querySelector('#upload-zone');
  const fileInput = container.querySelector('#file-input');
  const processingList = container.querySelector('#processing-list');

  // Click to browse
  uploadZone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });

  // File input change
  fileInput.addEventListener('change', () => {
    handleFiles([...fileInput.files]);
    fileInput.value = '';
  });

  async function handleFiles(files) {
    if (files.length === 0) return;

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const itemId = 'proc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

      // Add processing item
      const item = document.createElement('div');
      item.className = 'processing-item';
      item.id = itemId;
      item.innerHTML = `
        <div class="processing-item-icon ${getTypeClass(ext)}">
          ${icons.fileText}
        </div>
        <div class="processing-item-info">
          <div class="processing-item-name">${file.name}</div>
          <div class="processing-item-status">Parsing document...</div>
        </div>
        <div class="processing-item-progress">
          <div class="processing-item-progress-bar" style="width: 10%"></div>
        </div>
        <div class="processing-item-count">—</div>
      `;
      processingList.appendChild(item);

      try {
        // Parse
        updateItem(itemId, 'Extracting text...', 30);
        const { text, type } = await parseFile(file);

        // Extract
        updateItem(itemId, 'Extracting responses...', 60);
        const documentId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
        const responses = extractResponses(text, file.name, documentId);

        // Save document
        await addDocument({
          id: documentId,
          name: file.name,
          type,
          size: file.size,
          entryCount: responses.length,
          uploadedAt: new Date().toISOString(),
        });

        // Save responses
        updateItem(itemId, 'Saving to library...', 85);
        await addResponses(responses);

        // Ensure categories exist
        const existingCats = await getAllCategories();
        const existingCatNames = new Set(existingCats.map(c => c.name));
        const newCats = new Set(responses.map(r => r.category));
        for (const catName of newCats) {
          if (!existingCatNames.has(catName)) {
            await addCategory({
              id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
              name: catName,
              createdAt: new Date().toISOString(),
            });
          }
        }

        updateItem(itemId, 'Complete!', 100, responses.length);
        showToast(`Extracted ${responses.length} responses from ${file.name}`, 'success');
      } catch (err) {
        console.error('Parse error:', err);
        updateItem(itemId, `Error: ${err.message}`, 0);
        showToast(`Failed to parse ${file.name}: ${err.message}`, 'error');
      }
    }

    if (onComplete) onComplete();
  }

  function updateItem(itemId, status, progress, count = null) {
    const item = document.getElementById(itemId);
    if (!item) return;
    item.querySelector('.processing-item-status').textContent = status;
    const bar = item.querySelector('.processing-item-progress-bar');
    if (bar) bar.style.width = progress + '%';
    if (count !== null) {
      item.querySelector('.processing-item-count').textContent = `${count} entries`;
    }
  }

  function getTypeClass(ext) {
    if (['doc', 'docx'].includes(ext)) return 'docx';
    if (ext === 'pdf') return 'pdf';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    return 'txt';
  }
}
