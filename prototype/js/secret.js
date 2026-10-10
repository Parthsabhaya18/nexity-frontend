/* Secret section: Secret Messages (send, receive, reply 1/2, reveal) and the Secret tab shell.
   Privacy rule: until the receiver's 2nd reply, the sender's name, photo AND message text never reach the DOM. */
(function () {
  const { MIN, HOUR, DAY } = NX.T;
  App.secretTab = App.secretTab || 'messages';
  App.secretSub = App.secretSub || 'received';

  /* Day-level only: never expose precise timing on anonymous items. */
  const dayLabel = (ts) => {
    const d = new Date(ts), n = new Date();
    const y = new Date(); y.setDate(n.getDate() - 1);
    if (d.toDateString() === n.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  NX.dayLabel = dayLabel;

  const inbox = () => S.secretInbox.filter(m => !(S.blockedAnon || []).includes(m.senderId)).sort((a, b) => b.createdAt - a.createdAt);
  NX.secretInboxList = inbox;

  const NOTICE = 'Someone is trying to reach you with a Secret Message 💌';
  NX.secretNotice = NOTICE;
  const firstName = (u) => esc(u.name.split(' ')[0]);

  /* ---------- Premium tab (Secret hub) ---------- */
  const unreadSealed = () => inbox().filter(m => !m.revealed && m.messages[m.messages.length - 1].from === 'them').length;
  const crushDot = () => S.notifications.some(n => !n.read && (n.type === 'crush' || n.type === 'match'));

  const planPill = () => {
    const p = S.me.plan;
    const label = p === 'premium' ? `${Icon('crown', 13)} Premium` : p === 'plus' ? `${Icon('sparkles', 13)} Plus` : 'Free';
    return `<button class="px-plan-pill ${p}" data-go="${p === 'free' ? 'plans' : 'mySubscription'}" aria-label="Your plan: ${p}. ${p === 'free' ? 'See plans' : 'Open subscription'}">${label}</button>`;
  };

  /* Free users see every Premium feature, clearly marked as needing a plan, with one way to upgrade. */
  const LOCKS = {
    read: { icon: 'mailOpen', title: 'Read & reply to Secret Messages', reason: 'secret-read', points: () => ['Open sealed messages people send you', 'Reply twice to unseal who sent it and what they wrote', 'Blocking and reporting stay free'] },
    send: { icon: 'send', title: 'Send Secret Messages', reason: 'secret-send', points: () => ['They only see "Someone sent you a secret message"', 'You\'re revealed only after they reply twice', `Plus: ${S.plans.plus.limits.secretMessages} a month · Premium: unlimited`] },
    crush: { icon: 'heart', title: 'Add Secret Crushes', reason: 'crush', points: () => [`Plus: up to ${S.plans.plus.limits.crushes} crushes · Premium: up to ${S.plans.premium.limits.crushes}`, 'Nobody finds out unless it\'s mutual', 'A mutual crush becomes a match and opens a chat'] },
  };
  window.pxLockCard = (k) => {
    const c = LOCKS[k];
    return `
      <section class="px-lockcard">
        <div class="px-lockcard-head">
          <span class="px-tile" aria-hidden="true">${Icon(c.icon, 22)}<i class="px-tile-badge">${Icon('lock', 12)}</i></span>
          <div><span class="px-lock-tag">${Icon('crown', 12)} Plus or Premium</span><h3>${c.title}</h3></div>
        </div>
        <ul>${c.points().map(p => `<li>${Icon('check', 16)}<span>${esc(p)}</span></li>`).join('')}</ul>
        <button class="btn btn-primary btn-lg btn-block" data-go="plans" data-params='{"reason":"${c.reason}"}'>Choose a plan</button>
        <small class="px-lockcard-foot">From ${inr(S.plans.plus.price)}/month · cancel anytime</small>
      </section>`;
  };
  const gate = (t) => `
    <button class="px-gate" data-go="plans" data-params='{"reason":"${t === 'crush' ? 'crush' : 'secret-read'}"}'>
      <span class="px-tile sm muted" aria-hidden="true">${Icon('lock', 20)}</span>
      <span class="px-gate-text"><b>Premium features need a plan</b><small>You're on Free · Plus from ${inr(S.plans.plus.price)}/month</small></span>
      <span class="px-gate-cta">See plans ${Icon('chevronRight', 16)}</span>
    </button>`;

  Screens.secret = {
    tab: 'secret', title: 'Premium',
    render: (p) => {
      if (p.tab) { App.secretTab = p.tab; p.tab = null; }
      const t = App.secretTab;
      const unread = unreadSealed();
      const dot = crushDot();
      const free = !NX.isPaid();
      return `
        <header class="appbar px-appbar">
          <div class="appbar-title"><h1>Premium</h1></div>
          <div class="appbar-actions">
            ${planPill()}
            <button class="icon-btn" data-action="secretHowItWorks" aria-label="How it works">${Icon('help', 22)}</button>
          </div>
        </header>
        <div class="page px-page">
          <section class="px-intro">
            <span class="px-tile" aria-hidden="true">${Icon('mask', 24)}</span>
            <div>
              <h2>Say it without saying who</h2>
              <p>Send secret messages and add secret crushes. Your name stays hidden.</p>
            </div>
          </section>
          ${free ? gate(t) : ''}
          <div class="px-tabs" role="tablist" aria-label="Premium sections">
            <button role="tab" class="${t === 'messages' ? 'active' : ''}" aria-selected="${t === 'messages'}" data-action="secretTab" data-tab="messages">
              ${Icon('messageHeart', 18)} Messages${free ? `<span class="px-tab-lock" aria-label="Needs a plan">${Icon('lock', 13)}</span>` : ''}${unread ? `<span class="px-count" aria-label="${unread} unread">${unread}</span>` : ''}
            </button>
            <button role="tab" class="${t === 'crush' ? 'active' : ''}" aria-selected="${t === 'crush'}" data-action="secretTab" data-tab="crush">
              ${Icon('heart', 18)} Secret Crush${free ? `<span class="px-tab-lock" aria-label="Needs a plan">${Icon('lock', 13)}</span>` : ''}${dot ? '<span class="px-dot" aria-label="New"></span>' : ''}
            </button>
          </div>
          <div class="tab-anim" role="tabpanel">${t === 'messages' ? messagesTab() : Crush.renderTab()}</div>
        </div>`;
    },
    mount() {
      /* Free users keep the dot until a plan unlocks the section, so the reason to upgrade stays visible. */
      const msgs = App.secretTab === 'messages';
      const unlocked = msgs ? NX.canReadSecret() : NX.isPaid();
      if (!unlocked) return;
      const n = S.notifications.filter(x => !x.read && (msgs ? x.type === 'secret' && !x.target.params.role : x.type === 'crush' || x.type === 'match'));
      if (!n.length) return;
      n.forEach(x => { x.read = true; });
      NX.save();
      App.renderChrome();
      if (!msgs) { const d = $('.px-tabs .px-dot'); d && d.remove(); }
    }
  };
  Actions.secretTab = (el) => { App.secretTab = el.dataset.tab; App.refresh(); };
  Actions.secretSub = (el) => { App.secretSub = el.dataset.sub; App.refresh(); };

  function messagesTab() {
    const sub = App.secretSub;
    const rec = inbox();
    const seg = (id, icon, label, n) => `
      <button role="tab" class="${sub === id ? 'active' : ''}" aria-selected="${sub === id}" data-action="secretSub" data-sub="${id}">
        ${Icon(icon, 16)} ${label}${n ? `<span class="px-seg-n">${n}</span>` : ''}
      </button>`;
    return `
      <div class="px-seg" role="tablist" aria-label="Secret Messages">
        ${seg('received', 'inbox', 'Received', rec.length)}
        ${seg('sent', 'send', 'Sent', S.secretSent.length)}
      </div>
      ${sub === 'received' ? receivedList(rec) : sentList()}`;
  }

  /* ---------- Search + filters (Received / Sent) ---------- */
  App.secretQ = App.secretQ || { received: '', sent: '' };
  App.secretFilter = App.secretFilter || { received: 'all', sent: 'all' };
  const FILTERS = {
    received: [['all', 'All'], ['new', 'New'], ['sealed', 'Sealed'], ['revealed', 'Revealed']],
    sent: [['all', 'All'], ['waiting', 'Waiting'], ['revealed', 'Revealed']],
  };
  const isFresh = (m) => !m.revealed && m.messages[m.messages.length - 1].from === 'them';
  const PASS = {
    received: { all: () => true, new: isFresh, sealed: (m) => !m.revealed, revealed: (m) => m.revealed },
    sent: { all: () => true, waiting: (m) => !m.revealed, revealed: (m) => m.revealed },
  };
  const normQ = (q) => q.trim().toLowerCase().replace(/^@/, '');
  const matchUser = (u, q) => !!u && (u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  const sentAll = () => [...S.secretSent].sort((a, b) => b.createdAt - a.createdAt);

  const tools = (sub, list) => `
    <div class="px-tools">
      <div class="search-box px-search">
        ${Icon('search', 18)}
        <input type="search" id="secretSearch-${sub}" value="${esc(App.secretQ[sub])}" placeholder="Search by name or username" data-input="secretSearch" data-sub="${sub}" autocomplete="off" aria-label="Search ${sub} Secret Messages">
      </div>
      <div class="px-filters" role="radiogroup" aria-label="Filter ${sub} Secret Messages">
        ${FILTERS[sub].map(([id, label]) => {
          const on = App.secretFilter[sub] === id;
          const n = id === 'all' ? 0 : list.filter(PASS[sub][id]).length;
          return `<button type="button" class="chip${on ? ' active' : ''}" role="radio" aria-checked="${on}" data-action="secretFilter" data-sub="${sub}" data-f="${id}">${label}${n ? `<span class="px-chip-n">${n}</span>` : ''}</button>`;
        }).join('')}
      </div>
    </div>`;

  /* Sealed senders are unknown to the app, so a name search can only match revealed ones. */
  function receivedRows(list) {
    const q = normQ(App.secretQ.received);
    let rows = list.filter(PASS.received[App.secretFilter.received]);
    const sealedSkipped = q ? rows.filter(m => !m.revealed).length : 0;
    if (q) rows = rows.filter(m => m.revealed && matchUser(NX.user(m.senderId), q));
    const note = sealedSkipped ? `<p class="px-search-note">${Icon('lock', 13)} Sealed messages can't be searched by name until they're revealed.</p>` : '';
    if (!rows.length) return note + `<p class="px-pick-empty">${q ? `No revealed messages match "<b>${esc(App.secretQ.received)}</b>".` : 'No messages here yet.'}</p>`;
    return note + `<div class="px-list">${rows.map(m => (m.revealed ? revealedCard(m) : sealedCard(m))).join('')}</div>`;
  }

  function sentRows(list) {
    const q = normQ(App.secretQ.sent);
    const rows = list.filter(PASS.sent[App.secretFilter.sent]).filter(m => !q || matchUser(NX.user(m.toId), q));
    if (!rows.length) return `<p class="px-pick-empty">${q ? `No one matches "<b>${esc(App.secretQ.sent)}</b>".` : 'No messages here yet.'}</p>`;
    return `<div class="px-list">${rows.map(sentRow).join('')}</div>`;
  }

  Inputs.secretSearch = (el) => {
    const sub = el.dataset.sub;
    App.secretQ[sub] = el.value;
    const box = $('#pxSecretList');
    if (box) box.innerHTML = sub === 'received' ? receivedRows(inbox()) : sentRows(sentAll());
  };
  Actions.secretFilter = (el) => { App.secretFilter[el.dataset.sub] = el.dataset.f; App.refresh(); };

  /* Blurred stand-in for a sealed sender. Placeholder only: the real name and photo never reach the app before the reveal. */
  const ghostAvatar = (size) => `<span class="px-ghost" style="--s:${size}px" aria-hidden="true">${Icon('user', Math.round(size * 0.5))}</span>`;
  const ghostName = () => `<span class="px-blur" aria-hidden="true">Secret Sender</span><span class="sr-only">Hidden sender</span>`;

  /* Reply 1 → Reply 2 track for list rows. */
  const track = (n) => `
    <span class="px-track" aria-hidden="true">
      <i class="${n >= 1 ? 'on' : ''}"></i><i class="${n >= 2 ? 'on' : ''}"></i>
    </span>`;

  function receivedList(list) {
    const canRead = NX.canReadSecret();
    if (!list.length && !canRead) return pxLockCard('read');
    if (!list.length) return emptyState({
      icon: 'mail', title: 'No secret messages yet',
      text: 'When someone sends you a Secret Message it lands here, sealed. Reply twice to unseal who sent it and what they wrote.',
      actions: '<button class="btn btn-primary" data-action="sendSecretFromTab">Send a Secret Message</button>'
    });
    if (!canRead) {
      const sealed = list.filter(m => !m.revealed);
      return `
        <section class="px-locked">
          <span class="px-tile lg" aria-hidden="true">${Icon('mail', 26)}<i class="px-tile-badge">${Icon('lock', 12)}</i></span>
          <h3>You have ${sealed.length} sealed message${sealed.length === 1 ? '' : 's'}</h3>
          <p>Someone has something to tell you. Upgrade to reply — the name and message unseal after your 2nd reply.</p>
          <button class="btn btn-primary btn-lg btn-block" data-go="plans" data-params='{"reason":"secret-read"}'>Unlock Secret Messages</button>
        </section>
        <div class="px-head"><h2>Sealed messages</h2><span>${sealed.length}</span></div>
        <div class="px-list">${sealed.map(lockedRow).join('')}</div>`;
    }
    return `
      ${tools('received', list)}
      <p class="px-privacy">${Icon('shieldCheck', 15)} Name and photo stay blurred until you reply twice.</p>
      <div id="pxSecretList" aria-live="polite">${receivedRows(list)}</div>`;
  }

  /* Free receiver: no text, no sender, day only. The row opens Plans; ••• offers Report / Block. */
  const lockedRow = (m) => `
    <div class="px-row px-row-locked">
      <button class="px-row-main" data-go="plans" data-params='{"reason":"secret-read"}' aria-label="Sealed message from ${dayLabel(m.createdAt)}. Upgrade to open.">
        <span class="px-av">${ghostAvatar(52)}<span class="px-av-badge">${Icon('lock', 11)}</span></span>
        <span class="px-row-body">
          <b>${ghostName()}</b>
          <small>${Icon('lock', 11)} Locked · ${dayLabel(m.createdAt)}</small>
          ${nearChipFor(m.senderId, { static: true })}
        </span>
      </button>
      <button class="icon-btn sm" data-action="lockedSecretMenu" data-id="${m.id}" aria-label="Options">${Icon('more', 20)}</button>
    </div>`;

  const sealedCard = (m) => {
    const used = m.repliesUsed;
    const fresh = m.messages[m.messages.length - 1].from === 'them';
    const status = used === 0 ? 'Sealed · reply twice to unseal' : 'One more reply unseals it';
    return `
      <button class="px-row px-row-sealed${fresh ? ' fresh' : ''}" data-go="secretThread" data-params='{"id":"${m.id}"}' aria-label="Sealed message. ${status}">
        <span class="px-av">${ghostAvatar(52)}<span class="px-av-badge">${Icon('lock', 11)}</span></span>
        <span class="px-row-body">
          <b>${ghostName()}</b>
          <small class="${used === 1 ? 'px-hot' : ''}">${status}</small>
          ${track(used)}
          ${nearChipFor(m.senderId, { static: true })}
        </span>
        <span class="px-row-side"><span class="px-day">${dayLabel(m.createdAt)}</span>${fresh ? '<span class="px-new">New</span>' : ''}</span>
      </button>`;
  };

  const revealedCard = (m) => {
    const u = NX.user(m.senderId);
    const near = NX.nearbyState(m.senderId);
    return `
      <button class="px-row" data-go="chat" data-params='{"id":"${m.chatId}"}'>
        <span class="px-av">${avatar(u, 52)}<span class="px-av-badge ok">${Icon('check', 11)}</span></span>
        <span class="px-row-body">
          <b>${esc(u.name)}</b>
          <small>${near === 'on' ? `<span class="px-near">${esc(NX.nearText(m.senderId))}</span>` : 'Unsealed · now a chat'}</small>
        </span>
        <span class="px-row-side"><span class="chip chip-ok">${Icon('check', 12)} Revealed</span></span>
      </button>`;
  };

  function usageCard() {
    const l = NX.limitOf('secretMessages');
    if (l < 0) return `
      <div class="px-usage">
        <span class="px-tile sm" aria-hidden="true">${Icon('infinity', 22)}</span>
        <span class="px-usage-text"><b>Unlimited Secret Messages with Premium</b><small>Fair use: up to 30 new a day</small></span>
      </div>`;
    const used = Math.min(S.usage.secretSent, l);
    const left = Math.max(0, l - used);
    const reset = new Date(); reset.setMonth(reset.getMonth() + 1, 1);
    return `
      <div class="px-usage">
        <span class="px-tile sm" aria-hidden="true">${Icon('send', 20)}</span>
        <span class="px-usage-text">
          <b>${left} of ${l} Secret Messages left this month</b>
          <span class="px-pips" aria-hidden="true">${Array.from({ length: l }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span>
          <small>Resets ${reset.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
        </span>
        ${left === 0 ? '<button class="btn btn-primary btn-xs" data-go="plans" data-params=\'{"reason":"limit"}\'>Get more</button>' : ''}
      </div>`;
  }

  const sentStatus = (m) => (m.revealed ? 'They replied twice · you\'re revealed'
    : m.repliesReceived ? `${m.repliesReceived} of 2 replies · you're still hidden` : 'Delivered · you\'re hidden');

  const sentRow = (m) => {
    const u = NX.user(m.toId);
    const go = m.revealed ? `data-go="chat" data-params='{"id":"${m.chatId}"}'` : `data-go="secretThread" data-params='{"id":"${m.id}","role":"sent"}'`;
    return `
      <button class="px-row" ${go}>
        <span class="px-av">${avatar(u, 52)}<span class="px-av-badge${m.revealed ? ' ok' : ''}">${Icon(m.revealed ? 'check' : 'mask', 11)}</span></span>
        <span class="px-row-body">
          <b>To ${esc(u.name)}</b>
          <small class="${m.repliesReceived === 1 && !m.revealed ? 'px-hot' : ''}">${sentStatus(m)}</small>
          ${m.revealed ? '' : track(m.repliesReceived)}
          ${nearChipFor(m.toId, { static: true })}
        </span>
        <span class="px-row-side"><span class="px-day">${dayLabel(m.createdAt)}</span>${m.revealed ? `<span class="chip chip-ok">${Icon('chat', 12)} Chat</span>` : ''}</span>
      </button>`;
  };

  function sentList() {
    const paid = NX.isPaid();
    const list = sentAll();
    const head = paid ? usageCard() : pxLockCard('send');
    if (!list.length && !paid) return head;
    if (!list.length) return head + emptyState({
      icon: 'send', title: 'Nothing sent yet',
      text: 'Pick someone and tell them what you\'ve been holding back. They\'ll only learn it\'s you after they reply twice.',
      actions: paid ? '<button class="btn btn-primary" data-action="sendSecretFromTab">Send a Secret Message</button>' : ''
    });
    return head + `
      ${tools('sent', list)}
      <div id="pxSecretList" aria-live="polite">${sentRows(list)}</div>
      ${paid ? `<button class="btn btn-primary btn-lg btn-block mt" data-action="sendSecretFromTab">${Icon('send', 18)} Send another Secret Message</button>` : ''}`;
  }

  Actions.lockedSecretMenu = (el) => {
    const m = S.secretInbox.find(x => x.id === el.dataset.id);
    Modal.menu([
      { label: 'Report', icon: 'flag', danger: true, onClick: () => Safety.report({ userId: m.senderId, content: 'Secret Message', anonymous: true }) },
      { label: 'Block sender', icon: 'ban', danger: true, onClick: () => Safety.block(m.senderId, { anonymous: true }) },
    ], { title: 'Your report stays private. The sender\'s identity stays hidden.' });
  };

  Actions.sendSecretFromTab = () => {
    if (!NX.isPaid() || NX.limitOf('secretMessages') === 0) return Nav.go('plans', { reason: 'secret-send' });
    if (NX.secretLeft() <= 0) return upgradeLimitModal('secret');
    openPeoplePicker('secret_message');
  };

  /* ---------- SecretPeoplePicker (shared with Secret Crush) ---------- */
  const PICKER = {
    secret_message: { title: 'Send a Secret Message', icon: 'mask', text: 'Pick anyone — public or private. You stay <b>"Someone"</b> until they reply twice.' },
    crush: { title: 'Add a Secret Crush', icon: 'heart', text: 'Who do you like? They\'ll only find out it\'s you <b>if they add you too</b>.' },
  };

  const pickerRows = (intent, q) => {
    const v = q.trim().toLowerCase().replace(/^@/, '');
    const pool = S.users.filter(u => !NX.isBlocked(u.id) && !(S.blockedAnon || []).includes(u.id));
    const list = v ? pool.filter(u => u.name.toLowerCase().includes(v) || u.username.includes(v)) : pool.slice(0, 8);
    if (!list.length) return `<p class="px-pick-empty">No one matches "<b>${esc(q)}</b>".</p>`;
    return `${v ? '' : '<p class="px-pick-label">Suggested</p>'}${list.map(u => {
      const open = intent === 'secret_message' && S.secretSent.some(m => m.toId === u.id && !m.revealed);
      const crushed = intent === 'crush' && NX.hasCrush(u.id);
      const matched = intent === 'crush' && NX.matchWith(u.id);
      const tag = matched ? `<span class="px-pick-tag love">${Icon('heart', 12)} Match</span>`
        : crushed ? '<span class="px-pick-tag">In your crushes</span>'
        : open ? '<span class="px-pick-tag">Open thread</span>' : Icon('chevronRight', 18);
      return `
        <button class="px-pick-row" data-action="pickPerson" data-intent="${intent}" data-id="${u.id}" ${crushed || matched ? 'disabled' : ''}>
          ${avatar(u, 46)}
          <span class="px-row-body"><b>${esc(u.username)}${premiumBadge(u)}</b><small>${esc(u.name)}</small></span>
          ${tag}
        </button>`;
    }).join('')}`;
  };

  function openPeoplePicker(intent) {
    const c = PICKER[intent];
    Modal.open({
      title: c.title, cls: 'sheet-tall px-picker',
      body: `
        <p class="px-pick-intro">${Icon(c.icon, 18)}<span>${c.text}</span></p>
        <div class="search-box px-pick-search">
          ${Icon('search', 18)}
          <input type="search" placeholder="Search by name or username" data-input="pickerSearch" data-intent="${intent}" autocomplete="off" aria-label="Search people" data-autofocus>
        </div>
        <div class="px-pick-list" id="pickerList" aria-live="polite">${pickerRows(intent, '')}</div>`
    });
  }
  window.openPeoplePicker = openPeoplePicker;
  Inputs.pickerSearch = (el) => { $('#pickerList').innerHTML = pickerRows(el.dataset.intent, el.value); };
  Actions.pickPerson = (el) => {
    const { intent, id } = el.dataset;
    Modal.closeAll();
    setTimeout(() => (intent === 'crush' ? Actions.toggleCrush(el) : Actions.startSecretMessage(el)), 180);
  };

  Actions.secretHowItWorks = () => Modal.open({
    title: 'How it works', cls: 'sheet-tall',
    body: `
      <div class="how">
        <div class="how-block"><span class="px-tile" aria-hidden="true">${Icon('messageHeart', 22)}</span><div><h3>Secret Messages</h3>
          <ol><li>Send a message to anyone. They're told <b>"${NOTICE}"</b>.</li><li>The sender's <b>name and message stay sealed</b> while they reply.</li><li>After their <b>2nd reply</b>, the name, photo and full message unseal together and it becomes a normal chat.</li></ol></div></div>
        <div class="how-block"><span class="px-tile" aria-hidden="true">${Icon('heart', 22)}</span><div><h3>Secret Crush</h3>
          <ol><li>Add people to your private crush list.</li><li>They're told <b>"Someone added you as a Secret Crush 👀"</b> — never who.</li><li>If they add you too: <b>"Congratulations! It's a match 💘"</b> and a love chat opens.</li><li>No match? Nobody ever finds out.</li></ol></div></div>
        <p class="how-plans">Opening and replying to Secret Messages, sending them and adding crushes need <b>Plus</b> or <b>Premium</b>.</p>
      </div>`,
    footer: `<button class="btn btn-primary btn-block" data-close>Got it</button>`
  });

  /* ---------- Send flow ---------- */
  Actions.startSecretMessage = (el) => {
    const id = el.dataset.id;
    if (!NX.isPaid() || NX.limitOf('secretMessages') === 0) return Nav.go('plans', { reason: 'secret-send', to: id });
    const existing = S.secretSent.find(m => m.toId === id && !m.revealed);
    if (existing) { Toast.show('You already have a secret conversation going with them.', { type: 'info' }); return Nav.go('secretThread', { id: existing.id, role: 'sent' }); }
    if (NX.secretLeft() <= 0) return upgradeLimitModal('secret');
    Nav.go('secretCompose', { id });
  };

  window.upgradeLimitModal = (kind) => {
    const l = NX.limitOf(kind === 'secret' ? 'secretMessages' : 'crushes');
    const premiumCrush = S.plans.premium.limits.crushes;
    Modal.open({
      cls: 'confirm-layer', hideHeader: true, label: 'Limit reached',
      body: `<div class="confirm">
        <div class="confirm-ic">${Icon('crown', 26)}</div>
        <h2>You've used all ${l} ${kind === 'secret' ? 'Secret Messages this month' : 'Secret Crush spots'}</h2>
        <p>${S.me.plan === 'premium' ? 'You\'re on our top plan. Spots free up when you remove someone or next month.' : `Go Premium for ${kind === 'secret' ? 'unlimited Secret Messages' : `up to ${premiumCrush < 0 ? 'unlimited' : premiumCrush} Secret Crushes`} — ${inr(S.plans.premium.price)}/month.`}</p>
        <div class="confirm-actions">
          ${S.me.plan === 'premium' ? '' : `<button class="btn btn-primary btn-block" data-go="plans" data-params='{"reason":"limit"}'>Upgrade to Premium</button>`}
          <button class="btn btn-ghost btn-block" data-close>${S.me.plan === 'premium' ? 'OK' : 'Not now'}</button>
        </div></div>`
    });
  };

  const PROMPTS = ['I\'ve always wanted to tell you…', 'You made my day when…', 'Honestly, I admire how you…', 'Can I be honest? 🙈'];

  Screens.secretCompose = {
    chrome: 'none', title: 'Secret Message',
    render: (p) => {
      const u = NX.user(p.id);
      const left = NX.secretLeft();
      return `
        <header class="appbar sm-head">
          <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
          <div class="appbar-title"><h1>New secret message</h1></div>
        </header>
        <div class="page sm-compose">
          <div class="smc-to">${avatar(u, 46)}<div><small>To</small><b>${esc(u.name)}</b><span>@${esc(u.username)}</span></div><span class="smc-mask" title="You're anonymous">${Icon('mask', 18)}</span></div>
          <form data-form="sendSecret" data-id="${u.id}" novalidate>
            <div class="smc-letter">
              <div class="smc-letter-top"><span>${Icon('mask', 15)} From: <b>Someone</b></span><span class="paper-count" id="secretCount">0/300</span></div>
              <label class="sr-only" for="secretText">Your secret message</label>
              <textarea id="secretText" name="text" rows="6" maxlength="300" placeholder="Write something kind, honest or brave…" data-input="secretCount"></textarea>
            </div>
            <p class="field-error" id="secretErr" role="alert"></p>
            <div class="prompt-chips" aria-label="Need a start?">
              ${PROMPTS.map(t => `<button type="button" class="chip" data-action="usePrompt" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
            </div>
            <ol class="smc-how">
              <li><span>1</span><p>${firstName(u)} gets <b>"${NOTICE}"</b>.</p></li>
              <li><span>2</span><p>Your <b>name and message stay sealed</b> while they reply.</p></li>
              <li><span>3</span><p>After their <b>2nd reply</b>, both are revealed and you chat normally.</p></li>
            </ol>
            <p class="usage-line">${left === Infinity ? `${Icon('crown', 14)} Unlimited with Premium` : `Uses 1 of your <b>${left}</b> remaining Secret Messages this month.`}</p>
            <button class="btn btn-secret btn-lg btn-block" type="submit">${Icon('send', 18)} Send secretly</button>
            <p class="fine">Be kind. Recipients can report and block anonymously, and abuse gets accounts removed.</p>
          </form>
        </div>`;
    },
    mount() { setTimeout(() => { const t = $('#secretText'); t && t.focus(); }, 300); }
  };
  Inputs.secretCount = (el) => { $('#secretCount').textContent = `${el.value.length}/300`; $('#secretErr').textContent = ''; };
  Actions.usePrompt = (el) => {
    const t = $('#secretText');
    t.value = el.dataset.t + ' ';
    t.focus();
    Inputs.secretCount(t);
  };
  Forms.sendSecret = async (form) => {
    const text = form.text.value.trim();
    if (text.length < 3) { $('#secretErr').textContent = 'Write at least a few words.'; return; }
    if (NX.secretLeft() <= 0) return upgradeLimitModal('secret');
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Sealing…');
    await delay(1100);
    const item = { id: uid('ss'), toId: form.dataset.id, createdAt: Date.now(), repliesReceived: 0, revealed: false, chatId: null, messages: [{ from: 'me', text, time: Date.now() }] };
    S.secretSent.unshift(item);
    S.usage.secretSent += 1;
    NX.save();
    scheduleReplies(item.id);
    Nav.go('secretDone', { id: item.id }, { replace: true });
  };

  Screens.secretDone = {
    chrome: 'none', title: 'Sent',
    render: (p) => {
      const m = S.secretSent.find(x => x.id === p.id);
      const u = m && NX.user(m.toId);
      return `
        <div class="done-screen secret-done">
          <span class="success-check big" aria-hidden="true">${Icon('check', 44)}</span>
          <h1>Sealed &amp; sent</h1>
          <p>${u ? firstName(u) : 'They'} will see <i>"Someone is trying to reach you…"</i>. Your name and message stay sealed until they reply twice.</p>
          <div class="done-actions">
            <button class="btn btn-primary btn-lg btn-block" data-go="secretThread" data-params='{"id":"${p.id}","role":"sent"}' data-replace>View conversation</button>
            <button class="btn btn-ghost btn-lg btn-block" data-action="back">Done</button>
          </div>
        </div>`;
    }
  };

  /* Simulates the recipient replying so the sender-side reveal can be demonstrated. */
  function scheduleReplies(id) {
    const replies = ['Okay, who IS this? 👀 I can\'t even read it yet!', 'Fine, you win. Reply two — show me who you are 😄'];
    [9000, 21000].forEach((ms, i) => setTimeout(() => {
      const m = S.secretSent.find(x => x.id === id);
      if (!m || m.revealed || m.repliesReceived > i) return;
      const u = NX.user(m.toId);
      m.messages.push({ from: 'them', text: replies[i], time: Date.now() });
      m.repliesReceived = i + 1;
      let n;
      if (i === 1) {
        const chat = { id: 'cr_' + m.id, userId: m.toId, kind: 'revealed', unread: 1, messages: [{ id: uid('m'), from: 'system', text: 'Started as a Secret Message 💌 — you\'re now revealed', time: Date.now() }, ...m.messages.map(x => ({ id: uid('m'), from: x.from, text: x.text, time: x.time, seen: true }))] };
        S.chats.unshift(chat);
        m.revealed = true; m.chatId = chat.id;
        n = NX.notify({ type: 'secret', userId: m.toId, text: `<b>${esc(u.username)}</b> replied twice — you've been revealed ✨ Your chat is open.`, target: { screen: 'chat', params: { id: chat.id } } });
      } else {
        n = NX.notify({ type: 'secret', text: `<b>${esc(u.username)}</b> replied to your Secret Message (1 of 2)`, target: { screen: 'secretThread', params: { id: m.id, role: 'sent' } } });
      }
      NX.save();
      if (Nav.is('secretThread') && Nav.cur().params.id === id) App.refresh();
      App.incoming(n);
    }, ms));
  }

  /* ---------- Thread (received + sent) ---------- */
  /* Placeholder line widths are fixed per position so the real message length isn't leaked. */
  const SEAL_W = [[168, 112], [190, 92], [146, 120]];
  const sealedBubble = (i) => {
    const [a, b] = SEAL_W[i % SEAL_W.length];
    return `<div class="msg in"><div class="bubble sealed" role="img" aria-label="Sealed message. It unseals after your second reply.">
      <span class="sl"><i style="width:${a}px"></i><i style="width:${b}px"></i></span>
      <span class="sealed-tag">${Icon('lock', 12)} Sealed</span></div></div>`;
  };
  const bubble = (m) => {
    if (m.from === 'system') return `<div class="sys-msg">${esc(m.text)}</div>`;
    return `<div class="msg ${m.from === 'me' ? 'out' : 'in'}"><div class="bubble">${esc(m.text)}</div></div>`;
  };

  const nearLine = (state, userId) => {
    if (state === 'on') return `<small class="sm-near">${esc(NX.nearText(userId))}</small>`;
    if (state === 'locked') return `<button class="sm-near locked" data-go="plans" data-params='{"reason":"nearby"}' aria-label="Nearby hint locked. Upgrade to see.">${Icon('lock', 11)}<span class="blur-text">This person was near you</span></button>`;
    return `<small class="sm-sub">${Icon('lock', 11)} Name sealed until the reveal</small>`;
  };

  Screens.secretThread = {
    chrome: 'none', title: 'Secret conversation',
    render: (p) => (p.role === 'sent' ? sentThread(p) : receivedThread(p)),
    mount() { const end = $('#threadEnd'); end && end.scrollIntoView({ block: 'end' }); }
  };

  function receivedThread(p) {
    const m = S.secretInbox.find(x => x.id === p.id);
    if (!m || (S.blockedAnon || []).includes(m.senderId)) return `${appbar({ title: 'Secret Message', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ icon: 'mail', title: 'Message unavailable', text: 'This secret message is no longer available.' })}</div>`;
    if (m.revealed) return `${appbar({ title: 'Unsealed', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ icon: 'mailOpen', title: 'This secret was unsealed', text: 'Your conversation continues as a regular chat.', actions: `<button class="btn btn-primary" data-go="chat" data-params='{"id":"${m.chatId}"}' data-replace>Open chat</button>` })}</div>`;
    const near = NX.nearbyState(m.senderId);
    const canRead = NX.canReadSecret();
    const used = m.repliesUsed;
    const head = `
      <header class="appbar sm-head">
        <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
        <div class="sm-who">
          ${ghostAvatar(42)}
          <div class="sm-who-text">
            <b>${ghostName()}</b>
            ${nearLine(near, m.senderId)}
          </div>
        </div>
        <div class="appbar-actions"><button class="icon-btn" data-action="secretThreadMenu" data-id="${m.id}" aria-label="Options">${Icon('more', 22)}</button></div>
      </header>`;

    const themIdx = (() => { let k = 0; return () => k++; })();
    const msgs = m.messages.map(x => (x.from === 'them' ? sealedBubble(themIdx()) : bubble(x))).join('');

    if (!canRead) {
      return `${head}
        <div class="page sm-thread">
          <section class="sm-sealbox">
            <div class="sm-bigwax" aria-hidden="true">${Icon('lock', 26)}</div>
            <h2>Someone has something to tell you</h2>
            <p>Upgrade to reply. After your 2nd reply, their name, photo and message unseal together.</p>
            <button class="btn btn-primary btn-block" data-go="plans" data-params='{"reason":"secret-read"}'>Unlock Secret Messages</button>
          </section>
          <div class="day-divider"><span>${dayLabel(m.createdAt)}</span></div>
          <div class="messages">${sealedBubble(0)}</div>
          <div id="threadEnd"></div>
        </div>`;
    }
    return `${head}
      <div class="page sm-thread">
        <section class="sm-sealbox">
          <div class="sm-bigwax" aria-hidden="true">${Icon('mail', 26)}</div>
          <h2>${used === 0 ? 'This message is sealed' : used === 1 ? 'One more reply to unseal' : 'Unsealing…'}</h2>
          <p>${used === 0 ? 'Reply twice and the sender\'s name, photo and message are revealed together.' : 'Your next reply reveals who sent this — and what they wrote.'}</p>
          <div class="sm-track" aria-label="Reveal progress: ${used} of 2 replies">
            <span class="${used >= 1 ? 'on' : ''}"><b>${used >= 1 ? Icon('check', 13) : '1'}</b>Reply</span><i class="${used >= 1 ? 'on' : ''}"></i>
            <span class="${used >= 2 ? 'on' : ''}"><b>${used >= 2 ? Icon('check', 13) : '2'}</b>Reply</span><i></i>
            <span class="end"><b>${Icon('eye', 14)}</b>Reveal</span>
          </div>
        </section>
        <div class="day-divider"><span>${dayLabel(m.createdAt)}</span></div>
        <div class="messages">${msgs}
          <div class="msg in typing-row" id="typingRow" hidden><div class="bubble typing"><i></i><i></i><i></i></div></div>
        </div>
        <div id="threadEnd"></div>
      </div>
      <form class="composer composer-fixed sm-composer" data-form="secretReply" data-id="${m.id}">
        <div class="sm-quick" aria-label="Quick replies">
          ${['Who is this? 👀', 'Hi! 👋', 'Tell me more 🙈', 'You made me curious 😄'].map(q => `<button type="button" class="sm-chip" data-action="smQuick" data-t="${esc(q)}">${esc(q)}</button>`).join('')}
        </div>
        <p class="sm-hint${used >= 1 ? ' last' : ''}">${used >= 2 ? 'Unsealing their name &amp; message…' : used === 1 ? 'Reply 2 of 2 — this unseals their name &amp; message' : 'Reply 1 of 2 · everything stays sealed until your 2nd reply'}</p>
        <div class="composer-row">
          <input class="input" id="secretReplyInput" name="text" placeholder="${used === 1 ? 'Send your 2nd reply to unseal…' : 'Write a reply…'}" autocomplete="off" maxlength="500" aria-label="Write a reply">
          <button class="send-btn" type="submit" aria-label="Send reply">${Icon('send', 20)}</button>
        </div>
      </form>`;
  }

  Actions.smQuick = (el) => {
    const i = $('#secretReplyInput');
    if (!i) return;
    i.value = el.dataset.t;
    i.focus();
  };

  function sentThread(p) {
    const m = S.secretSent.find(x => x.id === p.id);
    if (!m) return `${appbar({ title: 'Secret Message', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ icon: 'mail', title: 'Conversation not found' })}</div>`;
    if (m.revealed) return `${appbar({ title: 'Revealed', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ icon: 'mailOpen', title: 'You\'ve been revealed', text: 'They replied twice, so your conversation is now a regular chat.', actions: `<button class="btn btn-primary" data-go="chat" data-params='{"id":"${m.chatId}"}' data-replace>Open chat</button>` })}</div>`;
    const u = NX.user(m.toId);
    const r = m.repliesReceived;
    return `
      <header class="appbar sm-head">
        <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
        <button class="sm-who" data-go="user" data-id="${u.id}">${avatar(u, 40)}<div class="sm-who-text"><b>${esc(u.name)}</b><small class="sm-sub">${Icon('mask', 11)} You're "Someone" to them</small>${NX.nearbyState(u.id) ? nearLine(NX.nearbyState(u.id), u.id) : ''}</div></button>
        <div class="appbar-actions"></div>
      </header>
      <div class="page sm-thread">
        <section class="sm-sealbox">
          <div class="sm-bigwax" aria-hidden="true">${Icon('mask', 26)}</div>
          <h2>${r === 0 ? 'Waiting for their first reply' : 'One more reply and you\'re revealed'}</h2>
          <p>${esc(u.name.split(' ')[0])} sees your message sealed. After their 2nd reply, your name and message are revealed.</p>
          <div class="sm-track" aria-label="Their replies: ${r} of 2">
            <span class="${r >= 1 ? 'on' : ''}"><b>${r >= 1 ? Icon('check', 13) : '1'}</b>Reply</span><i class="${r >= 1 ? 'on' : ''}"></i>
            <span class="${r >= 2 ? 'on' : ''}"><b>${r >= 2 ? Icon('check', 13) : '2'}</b>Reply</span><i></i>
            <span class="end"><b>${Icon('eye', 14)}</b>Reveal</span>
          </div>
        </section>
        <div class="day-divider"><span>${dayLabel(m.createdAt)}</span></div>
        <div class="messages">${m.messages.map(x => bubble(x)).join('')}</div>
        <div id="threadEnd"></div>
      </div>
      <form class="composer composer-fixed sm-composer" data-form="secretFollowUp" data-id="${m.id}">
        ${followupsLeft(m) <= 0 ? '<p class="sm-hint">Wait for their reply · you can add up to 3 messages in a row</p>' : ''}
        <div class="composer-row">
          <input class="input" id="secretFollowInput" name="text" placeholder="${followupsLeft(m) <= 0 ? 'Wait for their reply' : 'Add to your message (still anonymous)…'}" autocomplete="off" maxlength="500" aria-label="Write a message" ${followupsLeft(m) <= 0 ? 'disabled' : ''}>
          <button class="send-btn" type="submit" aria-label="Send" ${followupsLeft(m) <= 0 ? 'disabled' : ''}>${Icon('send', 20)}</button>
        </div>
      </form>`;
  }

  /* The first message isn't a follow-up; after it, max 3 in a row without a reply. */
  const followupsLeft = (m) => {
    let run = 0;
    for (let i = m.messages.length - 1; i >= 0 && m.messages[i].from === 'me'; i--) run++;
    const hasReply = m.messages.some(x => x.from === 'them');
    return 3 - (hasReply ? run : run - 1);
  };

  Forms.secretFollowUp = (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    const m = S.secretSent.find(x => x.id === form.dataset.id);
    if (followupsLeft(m) <= 0) return;
    m.messages.push({ from: 'me', text, time: Date.now() });
    form.text.value = '';
    NX.save();
    App.refresh();
    $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' });
  };

  Forms.secretReply = async (form) => {
    const text = form.text.value.trim();
    if (!text || form.dataset.busy) return;
    const m = S.secretInbox.find(x => x.id === form.dataset.id);
    form.dataset.busy = '1';
    m.messages.push({ from: 'me', text, time: Date.now() });
    m.repliesUsed += 1;
    form.text.value = '';
    NX.save();
    App.refresh();
    $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' });
    if (m.repliesUsed >= 2) { await delay(650); return reveal(m); }
    const tr = $('#typingRow');
    if (tr) { tr.hidden = false; $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' }); }
    await delay(1900);
    m.messages.push({ from: 'them', text: (m.script && m.script[0]) || 'Thank you for replying 💙', time: Date.now() });
    NX.save();
    if (Nav.is('secretThread')) { App.refresh(); $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' }); }
  };

  function reveal(m) {
    const u = NX.user(m.senderId);
    if (m.script && m.script[1]) m.messages.push({ from: 'them', text: m.script[1], time: Date.now() });
    const chat = {
      id: 'cr_' + m.id, userId: u.id, kind: 'revealed', unread: 0,
      messages: [{ id: uid('m'), from: 'system', text: 'Started as a Secret Message 💌 — unsealed', time: m.createdAt }, ...m.messages.map(x => ({ id: uid('m'), from: x.from, text: x.text, time: x.time, seen: true }))]
    };
    S.chats = S.chats.filter(c => c.id !== chat.id);
    S.chats.unshift(chat);
    m.revealed = true; m.chatId = chat.id;
    S.notifications.forEach(n => { if (n.target && n.target.screen === 'secretThread' && n.target.params.id === m.id) n.read = true; });
    NX.save();
    const near = NX.nearbyState(u.id);
    const theirs = m.messages.filter(x => x.from === 'them').slice(0, 3);
    const el = Overlay.show(`
      <div class="reveal sm-reveal">
        <div class="stars" aria-hidden="true"></div>
        <div class="reveal-stage">
          <div class="unseal" aria-hidden="true"><span class="us-l"></span><span class="us-r"></span><span class="us-wax">💌</span></div>
          <p class="eyebrow">Unsealed ✨</p>
          <div class="reveal-avatar">
            <span class="reveal-ring" aria-hidden="true"></span>
            <span class="reveal-real">${avatar(u, 120)}</span>
            <span class="reveal-mask">${anonAvatar(120)}</span>
          </div>
          <h2>It's ${esc(u.name)}!</h2>
          <p class="reveal-sub">@${esc(u.username)}</p>${near === 'on' ? `<p class="reveal-sub reveal-near">${esc(NX.nearText(u.id))}</p>` : ''}
          <div class="um">
            <p class="um-label">${Icon('mail', 14)} What they wrote</p>
            ${theirs.map((x, i) => `<div class="um-bubble" style="--d:${1.7 + i * .35}s">${esc(x.text)}</div>`).join('')}
          </div>
          <div class="reveal-actions">
            <button class="btn btn-light btn-lg btn-block" data-action="revealOpenChat" data-id="${chat.id}">${Icon('chat', 18)} Open chat</button>
            <button class="btn btn-ghost-light btn-lg btn-block" data-action="revealProfile" data-id="${u.id}">View profile</button>
          </div>
        </div>
      </div>`, 'reveal-overlay', { label: 'Sender revealed' });
    setTimeout(() => { confetti(70); const r = el.querySelector('.reveal-avatar').getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top + r.height / 2, 16, ['✨', '💙', '💌']); }, 1300);
  }
  Actions.revealOpenChat = (el) => { Overlay.close(null, true); Nav.stack = [{ name: 'chats', params: {} }]; Nav.go('chat', { id: el.dataset.id }); };
  Actions.revealProfile = (el) => { Overlay.close(null, true); Nav.go('user', { id: el.dataset.id }, { replace: true }); };

  Actions.secretThreadMenu = (el) => {
    const m = S.secretInbox.find(x => x.id === el.dataset.id);
    Modal.menu([
      { label: 'Report this message', icon: 'flag', danger: true, onClick: () => Safety.report({ userId: m.senderId, content: 'Secret Message', anonymous: true }) },
      { label: 'Block sender', icon: 'ban', danger: true, onClick: () => Safety.block(m.senderId, { anonymous: true, onDone: () => { Nav.back(); } }) },
    ], { title: 'Your report stays private. The sender\'s identity stays hidden.' });
  };

  /* Demo helper: receive a new anonymous secret message. */
  NX.simulateSecret = () => {
    const used = S.secretInbox.map(m => m.senderId);
    const pool = S.users.filter(u => !used.includes(u.id) && !(S.blockedAnon || []).includes(u.id));
    const sender = pool[Math.floor(Math.random() * pool.length)] || S.users[0];
    const tpl = NX.secretPool[S.secretInbox.length % NX.secretPool.length];
    const item = { id: uid('sm'), senderId: sender.id, createdAt: Date.now(), repliesUsed: 0, revealed: false, chatId: null, messages: [{ from: 'them', text: tpl.text, time: Date.now() }], script: tpl.script };
    S.secretInbox.unshift(item);
    const n = NX.notify({ type: 'secret', text: NOTICE, target: { screen: 'secretThread', params: { id: item.id } } });
    NX.save();
    App.incoming(n);
    return item;
  };
})();
