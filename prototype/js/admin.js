/* Nexity admin panel — desktop-first console that reads and writes the same localStorage state as the user app. */
(function () {
  const { HOUR, DAY } = NX.T;
  const root = document.getElementById('admin');
  const PER_PAGE = 10;

  const A = {
    page: 'dashboard', range: 30, sideOpen: false,
    users: { q: '', plan: 'all', status: 'all', page: 1 },
    payments: { status: 'all', q: '' },
    issues: { status: 'pending' },
    reports: { status: 'open' },
    gift: { userId: null, q: '', plan: 'plus', days: 30 },
    revealed: {},
  };

  const PAGES = [
    ['dashboard', 'dashboard', 'Dashboard'], ['users', 'users', 'Users'], ['plans', 'crown', 'Plans'],
    ['payments', 'card', 'Payments'], ['issues', 'headset', 'Issues'], ['reports', 'flag', 'Reports'],
    ['nearby', 'radar', 'Nearby'], ['settings', 'settings', 'Settings'],
  ];

  /* ---------- Helpers ---------- */
  const num = (n) => Math.round(n).toLocaleString('en-IN');
  const save = () => { NX.save(); render(); };
  const audit = (text) => { S.admin.audit.unshift({ text, time: Date.now() }); S.admin.audit = S.admin.audit.slice(0, 40); };
  const users = () => NX.allUsers().filter(u => u.status !== 'deleted');
  const nameOf = (id) => { const u = NX.user(id); return u ? u.name : 'Unknown user'; };
  const planOf = (u) => u.plan || 'free';
  const pendingIssues = () => S.issues.filter(i => i.status === 'pending').length;
  const openReports = () => S.reports.filter(r => r.status === 'open').length;
  const statusPill = (s) => `<span class="status s-${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;
  const userCell = (u, sub) => u ? `<span class="ad-user">${avatar(u, 34)}<span><b>${esc(u.name)}</b><small>${esc(sub ?? '@' + u.username)}</small></span>${u.id === 'me' ? '<span class="ad-tag">Demo user</span>' : ''}</span>` : '<span class="muted">Deleted user</span>';
  const tabs = (items, cur, action) => `<div class="ad-tabs" role="tablist">${items.map(([id, label, n]) =>
    `<button role="tab" class="${cur === id ? 'active' : ''}" aria-selected="${cur === id}" data-action="${action}" data-v="${id}">${label}${n != null ? ` <span class="ad-count">${n}</span>` : ''}</button>`).join('')}</div>`;
  const dateLabel = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const series = (n, base, vari, seed, trend = 0.004) => {
    const r = rng(seed);
    return Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base * (1 + trend * i) + Math.sin(i / 2.2) * vari * 0.45 + (r() - 0.5) * vari)));
  };
  const niceMax = (m) => { if (m <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil((m * 1.1) / p * 2) / 2 * p; };

  /* ---------- SVG charts ---------- */
  function lineChart(vals, labels, { h = 250, w = 680, money = false } = {}) {
    const pl = 54, pr = 14, pt = 14, pb = 30;
    const max = niceMax(Math.max(...vals));
    const X = (i) => pl + i * (w - pl - pr) / Math.max(1, vals.length - 1);
    const Y = (v) => pt + (h - pt - pb) * (1 - v / max);
    const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const area = `${line}L${X(vals.length - 1).toFixed(1)},${h - pb}L${pl},${h - pb}Z`;
    const grid = [0, 0.25, 0.5, 0.75, 1].map(t => {
      const y = Y(max * t).toFixed(1);
      return `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}" class="ch-grid"/><text x="${pl - 10}" y="${+y + 4}" text-anchor="end" class="ch-label">${money ? '₹' : ''}${fmtNum(max * t)}</text>`;
    }).join('');
    const step = Math.ceil(vals.length / 7);
    const xl = labels.map((l, i) => (i % step === 0 ? `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="ch-label">${l}</text>` : '')).join('');
    const half = (w - pl - pr) / Math.max(1, vals.length - 1) / 2;
    const pts = vals.map((v, i) => `<g class="ch-pt"><rect x="${(X(i) - half).toFixed(1)}" y="${pt}" width="${(half * 2).toFixed(1)}" height="${h - pt - pb}" fill="transparent"/><line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${pt}" y2="${h - pb}" class="ch-hair"/><circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5"/><title>${labels[i]} · ${money ? inr(v) : num(v)}</title></g>`).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart">
      <defs><linearGradient id="chArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--primary);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--primary);stop-opacity:0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#chArea)"/><path d="${line}" class="ch-line"/>${xl}${pts}</svg>`;
  }

  function barChart(sets, labels, { h = 230, colors = ['var(--primary)', 'var(--accent)'], names = [], money = false } = {}) {
    const w = 680, pl = 46, pr = 10, pt = 12, pb = 30;
    const max = niceMax(Math.max(...sets.flat()));
    const slot = (w - pl - pr) / labels.length;
    const bw = Math.min(26, (slot * 0.7) / sets.length);
    const Y = (v) => pt + (h - pt - pb) * (1 - v / max);
    const grid = [0, 0.5, 1].map(t => { const y = Y(max * t).toFixed(1); return `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}" class="ch-grid"/><text x="${pl - 10}" y="${+y + 4}" text-anchor="end" class="ch-label">${money ? '₹' : ''}${fmtNum(max * t)}</text>`; }).join('');
    const bars = labels.map((l, i) => {
      const cx = pl + slot * i + slot / 2;
      const start = cx - (bw * sets.length + 4 * (sets.length - 1)) / 2;
      return sets.map((s, k) => {
        const x = start + k * (bw + 4), y = Y(s[i]);
        return `<rect class="ch-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - pb - y).toFixed(1)}" rx="5" style="fill:${colors[k]}"><title>${l} · ${names[k] ? names[k] + ': ' : ''}${money ? inr(s[i]) : num(s[i])}</title></rect>`;
      }).join('') + `<text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="ch-label">${l}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart">${grid}${bars}</svg>`;
  }

  function donut(segs, center) {
    const total = segs.reduce((a, s) => a + s.value, 0) || 1;
    const r = 62, C = 2 * Math.PI * r;
    let off = 0;
    const arcs = segs.map(s => {
      const len = (s.value / total) * C;
      const el = `<circle r="${r}" cx="90" cy="90" fill="none" stroke-width="22" style="stroke:${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${s.label}: ${num(s.value)}</title></circle>`;
      off += len;
      return el;
    }).join('');
    return `<div class="donut-wrap">
      <svg class="donut" viewBox="0 0 180 180" role="img" aria-label="Plan distribution"><g transform="rotate(-90 90 90)">${arcs}</g>
        <text x="90" y="86" text-anchor="middle" class="donut-big">${center[0]}</text><text x="90" y="106" text-anchor="middle" class="ch-label">${center[1]}</text></svg>
      <ul class="legend">${segs.map(s => `<li><i style="background:${s.color}"></i><span>${s.label}</span><b>${num(s.value)}</b><small>${Math.round(s.value / total * 100)}%</small></li>`).join('')}</ul>
    </div>`;
  }

  const spark = (vals, color = 'var(--primary)') => {
    const w = 90, h = 30, max = Math.max(...vals), min = Math.min(...vals);
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i * w / (vals.length - 1)).toFixed(1)},${(h - 3 - (h - 6) * ((v - min) / ((max - min) || 1))).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" style="stroke:${color}"/></svg>`;
  };

  /* ---------- Login ---------- */
  function loginView() {
    return `
      <main class="ad-login">
        <section class="ad-login-art" aria-hidden="true">
          <div class="ad-login-brand on-dark">${Wordmark(44)}<em>admin</em></div>
          <h2>Keep Nexity kind, safe and private.</h2>
          <ul>
            <li>${Icon('shieldCheck', 20)} Moderate reports and resolve issues</li>
            <li>${Icon('crown', 20)} Manage plans, pricing and gifts</li>
            <li>${Icon('pinOff', 20)} Location data is never visible to admins</li>
          </ul>
        </section>
        <section class="ad-login-card">
          <div class="ad-login-brand mobile">${Wordmark(38)}<em>admin</em></div>
          <h1>Admin sign in</h1>
          <p class="muted">Restricted to the Nexity Trust &amp; Operations team.</p>
          <form data-form="adLogin" novalidate>
            <div class="field"><label for="adEmail">Work email</label><input class="input" id="adEmail" name="email" type="email" autocomplete="username" placeholder="you@nexity.app" data-autofocus></div>
            <div class="field"><label for="adPw">Password</label>
              <div class="input-wrap"><input class="input" id="adPw" name="password" type="password" autocomplete="current-password" placeholder="Enter password">
                <button type="button" class="input-icon" data-action="adTogglePw" aria-label="Show password">${Icon('eye', 20)}</button></div></div>
            <p class="field-error center" id="adLoginErr" role="alert"></p>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
          </form>
          <div class="demo-hint"><b>Demo:</b> admin@nexity.app / admin123 <button class="link" data-action="adFillDemo">Fill in</button></div>
          <a class="link-muted ad-back-app" href="index.html">${Icon('back', 16)} Back to the Nexity app</a>
        </section>
      </main>`;
  }

  /* ---------- Shell ---------- */
  function shell(content) {
    const counts = { issues: pendingIssues(), reports: openReports() };
    const title = (PAGES.find(p => p[0] === A.page) || PAGES[0])[2];
    return `
      <div class="ad-shell${A.sideOpen ? ' side-open' : ''}">
        <aside class="ad-side" aria-label="Admin navigation">
          <div class="ad-brand">${Wordmark(34)}<em>admin</em></div>
          <nav class="ad-nav">
            ${PAGES.map(([id, ic, label]) => `<button class="ad-nav-item${A.page === id ? ' active' : ''}" data-action="adGo" data-page="${id}" ${A.page === id ? 'aria-current="page"' : ''}>
              ${Icon(ic, 20)}<span>${label}</span>${counts[id] ? `<span class="ad-count warn">${counts[id]}</span>` : ''}</button>`).join('')}
          </nav>
          <div class="ad-side-foot">
            <a class="ad-nav-item" href="index.html" target="_blank" rel="noopener">${Icon('phone', 20)}<span>Open user app</span></a>
            <button class="ad-nav-item" data-action="adLogout">${Icon('logout', 20)}<span>Logout</span></button>
          </div>
        </aside>
        <div class="ad-scrim" data-action="adSide"></div>
        <div class="ad-main">
          <header class="ad-top">
            <button class="icon-btn ad-menu" data-action="adSide" aria-label="Open navigation">${Icon('menu', 22)}</button>
            <h1>${title}</h1>
            <div class="ad-top-right">
              <button class="icon-btn" data-action="adTheme" aria-label="Toggle theme">${Icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 20)}</button>
              <button class="icon-btn ad-bell" data-action="adGo" data-page="issues" aria-label="${counts.issues} pending issues">${Icon('bell', 20)}${counts.issues ? `<span class="badge">${counts.issues}</span>` : ''}</button>
              <div class="ad-me"><span class="ad-me-av">NA</span><span><b>Nexity Admin</b><small>Trust &amp; Ops</small></span></div>
            </div>
          </header>
          <div class="ad-content" id="adContent" tabindex="-1">${content}</div>
        </div>
      </div>`;
  }

  /* ---------- Dashboard ---------- */
  function dashboard() {
    const all = users();
    const now = Date.now();
    const succ = S.transactions.filter(t => t.status === 'success');
    const rev30 = 182640 + succ.filter(t => t.date > now - 30 * DAY).reduce((a, t) => a + t.amount, 0);
    const secretCount = 15604 + S.secretInbox.length + S.secretSent.length;
    const matches = 1128 + S.matches.length;
    const counts = { free: 10650, plus: 1240, premium: 502 };
    all.forEach(u => { counts[planOf(u)] = (counts[planOf(u)] || 0) + 1; });
    const subs = { plus: counts.plus, premium: counts.premium };
    const k = [
      { label: 'Total users', value: num(12444 + all.length), delta: '+4.2%', ic: 'users', page: 'users', s: series(12, 100, 8, 3, 0.03) },
      { label: 'Active users (today)', value: num(4312 + all.filter(u => u.online).length), delta: '+2.8%', ic: 'userCheck', s: series(12, 100, 14, 5, 0.01) },
      { label: 'New users (7d)', value: num(386 + Math.max(0, S.accounts.length - 1)), delta: '+11.6%', ic: 'userPlus', page: 'users', s: series(12, 60, 18, 7, 0.02) },
      { label: 'Revenue (30d)', value: inr(rev30), delta: '+9.1%', ic: 'rupee', page: 'payments', s: series(12, 100, 20, 11, 0.02) },
      { label: 'Active subscriptions', value: num(subs.plus + subs.premium), delta: '+6.4%', ic: 'crown', page: 'plans', s: series(12, 100, 9, 13, 0.02) },
      { label: 'Posts', value: num(48904 + S.posts.length), delta: '+3.3%', ic: 'image', s: series(12, 100, 12, 17) },
      { label: 'Reels', value: num(9207 + S.reels.length), delta: '+7.9%', ic: 'reels', s: series(12, 100, 15, 19, 0.02) },
      { label: 'Stories (24h)', value: num(2180 + S.stories.length), delta: '−1.2%', down: true, ic: 'plusSquare', s: series(12, 100, 18, 23, -0.004) },
      { label: 'Secret Messages', value: num(secretCount), delta: '+14.0%', ic: 'mail', s: series(12, 100, 16, 29, 0.03) },
      { label: 'Matches', value: num(matches), delta: '+8.7%', ic: 'heart', s: series(12, 100, 20, 31, 0.02) },
      { label: 'Pending issues', value: num(pendingIssues()), delta: pendingIssues() ? 'Needs attention' : 'All clear', warn: pendingIssues() > 0, ic: 'headset', page: 'issues', s: series(12, 10, 6, 37, 0) },
    ];

    const n = A.range;
    const labels = Array.from({ length: n }, (_, i) => dateLabel(now - (n - 1 - i) * DAY));
    const rawRev = series(n, 5400, 2600, 41 + n, 0.006);
    const revScale = (rev30 / 30) * n / rawRev.reduce((a, b) => a + b, 0);
    const revenue = rawRev.map(v => Math.round(v * revScale));
    revenue[n - 1] += Math.round((rev30 / 30) * n) - revenue.reduce((a, b) => a + b, 0);
    const signupLabels = Array.from({ length: 14 }, (_, i) => new Date(now - (13 - i) * DAY).toLocaleDateString('en-IN', { day: 'numeric' }));
    const signups = series(14, 52, 30, 53, 0.02);
    const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * DAY).toLocaleDateString('en-IN', { weekday: 'short' }));
    const monthly = A.revMode === 'monthly';
    const monthLabels = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (11 - i)); return d.toLocaleDateString('en-IN', { month: 'short' }); });
    const monthRev = series(12, 120000, 60000, 71, 0.04);
    monthRev[11] = rev30;

    return `
      <div class="ad-page">
        <div class="ad-greet">
          <div><h2>Good to see you 👋</h2><p class="muted">Here's how Nexity is doing. Figures combine platform aggregates with live prototype data.</p></div>
          <button class="btn btn-secondary btn-sm" data-action="adRefresh">${Icon('refresh', 16)} Refresh</button>
        </div>
        <div class="kpi-grid">
          ${k.map(x => `<${x.page ? `button data-action="adGo" data-page="${x.page}"` : 'div'} class="kpi${x.warn ? ' warn' : ''}">
              <span class="kpi-ic">${Icon(x.ic, 20)}</span>
              <span class="kpi-label">${x.label}</span>
              <b class="kpi-value">${x.value}</b>
              <span class="kpi-foot"><span class="kpi-delta${x.down ? ' down' : ''}${x.warn ? ' warn' : ''}">${x.delta}</span>${spark(x.s, x.warn ? 'var(--warning)' : x.down ? 'var(--danger)' : 'var(--primary)')}</span>
            </${x.page ? 'button' : 'div'}>`).join('')}
        </div>
        <div class="ad-grid-2">
          <section class="ad-card span-2">
            <div class="ad-card-head"><div><h3>Revenue</h3><p class="muted">${monthly ? `${inr(monthRev.reduce((a, b) => a + b, 0))} in the last 12 months` : `${inr(revenue.reduce((a, b) => a + b, 0))} in the last ${n} days`}</p></div>
              <div class="ad-head-ctrls">
                <div class="ad-seg">${[['daily', 'Daily'], ['monthly', 'Monthly']].map(([v, l]) => `<button class="${(A.revMode || 'daily') === v ? 'active' : ''}" data-action="adRevMode" data-v="${v}" aria-pressed="${(A.revMode || 'daily') === v}">${l}</button>`).join('')}</div>
                ${monthly ? '' : `<div class="ad-seg">${[7, 30, 90].map(r => `<button class="${A.range === r ? 'active' : ''}" data-action="adRange" data-v="${r}" aria-pressed="${A.range === r}">${r}d</button>`).join('')}</div>`}
              </div></div>
            ${monthly ? barChart([monthRev], monthLabels, { names: ['Revenue'], money: true }) : lineChart(revenue, labels, { money: true, w: 1040, h: 280 })}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Active subscriptions</h3><p class="muted">By plan, right now</p></div><button class="link" data-action="adGo" data-page="plans">Plans</button></div>
            <div class="subs-split">
              ${[['plus', 'Plus', 'var(--primary)'], ['premium', 'Premium', 'var(--accent)']].map(([id, l, col]) => `
                <div class="subs-row"><span class="subs-name">${planChip(id)}</span>
                  <div class="subs-bar"><i style="width:${Math.round((subs[id] / (subs.plus + subs.premium)) * 100)}%;background:${col}"></i></div>
                  <b>${num(subs[id])}</b></div>`).join('')}
              <p class="muted subs-total">${num(subs.plus + subs.premium)} active paid subscriptions · ${inr(subs.plus * S.plans.plus.price + subs.premium * S.plans.premium.price)} monthly recurring</p>
            </div>
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>New signups</h3><p class="muted">Last 14 days</p></div></div>
            ${barChart([signups], signupLabels, { names: ['Signups'] })}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Plan distribution</h3><p class="muted">All registered users</p></div></div>
            ${donut([{ label: 'Free', value: counts.free, color: 'var(--surface-3)' }, { label: 'Plus', value: counts.plus, color: 'var(--primary)' }, { label: 'Premium', value: counts.premium, color: 'var(--accent)' }], [fmtNum(counts.free + counts.plus + counts.premium), 'users'])}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Secret activity</h3><p class="muted">This week</p></div>
              <div class="legend inline"><span><i style="background:var(--primary)"></i>Secret Messages</span><span><i style="background:var(--accent)"></i>Matches</span></div></div>
            ${barChart([series(7, 320, 120, 61), series(7, 26, 14, 67)], days, { names: ['Secret Messages', 'Matches'] })}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Recent payments</h3></div><button class="link" data-action="adGo" data-page="payments">View all</button></div>
            <ul class="mini-list">${S.transactions.slice(0, 5).map(t => `<li>${userCell(NX.user(t.userId), `${S.plans[t.plan] ? S.plans[t.plan].name : t.plan} · ${timeAgoLong(t.date)}`)}<span class="mini-right"><b>${inr(t.amount)}</b>${statusPill(t.status)}</span></li>`).join('')}</ul>
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Pending issues</h3></div><button class="link" data-action="adGo" data-page="issues">Open issues</button></div>
            ${S.issues.filter(i => i.status === 'pending').length ? `<ul class="mini-list">${S.issues.filter(i => i.status === 'pending').slice(0, 4).map(i => `<li><span class="mini-issue"><b>${esc(i.subject)}</b><small>${esc(nameOf(i.userId))} · ${timeAgoLong(i.date)}</small></span><button class="btn btn-sm btn-secondary" data-action="adResolve" data-id="${i.id}">${Icon('check', 16)} Resolve</button></li>`).join('')}</ul>`
              : `<div class="ad-empty">${Icon('check', 26)}<p>No pending issues. Nice work!</p></div>`}
          </section>
        </div>
      </div>`;
  }

  /* ---------- Users ---------- */
  function filteredUsers() {
    const f = A.users, q = f.q.trim().toLowerCase();
    return users().filter(u =>
      (!q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) &&
      (f.plan === 'all' || planOf(u) === f.plan) &&
      (f.status === 'all' || u.status === f.status));
  }
  function usersPage() {
    const list = filteredUsers();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    A.users.page = Math.min(A.users.page, pages);
    const rows = list.slice((A.users.page - 1) * PER_PAGE, A.users.page * PER_PAGE);
    const all = users();
    return `
      <div class="ad-page">
        <div class="ad-stats">
          <div class="ad-stat"><span>Total</span><b>${all.length}</b></div>
          <div class="ad-stat"><span>Active</span><b>${all.filter(u => u.status === 'active').length}</b></div>
          <div class="ad-stat"><span>Inactive</span><b>${all.filter(u => u.status === 'inactive').length}</b></div>
          <div class="ad-stat"><span>Disabled</span><b>${all.filter(u => u.status === 'disabled').length}</b></div>
          <div class="ad-stat"><span>Paid</span><b>${all.filter(u => planOf(u) !== 'free').length}</b></div>
        </div>
        <section class="ad-card flush">
          <div class="ad-toolbar">
            <label class="ad-search">${Icon('search', 18)}<input id="adUserQ" type="search" placeholder="Search name, username or email" value="${esc(A.users.q)}" data-input="adUserQ" aria-label="Search users"></label>
            <select class="input ad-select" data-change="adUserPlan" aria-label="Filter by plan">
              ${[['all', 'All plans'], ['free', 'Free'], ['plus', 'Plus'], ['premium', 'Premium']].map(([v, l]) => `<option value="${v}" ${A.users.plan === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <select class="input ad-select" data-change="adUserStatus" aria-label="Filter by status">
              ${[['all', 'All statuses'], ['active', 'Active'], ['inactive', 'Inactive'], ['disabled', 'Disabled']].map(([v, l]) => `<option value="${v}" ${A.users.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" data-action="adGiftFor" data-id="">${Icon('gift', 16)} Gift a plan</button>
          </div>
          ${rows.length ? `
          <div class="ad-table-wrap"><table class="ad-table">
            <thead><tr><th>User</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th><th class="right">Actions</th></tr></thead>
            <tbody>${rows.map(u => `<tr>
              <td>${userCell(u)}</td>
              <td class="muted">${esc(u.email)}</td>
              <td>${planChip(planOf(u))}</td>
              <td>${statusPill(u.status)}</td>
              <td class="muted nowrap">${fmtDate(u.joined)}</td>
              <td class="right nowrap">
                <button class="btn btn-sm btn-ghost" data-action="adViewUser" data-id="${u.id}">${Icon('eye', 16)} View</button>
                <button class="icon-btn" data-action="adUserMenu" data-id="${u.id}" aria-label="More actions for ${esc(u.name)}">${Icon('moreV', 18)}</button>
              </td></tr>`).join('')}</tbody>
          </table></div>
          <div class="ad-pager">
            <span class="muted">Showing ${(A.users.page - 1) * PER_PAGE + 1}–${Math.min(list.length, A.users.page * PER_PAGE)} of ${list.length}</span>
            <div><button class="btn btn-sm btn-secondary" data-action="adPage" data-v="-1" ${A.users.page <= 1 ? 'disabled' : ''}>${Icon('back', 16)} Prev</button>
            <span class="ad-page-n">Page ${A.users.page} of ${pages}</span>
            <button class="btn btn-sm btn-secondary" data-action="adPage" data-v="1" ${A.users.page >= pages ? 'disabled' : ''}>Next ${Icon('chevronRight', 16)}</button></div>
          </div>` : `<div class="ad-empty big">${Icon('search', 28)}<h3>No users found</h3><p>Try a different name or clear the filters.</p><button class="btn btn-secondary btn-sm" data-action="adClearUserFilters">Clear filters</button></div>`}
        </section>
      </div>`;
  }

  function viewUser(id) {
    const u = NX.user(id);
    if (!u) return;
    const txns = S.transactions.filter(t => t.userId === id);
    const reports = S.reports.filter(r => r.reportedId === id).length;
    const isMe = id === 'me';
    const expiry = isMe ? S.me.planExpiry : u.planExpiry;
    Modal.open({
      title: 'User details', cls: 'ad-modal',
      body: `
        <div class="ud-head">${avatar(u, 72)}<div><h3>${esc(u.name)} ${isMe ? '<span class="ad-tag">Demo user</span>' : ''}</h3><p class="muted">@${esc(u.username)} · ${esc(u.email)}</p>
          <div class="ud-chips">${planChip(planOf(u))}${statusPill(u.status)}</div></div></div>
        <dl class="ud-grid">
          <div><dt>Joined</dt><dd>${fmtDate(u.joined)}</dd></div>
          <div><dt>Followers</dt><dd>${num(u.followers)}</dd></div>
          <div><dt>Following</dt><dd>${num(u.following)}</dd></div>
          <div><dt>Gender</dt><dd>${esc(u.gender || '—')}</dd></div>
          <div><dt>Plan renews / ends</dt><dd>${planOf(u) === 'free' ? '—' : expiry ? fmtDate(expiry) : 'Auto-renew'}</dd></div>
          <div><dt>Reports against</dt><dd>${reports}</dd></div>
        </dl>
        <div class="ud-privacy">${Icon('pinOff', 18)}<p>Location data is never collected for display and is not available to administrators. Secret Message and Secret Crush activity is private.</p></div>
        <h4 class="ud-sub">Billing history</h4>
        ${txns.length ? `<ul class="mini-list">${txns.map(t => `<li><span class="mini-issue"><b>${t.id} · ${S.plans[t.plan] ? S.plans[t.plan].name : t.plan}</b><small>${fmtDate(t.date)} · ${t.method}</small></span><span class="mini-right"><b>${inr(t.amount)}</b>${statusPill(t.status)}</span></li>`).join('')}</ul>` : '<p class="muted">No payments yet.</p>'}`,
      footer: `
        <button class="btn btn-secondary" data-action="adGiftFor" data-id="${id}">${Icon('gift', 16)} Gift plan</button>
        <button class="btn btn-secondary" data-action="adForceLogout" data-id="${id}">${Icon('logout', 16)} Force logout</button>
        <button class="btn ${u.status === 'disabled' ? 'btn-primary' : 'btn-danger'}" data-action="adToggleUser" data-id="${id}">${u.status === 'disabled' ? `${Icon('check', 16)} Enable` : `${Icon('ban', 16)} Disable`}</button>`
    });
  }

  async function toggleUser(id) {
    const u = NX.user(id);
    if (!u) return;
    const disabling = u.status !== 'disabled';
    if (disabling) {
      const ok = await Modal.confirm({ title: `Disable ${u.name}?`, message: id === 'me' ? 'The demo user will be blocked from the app immediately (try it with the app open in another tab).' : 'They will be signed out and can\'t use Nexity until re-enabled.', confirm: 'Disable account', danger: true, icon: 'ban' });
      if (!ok) return;
    }
    u.status = disabling ? 'disabled' : 'active';
    audit(`${disabling ? 'Disabled' : 'Enabled'} account @${u.username}`);
    Modal.closeAll();
    save();
    Toast.show(`${u.name} ${disabling ? 'disabled' : 'enabled'}`, { type: disabling ? 'warning' : 'success' });
  }

  function markActivity(id) {
    const u = NX.user(id);
    if (!u || u.status === 'disabled') return;
    u.status = u.status === 'inactive' ? 'active' : 'inactive';
    audit(`Marked @${u.username} as ${u.status}`);
    Modal.closeAll();
    save();
    Toast.show(`${u.name} marked as ${u.status}`, { type: 'success' });
  }

  async function forceLogout(id) {
    const u = NX.user(id);
    const ok = await Modal.confirm({ title: `Sign ${u.name} out everywhere?`, message: 'All active sessions will end. They can sign in again.', confirm: 'Force logout', icon: 'logout' });
    if (!ok) return;
    if (id === 'me') S.session.loggedIn = false;
    audit(`Forced logout for @${u.username}`);
    Modal.closeAll();
    save();
    Toast.show(`All sessions ended for ${u.name}`, { type: 'success', icon: 'logout' });
  }

  async function deleteUser(id) {
    const u = NX.user(id);
    if (id === 'me') { Toast.show('The demo account can\'t be deleted. Disable it instead.', { type: 'warning' }); return; }
    const ok = await Modal.confirm({ title: `Delete ${u.name}?`, message: 'This permanently removes the account and its content. This can\'t be undone.', confirm: 'Delete account', danger: true, icon: 'trash' });
    if (!ok) return;
    const extra = S.extraUsers.findIndex(x => x.id === id);
    if (extra >= 0) S.extraUsers.splice(extra, 1); else u.status = 'deleted';
    audit(`Deleted account @${u.username}`);
    Modal.closeAll();
    save();
    Toast.show(`${u.name} was deleted`, { type: 'success', icon: 'trash' });
  }

  /* ---------- Plans & gifts ---------- */
  function plansPage() {
    const plans = Object.values(S.plans);
    const fmtLimit = (v) => (v < 0 ? 'Unlimited' : v === 0 ? 'None' : v);
    const g = A.gift;
    const q = g.q.trim().toLowerCase();
    const matches = q ? users().filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)).slice(0, 6) : [];
    const sel = g.userId ? NX.user(g.userId) : null;
    const gifts = S.admin.gifts.filter(x => x.expiry > Date.now());
    return `
      <div class="ad-page">
        <div class="plan-admin-grid">
          ${plans.map(p => `
            <section class="ad-card pa-card ${p.id}${p.active ? '' : ' inactive'}">
              <div class="pa-top">${planChip(p.id)}<label class="pa-active"><span>${p.active ? 'Active' : 'Hidden'}</span>${switchEl({ checked: p.active, action: 'adPlanActive', label: `${p.name} plan active`, data: `data-id="${p.id}"`, disabled: p.id === 'free' })}</label></div>
              <h3>${esc(p.name)}</h3>
              <p class="muted">${esc(p.description)}</p>
              <div class="pa-price"><b>${p.price ? inr(p.price) : 'Free'}</b>${p.price ? '<span>/month</span>' : ''}${p.mrp > p.price ? `<s>${inr(p.mrp)}</s>` : ''}</div>
              <ul class="pa-features">${p.features.map(f => `<li>${Icon('check', 16)}${esc(f)}</li>`).join('')}</ul>
              <dl class="pa-limits">
                <div><dt>Secret Messages / month</dt><dd>${fmtLimit(p.limits.secretMessages)}</dd></div>
                <div><dt>Secret Crushes</dt><dd>${fmtLimit(p.limits.crushes)}</dd></div>
                <div><dt>Read Secret Messages</dt><dd>${p.limits.readSecret ? 'Yes' : 'No'}</dd></div>
                <div><dt>Nearby hints</dt><dd>${p.limits.nearby ? 'Yes' : 'No'}</dd></div>
              </dl>
              <button class="btn btn-secondary btn-block" data-action="adEditPlan" data-id="${p.id}">${Icon('edit', 16)} Edit plan</button>
            </section>`).join('')}
        </div>

        <section class="ad-card gift-card">
          <div class="ad-card-head"><div><h3>${Icon('gift', 20)} Free plan control</h3><p class="muted">Gift Plus or Premium to any user for a set duration — no payment needed.</p></div></div>
          <div class="gift-form">
            <div class="field gift-user">
              <label for="adGiftQ">User</label>
              ${sel ? `<div class="gift-selected">${userCell(sel)}<button class="icon-btn" data-action="adGiftClear" aria-label="Change user">${Icon('x', 18)}</button></div>`
                : `<label class="ad-search">${Icon('search', 18)}<input id="adGiftQ" type="search" placeholder="Search by name or username" value="${esc(g.q)}" data-input="adGiftQ" autocomplete="off"></label>
                  ${q ? `<div class="gift-results" role="listbox">${matches.length ? matches.map(u => `<button role="option" data-action="adGiftPick" data-id="${u.id}">${userCell(u)}${planChip(planOf(u))}</button>`).join('') : '<p class="muted gift-none">No users match that search.</p>'}</div>` : ''}`}
              <p class="field-error" id="adGiftErr"></p>
            </div>
            <div class="field"><span class="label">Plan</span>
              <div class="chip-group">${['plus', 'premium'].map(p => `<label class="chip-radio"><input type="radio" name="giftPlan" value="${p}" ${g.plan === p ? 'checked' : ''} data-change="adGiftPlan"><span>${S.plans[p].name}</span></label>`).join('')}</div></div>
            <div class="field"><label for="adGiftDays">Duration</label>
              <select class="input" id="adGiftDays" data-change="adGiftDays">${[[7, '7 days'], [30, '1 month'], [90, '3 months'], [180, '6 months'], [365, '12 months']].map(([v, l]) => `<option value="${v}" ${g.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <button class="btn btn-primary" data-action="adGiftConfirm">${Icon('gift', 16)} Gift plan</button>
          </div>
          <h4 class="ud-sub">Active gifts</h4>
          ${gifts.length ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>User</th><th>Plan</th><th>Granted</th><th>Ends</th><th class="right">Action</th></tr></thead><tbody>
            ${gifts.map(x => `<tr><td>${userCell(NX.user(x.userId))}</td><td>${planChip(x.plan)}</td><td class="muted">${fmtDate(x.time)}</td><td class="muted">${fmtDate(x.expiry)}</td><td class="right"><button class="btn btn-sm btn-ghost" data-action="adRevokeGift" data-id="${x.id}">Revoke</button></td></tr>`).join('')}
          </tbody></table></div>` : `<div class="ad-empty">${Icon('gift', 24)}<p>No active gifts yet.</p></div>`}
        </section>
      </div>`;
  }

  function editPlan(id) {
    const p = S.plans[id];
    const lim = (name, label, v) => `<div class="field"><label for="pl_${name}">${label}</label><input class="input" id="pl_${name}" name="${name}" type="number" min="-1" step="1" value="${v}"><p class="field-hint">Use −1 for unlimited, 0 for none.</p></div>`;
    Modal.open({
      title: `Edit ${p.name} plan`, cls: 'ad-modal',
      body: `<form id="planForm" data-form="adSavePlan" data-id="${id}" novalidate>
        <div class="field"><label for="pl_name">Plan name</label><input class="input" id="pl_name" name="name" value="${esc(p.name)}" maxlength="24" data-autofocus></div>
        <div class="field"><label for="pl_desc">Description</label><input class="input" id="pl_desc" name="description" value="${esc(p.description)}" maxlength="80"></div>
        <div class="field-row">
          <div class="field"><label for="pl_mrp">MRP (₹)</label><input class="input" id="pl_mrp" name="mrp" type="number" min="0" value="${p.mrp}" ${id === 'free' ? 'disabled' : ''}></div>
          <div class="field"><label for="pl_price">Offer price (₹)</label><input class="input" id="pl_price" name="price" type="number" min="0" value="${p.price}" ${id === 'free' ? 'disabled' : ''}></div>
        </div>
        <div class="field"><label for="pl_feat">Features <span class="muted">(one per line)</span></label><textarea class="input" id="pl_feat" name="features" rows="5">${esc(p.features.join('\n'))}</textarea></div>
        <div class="field-row">${lim('secretMessages', 'Secret Messages / month', p.limits.secretMessages)}${lim('crushes', 'Secret Crush spots', p.limits.crushes)}</div>
        <label class="check"><input type="checkbox" name="readSecret" ${p.limits.readSecret ? 'checked' : ''}><span class="check-box">${Icon('check', 14)}</span><span>Can read &amp; reply to Secret Messages</span></label>
        <label class="check"><input type="checkbox" name="nearby" ${p.limits.nearby ? 'checked' : ''}><span class="check-box">${Icon('check', 14)}</span><span>Can see "This person was near you today / yesterday."</span></label>
        <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} ${id === 'free' ? 'disabled' : ''}><span class="check-box">${Icon('check', 14)}</span><span>Plan is active and visible to users</span></label>
        <p class="field-error center" id="planErr"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="planForm">Save changes</button>`
    });
  }

  async function giftConfirm() {
    const g = A.gift;
    const err = document.getElementById('adGiftErr');
    if (!g.userId) { if (err) err.textContent = 'Choose a user to gift a plan to.'; return; }
    const u = NX.user(g.userId);
    const label = { 7: '7 days', 30: '1 month', 90: '3 months', 180: '6 months', 365: '12 months' }[g.days];
    const ok = await Modal.confirm({ title: `Gift ${S.plans[g.plan].name} to ${u.name}?`, message: `${u.name} gets ${S.plans[g.plan].name} free for ${label}. They'll be notified in the app.`, confirm: 'Gift plan', icon: 'gift' });
    if (!ok) return;
    const expiry = Date.now() + g.days * DAY;
    if (u.id === 'me') {
      NX.setPlan(g.plan, g.days, 'admin', 'Gift');
      NX.notify({ type: 'subscription', text: `🎁 You've been gifted <b>${S.plans[g.plan].name}</b> for ${label}. Enjoy your secret side!`, target: { screen: 'mySubscription', params: {} } });
    } else { u.plan = g.plan; u.planExpiry = expiry; }
    S.admin.gifts.unshift({ id: uid('g'), userId: u.id, plan: g.plan, days: g.days, time: Date.now(), expiry });
    audit(`Gifted ${S.plans[g.plan].name} (${label}) to @${u.username}`);
    A.gift = { userId: null, q: '', plan: g.plan, days: g.days };
    save();
    Toast.show(`${S.plans[g.plan].name} gifted to ${u.name} 🎁`, { type: 'success' });
  }

  /* ---------- Payments ---------- */
  function filteredTxns() {
    const q = A.payments.q.trim().toLowerCase();
    return S.transactions.filter(t => (A.payments.status === 'all' || t.status === A.payments.status) &&
      (!q || t.id.toLowerCase().includes(q) || nameOf(t.userId).toLowerCase().includes(q)));
  }
  function paymentsPage() {
    const t = S.transactions;
    const by = (s) => t.filter(x => x.status === s);
    const list = filteredTxns();
    return `
      <div class="ad-page">
        <div class="ad-stats">
          <div class="ad-stat"><span>Collected</span><b>${inr(by('success').reduce((a, x) => a + x.amount, 0))}</b></div>
          <div class="ad-stat ok"><span>Successful</span><b>${by('success').length}</b></div>
          <div class="ad-stat pending"><span>Pending</span><b>${by('pending').length}</b></div>
          <div class="ad-stat bad"><span>Failed</span><b>${by('failed').length}</b></div>
        </div>
        <section class="ad-card flush">
          <div class="ad-toolbar">
            ${tabs([['all', 'All', t.length], ['success', 'Successful', by('success').length], ['pending', 'Pending', by('pending').length], ['failed', 'Failed', by('failed').length]], A.payments.status, 'adPayTab')}
            <label class="ad-search">${Icon('search', 18)}<input id="adPayQ" type="search" placeholder="Transaction ID or user" value="${esc(A.payments.q)}" data-input="adPayQ" aria-label="Search payments"></label>
            <button class="btn btn-secondary btn-sm" data-action="adExport">${Icon('download', 16)} Export CSV</button>
          </div>
          ${list.length ? `<div class="ad-table-wrap"><table class="ad-table">
            <thead><tr><th>Transaction ID</th><th>User</th><th>Plan</th><th class="right">Amount</th><th>Date</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>${list.map(x => `<tr>
              <td class="mono">${x.id}</td><td>${userCell(NX.user(x.userId))}</td>
              <td>${planChip(x.plan)}</td><td class="right"><b>${inr(x.amount)}</b></td>
              <td class="muted nowrap">${fmtDate(x.date)} · ${clock(x.date)}</td><td>${esc(x.method)}</td><td>${statusPill(x.status)}</td></tr>`).join('')}</tbody>
          </table></div>` : `<div class="ad-empty big">${Icon('card', 28)}<h3>No payments found</h3><p>Nothing matches this filter yet.</p></div>`}
        </section>
      </div>`;
  }

  /* ---------- Issues ---------- */
  function issuesPage() {
    const st = A.issues.status;
    const list = S.issues.filter(i => st === 'all' || i.status === st);
    const p = pendingIssues();
    return `
      <div class="ad-page">
        <div class="ad-banner ${p ? 'warn' : 'ok'}">${Icon(p ? 'headset' : 'check', 22)}<div><b>${p ? `${p} pending issue${p > 1 ? 's' : ''}` : 'All issues resolved'}</b><p>${p ? 'Messages sent from Contact Us in the app arrive here instantly.' : 'New Contact Us requests from the app will show up here.'}</p></div></div>
        <section class="ad-card flush">
          <div class="ad-toolbar">${tabs([['pending', 'Pending', p], ['resolved', 'Resolved', S.issues.length - p], ['all', 'All', S.issues.length]], st, 'adIssueTab')}</div>
          ${list.length ? `<div class="ad-table-wrap"><table class="ad-table">
            <thead><tr><th>Issue</th><th>User</th><th>Subject</th><th>Date</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>${list.map(i => `<tr>
              <td><span class="mini-issue"><b class="mono">${i.id}</b><small class="clamp">${esc(i.message)}</small></span></td>
              <td>${userCell(NX.user(i.userId))}</td>
              <td>${esc(i.subject)}${i.screenshot ? ` <span class="ad-tag">${Icon('paperclip', 12)} Screenshot</span>` : ''}</td>
              <td class="muted nowrap">${timeAgoLong(i.date)}</td><td>${statusPill(i.status)}</td>
              <td class="right nowrap"><button class="btn btn-sm btn-ghost" data-action="adViewIssue" data-id="${i.id}">View</button>
                ${i.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-action="adResolve" data-id="${i.id}">${Icon('check', 16)} Resolve</button>` : `<button class="btn btn-sm btn-secondary" data-action="adReopen" data-id="${i.id}">Reopen</button>`}</td></tr>`).join('')}</tbody>
          </table></div>` : `<div class="ad-empty big">${Icon('check', 28)}<h3>${st === 'pending' ? 'Inbox zero 🎉' : 'Nothing here'}</h3><p>${st === 'pending' ? 'Every issue has been resolved.' : 'No issues in this view.'}</p></div>`}
        </section>
      </div>`;
  }

  function viewIssue(id) {
    const i = S.issues.find(x => x.id === id);
    if (!i) return;
    Modal.open({
      title: `Issue ${i.id}`, cls: 'ad-modal',
      body: `<div class="ud-head small">${avatar(NX.user(i.userId), 48)}<div><h3>${esc(nameOf(i.userId))}</h3><p class="muted">${esc((NX.user(i.userId) || {}).email || '')} · ${fmtDate(i.date)} ${clock(i.date)}</p></div>${statusPill(i.status)}</div>
        <p class="eyebrow">${esc(i.subject)}</p>
        <p class="issue-msg">${esc(i.message)}</p>
        ${i.screenshot ? `<p class="ud-sub">Attached screenshot</p><img class="issue-shot" src="${i.screenshot}" alt="Screenshot attached by the user">` : '<p class="muted">No screenshot attached.</p>'}`,
      footer: i.status === 'pending' ? `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" data-action="adResolve" data-id="${i.id}">${Icon('check', 16)} Mark resolved</button>`
        : `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-secondary" data-action="adReopen" data-id="${i.id}">Reopen issue</button>`
    });
  }

  /* ---------- Reports ---------- */
  const isAnon = (r) => r.content === 'Secret Message' || r.content === 'Secret Crush';
  function reportsPage() {
    const st = A.reports.status;
    const closed = ['dismissed', 'actioned', 'blocked'];
    const list = S.reports.filter(r => st === 'all' || (st === 'open' ? !closed.includes(r.status) : closed.includes(r.status)));
    const openN = S.reports.filter(r => !closed.includes(r.status)).length;
    return `
      <div class="ad-page">
        <section class="ad-card flush">
          <div class="ad-toolbar">${tabs([['open', 'Needs review', openN], ['closed', 'Closed', S.reports.length - openN], ['all', 'All', S.reports.length]], st, 'adReportTab')}</div>
          ${list.length ? `<div class="ad-table-wrap"><table class="ad-table">
            <thead><tr><th>ID</th><th>Reporter</th><th>Reported</th><th>Content</th><th>Reason</th><th>Date</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>${list.map(r => `<tr>
              <td class="mono">${r.id}</td>
              <td>${userCell(NX.user(r.reporterId))}</td>
              <td>${isAnon(r) && !A.revealed[r.id] ? `<span class="ad-user">${anonAvatar(34)}<span><b>Anonymous sender</b><small>Hidden until review</small></span></span>` : userCell(NX.user(r.reportedId))}</td>
              <td><span class="mini-issue"><b>${esc(r.content)}</b><small class="clamp">${esc(r.preview)}</small></span></td>
              <td>${r.reason === 'Nearby misuse' ? `<span class="ad-tag warn">${Icon('radar', 12)} Nearby misuse</span>` : esc(r.reason)}</td>
              <td class="muted nowrap">${timeAgoLong(r.date)}</td>
              <td>${statusPill(r.status)}</td>
              <td class="right nowrap">
                <button class="btn btn-sm btn-ghost" data-action="adReview" data-id="${r.id}">Review</button>
                ${closed.includes(r.status) ? '' : `<button class="icon-btn" data-action="adReportMenu" data-id="${r.id}" aria-label="Actions for ${r.id}">${Icon('moreV', 18)}</button>`}
              </td></tr>`).join('')}</tbody>
          </table></div>` : `<div class="ad-empty big">${Icon('shieldCheck', 28)}<h3>No reports to review</h3><p>The community is behaving. We'll show new reports here.</p></div>`}
        </section>
      </div>`;
  }

  function review(id) {
    const r = S.reports.find(x => x.id === id);
    if (!r) return;
    if (r.status === 'open') { r.status = 'reviewed'; NX.save(); render(); }
    const closed = ['dismissed', 'actioned', 'blocked'].includes(r.status);
    const reported = NX.user(r.reportedId);
    const hidden = isAnon(r) && !A.revealed[r.id];
    Modal.open({
      title: `Report ${r.id}`, cls: 'ad-modal',
      body: `
        <dl class="ud-grid">
          <div><dt>Reported by</dt><dd>${esc(nameOf(r.reporterId))}</dd></div>
          <div><dt>Content type</dt><dd>${esc(r.content)}</dd></div>
          <div><dt>Reason</dt><dd>${esc(r.reason)}</dd></div>
          <div><dt>Received</dt><dd>${fmtDate(r.date)} ${clock(r.date)}</dd></div>
          <div><dt>Status</dt><dd>${statusPill(r.status)}</dd></div>
          <div><dt>Prior reports</dt><dd>${S.reports.filter(x => x.reportedId === r.reportedId).length - 1}</dd></div>
        </dl>
        <p class="ud-sub">Reported account</p>
        ${hidden ? `<div class="ud-privacy">${Icon('mask', 18)}<p>This report is about anonymous content. The sender stays hidden unless a moderator needs to act. Revealing is logged in the audit trail.</p></div>
          <button class="btn btn-secondary btn-sm" data-action="adRevealReported" data-id="${r.id}">${Icon('eye', 16)} Reveal sender for moderation</button>`
          : `<div class="ud-head small">${avatar(reported, 48)}<div><h3>${esc(reported ? reported.name : 'Deleted user')}</h3><p class="muted">${reported ? '@' + esc(reported.username) : ''}</p></div>${reported ? statusPill(reported.status) : ''}</div>`}
        <p class="ud-sub">Reported content</p>
        <p class="issue-msg">${esc(r.preview)}</p>
        ${r.content === 'Nearby' ? `<div class="ud-privacy">${Icon('pinOff', 18)}<p>Nearby reports never include location, distance, time or history. Act on behaviour described by the reporter.</p></div>` : ''}
        ${r.action ? `<p class="muted">Action taken: <b>${esc(r.action)}</b></p>` : ''}`,
      footer: closed ? `<button class="btn btn-ghost" data-close>Close</button>` : `
        <button class="btn btn-ghost" data-action="adDismiss" data-id="${r.id}">Dismiss</button>
        <button class="btn btn-secondary" data-action="adTakeAction" data-id="${r.id}">Take action</button>
        <button class="btn btn-danger" data-action="adBlockReported" data-id="${r.id}">${Icon('ban', 16)} Block user</button>`
    });
  }

  function takeAction(id) {
    const r = S.reports.find(x => x.id === id);
    const apply = (label) => {
      r.status = 'actioned'; r.action = label;
      audit(`${r.id}: ${label}`);
      Modal.closeAll(); save();
      Toast.show(`${r.id} actioned — ${label.toLowerCase()}`, { type: 'success' });
    };
    Modal.menu([
      { label: 'Remove the reported content', icon: 'trash', onClick: () => apply('Content removed') },
      { label: 'Send a warning to the user', icon: 'alert', onClick: () => apply('Warning sent') },
      { label: 'Restrict Secret features for 7 days', icon: 'lock', onClick: () => apply('Secret features restricted for 7 days') },
      { label: 'Turn off Nearby for this user', icon: 'pinOff', onClick: () => apply('Nearby turned off for user') },
    ], { title: `Take action on ${r.id}` });
  }

  async function blockReported(id) {
    const r = S.reports.find(x => x.id === id);
    const u = NX.user(r.reportedId);
    const who = isAnon(r) && !A.revealed[r.id] ? 'the anonymous sender' : (u ? u.name : 'this user');
    const ok = await Modal.confirm({ title: `Block ${who}?`, message: 'The account will be disabled across Nexity and the report closed.', confirm: 'Block account', danger: true, icon: 'ban' });
    if (!ok) return;
    if (u) u.status = 'disabled';
    r.status = 'blocked'; r.action = 'Account blocked';
    audit(`${r.id}: blocked account${u ? ' @' + u.username : ''}`);
    Modal.closeAll(); save();
    Toast.show('Account blocked and report closed', { type: 'success', icon: 'ban' });
  }

  /* ---------- Nearby ---------- */
  function nearbyPage() {
    const all = users();
    const on = S.admin.nearbyGlobal;
    const misuse = S.reports.filter(r => r.reason === 'Nearby misuse');
    const misuseOpen = misuse.filter(r => !['dismissed', 'actioned', 'blocked'].includes(r.status)).length;
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * DAY).toLocaleDateString('en-IN', { weekday: 'short' }));
    const shown = series(7, 1180, 260, 71, 0.01);
    const now = NX.now();
    const encToday = S.encounters.filter(e => e.expiresAt > now && NX.calendarDiff(e.lastDetectedAt, now) === 0).length;
    const pushesToday = S.nearbyPushLog.filter(p => NX.calendarDiff(p.time, now) === 0).length;
    shown[6] = on ? S.admin.indicatorsBase + encToday : 0;
    const c = S.admin.nearbyConfig;
    const cfgRows = [['Location radius', `${c.radiusMeters} m`], ['Minimum time together', `${c.minDurationSeconds} s`], ['Max location accuracy', `${c.accuracyLimitMeters} m`], ['Encounter refresh cooldown', `${c.encounterCooldownMinutes} min`], ['Notification cooldown per pair', `${c.notificationCooldownMinutes} min`], ['Max nearby pushes per day', c.maxPushesPerDay], ['Keep encounters for', `${c.retentionDays} days`], ['Bluetooth id rotation', `${c.tokenTtlMinutes} min`], ['"Nearby now" lasts', `${c.presenceTtlSeconds} s`]];
    return `
      <div class="ad-page">
        <div class="ad-privacy-hero">${Icon('shieldCheck', 26)}<div><b>User locations are never visible to administrators.</b><p>Nexity keeps one encounter per pair of people — only the latest day — for ${c.retentionDays} days, and only those two people see "today" or "yesterday". Admins can't see who has Nearby on or off. There are no maps, coordinates, distances, timestamps or history — not for users, and not for admins.</p></div></div>
        <section class="ad-card nearby-toggle-card">
          <div class="ntc-ic${on ? ' on' : ''}">${Icon('radar', 28)}</div>
          <div class="ntc-text"><h3>Nearby feature</h3><p class="muted">${on ? 'Live. Turning it off stops Bluetooth discovery, location checks, nearby notifications and every "This person was near you" hint instantly.' : 'Paused for all users. Nothing is scanned, checked, sent or shown while it\'s off.'}</p></div>
          <div class="ntc-switch"><span class="status ${on ? 's-active' : 's-disabled'}">${on ? 'On' : 'Off'}</span>${switchEl({ checked: on, action: 'adNearbyToggle', label: 'Nearby feature enabled globally' })}</div>
        </section>
        <section class="ad-card">
          <div class="ad-card-head"><div><h3>Server settings</h3><p class="muted">Backend NEARBY_* values · aggregate only · ${pushesToday} nearby push${pushesToday === 1 ? '' : 'es'} sent today</p></div><button class="btn btn-sm btn-secondary" data-action="adNearbyConfig">${Icon('edit', 16)} Edit</button></div>
          <dl class="pa-limits">${cfgRows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </section>
        <div class="kpi-grid two">
          <div class="kpi"><span class="kpi-ic">${Icon('sparkles', 20)}</span><span class="kpi-label">Indicators shown today</span><b class="kpi-value">${num(shown[6])}</b><span class="kpi-foot"><span class="kpi-delta">${on ? 'Aggregate count only' : 'Feature paused'}</span></span></div>
          <button class="kpi${misuseOpen ? ' warn' : ''}" data-action="adGo" data-page="reports"><span class="kpi-ic">${Icon('flag', 20)}</span><span class="kpi-label">Misuse reports (open)</span><b class="kpi-value">${misuseOpen}</b><span class="kpi-foot"><span class="kpi-delta${misuseOpen ? ' warn' : ''}">${misuse.length} total</span></span></button>
        </div>
        <div class="ad-grid-2">
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Indicators shown</h3><p class="muted">Daily totals · no individual data</p></div></div>
            ${barChart([shown], days, { names: ['Indicators'] })}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>What admins can and can't see</h3></div></div>
            <div class="see-grid">
              <div><p class="see-title ok">${Icon('check', 16)} Visible</p><ul>
                <li>${Icon('chart', 16)} Daily indicator counts</li><li>${Icon('flag', 16)} Misuse reports</li><li>${Icon('history', 16)} Admin audit log</li></ul></div>
              <div><p class="see-title no">${Icon('x', 16)} Never visible</p><ul>
                <li>${Icon('pinOff', 16)} Exact or approximate location</li><li>${Icon('map', 16)} Maps</li><li>${Icon('ruler', 16)} Distance between users</li><li>${Icon('clock', 16)} Time or visit count</li><li>${Icon('history', 16)} Location history</li><li>${Icon('users', 16)} Who has Nearby on or off</li></ul></div>
            </div>
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Nearby misuse reports</h3></div><button class="link" data-action="adGo" data-page="reports">All reports</button></div>
            ${misuse.length ? `<ul class="mini-list">${misuse.map(r => `<li><span class="mini-issue"><b>${r.id} · ${esc(nameOf(r.reportedId))}</b><small class="clamp">${esc(r.preview)}</small></span><span class="mini-right">${statusPill(r.status)}<button class="btn btn-sm btn-ghost" data-action="adReview" data-id="${r.id}">Review</button></span></li>`).join('')}</ul>` : `<div class="ad-empty">${Icon('shieldCheck', 24)}<p>No misuse reports.</p></div>`}
          </section>
          <section class="ad-card">
            <div class="ad-card-head"><div><h3>Audit log</h3><p class="muted">Every admin change is recorded</p></div></div>
            <ul class="audit">${S.admin.audit.slice(0, 8).map(a => `<li><span class="audit-dot"></span><span>${esc(a.text)}</span><small>${timeAgoLong(a.time)}</small></li>`).join('')}</ul>
          </section>
        </div>
      </div>`;
  }

  /* ---------- Settings ---------- */
  function settingsPage() {
    const t = S.admin.theme || 'light';
    return `
      <div class="ad-page narrow">
        <section class="ad-card">
          <h3>Admin profile</h3>
          <div class="ud-head small"><span class="ad-me-av big">NA</span><div><h3>Nexity Admin</h3><p class="muted">admin@nexity.app · Trust &amp; Operations</p></div></div>
        </section>
        <section class="ad-card">
          <h3>Appearance</h3>
          <div class="ad-seg wide">${[['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'System']].map(([v, ic, l]) => `<button class="${t === v ? 'active' : ''}" data-action="adSetTheme" data-v="${v}" aria-pressed="${t === v}">${Icon(ic, 16)} ${l}</button>`).join('')}</div>
        </section>
        <section class="ad-card">
          <h3>Notifications</h3>
          <div class="ad-setting"><div><b>Email alerts for new issues</b><p class="muted">Get an email when someone uses Contact Us.</p></div>${switchEl({ checked: S.admin.emailAlerts, action: 'adPref', label: 'Email alerts', data: 'data-key="emailAlerts"' })}</div>
          <div class="ad-setting"><div><b>Weekly digest</b><p class="muted">Monday summary of growth, revenue and safety.</p></div>${switchEl({ checked: S.admin.weeklyDigest, action: 'adPref', label: 'Weekly digest', data: 'data-key="weeklyDigest"' })}</div>
        </section>
        <section class="ad-card">
          <h3>Demo data</h3>
          <p class="muted">Restore every user, plan, payment, issue and report to the original demo data. The user app resets too.</p>
          <button class="btn btn-danger" data-action="adResetData">${Icon('refresh', 16)} Reset demo data</button>
        </section>
        <section class="ad-card">
          <h3>Session</h3>
          <div class="ad-setting"><div><b>Sign out of the admin panel</b><p class="muted">You'll need to sign in again to manage Nexity.</p></div><button class="btn btn-secondary" data-action="adLogout">${Icon('logout', 16)} Logout</button></div>
        </section>
      </div>`;
  }

  /* ---------- Render ---------- */
  const VIEWS = { dashboard, users: usersPage, plans: plansPage, payments: paymentsPage, issues: issuesPage, reports: reportsPage, nearby: nearbyPage, settings: settingsPage };

  function render() {
    if (!S.admin.loggedIn) { root.innerHTML = loginView(); document.title = 'Admin sign in · Nexity'; return; }
    const content = root.querySelector('#adContent');
    const y = content ? window.scrollY : 0;
    const a = document.activeElement;
    const focus = a && a.id && root.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    root.innerHTML = shell((VIEWS[A.page] || dashboard)());
    window.scrollTo(0, y);
    if (focus) { const el = document.getElementById(focus.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* not text */ } } }
    document.title = `${(PAGES.find(p => p[0] === A.page) || PAGES[0])[2]} · Nexity Admin`;
  }

  function go(page) {
    A.page = VIEWS[page] ? page : 'dashboard';
    A.sideOpen = false;
    if (location.hash !== '#' + A.page) history.replaceState(null, '', '#' + A.page);
    Modal.closeAll();
    render();
    window.scrollTo(0, 0);
    const c = document.getElementById('adContent');
    if (c) c.focus({ preventScroll: true });
  }

  function applyTheme() {
    const p = S.admin.theme || 'light';
    const dark = p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  /* ---------- Actions ---------- */
  const Act = {
    adGo: (el) => go(el.dataset.page),
    adSide: () => { A.sideOpen = !A.sideOpen; root.querySelector('.ad-shell').classList.toggle('side-open', A.sideOpen); },
    adTheme: () => { S.admin.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); },
    adSetTheme: (el) => { S.admin.theme = el.dataset.v; applyTheme(); save(); },
    adRefresh: () => { NX.reload(); render(); Toast.show('Dashboard refreshed', { type: 'success', icon: 'refresh' }); },
    adRange: (el) => { A.range = +el.dataset.v; render(); },
    adRevMode: (el) => { A.revMode = el.dataset.v; render(); },
    adTogglePw: (el) => {
      const i = document.getElementById('adPw');
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      el.innerHTML = Icon(show ? 'eyeOff' : 'eye', 20);
      el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    },
    adFillDemo: () => { document.getElementById('adEmail').value = 'admin@nexity.app'; document.getElementById('adPw').value = 'admin123'; },
    adLogout: async () => {
      const ok = await Modal.confirm({ title: 'Log out of admin?', message: 'You\'ll return to the admin sign-in screen.', confirm: 'Log out', icon: 'logout' });
      if (!ok) return;
      S.admin.loggedIn = false; A.page = 'dashboard'; history.replaceState(null, '', location.pathname);
      save();
      Toast.show('Signed out of admin', { type: 'info' });
    },

    adViewUser: (el) => viewUser(el.dataset.id),
    adUserMenu: (el) => {
      const id = el.dataset.id, u = NX.user(id);
      Modal.menu([
        { label: 'View details', icon: 'eye', onClick: () => viewUser(id) },
        { label: u.status === 'disabled' ? 'Enable account' : 'Disable account', icon: u.status === 'disabled' ? 'check' : 'ban', onClick: () => toggleUser(id) },
        ...(u.status === 'disabled' ? [] : [{ label: u.status === 'inactive' ? 'Mark as active' : 'Mark as inactive', icon: u.status === 'inactive' ? 'userCheck' : 'clock', onClick: () => markActivity(id) }]),
        { label: 'Force logout', icon: 'logout', onClick: () => forceLogout(id) },
        { label: 'Gift a plan', icon: 'gift', onClick: () => Act.adGiftFor({ dataset: { id } }) },
        { label: 'Delete account', icon: 'trash', danger: true, onClick: () => deleteUser(id) },
      ], { title: `${u.name} · @${u.username}` });
    },
    adToggleUser: (el) => toggleUser(el.dataset.id),
    adForceLogout: (el) => forceLogout(el.dataset.id),
    adPage: (el) => { A.users.page += +el.dataset.v; render(); },
    adClearUserFilters: () => { A.users = { q: '', plan: 'all', status: 'all', page: 1 }; render(); },

    adGiftFor: (el) => {
      A.gift.userId = el.dataset.id || null; A.gift.q = '';
      go('plans');
      setTimeout(() => { const c = document.querySelector('.gift-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); const q = document.getElementById('adGiftQ'); if (q) q.focus({ preventScroll: true }); }, 60);
    },
    adGiftPick: (el) => { A.gift.userId = el.dataset.id; A.gift.q = ''; render(); },
    adGiftClear: () => { A.gift.userId = null; render(); const q = document.getElementById('adGiftQ'); if (q) q.focus(); },
    adGiftConfirm: () => giftConfirm(),
    adRevokeGift: async (el) => {
      const g = S.admin.gifts.find(x => x.id === el.dataset.id);
      const u = NX.user(g.userId);
      const ok = await Modal.confirm({ title: 'Revoke this gift?', message: `${u ? u.name : 'This user'} will return to the Free plan right away.`, confirm: 'Revoke gift', danger: true, icon: 'gift' });
      if (!ok) return;
      if (u) { if (u.id === 'me') { NX.setPlan('free'); NX.notify({ type: 'subscription', text: 'Your gifted plan has ended. Upgrade anytime to keep your secret side.', target: { screen: 'plans', params: {} } }); } else u.plan = 'free'; }
      g.expiry = Date.now() - 1;
      audit(`Revoked ${S.plans[g.plan].name} gift from @${u ? u.username : 'deleted'}`);
      save();
      Toast.show('Gift revoked', { type: 'success' });
    },
    adEditPlan: (el) => editPlan(el.dataset.id),
    adPlanActive: (el) => {
      const p = S.plans[el.dataset.id];
      p.active = !p.active;
      audit(`${p.active ? 'Activated' : 'Hid'} ${p.name} plan`);
      save();
      Toast.show(`${p.name} is now ${p.active ? 'visible to users' : 'hidden from users'}`, { type: 'success' });
    },

    adPayTab: (el) => { A.payments.status = el.dataset.v; render(); },
    adExport: () => {
      const rows = [['Transaction ID', 'User', 'Plan', 'Amount (INR)', 'Date', 'Method', 'Status']]
        .concat(filteredTxns().map(t => [t.id, nameOf(t.userId), S.plans[t.plan] ? S.plans[t.plan].name : t.plan, t.amount, new Date(t.date).toISOString(), t.method, t.status]));
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `nexity-payments-${A.payments.status}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      Toast.show(`Exported ${rows.length - 1} payments`, { type: 'success', icon: 'download' });
    },

    adIssueTab: (el) => { A.issues.status = el.dataset.v; render(); },
    adViewIssue: (el) => viewIssue(el.dataset.id),
    adResolve: (el) => {
      const i = S.issues.find(x => x.id === el.dataset.id);
      i.status = 'resolved';
      audit(`Resolved issue ${i.id}`);
      Modal.closeAll(); save();
      Toast.show(`${i.id} resolved`, { type: 'success', action: { label: 'Undo', onClick: () => { i.status = 'pending'; save(); } } });
    },
    adReopen: (el) => {
      const i = S.issues.find(x => x.id === el.dataset.id);
      i.status = 'pending';
      audit(`Reopened issue ${i.id}`);
      Modal.closeAll(); save();
      Toast.show(`${i.id} reopened`, { type: 'info' });
    },

    adReportTab: (el) => { A.reports.status = el.dataset.v; render(); },
    adReview: (el) => review(el.dataset.id),
    adReportMenu: (el) => {
      const id = el.dataset.id;
      Modal.menu([
        { label: 'Review details', icon: 'eye', onClick: () => review(id) },
        { label: 'Dismiss report', icon: 'x', onClick: () => Act.adDismiss({ dataset: { id } }) },
        { label: 'Take action', icon: 'shield', onClick: () => takeAction(id) },
        { label: 'Block user', icon: 'ban', danger: true, onClick: () => blockReported(id) },
      ], { title: id });
    },
    adDismiss: (el) => {
      const r = S.reports.find(x => x.id === el.dataset.id);
      r.status = 'dismissed';
      audit(`Dismissed report ${r.id}`);
      Modal.closeAll(); save();
      Toast.show(`${r.id} dismissed`, { type: 'info', action: { label: 'Undo', onClick: () => { r.status = 'reviewed'; save(); } } });
    },
    adTakeAction: (el) => takeAction(el.dataset.id),
    adBlockReported: (el) => blockReported(el.dataset.id),
    adRevealReported: async (el) => {
      const ok = await Modal.confirm({ title: 'Reveal the anonymous sender?', message: 'Only reveal when you need to act on this report. This is recorded in the audit log and never shown to the reporter.', confirm: 'Reveal for moderation', icon: 'eye' });
      if (!ok) return;
      A.revealed[el.dataset.id] = true;
      audit(`Revealed anonymous sender for ${el.dataset.id} (moderation)`);
      NX.save();
      Modal.closeAll();
      render();
      review(el.dataset.id);
    },

    adNearbyToggle: async () => {
      const on = S.admin.nearbyGlobal;
      const ok = await Modal.confirm(on
        ? { title: 'Turn off Nearby for everyone?', message: 'Bluetooth discovery, location checks, nearby notifications and all "This person was near you" hints stop immediately. Users\' own settings are kept.', confirm: 'Turn off Nearby', danger: true, icon: 'radar' }
        : { title: 'Turn Nearby back on?', message: 'Nearby works again for people who turned it on. Hints that haven\'t expired return.', confirm: 'Turn on Nearby', icon: 'radar' });
      if (!ok) return;
      S.admin.nearbyGlobal = !on;
      audit(`Nearby feature ${on ? 'disabled' : 'enabled'} globally`);
      save();
      Toast.show(`Nearby is now ${on ? 'off' : 'on'} for all users`, { type: on ? 'warning' : 'success', icon: 'radar' });
    },
    adNearbyConfig: () => {
      const c = S.admin.nearbyConfig;
      const num = (name, label, min, max, hint) => `<div class="field"><label for="nc_${name}">${label}</label><input class="input" id="nc_${name}" name="${name}" type="number" min="${min}" max="${max}" step="1" value="${c[name]}"><p class="field-hint">${hint}</p></div>`;
      Modal.open({
        title: 'Nearby server settings', cls: 'ad-modal',
        body: `<form id="nearbyCfgForm" data-form="adSaveNearbyConfig" novalidate>
          <div class="field-row">${num('radiusMeters', 'Location radius (m)', 10, 200, '10–200')}${num('minDurationSeconds', 'Minimum time together (s)', 60, 900, '60–900')}</div>
          <div class="field-row">${num('accuracyLimitMeters', 'Max accuracy (m)', 10, 100, '10–100')}${num('encounterCooldownMinutes', 'Encounter cooldown (min)', 5, 180, '5–180')}</div>
          <div class="field-row">${num('notificationCooldownMinutes', 'Push cooldown per pair (min)', 30, 1440, '30–1440')}${num('maxPushesPerDay', 'Max pushes per day', 0, 10, '0–10')}</div>
          <div class="field-row">${num('retentionDays', 'Keep encounters (days)', 2, 2, 'Fixed at 2 — the hint only ever shows today or yesterday')}${num('tokenTtlMinutes', 'Bluetooth id rotation (min)', 5, 30, '5–30')}</div>
          ${num('presenceTtlSeconds', '"Nearby now" lasts (s)', 60, 900, '60–900')}
          <p class="field-error center" id="ncErr"></p>
        </form>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="nearbyCfgForm">Save</button>`
      });
    },
    adPref: (el) => {
      const k = el.dataset.key;
      S.admin[k] = !S.admin[k];
      save();
      Toast.show('Preference saved', { type: 'success' });
    },
    adResetData: async () => {
      const ok = await Modal.confirm({ title: 'Reset all demo data?', message: 'Users, plans, payments, issues and reports go back to the original demo. The user app is reset to the Free persona.', confirm: 'Reset data', danger: true, icon: 'refresh' });
      if (!ok) return;
      const theme = S.admin.theme;
      NX.reset('free');
      S.admin.loggedIn = true; S.admin.theme = theme;
      A.revealed = {}; A.gift = { userId: null, q: '', plan: 'plus', days: 30 };
      save();
      Toast.show('Demo data restored', { type: 'success', icon: 'refresh' });
    },
  };

  const Frm = {
    adLogin: async (f) => {
      const email = f.email.value.trim().toLowerCase(), pw = f.password.value;
      const err = document.getElementById('adLoginErr');
      err.textContent = '';
      fieldError(f, 'email', !email ? 'Enter your work email.' : !validEmail(email) ? 'Enter a valid email address.' : '');
      fieldError(f, 'password', !pw ? 'Enter your password.' : '');
      if (!email || !validEmail(email) || !pw) return;
      const btn = f.querySelector('[type=submit]');
      setBusy(btn, true, 'Signing in…');
      await delay(900);
      if (email !== 'admin@nexity.app' || pw !== 'admin123') {
        setBusy(btn, false);
        err.textContent = 'Those credentials don\'t match an admin account.';
        f.password.value = ''; f.password.focus();
        return;
      }
      S.admin.loggedIn = true;
      NX.save();
      go(location.hash.slice(1) || 'dashboard');
      Toast.show('Welcome back, Admin', { type: 'success' });
    },
    adSavePlan: (f) => {
      const id = f.dataset.id, p = S.plans[id];
      const err = document.getElementById('planErr');
      const name = f.elements.namedItem('name').value.trim(), desc = f.elements.namedItem('description').value.trim();
      const mrp = id === 'free' ? 0 : Number(f.mrp.value), price = id === 'free' ? 0 : Number(f.price.value);
      const features = f.features.value.split('\n').map(s => s.trim()).filter(Boolean);
      const sm = Number(f.secretMessages.value), cr = Number(f.crushes.value);
      fieldError(f, 'name', name ? '' : 'Plan name is required.');
      fieldError(f, 'price', price < 0 || Number.isNaN(price) ? 'Enter a valid price.' : price > mrp ? 'Offer price can\'t be higher than MRP.' : '');
      fieldError(f, 'mrp', mrp < 0 || Number.isNaN(mrp) ? 'Enter a valid MRP.' : '');
      fieldError(f, 'features', features.length ? '' : 'Add at least one feature.');
      fieldError(f, 'secretMessages', Number.isInteger(sm) && sm >= -1 ? '' : 'Use −1, 0 or a positive number.');
      fieldError(f, 'crushes', Number.isInteger(cr) && cr >= -1 ? '' : 'Use −1, 0 or a positive number.');
      if (f.querySelector('.has-error')) { err.textContent = 'Please fix the highlighted fields.'; return; }
      Object.assign(p, { name, description: desc, mrp, price, features, active: id === 'free' ? true : f.elements.namedItem('active').checked });
      p.limits = { secretMessages: sm, crushes: cr, readSecret: f.readSecret.checked, nearby: f.nearby.checked };
      audit(`Updated ${name} plan (${price ? inr(price) : 'Free'})`);
      Modal.closeAll(); save();
      Toast.show(`${name} plan saved — the app reflects it now`, { type: 'success' });
    },
  };

  Frm.adSaveNearbyConfig = (f) => {
    const next = {};
    let bad = false;
    f.querySelectorAll('input[name]').forEach(inp => {
      const v = Number(inp.value), min = Number(inp.min), max = Number(inp.max);
      const ok = Number.isInteger(v) && v >= min && v <= max;
      fieldError(f, inp.name, ok ? '' : `Use a whole number from ${min} to ${max}.`);
      if (!ok) bad = true; else next[inp.name] = v;
    });
    if (bad) { document.getElementById('ncErr').textContent = 'Please fix the highlighted fields.'; return; }
    const changed = Object.keys(next).filter(k => next[k] !== S.admin.nearbyConfig[k]);
    Object.assign(S.admin.nearbyConfig, next);
    if (changed.length) audit(`Nearby settings changed: ${changed.join(', ')}`);
    Modal.closeAll(); save();
    Toast.show(changed.length ? 'Nearby settings saved' : 'No changes', { type: 'success', icon: 'radar' });
  };

  const Inp = {
    adUserQ: (el) => { A.users.q = el.value; A.users.page = 1; render(); },
    adUserPlan: (el) => { A.users.plan = el.value; A.users.page = 1; render(); },
    adUserStatus: (el) => { A.users.status = el.value; A.users.page = 1; render(); },
    adPayQ: (el) => { A.payments.q = el.value; render(); },
    adGiftQ: (el) => { A.gift.q = el.value; render(); },
    adGiftPlan: (el) => { A.gift.plan = el.value; },
    adGiftDays: (el) => { A.gift.days = +el.value; },
  };

  /* ---------- Delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = Act[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f || !Frm[f.dataset.form]) return;
    e.preventDefault();
    Frm[f.dataset.form](f, e);
  });
  document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && Inp[el.dataset.input]) Inp[el.dataset.input](el, e); });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && Inp[el.dataset.change]) Inp[el.dataset.change](el, e); });

  window.addEventListener('storage', (e) => {
    if (e.key !== NX.KEY) return;
    const before = pendingIssues();
    NX.reload();
    applyTheme();
    if (!Modal.stack.length) render();
    if (S.admin.loggedIn && pendingIssues() > before) Toast.show('New issue received from Contact Us', { type: 'info', icon: 'headset', action: { label: 'View', onClick: () => go('issues') } });
  });
  window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (S.admin.loggedIn && p && p !== A.page) go(p); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.admin.theme === 'system') applyTheme(); });

  document.addEventListener('DOMContentLoaded', () => {
    if (!S.admin.theme) S.admin.theme = 'light';
    applyTheme();
    const p = location.hash.slice(1);
    if (VIEWS[p]) A.page = p;
    render();
  });
})();
