/* App shell: rendering, chrome (sidebar / bottom nav / rail), theme and global event delegation. */
(function () {
  const appEl = document.getElementById('app');
  const view = document.getElementById('view');
  const sidebar = document.getElementById('sidebar');
  const bottomNav = document.getElementById('bottomNav');
  const rail = document.getElementById('rail');
  App.loaded = App.loaded || {};

  /* ---------- Theme ---------- */
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  /* A mood replaces Light/Dark/System; mood palettes are light-based. */
  App.resolvedTheme = () => (S.mood ? 'light' : S.theme === 'dark' || S.theme === 'light' ? S.theme : (mq.matches ? 'dark' : 'light'));
  App.applyTheme = () => {
    const t = App.resolvedTheme();
    document.documentElement.dataset.theme = t;
    if (S && S.mood) document.documentElement.dataset.mood = S.mood;
    else document.documentElement.removeAttribute('data-mood');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  };
  mq.addEventListener && mq.addEventListener('change', () => { if (S.theme === 'system' && !S.mood) App.applyTheme(); });

  /* ---------- Rendering ---------- */
  function captureInputs() {
    const vals = {};
    view.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
      if (el.type === 'file') return;
      vals[el.id] = el.type === 'checkbox' || el.type === 'radio' ? { checked: el.checked } : { value: el.value };
    });
    const scrolls = {};
    view.querySelectorAll('[data-keep-scroll]').forEach(el => { scrolls[el.dataset.keepScroll] = el.scrollTop; });
    const a = document.activeElement;
    const focus = a && a.id && view.contains(a) ? { id: a.id, start: a.selectionStart, end: a.selectionEnd } : null;
    return { vals, focus, scrolls };
  }
  function restoreInputs(k) {
    Object.entries(k.vals).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.noKeep !== undefined) return;
      if ('checked' in v) el.checked = v.checked; else if (el.value !== v.value) el.value = v.value;
    });
    Object.entries(k.scrolls).forEach(([key, top]) => { const el = view.querySelector(`[data-keep-scroll="${key}"]`); if (el) el.scrollTop = top; });
    if (k.focus) {
      const el = document.getElementById(k.focus.id);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(k.focus.start, k.focus.end); } catch (e) { /* not a text input */ } }
    }
  }

  App.render = function (dir = 'none') {
    let entry = Nav.cur();
    let scr = Screens[entry.name];
    if (!scr) { console.warn('Unknown screen', entry.name); Nav.stack = [{ name: 'home', params: {} }]; entry = Nav.cur(); scr = Screens.home; }
    if (scr.auth !== false && !S.session.loggedIn) { Nav.stack = [{ name: 'welcome', params: {} }]; entry = Nav.cur(); scr = Screens.welcome; dir = 'fade'; }
    if (S.session.loggedIn && S.me.status === 'disabled' && entry.name !== 'disabled') { Nav.stack = [{ name: 'disabled', params: {} }]; entry = Nav.cur(); scr = Screens.disabled; dir = 'fade'; }

    const chrome = scr.chrome || 'tabs';
    appEl.dataset.chrome = chrome;
    appEl.dataset.screen = entry.name;
    appEl.classList.toggle('dark-screen', !!scr.dark);
    if (dir !== 'none' && App.onLeave) { const f = App.onLeave; App.onLeave = null; f(); }

    const kept = dir === 'none' ? captureInputs() : null;
    const params = entry.params || {};
    view.innerHTML = `<section class="screen screen-${entry.name}${dir !== 'none' ? ' enter-' + dir : ''}" data-screen="${entry.name}">${scr.render(params)}</section>`;
    if (kept) restoreInputs(kept);
    if (scr.mount) scr.mount(view.firstElementChild, params, dir);
    App.renderChrome();

    if (dir === 'back') window.scrollTo(0, entry.scroll || 0);
    else if (dir !== 'none') window.scrollTo(0, 0);
    if (dir !== 'none') {
      const t = typeof scr.title === 'function' ? scr.title(params) : scr.title;
      document.title = (t ? t + ' · ' : '') + 'Nexity';
    }
  };

  App.refresh = function () {
    const y = window.scrollY;
    App.render('none');
    window.scrollTo(0, y);
  };

  /* ---------- Chrome ---------- */
  const badge = (n) => (n > 0 ? `<span class="badge" aria-label="${n} unread">${n > 9 ? '9+' : n}</span>` : '');

  App.renderChrome = function () {
    if (appEl.dataset.chrome === 'none') { sidebar.innerHTML = ''; bottomNav.innerHTML = ''; rail.innerHTML = ''; return; }
    const active = Nav.rootTab();
    const cur = Nav.cur().name;
    const secretN = NX.secretBadge(), chatN = NX.unreadChats(), notifN = NX.unreadNotifications();
    const items = [['home', 'home', 'Home', 0], ['search', 'search', 'Search', 0], ['secret', 'crown', 'Premium', secretN], ['plans', 'card', 'Plans', 0]];
    bottomNav.innerHTML = `
      <div class="nav-pill">
        ${items.map(([t, ic, label, n]) => `
          <button class="nav-item${active === t ? ' active' : ''}${t === 'secret' ? ' nav-premium' : ''}" data-nav-tab="${t}" aria-label="${label}" ${active === t ? 'aria-current="page"' : ''}>
            <span class="nav-ic">${Icon(ic, 24)}${badge(n)}</span><span class="nav-label">${label}</span>
          </button>`).join('')}
      </div>
      <button class="nav-fab" data-action="openCreateMenu" aria-label="Create a post or reel" aria-haspopup="dialog">${Icon('plus', 30)}</button>`;

    const side = [
      ['tab', 'home', 'home', 'Home', 0], ['tab', 'search', 'search', 'Search', 0], ['tab', 'reels', 'reels', 'Reels', 0],
      ['tab', 'secret', 'crown', 'Premium', secretN], ['tab', 'plans', 'card', 'Plans', 0], ['tab', 'chats', 'chat', 'Chat', chatN],
      ['go', 'notifications', 'bell', 'Notifications', notifN], ['action', 'openCreateMenu', 'plusSquare', 'Create', 0], ['tab', 'profile', null, 'Profile', 0],
    ];
    const attr = (kind, t) => (kind === 'tab' ? `data-nav-tab="${t}"` : kind === 'action' ? `data-action="${t}"` : `data-go="${t}"`);
    sidebar.innerHTML = `
      <button class="side-brand" data-nav-tab="home" aria-label="Nexity home">${Wordmark(36, 'Nexity home')}</button>
      <nav class="side-nav">
        ${side.map(([kind, t, ic, label, n]) => {
          const on = kind === 'tab' ? (active === t && !['notifications', 'create'].includes(cur)) : kind === 'go' ? cur === t : cur === 'create';
          return `<button class="side-item${on ? ' active' : ''}${t === 'secret' ? ' side-premium' : ''}" ${attr(kind, t)} ${on ? 'aria-current="page"' : ''}>
            <span class="side-ic">${ic ? Icon(ic, 24) : avatar(S.me, 26)}${badge(n)}</span><span>${label}</span></button>`;
        }).join('')}
      </nav>
      <div class="side-foot">
        <button class="side-item${cur === 'settings' ? ' active' : ''}" data-go="settings"><span class="side-ic">${Icon('settings', 24)}</span><span>Settings</span></button>
        <button class="side-item" data-action="openDemo"><span class="side-ic">${Icon('zap', 24)}</span><span>Demo controls</span></button>
      </div>`;

    const showRail = ['home', 'search', 'notifications', 'profile', 'user', 'secret', 'chats', 'settings'].includes(cur);
    if (!showRail) { rail.innerHTML = ''; return; }
    const sugg = S.users.filter(u => !NX.isFollowing(u.id) && !NX.isBlocked(u.id)).slice(0, 5);
    const plan = NX.plan();
    rail.innerHTML = `
      <div class="rail-me">
        <button class="rail-me-main" data-nav-tab="profile">${avatar(S.me, 44)}<span><b>${esc(S.me.username)}</b><small>${esc(S.me.name)}</small></span></button>
        ${planChip(S.me.plan)}
      </div>
      ${S.me.plan === 'premium' ? '' : `
      <div class="rail-card rail-promo">
        <p class="eyebrow">${Icon('sparkles', 14)} ${S.me.plan === 'free' ? 'Unlock your secret side' : 'Go unlimited'}</p>
        <p>${S.me.plan === 'free' ? 'Send Secret Messages, add Secret Crushes and see who was near you.' : 'Unlimited Secret Messages, up to 10 Crushes and a 👑 badge with Premium.'}</p>
        <button class="btn btn-sm btn-light" data-go="plans">${S.me.plan === 'free' ? `See plans · from ${inr(S.plans.plus.price)}` : 'Upgrade to Premium'}</button>
      </div>`}
      ${sugg.length ? `<div class="rail-section"><div class="rail-head"><h3>Suggested for you</h3></div>
        ${sugg.map(u => userRow(u, followBtn(u), { size: 36, sub: 'Suggested for you' })).join('')}</div>` : ''}
      <p class="rail-foot">Nexity prototype · ${plan.name} plan · <button class="link" data-go="legal" data-params='{"doc":"terms"}'>Terms</button> · <button class="link" data-go="legal" data-params='{"doc":"privacy"}'>Privacy</button></p>`;
  };

  /* ---------- Incoming (simulated) events ---------- */
  App.incoming = (n, toastText) => {
    App.renderChrome();
    if (Nav.cur().name === 'notifications' || Nav.cur().name === 'secret') App.refresh();
    const allowed = { secret: 'secretMessage', crush: 'secretCrush', match: 'match', chat: 'chat', like: 'likes', subscription: 'subscription' }[n.type];
    if (S.notifSettings.push && (!allowed || S.notifSettings[allowed])) {
      Toast.show(toastText || n.text.replace(/<[^>]+>/g, ''), { duration: 4200, icon: 'bell', action: { label: 'View', onClick: () => App.openNotification(n.id) } });
    }
  };

  /* ---------- Global event delegation ---------- */
  let lastTap = { el: null, t: 0 }, tapTimer = null;

  function runAction(el, e) {
    const fn = Actions[el.dataset.action];
    if (fn) fn(el, e); else console.warn('Missing action:', el.dataset.action);
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    const act = e.target.closest('[data-action]');
    const tab = e.target.closest('[data-nav-tab]');
    const dbl = e.target.closest('[data-dbl]');
    const cands = [go, act, tab, dbl].filter(Boolean);
    if (!cands.length) return;
    const el = cands.reduce((a, b) => (a.contains(b) ? b : a));
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.tagName === 'A') e.preventDefault();

    if (el.dataset.dbl) {
      const now = Date.now();
      if (lastTap.el === el && now - lastTap.t < 300) {
        clearTimeout(tapTimer); lastTap = { el: null, t: 0 };
        Actions[el.dataset.dbl] && Actions[el.dataset.dbl](el, e);
        return;
      }
      lastTap = { el, t: now };
      if (el.dataset.action) { clearTimeout(tapTimer); tapTimer = setTimeout(() => runAction(el, e), 260); }
      return;
    }
    if (el.dataset.before && Actions[el.dataset.before]) Actions[el.dataset.before](el, e);

    if (el === act) return runAction(el, e);
    if (el === tab) { Modal.closeAll(); while (Overlay.stack.length) Overlay.close(null, true); Nav.tab(el.dataset.navTab, el.dataset.params ? JSON.parse(el.dataset.params) : {}); return; }
    if (el === go) {
      const params = el.dataset.params ? JSON.parse(el.dataset.params) : (el.dataset.id ? { id: el.dataset.id } : {});
      if (el.closest('.modal-layer')) Modal.closeAll();
      if (el.closest('.overlay')) while (Overlay.stack.length) Overlay.close(null, true);
      if (el.dataset.go === 'user' && params.id === 'me') return Nav.tab('profile');
      Nav.go(el.dataset.go, params, { replace: el.dataset.replace !== undefined });
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = Forms[f.dataset.form];
    if (fn) fn(f, e); else console.warn('Missing form handler:', f.dataset.form);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && Inputs[el.dataset.change]) Inputs[el.dataset.change](el, e);
  });
  document.addEventListener('keydown', (e) => {
    const el = e.target.closest && e.target.closest('[role="button"][tabindex]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });

  /* ---------- Common actions ---------- */
  Actions.back = () => Nav.back();

  App.syncFollow = (id) => {
    const f = NX.isFollowing(id);
    document.querySelectorAll(`#overlay-root [data-action="follow"][data-id="${id}"]`).forEach(b => {
      b.textContent = f ? 'Following' : 'Follow';
      b.classList.toggle('btn-primary', !f); b.classList.toggle('btn-secondary', f);
      b.setAttribute('aria-pressed', f);
    });
  };
  Actions.follow = (el) => {
    const id = el.dataset.id;
    const u = NX.user(id);
    const i = S.following.indexOf(id);
    if (i >= 0) { S.following.splice(i, 1); u.followers = Math.max(0, u.followers - 1); }
    else { S.following.push(id); u.followers += 1; }
    NX.save();
    App.refresh();
    App.syncFollow(id);
  };

  /* Cross-tab sync with the admin panel. */
  window.addEventListener('storage', (e) => {
    if (e.key !== NX.KEY) return;
    const wasIn = S.session.loggedIn;
    const seen = new Set(S.notifications.map(n => n.id));
    NX.reload();
    App.applyTheme();
    if (wasIn && !S.session.loggedIn) { Modal.closeAll(); Nav.reset('welcome'); Toast.show('You were signed out.', { type: 'info' }); return; }
    if (['splash'].includes(Nav.cur().name)) return;
    if (Nav.cur().name === 'disabled' && S.me.status !== 'disabled') { Nav.reset('home'); Toast.show('Your account is active again.', { type: 'success' }); return; }
    App.refresh();
    const fresh = S.session.loggedIn && S.notifications.find(n => !seen.has(n.id) && !n.read);
    if (fresh) App.incoming(fresh);
  });

  App.init = () => {
    App.applyTheme();
    Nav.stack = [{ name: 'splash', params: {} }];
    App.render('fade');
  };
  document.addEventListener('DOMContentLoaded', App.init);
})();
