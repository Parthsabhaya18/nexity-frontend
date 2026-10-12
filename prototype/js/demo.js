/* Prototype demo controls: switch personas and simulate incoming events without a backend. */
(function () {
  const PERSONAS = [
    ['free', '🙂', 'Free user', 'Locked Secret Messages, upgrade prompts, locked Nearby hints'],
    ['plus', '✨', 'Plus user', '5 Secret Messages / month, 3 crush spots'],
    ['premium', '👑', 'Premium user', 'Unlimited messages, 10 crushes, 👑 badge'],
    ['secret-receiver', '💌', 'Secret Message receiver', 'One sealed message is a single reply away from unsealing'],
    ['crush-receiver', '👀', 'Secret Crush receiver', 'Tip: add Riya Patel as a crush to trigger a match'],
    ['matched', '💘', 'Matched user', 'Already matched with Kabir, chat open'],
    ['nearby', '📡', 'Nearby explorer', 'Nearby on · 2 people in Bluetooth range · a nearby notification waiting'],
    ['new', '🆕', 'New visitor', 'Logged out — try Register → Verify (code 123456)'],
  ];

  Actions.openDemo = () => {
    const cur = S.persona;
    Modal.open({
      title: 'Demo controls', cls: 'sheet-tall demo-sheet',
      body: `
        <p class="muted small">Switch to a ready-made account state. This resets the prototype data for that persona.</p>
        <div class="persona-list">
          ${PERSONAS.map(([id, e, t, s]) => `
            <button class="persona ${cur === id && S.session.loggedIn ? 'active' : ''}" data-action="demoPersona" data-p="${id}">
              <span class="persona-emoji">${e}</span><span class="persona-text"><b>${t}</b><small>${s}</small></span>
              ${cur === id && S.session.loggedIn ? '<span class="chip chip-ok sm">Current</span>' : Icon('chevronRight', 18)}
            </button>`).join('')}
          <a class="persona" href="admin.html" target="_blank" rel="noopener">
            <span class="persona-emoji">🛡️</span><span class="persona-text"><b>Admin panel</b><small>Opens in a new tab · admin@nexity.app / admin123</small></span>${Icon('arrowRight', 18)}
          </a>
        </div>
        ${S.session.loggedIn ? `
        <h3 class="demo-h">Simulate events</h3>
        <div class="demo-actions">
          <button class="btn btn-secondary" data-action="demoSim" data-e="secret">💌 Receive a secret message</button>
          <button class="btn btn-secondary" data-action="demoSim" data-e="crush">👀 Someone adds me as crush</button>
          <button class="btn btn-secondary" data-action="demoSim" data-e="mutual">💘 A crush adds me back (match)</button>
          <button class="btn btn-secondary" data-action="demoSim" data-e="chat">💬 Receive a chat message</button>
        </div>
        <h3 class="demo-h">Nearby simulator</h3>
        <p class="muted small">Simulates other phones and the server checks. Real Bluetooth and GPS are not used in the prototype.${S.demo.clockOffset ? ` Clock: <b>${fmtDate(NX.now())}</b> (+${Math.round(S.demo.clockOffset / NX.T.DAY)} day${S.demo.clockOffset > NX.T.DAY ? 's' : ''}).` : ''}</p>
        <div class="demo-actions">
          <button class="btn btn-secondary" data-action="demoNearby" data-e="bleArrive">📡 Someone comes into Bluetooth range</button>
          <button class="btn btn-secondary" data-action="demoNearby" data-e="bleLeave">🚶 Everyone leaves Bluetooth range</button>
          <button class="btn btn-secondary" data-action="demoNearby" data-e="unknownDevice">❓ Unknown Bluetooth device</button>
          <button class="btn btn-secondary" data-action="demoNearby" data-e="locationEncounter">📍 Location encounter (server)</button>
          <button class="btn btn-secondary" data-action="demoNearby" data-e="advanceDay">⏭️ Advance clock by 1 day</button>
          ${S.demo.clockOffset ? '<button class="btn btn-secondary" data-action="demoNearby" data-e="resetClock">🕒 Reset clock</button>' : ''}
        </div>
        ${S.demo.lastNearby ? `<p class="muted small demo-last">Last: ${esc(S.demo.lastNearby)}</p>` : ''}
        <h3 class="demo-h">Phone</h3>
        <div class="set-card">
          ${[['bluetooth', 'Bluetooth', 'Phone Bluetooth adapter'], ['bleSupported', 'Bluetooth advertising supported', 'Off = phone can\'t be discovered'], ['locationServices', 'Location services', 'Phone-wide location switch'], ['precise', 'Precise location', 'Off = approximate only']].map(([k, t, s]) =>
            `<div class="set-row toggle"><span class="set-text"><b>${t}</b><small>${s}</small></span>${switchEl({ checked: !!S.device[k], action: 'demoDevice', label: t, data: `data-k="${k}"` })}</div>`).join('')}
          ${[['btPermission', 'Bluetooth permission'], ['locPermission', 'Location permission']].map(([k, t]) =>
            `<button class="set-row" data-action="demoPermission" data-k="${k}"><span class="set-text"><b>${t}</b><small>Tap to cycle: not asked → denied → blocked → allowed</small></span><span class="set-val">${{ granted: 'Allowed', denied: 'Denied', blocked: 'Blocked' }[S.device[k]] || 'Not asked'}</span></button>`).join('')}
        </div>` : ''}
        <h3 class="demo-h">States</h3>
        <div class="set-card">
          <div class="set-row toggle"><span class="set-text"><b>Network error</b><small>Feed and login fail like an offline device</small></span>${switchEl({ checked: S.demo.offline, action: 'demoToggle', label: 'Network error', data: 'data-k="offline"' })}</div>
          <div class="set-row toggle"><span class="set-text"><b>Next payment fails</b><small>Simulates a declined payment</small></span>${switchEl({ checked: S.demo.failNextPayment, action: 'demoToggle', label: 'Next payment fails', data: 'data-k="failNextPayment"' })}</div>
          <div class="set-row toggle"><span class="set-text"><b>Dark mode</b><small>Quick theme switch</small></span>${switchEl({ checked: App.resolvedTheme() === 'dark', action: 'demoTheme', label: 'Dark mode' })}</div>
        </div>
        <h3 class="demo-h">Mood</h3>
        <p class="muted small">A mood replaces Light/Dark/System across the whole app. Turning dark mode on, or tapping the selected mood again, removes it.</p>
        <div class="mood-grid" role="radiogroup" aria-label="Mood">
          ${NX.moods.map(([id, emoji, name]) => `<button type="button" role="radio" aria-checked="${S.mood === id}" class="mood-chip ${S.mood === id ? 'active' : ''}" data-action="setMood" data-v="${id}"><span class="mood-emoji" aria-hidden="true">${emoji}</span><span>${name}</span></button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-block danger-text mt" data-action="demoReset">${Icon('refresh', 16)} Reset everything</button>`
    });
  };

  Actions.demoPersona = (el) => {
    const p = el.dataset.p;
    NX.reset(p);
    App.loaded = {};
    App.secretTab = 'messages'; App.secretSub = 'received'; App.notifFilter = 'all'; App.profileTab = 'posts'; App.draft = null; App.checkout = null;
    Modal.closeAll();
    while (Overlay.stack.length) Overlay.close(null, true);
    if (p === 'new') { Nav.reset('welcome'); Toast.show('Logged out — create a new account to try onboarding'); return; }
    Nearby.stopScan();
    const start = { 'secret-receiver': ['secret', { tab: 'messages' }], 'crush-receiver': ['secret', { tab: 'crush' }], matched: ['chats', {}], nearby: ['nearby', {}] }[p] || ['home', {}];
    Nav.reset(start[0], start[1]);
    const label = PERSONAS.find(x => x[0] === p)[2];
    Toast.show(`Now viewing as: ${label}`, { type: 'success', icon: 'user' });
  };

  Actions.demoSim = (el) => {
    const e = el.dataset.e;
    Modal.closeAll();
    setTimeout(() => {
      if (e === 'secret') NX.simulateSecret();
      if (e === 'crush') NX.simulateCrush();
      if (e === 'mutual') NX.simulateMutual();
      if (e === 'chat') {
        const c = S.chats.find(x => !NX.isBlocked(x.userId)) || App.ensureChat('u2');
        const u = NX.user(c.userId);
        const text = 'Are you free this weekend? 😊';
        c.messages.push({ id: uid('m'), from: 'them', text, time: Date.now(), seen: false });
        c.unread = (c.unread || 0) + 1;
        const n = NX.notify({ type: 'chat', userId: u.id, text: 'You have a new message 💬', target: { screen: 'chat', params: { id: c.id } } });
        NX.save();
        App.incoming(n);
        if (Nav.is('chats')) App.refresh();
      }
    }, 350);
  };

  Actions.demoToggle = (el) => {
    const k = el.dataset.k;
    S.demo[k] = !S.demo[k];
    NX.save();
    el.classList.toggle('on', S.demo[k]);
    el.setAttribute('aria-checked', S.demo[k]);
    App.refresh();
  };
  Actions.demoNearby = (el) => {
    Modal.closeAll();
    setTimeout(() => Nearby.sim[el.dataset.e](), 250);
  };
  Actions.demoDevice = (el) => {
    const k = el.dataset.k;
    S.device[k] = !S.device[k];
    if ((k === 'bluetooth' || k === 'bleSupported') && !S.device[k]) { NX.clearNearbyRuntime(); Nearby.stopScan(); }
    NX.save();
    el.classList.toggle('on', S.device[k]);
    el.setAttribute('aria-checked', S.device[k]);
    App.refresh();
  };
  Actions.demoPermission = (el) => {
    const k = el.dataset.k;
    const order = [null, 'denied', 'blocked', 'granted'];
    S.device[k] = order[(order.indexOf(S.device[k]) + 1) % order.length];
    if (k === 'btPermission' && S.device[k] !== 'granted') { NX.clearNearbyRuntime(); Nearby.stopScan(); }
    NX.save();
    el.querySelector('.set-val').textContent = { granted: 'Allowed', denied: 'Denied', blocked: 'Blocked' }[S.device[k]] || 'Not asked';
    App.refresh();
  };
  Actions.demoTheme = (el) => {
    S.theme = App.resolvedTheme() === 'dark' ? 'light' : 'dark';
    S.mood = null;
    NX.save();
    App.applyTheme();
    el.classList.toggle('on', S.theme === 'dark');
    el.setAttribute('aria-checked', S.theme === 'dark');
    document.querySelectorAll('[data-action="setMood"]').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-checked', 'false'); });
    App.refresh();
  };
  Actions.demoReset = async () => {
    if (!(await Modal.confirm({ title: 'Reset the prototype?', message: 'All demo data returns to its original state and you\'ll be logged out.', confirm: 'Reset', danger: true }))) return;
    NX.reset('free', { loggedOut: true });
    App.loaded = {};
    Modal.closeAll();
    Nav.reset('welcome');
    Toast.show('Prototype reset');
  };

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); Actions.openDemo(); }
  });
})();
