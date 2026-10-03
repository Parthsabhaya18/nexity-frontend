/* Reusable toast notifications. Toast.show('Message sent 💌', { type: 'success' }) */
window.Toast = {
  show(msg, { type = 'default', icon = '', duration = 2600, action = null } = {}) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const icons = { success: 'check', error: 'alert', warning: 'alert', info: 'info' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const ic = icon || icons[type];
    t.innerHTML = `${ic ? `<span class="toast-ic">${Icon(ic, 16)}</span>` : ''}<span class="toast-msg">${msg}</span>${action ? `<button class="toast-action">${esc(action.label)}</button>` : ''}`;
    if (action) t.querySelector('.toast-action').addEventListener('click', () => { action.onClick(); dismiss(); });
    root.appendChild(t);
    while (root.children.length > 3) root.firstElementChild.remove();
    requestAnimationFrame(() => t.classList.add('show'));
    const dismiss = () => { t.classList.remove('show'); t.classList.add('hide'); setTimeout(() => t.remove(), 250); };
    t.addEventListener('click', (e) => { if (!e.target.closest('.toast-action')) dismiss(); });
    setTimeout(dismiss, duration);
  }
};
