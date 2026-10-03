/* Reusable modal / bottom-sheet / action-menu / fullscreen overlay system. */
(function () {
  const root = () => document.getElementById('overlay-root');
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  const Modal = {
    stack: [],

    open({ title = '', body = '', footer = '', cls = '', onClose = null, dismissible = true, label = '', hideHeader = false } = {}) {
      const el = document.createElement('div');
      el.className = `modal-layer ${cls}`;
      el.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label || title || 'Dialog')}">
          <div class="modal-grabber" aria-hidden="true"></div>
          ${hideHeader ? '' : `<div class="modal-head"><h2>${esc(title)}</h2>${dismissible ? `<button class="icon-btn modal-x" data-close aria-label="Close">${Icon('x', 20)}</button>` : ''}</div>`}
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
        </div>`;
      const entry = { el, onClose, dismissible, prevFocus: document.activeElement };
      el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') && (dismissible || e.target.closest('.modal-x'))) Modal.close(el); });
      root().appendChild(el);
      this.stack.push(entry);
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => {
        el.classList.add('open');
        const m = el.querySelector('.modal');
        m.setAttribute('tabindex', '-1');
        const auto = el.querySelector('[data-autofocus]');
        (auto || m).focus({ preventScroll: true });
      });
      return el;
    },

    close(el, silent = false) {
      const idx = el ? this.stack.findIndex(s => s.el === el) : this.stack.length - 1;
      if (idx < 0) return;
      const [entry] = this.stack.splice(idx, 1);
      entry.el.classList.remove('open');
      entry.el.classList.add('closing');
      setTimeout(() => entry.el.remove(), 220);
      if (!this.stack.length && !Overlay.stack.length) document.body.classList.remove('no-scroll');
      if (!silent && entry.onClose) entry.onClose();
      if (entry.prevFocus && entry.prevFocus.focus && document.contains(entry.prevFocus)) entry.prevFocus.focus({ preventScroll: true });
    },

    closeAll() { while (this.stack.length) this.close(null, true); },

    top() { return this.stack[this.stack.length - 1]; },

    confirm({ title, message = '', confirm = 'Confirm', cancel = 'Cancel', danger = false, icon = '' }) {
      return new Promise((resolve) => {
        let done = false;
        const el = Modal.open({
          cls: 'confirm-layer', label: title, hideHeader: true,
          body: `<div class="confirm">
              ${icon ? `<div class="confirm-ic ${danger ? 'danger' : ''}">${Icon(icon, 26)}</div>` : ''}
              <h2>${esc(title)}</h2>${message ? `<p>${message}</p>` : ''}
              <div class="confirm-actions">
                <button class="btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirm)}</button>
                <button class="btn btn-block btn-ghost" data-cancel>${esc(cancel)}</button>
              </div></div>`,
          onClose: () => { if (!done) resolve(false); }
        });
        el.querySelector('[data-confirm]').addEventListener('click', () => { done = true; Modal.close(el, true); resolve(true); });
        el.querySelector('[data-cancel]').addEventListener('click', () => { done = true; Modal.close(el, true); resolve(false); });
      });
    },

    /* Action sheet. items: [{ label, icon, danger, onClick }] */
    menu(items, { title = '' } = {}) {
      const el = Modal.open({
        cls: 'menu-layer', label: title || 'Options', hideHeader: true,
        body: `${title ? `<p class="menu-title">${esc(title)}</p>` : ''}<div class="menu-list" role="menu">
          ${items.map((it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" data-i="${i}">${it.icon ? Icon(it.icon, 20) : ''}<span>${esc(it.label)}</span></button>`).join('')}
          </div><button class="btn btn-block btn-ghost menu-cancel" data-close>Cancel</button>`
      });
      el.querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', () => {
        const it = items[+b.dataset.i];
        Modal.close(el, true);
        setTimeout(() => it.onClick && it.onClick(), 120);
      }));
      setTimeout(() => { const f = el.querySelector('.menu-item'); f && f.focus({ preventScroll: true }); }, 30);
      return el;
    },
  };

  /* Fullscreen overlays: story viewer, match, reveal, payment processing. */
  const Overlay = {
    stack: [],
    show(html, cls = '', { onClose = null, label = 'Overlay' } = {}) {
      const el = document.createElement('div');
      el.className = `overlay ${cls}`;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', label);
      el.innerHTML = html;
      root().appendChild(el);
      this.stack.push({ el, onClose, prevFocus: document.activeElement });
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => el.classList.add('open'));
      return el;
    },
    close(el, silent = false) {
      const idx = el ? this.stack.findIndex(s => s.el === el) : this.stack.length - 1;
      if (idx < 0) return;
      const [entry] = this.stack.splice(idx, 1);
      entry.el.classList.remove('open');
      entry.el.classList.add('closing');
      setTimeout(() => entry.el.remove(), 260);
      if (!this.stack.length && !Modal.stack.length) document.body.classList.remove('no-scroll');
      if (!silent && entry.onClose) entry.onClose();
      if (entry.prevFocus && entry.prevFocus.focus && document.contains(entry.prevFocus)) entry.prevFocus.focus({ preventScroll: true });
    },
    top() { return this.stack[this.stack.length - 1]; },
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (Modal.stack.length) { const t = Modal.top(); if (t.dismissible) Modal.close(); return; }
      if (Overlay.stack.length) { const t = Overlay.top(); if (!t.el.dataset.noEsc) Overlay.close(); }
    }
    if (e.key === 'Tab' && Modal.stack.length) {
      const m = Modal.top().el.querySelector('.modal');
      const f = Array.from(m.querySelectorAll(FOCUSABLE)).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.Modal = Modal;
  window.Overlay = Overlay;
})();
