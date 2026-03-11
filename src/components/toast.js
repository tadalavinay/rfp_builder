// ========================================================================
// Toast notification component
// ========================================================================
import { icons } from './icons.js';

let container = null;

function ensureContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  ms
 */
export function showToast(message, type = 'info', duration = 3500) {
    const c = ensureContainer();

    const iconMap = {
        success: icons.check,
        error: icons.alertCircle,
        info: icons.info,
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close">${icons.close}</button>
  `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => remove(toast));

    c.appendChild(toast);

    setTimeout(() => remove(toast), duration);
}

function remove(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
}
