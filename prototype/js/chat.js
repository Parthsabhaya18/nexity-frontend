/* One-to-one chat: inbox, thread, typing indicator, seen status, image attachments, simulated replies. */
(function () {
  const { MIN, HOUR, DAY } = NX.T;
  let chatQ = '';

  App.ensureChat = (userId) => {
    let c = S.chats.find(x => x.userId === userId);
    if (!c) { c = { id: uid('c'), userId, kind: 'normal', unread: 0, messages: [] }; S.chats.unshift(c); }
    return c;
  };

  const lastMsg = (c) => c.messages[c.messages.length - 1];
  const statusText = (u) => u.online ? 'Active now' : `Active ${timeAgo(Date.now() - (u.lastSeen || HOUR))} ago`;
  const kindTag = (c) => c.kind === 'match' ? '<span class="kind-tag match">💘 Match</span>' : c.kind === 'revealed' ? '<span class="kind-tag revealed">💌 Revealed</span>' : '';

  Screens.chats = {
    tab: 'chats', title: 'Chats',
    render: () => {
      const list = S.chats.filter(c => !NX.isBlocked(c.userId) && (c.messages.length || c.kind !== 'normal'))
        .sort((a, b) => ((lastMsg(b) || {}).time || 0) - ((lastMsg(a) || {}).time || 0));
      const v = chatQ.trim().toLowerCase();
      const shown = v ? list.filter(c => { const u = NX.user(c.userId); return u.name.toLowerCase().includes(v) || u.username.includes(v); }) : list;
      const matches = S.matches.filter(m => !NX.isBlocked(m.userId));
      const online = S.users.filter(u => u.online && NX.isFollowing(u.id) && !NX.isBlocked(u.id));
      return `
        <header class="appbar">
          <div class="appbar-title"><h1>Chats</h1></div>
          <div class="appbar-actions"><button class="icon-btn" data-action="newChat" aria-label="New message">${Icon('edit', 23)}</button></div>
        </header>
        <div class="page">
          <div class="search-box static">${Icon('search', 18)}<input id="chatSearch" type="search" placeholder="Search chats" value="${esc(chatQ)}" data-input="chatSearch" aria-label="Search chats"></div>
          ${!v && (matches.length || online.length) ? `
            <div class="active-row" aria-label="Matches and active friends">
              ${matches.map(m => { const u = NX.user(m.userId); return `<button class="active-item" data-go="chat" data-params='{"id":"${m.chatId}"}'><span class="match-ring">${avatar(u, 58, { online: u.online })}</span><span>${esc(u.name.split(' ')[0])}</span><small>💘 Match</small></button>`; }).join('')}
              ${online.map(u => `<button class="active-item" data-action="messageUser" data-id="${u.id}">${avatar(u, 58, { online: true })}<span>${esc(u.name.split(' ')[0])}</span><small>Active</small></button>`).join('')}
            </div>` : ''}
          ${shown.length ? `<div class="chat-list">${shown.map(c => {
            const u = NX.user(c.userId), m = lastMsg(c);
            const preview = !m ? 'Say hi 👋' : m.from === 'system' ? m.text : (m.from === 'me' ? 'You: ' : '') + (m.image ? '📷 Photo' : m.text);
            return `<button class="chat-row ${c.unread ? 'unread' : ''}" data-go="chat" data-params='{"id":"${c.id}"}'>
              ${avatar(u, 54, { online: u.online })}
              <span class="chat-row-text"><span class="cr-top"><b>${esc(u.name)}</b>${kindTag(c)}</span><span class="cr-prev">${esc(preview)}</span></span>
              <span class="chat-row-meta">${m ? `<small>${timeAgo(m.time)}</small>` : ''}${c.unread ? `<span class="badge-count">${c.unread}</span>` : ''}</span>
            </button>`;
          }).join('')}</div>` : v ? emptyState({ icon: 'search', title: 'No chats found', text: `No conversations match "${esc(chatQ)}".` })
            : emptyState({ icon: 'chat', title: 'No messages yet', text: 'Start a conversation with someone you follow, or match with a Secret Crush.', actions: '<button class="btn btn-primary" data-action="newChat">New message</button>' })}
        </div>`;
    }
  };
  Inputs.chatSearch = (el) => { chatQ = el.value; App.refresh(); };

  Actions.newChat = () => {
    const people = S.users.filter(u => !NX.isBlocked(u.id));
    Modal.open({
      title: 'New message', cls: 'sheet-tall',
      body: `<div class="list">${people.map(u => `<div class="user-row"><button class="user-row-main" data-action="startChatWith" data-id="${u.id}">${avatar(u, 44, { online: u.online })}<span class="user-row-text"><b>${esc(u.username)}</b><small>${esc(u.name)}</small></span></button></div>`).join('')}</div>`
    });
  };
  Actions.startChatWith = (el) => {
    Modal.closeAll();
    const c = App.ensureChat(el.dataset.id);
    NX.save();
    Nav.go('chat', { id: c.id });
  };

  /* ---------- Thread ---------- */
  function msgHtml(m, i, arr, u) {
    if (m.from === 'system') return `<div class="sys-msg">${esc(m.text)}</div>`;
    const mine = m.from === 'me';
    const next = arr[i + 1];
    const tail = !next || next.from !== m.from;
    let content;
    if (m.image) content = `<div class="bubble img-bubble"><img src="${esc(m.image)}" alt="Photo" loading="lazy" onerror="this.remove()">${m.text ? `<span>${esc(m.text)}</span>` : ''}</div>`;
    else if (m.share) {
      const item = NX.findContent(m.share.id, m.share.kind);
      content = item ? `<button class="bubble share-bubble" ${m.share.kind === 'reel' ? `data-action="openReel" data-id="${item.id}"` : `data-go="post" data-id="${item.id}"`}><img src="${esc(item.img || item.src)}" alt="" onerror="this.remove()"><span>${esc(m.text)}</span></button>` : `<div class="bubble">${esc(m.text)}</div>`;
    } else content = `<div class="bubble">${esc(m.text)}</div>`;
    return `<div class="msg ${mine ? 'out' : 'in'} ${tail ? 'tail' : ''}">${!mine ? (tail ? avatar(u, 28, { cls: 'msg-av' }) : '<span class="msg-av-space"></span>') : ''}${content}</div>`;
  }

  function dayDividers(msgs, u) {
    let out = '', lastDay = '';
    msgs.forEach((m, i) => {
      const d = new Date(m.time).toDateString();
      if (d !== lastDay) { lastDay = d; out += `<div class="day-divider"><span>${NX.dayLabel(m.time)}${m.from !== 'system' ? ' · ' + clock(m.time) : ''}</span></div>`; }
      out += msgHtml(m, i, msgs, u);
    });
    return out;
  }

  Screens.chat = {
    chrome: 'none', title: (p) => { const c = S.chats.find(x => x.id === p.id); return c ? NX.user(c.userId).name : 'Chat'; },
    render: (p) => {
      const c = S.chats.find(x => x.id === p.id);
      if (!c) return `${appbar({ title: 'Chat' })}<div class="page">${emptyState({ icon: 'chat', title: 'Conversation not found' })}</div>`;
      const u = NX.user(c.userId);
      const blocked = NX.isBlocked(u.id);
      const lastMine = [...c.messages].reverse().find(m => m.from === 'me');
      const lastAny = lastMsg(c);
      const near = c.kind !== 'normal' ? NX.nearbyState(u.id) : null;
      return `
        <header class="appbar thread-head">
          <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
          <button class="th-user" data-go="user" data-id="${u.id}">${avatar(u, 40, { online: u.online })}<div><b>${esc(u.name)}</b>${near === 'on' ? nearLineFor(u.id) : `<small class="${u.online ? 'online' : ''}">${statusText(u)}</small>`}</div></button>
          <div class="appbar-actions"><button class="icon-btn" data-action="chatMenu" data-id="${c.id}" aria-label="Chat options">${Icon('moreV', 22)}</button></div>
        </header>
        <div class="page thread">
          <div class="thread-intro">
            ${avatar(u, 76)}
            <h2>${esc(u.name)}</h2><p>@${esc(u.username)} · ${fmtNum(u.followers)} followers</p>
            ${c.kind === 'match' ? '<span class="kind-banner match">💘 You matched via Secret Crush</span>' : c.kind === 'revealed' ? '<span class="kind-banner revealed">💌 This chat started as a Secret Message</span>' : ''}
            ${near === 'locked' ? nearChipFor(u.id) : ''}
            <button class="btn btn-sm btn-secondary" data-go="user" data-id="${u.id}">View profile</button>
          </div>
          <div class="messages" id="msgs">
            ${dayDividers(c.messages, u)}
            ${lastAny && lastMine && lastAny === lastMine ? `<p class="seen-line">${lastMine.seen ? `${Icon('checks', 14)} Seen` : `${Icon('check', 14)} Delivered`}</p>` : ''}
            <div class="msg in typing-row" id="typingRow" hidden>${avatar(u, 28, { cls: 'msg-av' })}<div class="bubble typing" aria-label="${esc(u.name)} is typing"><i></i><i></i><i></i></div></div>
          </div>
          <div id="threadEnd"></div>
        </div>
        ${blocked ? `<div class="composer composer-fixed blocked-bar">You blocked this account. <button class="link strong" data-action="unblock" data-id="${u.id}">Unblock</button></div>` : `
        <form class="composer composer-fixed" data-form="sendChat" data-id="${c.id}">
          <div class="composer-row">
            <button type="button" class="icon-btn attach" data-action="attachImage" data-id="${c.id}" aria-label="Attach photo">${Icon('image', 22)}</button>
            <input class="input" id="chatInput" name="text" placeholder="Message…" autocomplete="off" maxlength="1000" aria-label="Message">
            <button class="send-btn" type="submit" aria-label="Send">${Icon('send', 20)}</button>
          </div>
        </form>`}`;
    },
    mount(el, p) {
      const c = S.chats.find(x => x.id === p.id);
      if (!c) return;
      let changed = false;
      if (c.unread) { c.unread = 0; changed = true; }
      c.messages.forEach(m => { if (m.from === 'them' && !m.seen) { m.seen = true; changed = true; } });
      S.notifications.forEach(n => { if (!n.read && n.target && n.target.screen === 'chat' && n.target.params.id === c.id) { n.read = true; changed = true; } });
      if (changed) { NX.save(); App.renderChrome(); }
      const end = $('#threadEnd'); end && end.scrollIntoView({ block: 'end' });
      if (App.focusComposer) { App.focusComposer = false; const i = $('#chatInput'); if (i) { i.value = 'Hey! 👋 '; i.focus(); } }
    }
  };

  function scheduleReply(c) {
    const u = NX.user(c.userId);
    if (NX.isBlocked(u.id)) return;
    clearTimeout(c._t1); clearTimeout(c._t2);
    const seenDelay = u.online ? 900 : 2500;
    setTimeout(() => {
      c.messages.forEach(m => { if (m.from === 'me') m.seen = true; });
      NX.save();
      if (Nav.is('chat') && Nav.cur().params.id === c.id) App.refresh();
      if (!u.online) return;
      setTimeout(() => {
        const tr = $('#typingRow');
        if (tr && Nav.cur().params.id === c.id) { tr.hidden = false; $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' }); }
        setTimeout(() => {
          const text = NX.chatReplies[Math.floor(Math.random() * NX.chatReplies.length)];
          c.messages.push({ id: uid('m'), from: 'them', text, time: Date.now(), seen: false });
          const here = Nav.is('chat') && Nav.cur().params.id === c.id;
          if (here) c.messages[c.messages.length - 1].seen = true; else c.unread = (c.unread || 0) + 1;
          NX.save();
          if (here) { App.refresh(); $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' }); }
          else { const n = NX.notify({ type: 'chat', userId: u.id, text: 'You have a new message 💬', target: { screen: 'chat', params: { id: c.id } } }); NX.save(); App.incoming(n); }
        }, 1800);
      }, 600);
    }, seenDelay);
  }

  Forms.sendChat = (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    const c = S.chats.find(x => x.id === form.dataset.id);
    c.messages.push({ id: uid('m'), from: 'me', text, time: Date.now(), seen: false });
    form.text.value = '';
    NX.save();
    App.refresh();
    $('#chatInput') && $('#chatInput').focus();
    $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' });
    scheduleReply(c);
  };

  Actions.attachImage = (el) => {
    const id = el.dataset.id;
    Modal.open({
      title: 'Send a photo',
      body: `
        <label class="upload-drop">${Icon('upload', 24)}<b>Upload from device</b><span>JPG or PNG</span><input type="file" accept="image/*" data-change="chatUpload" data-id="${id}" hidden></label>
        <div class="section-head"><h2>Recent</h2></div>
        <div class="gallery small">${NX.galleryIds.slice(0, 8).map(g => `<button class="gallery-item" data-action="chatPick" data-id="${id}" data-src="${NX.img.pic(g, 600, 600)}" aria-label="Send photo"><img src="${NX.img.pic(g, 200, 200)}" alt="" loading="lazy" onerror="this.remove()"></button>`).join('')}</div>`
    });
  };
  function sendImage(id, src) {
    const c = S.chats.find(x => x.id === id);
    c.messages.push({ id: uid('m'), from: 'me', text: '', image: src, time: Date.now(), seen: false });
    NX.save();
    Modal.closeAll();
    App.refresh();
    setTimeout(() => $('#threadEnd') && $('#threadEnd').scrollIntoView({ block: 'end', behavior: 'smooth' }), 50);
    scheduleReply(c);
  }
  Actions.chatPick = (el) => sendImage(el.dataset.id, el.dataset.src);
  Inputs.chatUpload = async (el) => {
    try { sendImage(el.dataset.id, await readImage(el.files[0], 700)); }
    catch (e) { Toast.show(e.message, { type: 'error' }); }
  };

  Actions.chatMenu = (el) => {
    const c = S.chats.find(x => x.id === el.dataset.id);
    const u = NX.user(c.userId);
    Modal.menu([
      { label: 'View profile', icon: 'user', onClick: () => Nav.go('user', { id: u.id }) },
      { label: 'Report', icon: 'flag', danger: true, onClick: () => Safety.report({ userId: u.id, content: 'Chat', preview: 'Chat conversation' }) },
      NX.isBlocked(u.id) ? { label: 'Unblock', icon: 'ban', onClick: () => Actions.unblock({ dataset: { id: u.id } }) }
        : { label: `Block ${u.username}`, icon: 'ban', danger: true, onClick: () => Safety.block(u.id) },
      { label: 'Delete chat', icon: 'trash', danger: true, onClick: async () => {
        if (await Modal.confirm({ title: 'Delete this chat?', message: 'Messages will be removed from your inbox only.', confirm: 'Delete', danger: true, icon: 'trash' })) {
          S.chats = S.chats.filter(x => x.id !== c.id);
          S.matches.forEach(m => { if (m.chatId === c.id) m.chatId = null; });
          NX.save(); Nav.back(); Toast.show('Chat deleted');
        }
      } },
    ], { title: u.name });
  };
})();
