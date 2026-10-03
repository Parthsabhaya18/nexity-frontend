/* Notification center with categories, unread state and routing to the right destination. */
(function () {
  const { DAY } = NX.T;
  App.notifFilter = App.notifFilter || 'all';
  const CATS = [
    ['all', 'All'], ['chat', 'Chat'], ['like', 'Likes'], ['secret', 'Secret Message'], ['crush', 'Secret Crush'], ['match', 'Match'], ['subscription', 'Subscription'],
  ];
  const ICONS = {
    secret: { emoji: '💌', cls: 'n-secret' }, crush: { emoji: '👀', cls: 'n-crush' }, match: { emoji: '💘', cls: 'n-match' },
    subscription: { icon: 'sparkles', cls: 'n-sub' }, like: { icon: 'heart', cls: 'n-like' }, chat: { icon: 'chat', cls: 'n-chat' },
  };

  /* Anonymous categories never show an avatar, even when the sender is known internally. */
  function leading(n) {
    const anon = (n.type === 'secret' && !n.userId) || n.type === 'crush';
    const ic = ICONS[n.type] || ICONS.subscription;
    if (!anon && n.userId && NX.user(n.userId)) return `<span class="n-lead">${avatar(NX.user(n.userId), 46)}<span class="n-type ${ic.cls}">${ic.emoji || Icon(ic.icon, 11)}</span></span>`;
    return `<span class="n-lead n-badge ${ic.cls}">${ic.emoji ? `<span>${ic.emoji}</span>` : Icon(ic.icon, 20)}</span>`;
  }

  function item(n) {
    const locked = n.type === 'secret' && n.target && n.target.screen === 'secretThread' && !(n.target.params || {}).role && !NX.canReadSecret();
    return `
      <button class="notif ${n.read ? '' : 'unread'}" data-action="openNotif" data-id="${n.id}">
        ${leading(n)}
        <span class="n-body"><span class="n-text">${n.text}</span><small>${timeAgoLong(n.time)}${locked ? ` · <span class="n-lock">${Icon('lock', 11)} Unlock to read</span>` : ''}</small></span>
        ${n.read ? '' : '<span class="unread-dot" aria-label="Unread"></span>'}
      </button>`;
  }

  Screens.notifications = {
    title: 'Notifications',
    render: () => {
      const f = App.notifFilter;
      const list = S.notifications.filter(n => f === 'all' || n.type === f || (f === 'like' && n.type === 'comment'))
        .filter(n => !(n.userId && NX.isBlocked(n.userId) && n.type !== 'secret' && n.type !== 'crush'));
      const today = list.filter(n => Date.now() - n.time < DAY), earlier = list.filter(n => Date.now() - n.time >= DAY);
      const unread = NX.unreadNotifications();
      const label = (CATS.find(c => c[0] === f) || [])[1];
      return `
        ${appbar({ title: 'Notifications', actions: unread ? `<button class="btn btn-sm btn-ghost" data-action="markAllRead">Mark all read</button>` : '' })}
        <div class="page">
          <div class="filter-chips" role="tablist" aria-label="Filter notifications">
            ${CATS.map(([k, l]) => { const c = k === 'all' ? unread : S.notifications.filter(n => !n.read && n.type === k).length; return `<button role="tab" class="chip ${f === k ? 'active' : ''}" aria-selected="${f === k}" data-action="notifFilter" data-f="${k}">${l}${c ? ` <span class="chip-count">${c}</span>` : ''}</button>`; }).join('')}
          </div>
          ${!list.length ? emptyState({ icon: 'bell', title: f === 'all' ? 'No notifications yet' : `No ${label} notifications`, text: 'When something happens, you\'ll see it here.' }) : `
            ${today.length ? `<h2 class="group-title">Today</h2><div class="notif-list">${today.map(item).join('')}</div>` : ''}
            ${earlier.length ? `<h2 class="group-title">Earlier</h2><div class="notif-list">${earlier.map(item).join('')}</div>` : ''}`}
        </div>`;
    }
  };
  Actions.notifFilter = (el) => { App.notifFilter = el.dataset.f; App.refresh(); };
  Actions.markAllRead = () => { S.notifications.forEach(n => { n.read = true; }); commit(); Toast.show('All caught up ✓'); };
  Actions.openNotif = (el) => App.openNotification(el.dataset.id);

  App.openNotification = (id) => {
    const n = S.notifications.find(x => x.id === id);
    if (!n) return;
    n.read = true;
    NX.save();
    Modal.closeAll();
    const t = n.target || {};
    const p = t.params || {};
    if (t.screen === 'secretThread' && !p.role) {
      if (!NX.canReadSecret()) return Nav.go('plans', { reason: 'secret-read' });
      const m = S.secretInbox.find(x => x.id === p.id);
      if (m && m.revealed) return Nav.go('chat', { id: m.chatId });
      return Nav.go('secretThread', p);
    }
    if (t.screen === 'secret') return Nav.tab('secret', p);
    if (t.screen === 'chat' && !S.chats.find(c => c.id === p.id)) return Nav.tab('chats');
    if (t.screen && Screens[t.screen]) return Nav.go(t.screen, p);
    App.refresh();
  };
})();
