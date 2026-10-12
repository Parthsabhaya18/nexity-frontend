/* Shared helpers + small render components used across screens. */
window.Actions = window.Actions || {};
window.Forms = window.Forms || {};
window.Inputs = window.Inputs || {};
window.Screens = window.Screens || {};
window.App = window.App || {};

(function () {
  const { MIN, HOUR, DAY } = NX.T;

  window.$ = (s, r = document) => r.querySelector(s);
  window.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9);
  window.delay = (ms) => new Promise(r => setTimeout(r, ms));
  window.commit = () => { NX.save(); App.refresh(); };

  window.timeAgo = (ts) => {
    const d = Date.now() - ts;
    if (d < MIN) return 'now';
    if (d < HOUR) return Math.floor(d / MIN) + 'm';
    if (d < DAY) return Math.floor(d / HOUR) + 'h';
    if (d < 7 * DAY) return Math.floor(d / DAY) + 'd';
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  window.timeAgoLong = (ts) => {
    const d = Date.now() - ts;
    if (d < MIN) return 'Just now';
    if (d < HOUR) { const m = Math.floor(d / MIN); return `${m} minute${m > 1 ? 's' : ''} ago`; }
    if (d < DAY) { const h = Math.floor(d / HOUR); return `${h} hour${h > 1 ? 's' : ''} ago`; }
    if (d < 7 * DAY) { const n = Math.floor(d / DAY); return n === 1 ? 'Yesterday' : `${n} days ago`; }
    return fmtDate(ts);
  };
  window.clock = (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  window.fmtDate = (v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  window.fmtNum = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  };
  window.inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  window.initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  window.avatar = (u, size = 40, o = {}) => {
    if (!u) return anonAvatar(size);
    const ring = o.ring ? (o.seen ? ' ring ring-seen' : ' ring') : '';
    return `<span class="avatar${ring} ${o.cls || ''}" style="--s:${size}px">
      <span class="avatar-in"><span class="avatar-initials">${esc(initials(u.name))}</span>${u.avatar ? `<img src="${esc(u.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      ${o.online ? '<span class="online-dot" aria-label="Online"></span>' : ''}</span>`;
  };
  window.anonAvatar = (size = 40, o = {}) =>
    `<span class="avatar anon ${o.cls || ''}" style="--s:${size}px" aria-label="Hidden identity"><span class="avatar-in">${Icon('mask', Math.round(size * 0.5))}</span></span>`;

  window.appbar = ({ title = '', back = true, actions = '', sub = '', cls = '', titleHtml = '' } = {}) => `
    <header class="appbar ${cls}">
      ${back ? `<button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>` : ''}
      <div class="appbar-title">${titleHtml || `<h1>${esc(title)}</h1>`}${sub ? `<p>${sub}</p>` : ''}</div>
      <div class="appbar-actions">${actions}</div>
    </header>`;

  window.emptyState = ({ emoji = '', icon = 'sparkles', title, text = '', actions = '', cls = '' }) => `
    <div class="empty ${cls}">
      <div class="empty-art">${emoji ? `<span class="empty-emoji">${emoji}</span>` : Icon(icon, 30)}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${text}</p>` : ''}
      ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
    </div>`;

  window.switchEl = ({ id, checked, action, label, disabled = false, data = '' }) => `
    <button type="button" class="switch${checked ? ' on' : ''}" role="switch" aria-checked="${checked}" aria-label="${esc(label)}" ${id ? `id="${id}"` : ''} ${action ? `data-action="${action}"` : ''} ${data} ${disabled ? 'disabled' : ''}><span></span></button>`;

  window.planChip = (plan) => {
    if (plan === 'premium') return `<span class="plan-chip premium">${Icon('crown', 13)} Premium</span>`;
    if (plan === 'plus') return `<span class="plan-chip plus">${Icon('sparkles', 13)} Plus</span>`;
    return `<span class="plan-chip free">Free</span>`;
  };

  window.premiumBadge = (u) => (u && u.plan === 'premium' && !NX.isRemoved(u.id) ? `<span class="crown-badge" title="Premium member" aria-label="Premium member">${Icon('crown', 14)}</span>` : '');

  /* Locked chips never carry the day: the plan decides whether "today" / "yesterday" is shown at all. */
  window.nearbyChip = (state, opts = {}) => {
    if (!state) return '';
    if (state === 'on') return `<span class="nearby-chip">${Icon('radar', 12)}${esc(opts.label)}</span>`;
    const inner = `${Icon('lock', 12)}<span class="blur-text">This person was near you</span>`;
    if (opts.static) return `<span class="nearby-chip locked">${inner}</span>`;
    return `<button class="nearby-chip locked" data-go="plans" data-params='{"reason":"nearby"}' aria-label="Nearby hint locked. Upgrade to see.">${inner}</button>`;
  };

  window.nearChipFor = (userId, opts = {}) => nearbyChip(NX.nearbyState(userId), Object.assign({ label: NX.nearText(userId) }, opts));
  window.nearLineFor = (userId, cls = 'near-line') =>
    NX.nearbyState(userId) === 'on' ? `<small class="${cls}">${esc(NX.nearText(userId))}</small>` : '';

  window.spinner = (size = 18) => `<span class="spinner" style="--sz:${size}px" aria-hidden="true"></span>`;

  window.setBusy = (btn, busy, label) => {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `${spinner()} <span>${label || 'Please wait…'}</span>`; btn.disabled = true; btn.classList.add('busy'); }
    else { btn.innerHTML = btn.dataset.label || label || ''; btn.disabled = false; btn.classList.remove('busy'); }
  };

  window.fieldError = (form, name, msg) => {
    const f = form.querySelector(`[name="${name}"]`);
    const wrap = f && f.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('has-error', !!msg);
    let e = wrap.querySelector('.field-error');
    if (!e) { e = document.createElement('p'); e.className = 'field-error'; e.setAttribute('role', 'alert'); wrap.appendChild(e); }
    e.textContent = msg || '';
    if (f) f.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  window.validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* Resize uploads so they fit comfortably in localStorage. */
  window.readImage = (file, max = 900) => new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  window.burstHearts = (x, y, count = 14, emojis = ['💙', '💗', '💘', '✨']) => {
    const root = document.body;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = emojis[i % emojis.length];
      const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 120;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 40 + 'px');
      s.style.animationDelay = (Math.random() * 120) + 'ms';
      root.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  };

  window.confetti = (n = 60) => {
    const colors = ['#2563EB', '#E8487F', '#F5B83D', '#22C55E', '#38BDF8'];
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 400 + 'ms';
      p.style.animationDuration = 1400 + Math.random() * 1200 + 'ms';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3000);
  };

  window.userRow = (u, right = '', o = {}) => `
    <div class="user-row">
      <button class="user-row-main" data-go="user" data-id="${u.id}" ${o.onOpen ? `data-before="${o.onOpen}"` : ''}>
        ${avatar(u, o.size || 48, { online: o.online && u.online })}
        <span class="user-row-text"><b>${esc(u.username)}${premiumBadge(u)}</b><small>${esc(o.sub || u.name)}</small></span>
      </button>
      ${right}
    </div>`;

  window.followBtn = (u, small = true) => {
    if (u.id === 'me') return '';
    const f = NX.isFollowing(u.id);
    return `<button class="btn ${small ? 'btn-sm' : ''} ${f ? 'btn-secondary' : 'btn-primary'}" data-action="follow" data-id="${u.id}" aria-pressed="${f}">${f ? 'Following' : 'Follow'}</button>`;
  };
})();
