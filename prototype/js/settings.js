/* Settings hub + sub-pages, Nearby consent, Contact Us, Help, legal pages, logout. */
(function () {
  const row = ({ icon, label, sub = '', value = '', go = '', params = null, action = '', danger = false, data = '' }) => `
    <button class="set-row ${danger ? 'danger' : ''}" ${go ? `data-go="${go}"` : ''} ${params ? `data-params='${JSON.stringify(params)}'` : ''} ${action ? `data-action="${action}"` : ''} ${data}>
      <span class="set-ic">${Icon(icon, 20)}</span>
      <span class="set-text"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      ${value ? `<span class="set-val">${value}</span>` : ''}
      ${danger ? '' : Icon('chevronRight', 18, 'set-chev')}
    </button>`;
  const toggleRow = ({ icon, label, sub = '', checked, action, k = '', disabled = false }) => `
    <div class="set-row toggle ${disabled ? 'disabled' : ''}">
      ${icon ? `<span class="set-ic">${Icon(icon, 20)}</span>` : ''}
      <span class="set-text"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      ${switchEl({ checked, action, label, disabled, data: k ? `data-k="${k}"` : '' })}
    </div>`;
  const group = (title, body) => `<section class="set-group">${title ? `<h2>${title}</h2>` : ''}<div class="set-card">${body}</div></section>`;
  const themeSeg = () => `
    <div class="segmented theme-seg" role="radiogroup" aria-label="Theme">
      ${[['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'System']].map(([v, ic, l]) => `<button role="radio" aria-checked="${!S.mood && S.theme === v}" class="${!S.mood && S.theme === v ? 'active' : ''}" data-action="setTheme" data-v="${v}">${Icon(ic, 16)} ${l}</button>`).join('')}
    </div>`;
  const moodGrid = () => `
    <div class="mood-grid" role="radiogroup" aria-label="Mood">
      ${NX.moods.map(([id, emoji, name]) => `<button type="button" role="radio" aria-checked="${S.mood === id}" class="mood-chip ${S.mood === id ? 'active' : ''}" data-action="setMood" data-v="${id}"><span class="mood-emoji" aria-hidden="true">${emoji}</span><span>${name}</span></button>`).join('')}
    </div>`;

  Screens.settings = {
    title: 'Settings',
    render: () => {
      return `
        ${appbar({ title: 'Settings' })}
        <div class="page settings">
          <button class="set-profile card" data-action="editProfile">${avatar(S.me, 56)}<span><b>${esc(S.me.name)}</b><small>@${esc(S.me.username)}</small></span>${planChip(S.me.plan)}</button>
          ${group('Account', row({ icon: 'user', label: 'Edit profile', action: 'editProfile' }) + row({ icon: 'mail', label: 'Account information', sub: 'Email, username, birthday', go: 'settingsAccount' }))}
          ${group('Privacy', row({ icon: 'shield', label: 'Privacy', sub: 'Account visibility, messages, activity', go: 'settingsPrivacy' }) + row({ icon: 'ban', label: 'Blocked accounts', value: S.blocked.length ? String(S.blocked.length) : '', go: 'blocked' }))}
          ${group('Notifications', row({ icon: 'bell', label: 'Notification settings', sub: 'Choose what you hear about', go: 'settingsNotifications' }))}
          ${group('Nearby', row({ icon: 'radar', label: 'Nearby', sub: S.me.nearbyEnabled ? 'On · Bluetooth discovery & location notifications' : 'Off · never shows your location', go: 'settingsNearby' }))}
          ${group('Subscription', row({ icon: S.me.plan === 'premium' ? 'crown' : 'sparkles', label: 'Subscription', sub: NX.isPaid() ? `Active until ${fmtDate(S.me.planExpiry)}` : 'Upgrade to unlock Secret features', value: NX.plan().name, go: NX.isPaid() ? 'mySubscription' : 'plans' }))}
          ${group('Security', row({ icon: 'key', label: 'Change password', go: 'changePassword' }) + row({ icon: 'devices', label: 'Login & security', sub: 'Where you\'re logged in', go: 'settingsSecurity' }))}
          ${group('Theme', `<div class="set-row static"><span class="set-ic">${Icon('moon', 20)}</span><span class="set-text"><b>Appearance</b><small>${S.mood ? 'Off while a mood is on · pick one to remove the mood' : 'Light, dark or match your device'}</small></span></div><div class="set-pad">${themeSeg()}</div><div class="set-row static"><span class="set-ic">${Icon('sparkles', 20)}</span><span class="set-text"><b>Mood</b><small>${esc((NX.moods.find(m => m[0] === S.mood) || [0, 0, 'No mood'])[2])} · replaces Light/Dark/System · tap again to remove</small></span></div><div class="set-pad">${moodGrid()}</div>`)}
          ${group('Help', row({ icon: 'headset', label: 'Contact us', sub: 'We usually reply within 24 hours', go: 'contact' }) + row({ icon: 'help', label: 'Help center', go: 'help' }))}
          ${group('About', row({ icon: 'file', label: 'Terms of Service', go: 'legal', params: { doc: 'terms' } }) + row({ icon: 'shieldCheck', label: 'Privacy Policy', go: 'legal', params: { doc: 'privacy' } }))}
          ${group('Prototype', row({ icon: 'zap', label: 'Demo controls', sub: 'Switch personas and simulate events', action: 'openDemo' }))}
          <button class="btn btn-block btn-danger-soft logout-btn" data-action="logout">${Icon('logout', 18)} Log out</button>
          <p class="version">Nexity prototype v3 · Made with 💜</p>
        </div>`;
    }
  };

  Actions.setTheme = (el) => {
    S.theme = el.dataset.v;
    S.mood = null;
    NX.save();
    App.applyTheme();
    App.refresh();
    Toast.show(`Theme: ${el.dataset.v === 'system' ? 'System default' : el.dataset.v[0].toUpperCase() + el.dataset.v.slice(1)}`);
  };

  Actions.setMood = (el) => {
    const mood = NX.moods.find(m => m[0] === el.dataset.v);
    if (!mood) return;
    const off = S.mood === mood[0];
    S.mood = off ? null : mood[0];
    NX.save();
    App.applyTheme();
    document.querySelectorAll('[data-action="setMood"]').forEach(btn => {
      const on = btn.dataset.v === S.mood;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const darkToggle = document.querySelector('[data-action="demoTheme"]');
    if (darkToggle) {
      const dark = App.resolvedTheme() === 'dark';
      darkToggle.classList.toggle('on', dark);
      darkToggle.setAttribute('aria-checked', dark ? 'true' : 'false');
    }
    App.refresh();
    Toast.show(off ? 'Mood removed' : `${mood[1]} ${mood[2]} theme`);
  };

  Actions.logout = async () => {
    const ok = await Modal.confirm({ title: 'Log out of Nexity?', message: 'You can log back in anytime with your email and password.', confirm: 'Log out', danger: true, icon: 'logout' });
    if (!ok) return;
    S.session.loggedIn = false;
    NX.save();
    App.loaded = {};
    Nav.reset('welcome');
    Toast.show('You\'ve been logged out');
  };

  /* ---------- Account ---------- */
  Screens.settingsAccount = {
    title: 'Account information',
    render: () => `
      ${appbar({ title: 'Account information' })}
      <div class="page settings">
        ${group('', `
          <div class="info-row"><span>Name</span><b>${esc(S.me.name)}</b></div>
          <div class="info-row"><span>Username</span><b>@${esc(S.me.username)}</b></div>
          <div class="info-row"><span>Email</span><b>${esc(S.me.email)} <span class="chip chip-ok sm">${Icon('check', 11)} Verified</span></b></div>
          <div class="info-row"><span>Gender</span><b>${esc(S.me.gender)}</b></div>
          <div class="info-row"><span>Date of birth</span><b>${fmtDate(S.me.dob)} <span class="muted">· private</span></b></div>
          <div class="info-row"><span>Member since</span><b>${fmtDate(S.me.joined)}</b></div>`)}
        <button class="btn btn-secondary btn-block" data-action="editProfile">Edit profile</button>
        ${group('Danger zone', row({ icon: 'trash', label: 'Delete account', sub: 'Permanently remove your account and data', action: 'deleteAccount', danger: true }))}
      </div>`
  };
  Actions.deleteAccount = async () => {
    const ok = await Modal.confirm({ title: 'Delete your account?', message: 'Your profile, posts, chats and secret conversations will be permanently deleted. This can\'t be undone.', confirm: 'Delete account', danger: true, icon: 'trash' });
    if (!ok) return;
    NX.reset('free', { loggedOut: true });
    Nav.reset('welcome');
    Toast.show('Your account was deleted');
  };

  /* ---------- Privacy ---------- */
  Screens.settingsPrivacy = {
    title: 'Privacy',
    render: () => `
      ${appbar({ title: 'Privacy' })}
      <div class="page settings">
        ${group('Account', toggleRow({ icon: 'lock', label: 'Private account', sub: 'Only approved followers see your posts and reels', checked: S.privacy.private, action: 'togglePrivacy', k: 'private' })
          + toggleRow({ icon: 'clock', label: 'Show activity status', sub: 'Let people you follow see when you\'re active', checked: S.privacy.activity, action: 'togglePrivacy', k: 'activity' }))}
        ${group('Who can message you', `<div class="radio-list pad">
          ${[['everyone', 'Everyone'], ['following', 'People you follow']].map(([v, l]) => `<label class="radio-row"><input type="radio" name="msgPriv" value="${v}" ${S.privacy.messages === v ? 'checked' : ''} data-change="msgPrivacy"><span>${l}</span><i class="radio-dot"></i></label>`).join('')}</div>`)}
        <div class="rule-card">${Icon('mask', 18)}<p><b>Secret features are always anonymous.</b> Secret Message senders stay hidden until two replies; Secret Crushes are only revealed when mutual.</p></div>
        ${group('', row({ icon: 'ban', label: 'Blocked accounts', value: S.blocked.length ? String(S.blocked.length) : '', go: 'blocked' }))}
      </div>`
  };
  Actions.togglePrivacy = (el) => { S.privacy[el.dataset.k] = !S.privacy[el.dataset.k]; commit(); Toast.show('Privacy updated', { type: 'success' }); };
  Inputs.msgPrivacy = (el) => { S.privacy.messages = el.value; NX.save(); Toast.show('Message settings updated', { type: 'success' }); };

  Screens.blocked = {
    title: 'Blocked accounts',
    render: () => {
      const anon = (S.blockedAnon || []).length;
      return `
        ${appbar({ title: 'Blocked accounts' })}
        <div class="page">
          ${S.blocked.length ? `<div class="list">${S.blocked.map(id => { const u = NX.user(id); return `<div class="user-row"><span class="user-row-main">${avatar(u, 48)}<span class="user-row-text"><b>${esc(u.username)}</b><small>${esc(u.name)}</small></span></span><button class="btn btn-sm btn-secondary" data-action="unblock" data-id="${id}">Unblock</button></div>`; }).join('')}</div>`
            : emptyState({ icon: 'ban', title: 'No blocked accounts', text: 'When you block someone, they\'ll appear here. They\'re never notified.' })}
          ${anon ? `<div class="rule-card">${Icon('eyeOff', 18)}<p>You've blocked <b>${anon} anonymous sender${anon > 1 ? 's' : ''}</b>. Their identities stay hidden, even here.</p></div>` : ''}
        </div>`;
    }
  };

  /* ---------- Notifications ---------- */
  const NOTIF = [['chat', 'chat', 'Chat messages'], ['likes', 'heart', 'Likes'], ['comments', 'comment', 'Comments'], ['secretMessage', 'mail', 'Secret Messages', 'Always anonymous'], ['secretCrush', 'heart', 'Secret Crush', 'Always anonymous'], ['match', 'sparkles', 'Matches'], ['subscription', 'card', 'Subscription & billing']];
  Screens.settingsNotifications = {
    title: 'Notification settings',
    render: () => `
      ${appbar({ title: 'Notifications' })}
      <div class="page settings">
        ${group('', toggleRow({ icon: 'bell', label: 'Push notifications', sub: 'Pause everything at once', checked: S.notifSettings.push, action: 'toggleNotif', k: 'push' }))}
        ${group('Notify me about', NOTIF.map(([k, ic, l, sub]) => toggleRow({ icon: ic, label: l, sub: sub || '', checked: S.notifSettings[k] && S.notifSettings.push, action: 'toggleNotif', k, disabled: !S.notifSettings.push })).join('')
          + toggleRow({ icon: 'radar', label: 'Nearby', sub: S.me.nearbyEnabled ? '"Someone is near you on Nexity. ✨"' : 'Turn on Nearby first', checked: S.me.nearbyEnabled && S.me.nearbyNotifications && S.notifSettings.push, action: 'nearbySignal', k: 'notifications', disabled: !S.notifSettings.push || !S.me.nearbyEnabled }))}
        <p class="fine">Secret Message, Secret Crush and Nearby notifications never include names or photos.</p>
      </div>`
  };
  Actions.toggleNotif = (el) => { const k = el.dataset.k; S.notifSettings[k] = !S.notifSettings[k]; commit(); };

  /* ---------- Nearby ---------- */
  const statusSub = (k, extra) => { const s = NX.signalStatus(k); return `${esc(extra)}<span class="sig ${s.ok ? 'ok' : S.me[k === 'bluetooth' ? 'nearbyBluetooth' : 'nearbyLocation'] ? 'warn' : ''}">${esc(s.text)}</span>`; };

  Screens.settingsNearby = {
    title: 'Nearby',
    render: () => {
      const g = S.admin.nearbyGlobal;
      const on = g && S.me.nearbyEnabled;
      return `
        ${appbar({ title: 'Nearby' })}
        <div class="page settings">
          <section class="nearby-hero ${on ? 'on' : ''}">
            <div class="radar" aria-hidden="true"><i></i><i></i><i></i><span>${Icon('radar', 22)}</span></div>
            <h2>Nearby</h2>
            <p>See Nexity users around you, get a notification when someone is near, and see "This person was near you today." in Secret Messages and Secret Crush.</p>
          </section>
          ${!g ? `<div class="rule-card">${Icon('info', 18)}<p>Nearby is paused for everyone right now. Your settings are kept.</p></div>` : ''}
          ${group('', toggleRow({ icon: 'radar', label: 'Nearby', sub: 'Off by default. Only you can see this setting.', checked: on, action: 'toggleNearby', disabled: !g }))}
          ${on ? group('How Nearby works', toggleRow({ icon: 'bluetooth', label: 'Bluetooth discovery', sub: statusSub('bluetooth', 'Find people close by on the Nearby screen. '), checked: S.me.nearbyBluetooth, action: 'nearbySignal', k: 'bluetooth' })
            + toggleRow({ icon: 'pin', label: 'Location notifications', sub: statusSub('location', 'Know when someone is near, while you use Nexity. '), checked: S.me.nearbyLocation, action: 'nearbySignal', k: 'location' })
            + toggleRow({ icon: 'bell', label: 'Nearby notifications', sub: '"Someone is near you on Nexity. ✨" — never a name, photo or place.', checked: S.me.nearbyNotifications, action: 'nearbySignal', k: 'notifications' })
            + row({ icon: 'users', label: 'See who\'s nearby', sub: 'Opens the Nearby screen', go: 'nearby' })) : ''}
          ${on && !NX.canSeeNearby() ? `<div class="upsell-card"><span class="upsell-emoji">✨</span><div><b>See who was near you</b><p>Upgrade to Plus or Premium to see "This person was near you today." in Secret Messages and Secret Crush.</p></div><button class="btn btn-primary btn-sm" data-go="plans" data-params='{"reason":"nearby"}'>Upgrade</button></div>` : ''}
          ${group('Your privacy', `
            <ul class="nearby-privacy">
              <li><span class="set-ic">${Icon('shieldCheck', 20)}</span><span><b>Private by design</b><small>Bluetooth uses anonymous ids that change every 15 minutes.</small></span></li>
              <li><span class="set-ic">${Icon('history', 20)}</span><span><b>Only today or yesterday</b><small>Just the latest day is kept, then it disappears.</small></span></li>
              <li><span class="set-ic">${Icon('eyeOff', 20)}</span><span><b>Only you control it</b><small>Nobody can see whether your Nearby is on or off.</small></span></li>
            </ul>`)}
        </div>`;
    }
  };
  Actions.toggleNearby = () => {
    if (!S.admin.nearbyGlobal) return;
    if (S.me.nearbyEnabled) return Nearby.turnOff();
    Nav.go('nearbyConsent');
  };

  Screens.nearbyConsent = {
    chrome: 'none', title: 'Nearby',
    render: () => `
      <div class="consent">
        <button class="icon-btn consent-x" data-action="back" aria-label="Close">${Icon('x', 24)}</button>
        <div class="radar big" aria-hidden="true"><i></i><i></i><i></i><span>${Icon('radar', 30)}</span></div>
        <p class="eyebrow">Nearby · optional</p>
        <h1>See who's around you.</h1>
        <p class="consent-lead">Find Nexity users close by, get a notification when someone is near, and see when someone you sent a Secret Message to or added as a Secret Crush was near you.</p>
        <div class="consent-example"><span class="muted">They'd see:</span> <span class="nearby-chip">${Icon('radar', 12)}This person was near you today.</span></div>
        <div class="consent-signals">
          <label class="consent-check"><input type="checkbox" id="ncBt" checked><span>${Icon('bluetooth', 18)}<span><b>Bluetooth discovery</b><small>Finds people close by while the Nearby screen is open.</small></span></span></label>
          <label class="consent-check"><input type="checkbox" id="ncLoc" checked><span>${Icon('pin', 18)}<span><b>Location notifications</b><small>Tells you "Someone is near you on Nexity. ✨" while you use the app.</small></span></span></label>
        </div>
        <ul class="consent-points">
          <li>${Icon('eyeOff', 18)}<span>Anonymous cards stay anonymous — the hint never shows a name.</span></li>
          <li>${Icon('history', 18)}<span>Only "today" or "yesterday" is shown. Older encounters disappear.</span></li>
          <li>${Icon('shield', 18)}<span>Nobody — not other users, not administrators — can see your location or whether Nearby is on.</span></li>
          <li>${Icon('settings', 18)}<span>Turn it off anytime in Settings → Nearby.</span></li>
        </ul>
        <div class="consent-actions">
          <button class="btn btn-primary btn-lg btn-block" data-action="enableNearby">Turn on Nearby</button>
          <button class="btn btn-ghost btn-lg btn-block" data-action="nearbyNotNow">Not now</button>
        </div>
      </div>`
  };
  Actions.nearbyNotNow = () => Nav.back();
  Actions.enableNearby = async (el) => {
    const bt = $('#ncBt').checked, loc = $('#ncLoc').checked;
    if (!bt && !loc) return Toast.show('Choose Bluetooth discovery, location notifications or both.', { type: 'warning' });
    setBusy(el, true, 'Turning on…');
    Object.assign(S.me, { nearbyEnabled: true, nearbyConsent: true, nearbyNotifications: true, nearbyBluetooth: false, nearbyLocation: false });
    NX.save();
    const btOn = bt ? await Nearby.enableSignal('bluetooth') : false;
    const locOn = loc ? await Nearby.enableSignal('location') : false;
    NX.save();
    if (!btOn && !locOn) Toast.show('Nearby is on, but no permission was allowed. Turn a signal on in Settings → Nearby.', { type: 'warning', duration: 4200 });
    else Toast.show('Nearby is on', { type: 'success' });
    const target = btOn ? 'nearby' : 'settingsNearby';
    const prev = Nav.stack[Nav.stack.length - 2];
    if (prev && prev.name === target) Nav.back();
    else Nav.go(target, {}, { replace: true });
  };

  /* ---------- Security ---------- */
  Screens.settingsSecurity = {
    title: 'Login & security',
    render: () => `
      ${appbar({ title: 'Login & security' })}
      <div class="page settings">
        ${group('Password', row({ icon: 'key', label: 'Change password', sub: 'Last changed 3 months ago', go: 'changePassword' }))}
        ${group('Where you\'re logged in', `
          <div class="device-row"><span class="set-ic">${Icon('monitor', 20)}</span><span class="set-text"><b>This device</b><small>Web browser · Active now</small></span><span class="chip chip-ok sm">Current</span></div>
          ${(App.devices || ['iPhone 15 · Nexity app · 2 days ago', 'Pixel 8 · Nexity app · 1 week ago']).map((d, i) => `<div class="device-row"><span class="set-ic">${Icon('phone', 20)}</span><span class="set-text"><b>${d.split(' · ')[0]}</b><small>${d.split(' · ').slice(1).join(' · ')}</small></span><button class="btn btn-xs btn-secondary" data-action="logoutDevice" data-i="${i}">Log out</button></div>`).join('')}`)}
        ${(App.devices || [1]).length ? `<button class="btn btn-secondary btn-block" data-action="logoutOthers">Log out of all other devices</button>` : ''}
        <div class="rule-card">${Icon('shieldCheck', 18)}<p>We'll email <b>${esc(S.me.email)}</b> whenever there's a new login to your account.</p></div>
      </div>`
  };
  Actions.logoutDevice = (el) => {
    App.devices = (App.devices || ['iPhone 15 · Nexity app · 2 days ago', 'Pixel 8 · Nexity app · 1 week ago']).filter((_, i) => i !== +el.dataset.i);
    App.refresh();
    Toast.show('Device logged out', { type: 'success' });
  };
  Actions.logoutOthers = async () => {
    if (!(await Modal.confirm({ title: 'Log out of other devices?', message: 'You\'ll stay logged in on this device.', confirm: 'Log out others' }))) return;
    App.devices = [];
    App.refresh();
    Toast.show('Logged out of all other devices', { type: 'success' });
  };

  Screens.changePassword = {
    title: 'Change password',
    render: () => `
      ${appbar({ title: 'Change password' })}
      <div class="page">
        <form data-form="changePassword" class="card form-card" novalidate>
          ${pwField('cpOld', 'current', 'Current password', 'Your current password')}
          ${pwField('cpNew', 'password', 'New password', 'At least 8 characters', true, 'new-password')}
          ${pwField('cpNew2', 'confirm', 'Confirm new password', 'Type it again', false, 'new-password')}
          <button class="btn btn-primary btn-block btn-lg" type="submit">Update password</button>
          <button type="button" class="link center-block" data-go="forgot">Forgot your password?</button>
        </form>
      </div>`
  };
  Forms.changePassword = async (form) => {
    const acc = S.accounts.find(a => a.email === S.me.email);
    const cur = form.current.value, pw = form.password.value, c = form.confirm.value;
    let ok = true;
    if (!cur) { fieldError(form, 'current', 'Enter your current password.'); ok = false; }
    else if (acc && acc.password !== cur) { fieldError(form, 'current', 'That\'s not your current password.'); ok = false; }
    else fieldError(form, 'current', '');
    if (pw.length < 8) { fieldError(form, 'password', 'Use at least 8 characters.'); ok = false; }
    else if (pw === cur) { fieldError(form, 'password', 'Choose a password you haven\'t used.'); ok = false; }
    else fieldError(form, 'password', '');
    if (pw !== c) { fieldError(form, 'confirm', 'Passwords don\'t match.'); ok = false; } else fieldError(form, 'confirm', '');
    if (!ok) return;
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Updating…');
    await delay(800);
    if (acc) acc.password = pw;
    NX.save();
    Nav.back();
    Toast.show('Password changed', { type: 'success' });
  };

  /* ---------- Help + Contact ---------- */
  const FAQ = [
    ['How does a Secret Message reveal work?', 'The sender\'s name and message stay sealed (blurred). After your 2nd reply, their name, photo and full message are revealed together, and it becomes a normal chat.'],
    ['Will someone know I added them as a Secret Crush?', 'Only if they add you too — then it\'s a match. Otherwise they only see "Someone added you as a Secret Crush 👀" and never find out who.'],
    ['Does Nearby share my location?', 'No. Nearby shows people close by on the Nearby screen (Bluetooth, only while it\'s open), sends "Someone is near you on Nexity. ✨" and shows "This person was near you today." or "yesterday" in Secret Messages and Secret Crush. Never a place, map, distance, time, visit count or history — not even to administrators.'],
    ['Who can find me with Nearby?', 'Only people who also turned Nearby on, and only when both phones confirm each other. People you blocked never see you. Turn Nearby off anytime in Settings → Nearby.'],
    ['What do Plus and Premium include?', 'Plus (₹99/month) lets you send 5 Secret Messages a month, add 3 Secret Crushes, read & reply to Secret Messages and see Nearby. Premium (₹249/month) gives unlimited Secret Messages (fair use), up to 10 Secret Crushes and a 👑 profile badge.'],
    ['How do I report or block someone?', 'Tap ••• on a profile, post, reel, story, chat or secret message and choose Report or Block. Anonymous senders can be blocked without revealing who they are.'],
  ];
  Screens.help = {
    title: 'Help center',
    render: () => `
      ${appbar({ title: 'Help center' })}
      <div class="page">
        <div class="faq">${FAQ.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}${Icon('chevronDown', 18)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
        <div class="help-cta card"><b>Still need help?</b><p>Our team usually replies within 24 hours.</p><button class="btn btn-primary" data-go="contact">Contact us</button></div>
      </div>`
  };

  const SUBJECTS = ['Account', 'Payments & subscription', 'Secret Messages', 'Secret Crush', 'Nearby', 'Report a bug', 'Other'];
  Screens.contact = {
    title: 'Contact us',
    render: (p) => {
      const mine = S.issues.filter(i => i.userId === 'me');
      return `
        ${appbar({ title: 'Contact us' })}
        <div class="page">
          <div class="contact-head"><span class="ql-ic">${Icon('headset', 22)}</span><div><h2>How can we help?</h2><p>Tell us what's going on. ${S.me.plan === 'premium' ? '<b>Premium priority support</b> — we\'ll get back to you first.' : 'We usually reply within 24 hours.'}</p></div></div>
          <form data-form="contact" class="card form-card" novalidate>
            <div class="field"><label for="ctSubject">Subject</label>
              <select class="input" id="ctSubject" name="subject"><option value="">Choose a topic</option>${SUBJECTS.map(s => `<option ${p.subject === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label for="ctMsg">Message</label>
              <textarea class="input" id="ctMsg" name="message" rows="5" maxlength="1000" placeholder="Describe the issue in as much detail as you can"></textarea></div>
            <div class="field">
              <span class="label">Screenshot <span class="muted">(optional)</span></span>
              <div id="shotBox">${App.contactShot ? shotPreview() : `<label class="upload-drop">${Icon('upload', 22)}<b>Upload a screenshot</b><span>PNG or JPG</span><input type="file" accept="image/*" data-change="contactShot" hidden></label>`}</div>
            </div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Submit</button>
          </form>
          ${mine.length ? `<div class="section-head"><h2>Your requests</h2></div><div class="card list">${mine.map(i => `
            <div class="ticket"><div><b>${esc(i.subject)}</b><small>#${esc(i.id)} · ${fmtDate(i.date)}</small><p>${esc(i.message.slice(0, 90))}</p></div><span class="status s-${i.status}">${i.status === 'resolved' ? 'Resolved' : 'Pending'}</span></div>`).join('')}</div>` : ''}
        </div>`;
    }
  };
  const shotPreview = () => `<div class="shot-preview"><img src="${App.contactShot}" alt="Screenshot preview"><button type="button" class="btn btn-sm btn-secondary" data-action="removeShot">${Icon('trash', 15)} Remove</button></div>`;
  Inputs.contactShot = async (el) => {
    try { App.contactShot = await readImage(el.files[0], 700); $('#shotBox').innerHTML = shotPreview(); }
    catch (e) { Toast.show(e.message, { type: 'error' }); }
  };
  Actions.removeShot = () => { App.contactShot = null; App.refresh(); };
  Forms.contact = async (form) => {
    const subject = form.subject.value, message = form.message.value.trim();
    let ok = true;
    if (!subject) { fieldError(form, 'subject', 'Choose a topic.'); ok = false; } else fieldError(form, 'subject', '');
    if (message.length < 10) { fieldError(form, 'message', 'Tell us a little more (at least 10 characters).'); ok = false; } else fieldError(form, 'message', '');
    if (!ok) return;
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Sending…');
    await delay(1000);
    const id = 'NX-' + (1032 + S.issues.length);
    S.issues.unshift({ id, userId: 'me', subject, message, date: Date.now(), status: 'pending', screenshot: App.contactShot || null });
    App.contactShot = null;
    NX.save();
    Nav.go('contactDone', { id }, { replace: true });
  };
  Screens.contactDone = {
    chrome: 'none', title: 'Request sent',
    render: (p) => `
      <div class="done-screen success">
        <div class="success-check big">${Icon('check', 44)}</div>
        <h1>Thanks — we got it</h1>
        <p>Your request <b>#${esc(p.id)}</b> is with our support team. ${S.me.plan === 'premium' ? 'As a Premium member, you\'re at the front of the queue.' : 'We usually reply within 24 hours.'}</p>
        <div class="done-actions">
          <button class="btn btn-primary btn-lg btn-block" data-go="contact" data-replace>View my requests</button>
          <button class="btn btn-ghost btn-lg btn-block" data-action="back">Done</button>
        </div>
      </div>`
  };

  /* ---------- Legal ---------- */
  const LEGAL = {
    terms: { title: 'Terms of Service', body: [
      ['Who can use Nexity', 'One person, one account. Keep your login details safe.'],
      ['Be kind, especially when anonymous', 'Secret Messages and Secret Crush are for genuine, respectful expression. Harassment, threats, hate speech or sexual content sent to someone who didn\'t ask for it leads to removal.'],
      ['Subscriptions', 'Plus and Premium are monthly plans that renew automatically until you cancel. Cancelling keeps your plan active until the end of the paid period.'],
      ['Your content', 'You own what you post. You give Nexity permission to display it to the audience you choose.'],
      ['Safety & enforcement', 'We review reports and may remove content or disable accounts that break these terms.'],
    ] },
    privacy: { title: 'Privacy Policy', body: [
      ['What we collect', 'Your profile details, the content you share and basic device information needed to run the app.'],
      ['Anonymous features', 'Secret Message senders stay hidden until the receiver replies twice. Secret Crushes are only revealed when mutual. We never reveal a non-mutual crush.'],
      ['Nearby', 'Nearby is off by default. Bluetooth discovery uses anonymous ids that change every 15 minutes. Location notifications use a rounded location that is deleted within 15 minutes. Only the latest day you were near someone is kept, for 2 days, and shown only as "today" or "yesterday". We never show a place, map, distance, time, visit count or location history — and administrators cannot see your location.'],
      ['Payments', 'Payments are handled by certified payment partners. We never store your full card number.'],
      ['Your choices', 'Change privacy settings, download your data or delete your account at any time from Settings.'],
    ] },
  };
  const legalHtml = (d) => `<div class="legal">${LEGAL[d].body.map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join('')}<p class="fine">Last updated 1 September 2026.</p></div>`;
  Screens.legal = {
    auth: false, title: (p) => (LEGAL[p.doc] || LEGAL.terms).title,
    chrome: 'none',
    render: (p) => `${appbar({ title: (LEGAL[p.doc] || LEGAL.terms).title })}<div class="page">${legalHtml(LEGAL[p.doc] ? p.doc : 'terms')}</div>`
  };
  Actions.openLegal = (el) => {
    const d = LEGAL[el.dataset.doc] ? el.dataset.doc : 'terms';
    Modal.open({ title: LEGAL[d].title, cls: 'sheet-tall', body: legalHtml(d), footer: '<button class="btn btn-primary btn-block" data-close>Close</button>' });
  };
})();
