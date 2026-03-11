// ========================================================================
// Modal component
// ========================================================================
import { icons } from './icons.js';

/**
 * Open a modal dialog.
 * @param {Object} options
 * @param {string} options.title
 * @param {string|HTMLElement} options.body — HTML string or element
 * @param {Array<{label:string, className:string, onClick:Function}>} options.actions
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openModal({ title, body, actions = [], onClose = null }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
    <h2 class="modal-title">${title}</h2>
    <button class="modal-close" aria-label="Close">${icons.close}</button>
  `;

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    if (typeof body === 'string') {
        bodyEl.innerHTML = body;
    } else {
        bodyEl.appendChild(body);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    for (const action of actions) {
        const btn = document.createElement('button');
        btn.className = `btn ${action.className || 'btn-secondary'}`;
        btn.innerHTML = action.label;
        btn.addEventListener('click', () => {
            if (action.onClick) action.onClick(close);
        });
        footer.appendChild(btn);
    }

    modal.appendChild(header);
    modal.appendChild(bodyEl);
    if (actions.length > 0) modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function close() {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
            backdrop.remove();
            if (onClose) onClose();
        }, 200);
    }

    // Close handlers
    header.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', escHandler);
        }
    });

    return { close, element: modal };
}
