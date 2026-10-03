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

  /* ---------- Secret tab ---------- */
  Screens.secret = {
    tab: 'secret', title: 'Premium',
    render: (p) => {
      if (p.tab) { App.secretTab = p.tab; p.tab = null; }
      const t = App.secretTab;
      const unread = inbox().filter(m => !m.revealed && m.messages[m.messages.length - 1].from === 'them').length;
      return `
        <header class="appbar appbar-secret">
          <div class="appbar-title"><h1>${Icon('crown', 20)} Premium</h1></div>
          <div class="appbar-actions">
            <button class="icon-btn" data-action="secretHowItWorks" aria-label="How it works">${Icon('help', 23)}</button>
          </div>
        </header>
        <div class="page page-secret">
          <section class="secret-hero">
            <div class="stars" aria-hidden="true"></div>
            <div class="sh-row">
              <div>
                <p class="eyebrow">${Icon('mask', 15)} Your secret side</p>
                <h2>Say it without saying who.</h2>
              </div>
              <span class="sh-seal" aria-hidden="true">💌</span>
            </div>
            <div class="secret-tabs" role="tablist" aria-label="Secret sections">
              <button role="tab" class="${t === 'messages' ? 'active' : ''}" aria-selected="${t === 'messages'}" data-action="secretTab" data-tab="messages"><span aria-hidden="true">💌</span> Messages ${unread ? `<span class="count">${unread}</span>` : ''}</button>
              <button role="tab" class="${t === 'crush' ? 'active' : ''}" aria-selected="${t === 'crush'}" data-action="secretTab" data-tab="crush"><span aria-hidden="true">💘</span> Secret Crush</button>
            </div>
          </section>
          <div class="tab-anim" role="tabpanel">${t === 'messages' ? messagesTab() : Crush.renderTab()}</div>
        </div>`;
    },
    mount() {
      const n = S.notifications.filter(x => !x.read && (App.secretTab === 'messages' ? x.type === 'secret' && !x.target.params.role : x.type === 'crush'));
      if (n.length && (App.secretTab === 'crush' || NX.canReadSecret())) { n.forEach(x => { x.read = true; }); NX.save(); App.renderChrome(); }
    }
  };
  Actions.secretTab = (el) => { App.secretTab = el.dataset.tab; App.refresh(); };
  Actions.secretSub = (el) => { App.secretSub = el.dataset.sub; App.refresh(); };

  function messagesTab() {
    const sub = App.secretSub;
    const rec = inbox();
    return `
      <div class="sm-switch" role="tablist" aria-label="Secret messages">
        <button role="tab" class="${sub === 'received' ? 'active' : ''}" aria-selected="${sub === 'received'}" data-action="secretSub" data-sub="received">${Icon('inbox', 17)} Received${rec.length ? `<span>${rec.length}</span>` : ''}</button>
        <button role="tab" class="${sub === 'sent' ? 'active' : ''}" aria-selected="${sub === 'sent'}" data-action="secretSub" data-sub="sent">${Icon('send', 16)} Sent${S.secretSent.length ? `<span>${S.secretSent.length}</span>` : ''}</button>
      </div>
      ${sub === 'received' ? receivedList(rec) : sentList()}`;
  }

  /* Two-step reveal track used by cards and threads. */
  const steps = (n) => `<span class="sm-steps" aria-hidden="true"><i class="${n >= 1 ? 'on' : ''}"></i><i class="${n >= 2 ? 'on' : ''}"></i></span>`;

  function receivedList(list) {
    if (!list.length) return emptyState({
      emoji: '💌', title: 'No secret messages yet', cls: 'empty-secret',
      text: 'When someone sends you a Secret Message it lands here, sealed. Reply twice to unseal who sent it and what they wrote.',
      actions: '<button class="btn btn-secret" data-action="sendSecretFromTab">Send a Secret Message</button>'
    });
    const hidden = list.filter(m => !m.revealed);
    const canRead = NX.canReadSecret();
    return `
      ${!canRead && hidden.length ? `
        <div class="locked-banner">
          <div class="lb-ic">${Icon('lock', 22)}</div>
          <h3>You have ${hidden.length} sealed message${hidden.length > 1 ? 's' : ''}</h3>
          <p>Someone has something to tell you. Upgrade to reply — the name and message unseal after your 2nd reply.</p>
          <button class="btn btn-light btn-block" data-go="plans" data-params='{"reason":"secret-read"}'>Unlock Secret Messages</button>
        </div>` : `<p class="privacy-line">${Icon('shieldCheck', 15)} Name and message stay sealed until you reply twice.</p>`}
      <div class="sm-list">
        ${list.map(m => m.revealed ? revealedCard(m) : sealedCard(m, !canRead)).join('')}
      </div>`;
  }

  const sealedCard = (m, locked) => {
    const used = m.repliesUsed;
    const fresh = !locked && m.messages[m.messages.length - 1].from === 'them';
    const status = locked ? 'Upgrade to reply and unseal'
      : used === 0 ? 'Sealed · reply twice to unseal'
      : 'One more reply unseals it ✨';
    const go = locked ? `data-go="plans" data-params='{"reason":"secret-read"}'` : `data-go="secretThread" data-params='{"id":"${m.id}"}'`;
    return `
      <button class="sm-card${locked ? ' locked' : ''}${fresh ? ' fresh' : ''}" ${go} aria-label="Sealed secret message. ${status}">
        <span class="sm-env" aria-hidden="true"><span class="sm-flap"></span><span class="sm-wax">${locked ? Icon('lock', 15) : Icon('mask', 16)}</span></span>
        <span class="sm-body">
          <b>Someone sent you a secret message</b>
          <span class="sm-status">${status}</span>
          ${locked ? '' : steps(used)}
        </span>
        <span class="sm-side"><span class="sm-day">${dayLabel(m.createdAt)}</span>${fresh ? '<span class="sm-new">New</span>' : ''}</span>
      </button>`;
  };

  const revealedCard = (m) => {
    const u = NX.user(m.senderId);
    const near = NX.nearbyState(m.senderId);
    return `
      <button class="sm-card revealed" data-go="chat" data-params='{"id":"${m.chatId}"}'>
        ${avatar(u, 50)}
        <span class="sm-body">
          <b>${esc(u.name)}</b>
          <span class="sm-status">${near === 'on' ? `<span class="sm-near-inline">${NX.nearText(m.senderId)} 💫</span>` : 'Unsealed · now a chat'}</span>
        </span>
        <span class="sm-side"><span class="chip chip-ok">${Icon('check', 12)} Revealed</span></span>
      </button>`;
  };

  function usageMeter() {
    const l = NX.limitOf('secretMessages');
    if (l < 0) return `<div class="usage">${Icon('crown', 16)}<span><b>Unlimited</b> Secret Messages with Premium</span></div>`;
    const used = Math.min(S.usage.secretSent, l);
    return `<div class="usage"><div class="usage-top"><span><b>${Math.max(0, l - used)} of ${l}</b> Secret Messages left this month</span>${NX.secretLeft() === 0 ? '<button class="link" data-go="plans" data-params=\'{"reason":"limit"}\'>Get more</button>' : ''}</div><div class="meter"><i style="width:${(used / l) * 100}%"></i></div></div>`;
  }

  function sentList() {
    const paid = NX.isPaid();
    const list = [...S.secretSent].sort((a, b) => b.createdAt - a.createdAt);
    const head = paid ? usageMeter() : `
      <div class="upsell-card">
        <span class="upsell-emoji">💌</span>
        <div><b>Send your first Secret Message</b><p>Say what you've been holding back. You stay anonymous until they reply twice.</p></div>
        <button class="btn btn-primary btn-sm" data-go="plans" data-params='{"reason":"secret-send"}'>See plans</button>
      </div>`;
    if (!list.length) return head + emptyState({
      emoji: '🤫', title: 'Nothing sent yet', cls: 'empty-secret',
      text: 'Find someone, open their profile and tap <b>Send Secret Message</b>.',
      actions: '<button class="btn btn-secret" data-action="sendSecretFromTab">Send a Secret Message</button>'
    });
    return head + `
      <div class="sm-list">${list.map(m => {
        const u = NX.user(m.toId);
        return `<button class="sm-card sent" data-go="${m.revealed ? 'chat' : 'secretThread'}" data-params='${m.revealed ? `{"id":"${m.chatId}"}` : `{"id":"${m.id}","role":"sent"}`}'>
            ${avatar(u, 50)}
            <span class="sm-body">
              <b>To ${esc(u.name)}</b>
              <span class="sm-status">${m.revealed ? 'They replied twice · you\'re revealed' : m.repliesReceived ? `${m.repliesReceived} of 2 replies · you're still hidden` : 'Delivered · you\'re hidden'}</span>
              ${m.revealed ? '' : steps(m.repliesReceived)}
            </span>
            <span class="sm-side"><span class="sm-day">${dayLabel(m.createdAt)}</span>${m.revealed ? `<span class="chip chip-ok">${Icon('check', 12)} Chat</span>` : ''}</span>
          </button>`;
      }).join('')}</div>
      <button class="btn btn-secret btn-block mt" data-action="sendSecretFromTab">${Icon('send', 18)} Send another Secret Message</button>`;
  }

  Actions.sendSecretFromTab = () => {
    if (!NX.isPaid() || NX.limitOf('secretMessages') === 0) return Nav.go('plans', { reason: 'secret-send' });
    Nav.go('search', { intent: 'secret' });
  };

  Actions.secretHowItWorks = () => Modal.open({
    title: 'How Secret works', cls: 'sheet-tall',
    body: `
      <div class="how">
        <div class="how-block"><span class="how-emoji">💌</span><div><h3>Secret Messages</h3>
          <ol><li>Send a message to anyone. They're told <b>"Someone sent you a secret message 💌"</b>.</li><li>The sender's <b>name and message stay sealed</b> — blurred — while they reply.</li><li>After their <b>2nd reply</b>, the name, photo and full message unseal together and it becomes a normal chat.</li></ol></div></div>
        <div class="how-block"><span class="how-emoji">💘</span><div><h3>Secret Crush</h3>
          <ol><li>Add people to your private crush list.</li><li>They're told <b>"Someone added you as a secret crush 👀"</b> — never who.</li><li>If they add you too: <b>"Congratulations! It's a match 💘"</b> and a chat opens.</li><li>No match? Nobody ever finds out.</li></ol></div></div>
        <div class="how-block"><span class="how-emoji">💫</span><div><h3>Nearby, privately</h3>
          <p>If you both turn on Nearby, you may see one line under their name — <b>"Was near you today 💫"</b>, "yesterday" or "3 days ago", whichever is latest. Never a place, map, distance, time or history.</p></div></div>
        <p class="how-plans">Replying to Secret Messages, sending them and adding crushes need <b>Plus</b> or <b>Premium</b>.</p>
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
        <div class="confirm-ic premium">${Icon('crown', 26)}</div>
        <h2>You've used all ${l} ${kind === 'secret' ? 'Secret Messages this month' : 'Secret Crush spots'}</h2>
        <p>${S.me.plan === 'premium' ? 'You\'re on our top plan. Spots free up when you remove someone or next month.' : `Go Premium for ${kind === 'secret' ? 'unlimited Secret Messages' : `up to ${premiumCrush < 0 ? 'unlimited' : premiumCrush} Secret Crushes`} — ${inr(S.plans.premium.price)}/month.`}</p>
        <div class="confirm-actions">
          ${S.me.plan === 'premium' ? '' : `<button class="btn btn-premium btn-block" data-go="plans" data-params='{"reason":"limit"}'>Upgrade to Premium</button>`}
          <button class="btn btn-ghost btn-block" data-close>${S.me.plan === 'premium' ? 'OK' : 'Not now'}</button>
        </div></div>`
    });
  };

  const PROMPTS = ['I\'ve always wanted to tell you…', 'You made my day when…', 'Honestly, I admire how you…', 'Can I be honest? 🙈'];

  Screens.secretCompose = {
    chrome: 'none', title: 'Secret Message', dark: true,
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
              <li><span>1</span><p>${esc(u.name.split(' ')[0])} gets <b>"Someone sent you a secret message 💌"</b>.</p></li>
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
    chrome: 'none', title: 'Sent', dark: true,
    render: (p) => {
      const m = S.secretSent.find(x => x.id === p.id);
      const u = m && NX.user(m.toId);
      return `
        <div class="done-screen secret-done">
          <div class="stars" aria-hidden="true"></div>
          <div class="envelope" aria-hidden="true"><span class="env-back"></span><span class="env-letter">💌</span><span class="env-front"></span></div>
          <h1>Sealed &amp; sent</h1>
          <p>${u ? esc(u.name.split(' ')[0]) : 'They'} will see <i>"Someone sent you a secret message 💌"</i>. Your name and message stay sealed until they reply twice.</p>
          <div class="done-actions">
            <button class="btn btn-light btn-lg btn-block" data-go="secretThread" data-params='{"id":"${p.id}","role":"sent"}' data-replace>View conversation</button>
            <button class="btn btn-ghost-light btn-lg btn-block" data-action="back">Done</button>
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
        n = NX.notify({ type: 'secret', text: `Your secret message to <b>${esc(u.username)}</b> got a reply 💌 (1 of 2)`, target: { screen: 'secretThread', params: { id: m.id, role: 'sent' } } });
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
    if (state === 'on') return `<small class="sm-near">${NX.nearText(userId)} 💫</small>`;
    if (state === 'locked') return `<button class="sm-near locked" data-go="plans" data-params='{"reason":"nearby"}' aria-label="Nearby indicator locked. Upgrade to see.">${Icon('lock', 11)}<span class="blur-text">Was near you recently</span> 💫</button>`;
    return `<small class="sm-sub">${Icon('lock', 11)} Name sealed until the reveal</small>`;
  };

  Screens.secretThread = {
    chrome: 'none', title: 'Secret conversation', dark: true,
    render: (p) => (p.role === 'sent' ? sentThread(p) : receivedThread(p)),
    mount() { const end = $('#threadEnd'); end && end.scrollIntoView({ block: 'end' }); }
  };

  function receivedThread(p) {
    const m = S.secretInbox.find(x => x.id === p.id);
    if (!m || (S.blockedAnon || []).includes(m.senderId)) return `${appbar({ title: 'Secret Message', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ icon: 'mail', title: 'Message unavailable', text: 'This secret message is no longer available.' })}</div>`;
    if (m.revealed) return `${appbar({ title: 'Unsealed', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ emoji: '✨', title: 'This secret was unsealed', text: 'Your conversation continues as a regular chat.', actions: `<button class="btn btn-light" data-go="chat" data-params='{"id":"${m.chatId}"}' data-replace>Open chat</button>` })}</div>`;
    const near = NX.nearbyState(m.senderId);
    const canRead = NX.canReadSecret();
    const used = m.repliesUsed;
    const head = `
      <header class="appbar sm-head">
        <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
        <div class="sm-who">
          <span class="sm-mask" aria-hidden="true">${Icon('mask', 22)}</span>
          <div class="sm-who-text">
            <span class="sealed-name" role="img" aria-label="Sender's name is sealed"><i></i><i></i></span>
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
            <div class="sm-bigwax" aria-hidden="true">${Icon('lock', 28)}</div>
            <h2>Someone has something to tell you 💌</h2>
            <p>Upgrade to reply. After your 2nd reply, their name, photo and message unseal together.</p>
            <button class="btn btn-light btn-block" data-go="plans" data-params='{"reason":"secret-read"}'>Unlock Secret Messages</button>
          </section>
          <div class="day-divider"><span>${dayLabel(m.createdAt)}</span></div>
          <div class="messages">${sealedBubble(0)}</div>
          <div id="threadEnd"></div>
        </div>`;
    }
    return `${head}
      <div class="page sm-thread">
        <section class="sm-sealbox">
          <div class="sm-bigwax${used === 1 ? ' cracking' : ''}" aria-hidden="true">💌</div>
          <h2>${used === 0 ? 'This message is sealed' : used === 1 ? 'One more reply to unseal' : 'Unsealing…'}</h2>
          <p>${used === 0 ? 'Reply twice and the sender\'s name, photo and message are revealed together.' : 'Your next reply reveals who sent this — and what they wrote.'}</p>
          <div class="sm-track" aria-label="Reveal progress: ${used} of 2 replies">
            <span class="${used >= 1 ? 'on' : ''}"><b>${used >= 1 ? Icon('check', 13) : '1'}</b>Reply</span><i class="${used >= 1 ? 'on' : ''}"></i>
            <span class="${used >= 2 ? 'on' : ''}"><b>${used >= 2 ? Icon('check', 13) : '2'}</b>Reply</span><i></i>
            <span class="end"><b>✨</b>Reveal</span>
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
        <p class="sm-hint${used >= 1 ? ' last' : ''}">${used >= 2 ? '✨ Unsealing their name &amp; message…' : used === 1 ? '✨ Reply 2 of 2 — this unseals their name &amp; message' : 'Reply 1 of 2 · everything stays sealed until your 2nd reply'}</p>
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
    if (m.revealed) return `${appbar({ title: 'Revealed', cls: 'sm-head' })}<div class="page sm-thread">${emptyState({ emoji: '✨', title: 'You\'ve been revealed', text: 'They replied twice, so your conversation is now a regular chat.', actions: `<button class="btn btn-light" data-go="chat" data-params='{"id":"${m.chatId}"}' data-replace>Open chat</button>` })}</div>`;
    const u = NX.user(m.toId);
    const r = m.repliesReceived;
    return `
      <header class="appbar sm-head">
        <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
        <button class="sm-who" data-go="user" data-id="${u.id}">${avatar(u, 40)}<div class="sm-who-text"><b>${esc(u.name)}</b><small class="sm-sub">${Icon('mask', 11)} You're "Someone" to them</small></div></button>
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
            <span class="end"><b>✨</b>Reveal</span>
          </div>
        </section>
        <div class="day-divider"><span>${dayLabel(m.createdAt)}</span></div>
        <div class="messages">${m.messages.map(x => bubble(x)).join('')}</div>
        <div id="threadEnd"></div>
      </div>
      <form class="composer composer-fixed sm-composer" data-form="secretFollowUp" data-id="${m.id}">
        <div class="composer-row">
          <input class="input" id="secretFollowInput" name="text" placeholder="Add to your message (still anonymous)…" autocomplete="off" maxlength="500" aria-label="Write a message">
          <button class="send-btn" type="submit" aria-label="Send">${Icon('send', 20)}</button>
        </div>
      </form>`;
  }

  Forms.secretFollowUp = (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    const m = S.secretSent.find(x => x.id === form.dataset.id);
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
          <p class="reveal-sub">@${esc(u.username)}${near === 'on' ? ` · <span class="reveal-near">${NX.nearText(u.id)} 💫</span>` : ''}</p>
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
    const n = NX.notify({ type: 'secret', text: 'Someone sent you a secret message 💌', target: { screen: 'secretThread', params: { id: item.id } } });
    NX.save();
    App.incoming(n);
    return item;
  };
})();
