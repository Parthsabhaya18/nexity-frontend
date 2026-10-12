/* Authentication: splash, welcome, login, register, email verification, forgot/reset password. */
(function () {
  const TAKEN = ['riya.patel', 'aarav.shah', 'kabir.mehta', 'mahi.joshi', 'admin', 'nexity', 'support', 'tara.mehra'];

  window.field = ({ label, name, id, type = 'text', placeholder = '', value = '', autocomplete = 'off', hint = '', extra = '', right = '', cls = '' }) => `
    <div class="field ${cls}">
      <label for="${id}">${label}</label>
      <div class="input-wrap">
        <input class="input" id="${id}" name="${name}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="${autocomplete}" ${extra}>
        ${right}
      </div>
      ${hint ? `<p class="field-hint">${hint}</p>` : ''}
    </div>`;

  window.pwField = (id, name, label, placeholder = 'At least 8 characters', meter = false, autocomplete = 'current-password') => `
    ${field({ label, name, id, type: 'password', placeholder, autocomplete, extra: meter ? 'data-input="pwStrength"' : '',
      right: `<button type="button" class="input-icon" data-action="togglePw" aria-label="Show password" aria-pressed="false">${Icon('eye', 20)}</button>` })}
    ${meter ? `<div class="pw-meter" id="${id}Meter" aria-live="polite"><div class="pw-bars"><i></i><i></i><i></i><i></i></div><span>Use 8+ characters with a number and a symbol</span></div>` : ''}`;

  const strength = (v) => {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return v ? Math.max(1, s) : 0;
  };

  Inputs.pwStrength = (el) => {
    const m = document.getElementById(el.id + 'Meter');
    if (!m) return;
    const s = strength(el.value);
    const labels = ['Use 8+ characters with a number and a symbol', 'Weak — add more variety', 'Okay — add a number or symbol', 'Good password', 'Strong password 💪'];
    m.dataset.level = s;
    m.querySelector('span').textContent = labels[s];
  };

  Actions.togglePw = (el) => {
    const input = el.closest('.input-wrap').querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.innerHTML = Icon(show ? 'eyeOff' : 'eye', 20);
    el.setAttribute('aria-pressed', show);
    el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  };

  /* ---------- Splash ---------- */
  Screens.splash = {
    auth: false, chrome: 'none',
    render: () => `
      <div class="splash">
        <div class="splash-glow g1" aria-hidden="true"></div>
        <div class="splash-glow g2" aria-hidden="true"></div>
        <div class="splash-center">
          <div class="splash-ring" aria-hidden="true"></div>
          <div class="splash-logo">${LogoStacked(168)}</div>
        </div>
        <p class="splash-tag">Connect. Share. Discover.</p>
        <div class="splash-bar" aria-hidden="true"><i></i></div>
      </div>`,
    mount() {
      setTimeout(() => { if (Nav.is('splash')) Nav.reset(S.session.loggedIn ? 'home' : 'welcome'); }, 2300);
    }
  };

  /* ---------- Welcome ---------- */
  Screens.welcome = {
    auth: false, chrome: 'none', title: 'Welcome',
    render: () => `
      <div class="welcome">
        <div class="welcome-hero">
          <div class="welcome-art" aria-hidden="true">
            <div class="orb orb-1">${anonAvatar(64)}</div>
            <div class="orb orb-2"><span class="orb-bubble">Someone has something to tell you 💌</span></div>
            <div class="orb orb-3"><span class="orb-heart">💘</span></div>
            <div class="orb orb-4"><span class="nearby-chip">This person was near you today.</span></div>
          </div>
          <div class="welcome-brand">${Wordmark(40)}</div>
          <h1>Say what you feel.<br><span class="grad-text">Reveal when it's right.</span></h1>
          <p class="welcome-sub">Share your moments, send secret messages, and find out if your crush feels the same — privately.</p>
        </div>
        <ul class="welcome-points">
          <li><span class="wp-ic">💌</span><div><b>Secret Messages</b><small>Name and message stay sealed until they reply twice.</small></div></li>
          <li><span class="wp-ic">💘</span><div><b>Secret Crush</b><small>Only revealed when it's mutual. Otherwise, nobody knows.</small></div></li>
          <li><span class="wp-ic">📡</span><div><b>Nearby, privately</b><small>See who's around you. Never your place, time or distance.</small></div></li>
        </ul>
        <div class="welcome-cta">
          <button class="btn btn-primary btn-lg btn-block" data-go="register">Create account</button>
          <button class="btn btn-secondary btn-lg btn-block" data-go="login">Log in</button>
          <p class="welcome-demo">Showing a demo? <button class="link" data-action="openDemo">Use a demo account</button></p>
          <p class="legal-note">By continuing you agree to our <button class="link" data-action="openLegal" data-doc="terms">Terms</button> and <button class="link" data-action="openLegal" data-doc="privacy">Privacy Policy</button>.</p>
        </div>
      </div>`
  };

  /* ---------- Login ---------- */
  Screens.login = {
    auth: false, chrome: 'none', title: 'Log in',
    render: (p) => `
      ${appbar({ title: '', cls: 'appbar-clear' })}
      <div class="auth">
        <div class="auth-head">${Logo(48)}<h1>Welcome back</h1><p>Log in to continue to Nexity.</p></div>
        <div class="alert alert-error" id="loginError" role="alert" hidden></div>
        <form data-form="login" novalidate>
          ${field({ label: 'Email', name: 'email', id: 'loginEmail', type: 'email', placeholder: 'you@example.com', autocomplete: 'email', value: p.email || '' })}
          ${pwField('loginPw', 'password', 'Password', 'Your password')}
          <div class="row-end"><button type="button" class="link" data-go="forgot">Forgot password?</button></div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Log in</button>
        </form>
        <div class="demo-hint">
          <span>${Icon('info', 16)} Demo: <b>tara@nexity.app</b> / <b>demo1234</b></span>
          <button class="btn btn-sm btn-ghost" data-action="fillDemoLogin">Fill</button>
        </div>
        <p class="auth-switch">New to Nexity? <button class="link strong" data-go="register" data-replace>Create account</button></p>
      </div>`
  };
  Actions.fillDemoLogin = () => {
    $('#loginEmail').value = 'tara@nexity.app';
    $('#loginPw').value = 'demo1234';
    fieldError($('[data-form="login"]'), 'email', ''); fieldError($('[data-form="login"]'), 'password', '');
  };
  Forms.login = async (form) => {
    const email = form.email.value.trim().toLowerCase(), pw = form.password.value;
    const errBox = $('#loginError');
    errBox.hidden = true;
    let ok = true;
    if (!validEmail(email)) { fieldError(form, 'email', 'Enter a valid email address.'); ok = false; } else fieldError(form, 'email', '');
    if (pw.length < 6) { fieldError(form, 'password', 'Password must be at least 6 characters.'); ok = false; } else fieldError(form, 'password', '');
    if (!ok) return;
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Logging in…');
    await delay(900);
    const acc = S.accounts.find(a => a.email === email);
    const sec = S.security || (S.security = { failed: 0, lockedUntil: 0 });
    const LIMIT = 5;
    let msg = '';
    if (sec.lockedUntil > Date.now()) msg = `Too many wrong attempts. For your safety, this account is locked — try again in ${Math.ceil((sec.lockedUntil - Date.now()) / 60000)} min or reset your password.`;
    else if (S.demo.offline) msg = 'Network error. Check your connection and try again.';
    else if (!acc) msg = 'We couldn\'t find an account with that email.';
    else if (acc.password !== pw) {
      sec.failed += 1;
      if (sec.failed >= LIMIT) { sec.lockedUntil = Date.now() + 5 * 60000; sec.failed = 0; msg = 'Too many wrong attempts. Your account is temporarily locked for 5 minutes. You can reset your password to get back in now.'; }
      else msg = `Incorrect password. ${LIMIT - sec.failed} attempt${LIMIT - sec.failed > 1 ? 's' : ''} left before a temporary lock.`;
      NX.save();
    }
    if (!msg) { sec.failed = 0; sec.lockedUntil = 0; }
    if (msg) {
      setBusy(btn, false);
      errBox.innerHTML = `${Icon('alert', 18)}<span>${msg}</span>`;
      errBox.hidden = false;
      form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 500);
      return;
    }
    btn.innerHTML = `${Icon('check', 18)} <span>Welcome back!</span>`;
    btn.classList.add('btn-success');
    await delay(450);
    S.session.loggedIn = true;
    NX.save();
    App.loaded = {};
    Nav.reset('home');
    Toast.show(`Welcome back, ${esc(S.me.name.split(' ')[0])} 👋`);
  };

  /* ---------- Register ---------- */
  const maxDob = () => new Date().toISOString().slice(0, 10);
  Screens.register = {
    auth: false, chrome: 'none', title: 'Create account',
    render: () => `
      ${appbar({ title: '', cls: 'appbar-clear' })}
      <div class="auth">
        <div class="auth-head"><h1>Create your account</h1><p>It takes less than a minute.</p></div>        <form data-form="register" novalidate>
          ${field({ label: 'Full name', name: 'name', id: 'regName', placeholder: 'e.g. Riya Patel', autocomplete: 'name' })}
          ${field({ label: 'Username', name: 'username', id: 'regUser', placeholder: 'e.g. riya.writes', autocomplete: 'username', extra: 'data-input="checkUsername" autocapitalize="none" spellcheck="false"', right: '<span class="input-status" id="unameStatus" aria-live="polite"></span>', hint: 'Lowercase letters, numbers, dots and underscores.' })}
          ${field({ label: 'Email', name: 'email', id: 'regEmail', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' })}
          ${pwField('regPw', 'password', 'Password', 'At least 8 characters', true, 'new-password')}
          <fieldset class="field">
            <legend>Gender</legend>
            <div class="chip-group" role="radiogroup">
              ${['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map((g, i) => `<label class="chip-radio"><input type="radio" name="gender" value="${g}" id="regG${i}"><span>${g}</span></label>`).join('')}
            </div>
          </fieldset>
          ${field({ label: 'Date of birth', name: 'dob', id: 'regDob', type: 'date', extra: `max="${maxDob()}" min="1940-01-01"`, hint: 'Your birthday is never shown publicly.' })}
          <div class="field">
            <label class="check"><input type="checkbox" name="terms" id="regTerms"><span class="check-box">${Icon('check', 14)}</span>
              <span>I agree to the <button type="button" class="link" data-action="openLegal" data-doc="terms">Terms</button> and <button type="button" class="link" data-action="openLegal" data-doc="privacy">Privacy Policy</button>.</span></label>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
        </form>
        <p class="auth-switch">Already have an account? <button class="link strong" data-go="login" data-replace>Log in</button></p>
      </div>`
  };
  let unameTimer;
  Inputs.checkUsername = (el) => {
    const st = $('#unameStatus');
    const v = el.value.trim().toLowerCase();
    clearTimeout(unameTimer);
    if (!v) { st.innerHTML = ''; return; }
    if (!/^[a-z0-9._]{3,20}$/.test(v)) { st.innerHTML = `<span class="st-bad">${Icon('x', 14)} Invalid</span>`; return; }
    st.innerHTML = spinner(14);
    unameTimer = setTimeout(() => {
      st.innerHTML = TAKEN.includes(v) || S.users.some(u => u.username === v)
        ? `<span class="st-bad">${Icon('x', 14)} Taken</span>` : `<span class="st-ok">${Icon('check', 14)} Available</span>`;
    }, 550);
  };
  Forms.register = async (form) => {
    const v = { name: form.name.value.trim(), username: form.username.value.trim().toLowerCase(), email: form.email.value.trim().toLowerCase(), password: form.password.value, gender: (form.querySelector('[name=gender]:checked') || {}).value, dob: form.dob.value, terms: form.terms.checked };
    const errs = {};
    if (v.name.length < 2) errs.name = 'Please enter your name.';
    if (!/^[a-z0-9._]{3,20}$/.test(v.username)) errs.username = 'Use 3–20 lowercase letters, numbers, dots or underscores.';
    else if (TAKEN.includes(v.username) || S.users.some(u => u.username === v.username)) errs.username = 'That username is taken. Try another.';
    if (!validEmail(v.email)) errs.email = 'Enter a valid email address.';
    else if (S.accounts.some(a => a.email === v.email)) errs.email = 'An account with this email already exists. Try logging in.';
    if (v.password.length < 8) errs.password = 'Use at least 8 characters.';
    else if (strength(v.password) < 2) errs.password = 'Too weak — add uppercase letters, numbers or symbols.';
    if (!v.gender) errs.gender = 'Please choose an option.';
    if (!v.dob) errs.dob = 'Please enter your date of birth.';
    else if (v.dob > maxDob()) errs.dob = 'Please enter a valid date.';
    if (!v.terms) errs.terms = 'Please accept the Terms and Privacy Policy.';
    ['name', 'username', 'email', 'password', 'dob', 'terms'].forEach(k => fieldError(form, k, errs[k]));
    const gf = form.querySelector('fieldset.field');
    gf.classList.toggle('has-error', !!errs.gender);
    let ge = gf.querySelector('.field-error'); if (!ge) { ge = document.createElement('p'); ge.className = 'field-error'; gf.appendChild(ge); } ge.textContent = errs.gender || '';
    const first = Object.keys(errs)[0];
    if (first) { const f = form.querySelector(`[name=${first}]`); f && f.focus(); return; }
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Creating account…');
    await delay(1000);
    App.pendingRegistration = v;
    Nav.go('verify', { email: v.email, mode: 'register' });
  };

  /* ---------- Email verification (also used for password reset codes) ---------- */
  let otpTimer = null;
  Screens.verify = {
    auth: false, chrome: 'none', title: 'Verify email',
    render: (p) => `
      ${appbar({ title: '', cls: 'appbar-clear' })}
      <div class="auth verify" id="verifyBox">
        <div class="verify-ic">${Icon('mail', 30)}</div>
        <h1>${p.mode === 'reset' ? 'Enter reset code' : 'Check your email'}</h1>
        <p>We sent a 6-digit code to <b>${esc(p.email || 'your email')}</b>.</p>
        <form data-form="verify" novalidate>
          <div class="otp" role="group" aria-label="6-digit code">
            ${[0, 1, 2, 3, 4, 5].map(i => `<input class="otp-input" inputmode="numeric" maxlength="1" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="Digit ${i + 1}" data-input="otp" data-i="${i}">`).join('')}
          </div>
          <p class="field-error center" id="otpError" role="alert"></p>
          <button class="btn btn-primary btn-lg btn-block" type="submit" id="otpSubmit">Verify</button>
        </form>
        <p class="resend" id="resendRow">Didn't get it? <span id="resendTimer">Resend in 0:30</span></p>
        <div class="demo-hint"><span>${Icon('info', 16)} Demo code: <b>123456</b></span><button class="btn btn-sm btn-ghost" data-action="fillOtp">Fill</button></div>
      </div>`,
    mount(el) {
      const inputs = $$('.otp-input', el);
      inputs[0].focus();
      inputs.forEach((inp, i) => {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !inp.value && i > 0) { inputs[i - 1].focus(); inputs[i - 1].value = ''; }
          if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
          if (e.key === 'ArrowRight' && i < 5) inputs[i + 1].focus();
        });
        inp.addEventListener('paste', (e) => {
          const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
          if (!t) return;
          e.preventDefault();
          t.split('').forEach((c, j) => { if (inputs[j]) inputs[j].value = c; });
          inputs[Math.min(t.length, 5)].focus();
          if (t.length === 6) $('[data-form="verify"]').requestSubmit();
        });
      });
      startResendTimer();
    }
  };
  function startResendTimer() {
    clearInterval(otpTimer);
    let left = 30;
    const tick = () => {
      const t = $('#resendTimer');
      if (!t) { clearInterval(otpTimer); return; }
      if (left <= 0) { clearInterval(otpTimer); t.outerHTML = `<button class="link strong" id="resendTimer" data-action="resendCode">Resend code</button>`; return; }
      t.textContent = `Resend in 0:${String(left).padStart(2, '0')}`;
      left--;
    };
    tick();
    otpTimer = setInterval(tick, 1000);
  }
  Actions.resendCode = () => {
    Toast.show('A new code is on its way 📬', { type: 'success' });
    $('#resendTimer').outerHTML = '<span id="resendTimer">Resend in 0:30</span>';
    startResendTimer();
  };
  Actions.fillOtp = () => {
    $$('.otp-input').forEach((inp, i) => { inp.value = '123456'[i]; });
    $('#otpError').textContent = '';
  };
  Inputs.otp = (el) => {
    el.value = el.value.replace(/\D/g, '').slice(-1);
    $('#otpError').textContent = '';
    $$('.otp-input').forEach(i => i.classList.remove('error'));
    const i = +el.dataset.i;
    if (el.value && i < 5) $$('.otp-input')[i + 1].focus();
    const code = $$('.otp-input').map(x => x.value).join('');
    if (code.length === 6) $('[data-form="verify"]').requestSubmit();
  };
  Forms.verify = async (form) => {
    const p = Nav.cur().params;
    const inputs = $$('.otp-input', form);
    const code = inputs.map(x => x.value).join('');
    const err = $('#otpError');
    if (code.length < 6) { err.textContent = 'Enter all 6 digits.'; return; }
    const btn = $('#otpSubmit');
    if (btn.disabled) return;
    setBusy(btn, true, 'Verifying…');
    await delay(800);
    if (code !== '123456') {
      setBusy(btn, false);
      err.textContent = 'That code isn\'t right. Check your email and try again.';
      inputs.forEach(i => { i.classList.add('error'); i.value = ''; });
      form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 500);
      inputs[0].focus();
      return;
    }
    clearInterval(otpTimer);
    if (p.mode === 'reset') { Nav.go('newPassword', { email: p.email }, { replace: true }); return; }
    $('#verifyBox').innerHTML = `<div class="success-state"><div class="success-check">${Icon('check', 40)}</div><h1>Email verified</h1><p>You're all set. Setting up your account…</p></div>`;
    await delay(1300);
    createAccount(App.pendingRegistration || { name: 'New Member', username: 'new.member', email: p.email, password: 'password1', gender: 'Prefer not to say', dob: '2000-01-01' });
    Nav.reset('home');
    Toast.show(`Welcome to Nexity, ${esc(S.me.name.split(' ')[0])} 🎉`, { type: 'success' });
  };

  function createAccount(v) {
    const now = Date.now();
    S.accounts.push({ email: v.email, password: v.password });
    S.me = Object.assign(NX.meDefaults(), { name: v.name, username: v.username, email: v.email, gender: v.gender, dob: v.dob, avatar: '', bio: '', followers: 0, following: 0, joined: new Date().toISOString().slice(0, 10) });
    S.posts = S.posts.filter(p => p.userId !== 'me');
    S.reels = S.reels.filter(r => r.userId !== 'me');
    S.stories = S.stories.filter(s => s.userId !== 'me');
    S.following = ['u2', 'u7'];
    S.chats = []; S.secretInbox = []; S.secretSent = []; S.crushes = []; S.crushedBy = []; S.matches = [];
    S.notifications = [{ id: 'nw', type: 'subscription', text: 'Welcome to Nexity! Try Plus to send your first Secret Message 💌', time: now, read: false, target: { screen: 'plans', params: {} } }];
    S.usage.secretSent = 0;
    S.session.loggedIn = true;
    S.persona = 'new';
    App.loaded = {};
    NX.save();
  }

  /* ---------- Forgot password ---------- */
  Screens.forgot = {
    auth: false, chrome: 'none', title: 'Forgot password',
    render: () => `
      ${appbar({ title: '', cls: 'appbar-clear' })}
      <div class="auth">
        <div class="verify-ic">${Icon('key', 28)}</div>
        <h1>Forgot your password?</h1>
        <p class="muted">Enter your email and we'll send you a 6-digit code to reset it.</p>
        <form data-form="forgot" novalidate>
          ${field({ label: 'Email', name: 'email', id: 'fpEmail', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' })}
          <button class="btn btn-primary btn-lg btn-block" type="submit">Send code</button>
        </form>
        <p class="auth-switch"><button class="link strong" data-action="back">Back to log in</button></p>
      </div>`
  };
  Forms.forgot = async (form) => {
    const email = form.email.value.trim().toLowerCase();
    if (!validEmail(email)) return fieldError(form, 'email', 'Enter a valid email address.');
    fieldError(form, 'email', '');
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Sending…');
    await delay(900);
    Toast.show('If an account exists, we\'ve sent a code.', { type: 'info' });
    Nav.go('verify', { email, mode: 'reset' }, { replace: true });
  };

  Screens.newPassword = {
    auth: false, chrome: 'none', title: 'New password',
    render: (p) => `
      ${appbar({ title: '', cls: 'appbar-clear' })}
      <div class="auth">
        <div class="verify-ic">${Icon('lock', 28)}</div>
        <h1>Create a new password</h1>
        <p class="muted">For <b>${esc(p.email || '')}</b>. Make it something you haven't used before.</p>
        <form data-form="newPassword" novalidate>
          ${pwField('npPw', 'password', 'New password', 'At least 8 characters', true, 'new-password')}
          ${pwField('npPw2', 'confirm', 'Confirm password', 'Type it again', false, 'new-password')}
          <button class="btn btn-primary btn-lg btn-block" type="submit">Update password</button>
        </form>
      </div>`
  };
  Forms.newPassword = async (form) => {
    const pw = form.password.value, c = form.confirm.value;
    let ok = true;
    if (pw.length < 8 || strength(pw) < 2) { fieldError(form, 'password', 'Use 8+ characters with a mix of letters, numbers or symbols.'); ok = false; } else fieldError(form, 'password', '');
    if (pw !== c) { fieldError(form, 'confirm', 'Passwords don\'t match.'); ok = false; } else fieldError(form, 'confirm', '');
    if (!ok) return;
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Updating…');
    await delay(900);
    const email = Nav.cur().params.email;
    const acc = S.accounts.find(a => a.email === email);
    if (acc) { acc.password = pw; S.security = { failed: 0, lockedUntil: 0 }; NX.save(); }
    Nav.stack = [{ name: 'welcome', params: {} }, { name: 'login', params: { email } }];
    App.render('back');
    Toast.show('Password updated. Log in with your new password.', { type: 'success' });
  };

  Screens.disabled = {
    chrome: 'none', title: 'Account disabled',
    render: () => `
      <div class="auth center-screen">
        <div class="verify-ic danger">${Icon('ban', 30)}</div>
        <h1>Your account is disabled</h1>
        <p class="muted">An administrator has temporarily disabled this account. If you think this is a mistake, email <b>support@nexity.app</b>.</p>
        <button class="btn btn-secondary btn-lg btn-block" data-action="logoutNow">Log out</button>
      </div>`
  };
  Actions.logoutNow = () => {
    S.session.loggedIn = false;
    NX.save();
    Modal.closeAll();
    Nav.reset('welcome');
  };
})();
