/* Secret Crush: private crush list, anonymous "someone added you" signals, mutual match + match screen.
   Rule: a non-mutual crush is never revealed — not even whether the other person added you. */
(function () {
  const { DAY } = NX.T;

  const Crush = {
    renderTab() {
      const secretAdmirers = S.crushedBy.filter(id => !NX.matchWith(id));
      const n = secretAdmirers.length;
      const paid = NX.isPaid();
      const mine = [...S.crushes].sort((a, b) => b.time - a.time);
      const matches = S.matches.filter(m => !NX.isBlocked(m.userId));

      const received = `
        <section class="crush-received">
          <div class="cr-eyes" aria-hidden="true">👀</div>
          <div class="cr-text">
            <h3>${n ? `${n} ${n > 1 ? 'people have' : 'person has'} a secret crush on you` : matches.length ? 'No other secret crushes right now' : 'No secret crushes on you yet'}</h3>
            <p>${n ? 'We\'ll never tell you who. Add your own crushes — if one is mutual, it\'s a match.' : 'When someone adds you, you\'ll be notified — never with their name.'}</p>
          </div>
        </section>`;

      const matchesHtml = matches.length ? `
        <div class="section-head"><h2>Matches 💘</h2></div>
        <div class="match-row">${matches.map(m => {
          const u = NX.user(m.userId);
          return `<button class="match-card" data-action="openMatchChat" data-id="${u.id}">${avatar(u, 60)}<b>${esc(u.name.split(' ')[0])}</b><small>Matched ${timeAgo(m.time)}</small></button>`;
        }).join('')}</div>` : '';

      let list;
      if (!paid || NX.limitOf('crushes') === 0) {
        list = `
          <div class="upsell-card">
            <span class="upsell-emoji">💘</span>
            <div><b>Add your own Secret Crushes</b><p>Plus lets you add up to ${S.plans.plus.limits.crushes < 0 ? 'unlimited' : S.plans.plus.limits.crushes} crushes, Premium up to ${S.plans.premium.limits.crushes < 0 ? 'unlimited' : S.plans.premium.limits.crushes}. Mutual crushes become a match.</p></div>
            <button class="btn btn-primary btn-sm" data-go="plans" data-params='{"reason":"crush"}'>See plans</button>
          </div>`;
      } else {
        const l = NX.limitOf('crushes');
        const meter = l < 0 ? `<div class="usage">${Icon('crown', 16)}<span><b>Unlimited</b> Secret Crushes with Premium</span></div>`
          : `<div class="usage"><div class="usage-top"><span><b>${S.crushes.length} of ${l}</b> crush spots used</span>${NX.crushLeft() === 0 ? '<button class="link" data-go="plans" data-params=\'{"reason":"limit"}\'>Get more</button>' : ''}</div><div class="meter"><i style="width:${Math.min(100, (S.crushes.length / l) * 100)}%"></i></div></div>`;
        list = meter + (mine.length ? `
          <div class="list crush-list">${mine.map(c => {
            const u = NX.user(c.userId);
            const matched = NX.matchWith(c.userId);
            const near = NX.nearbyState(c.userId);
            return `<div class="user-row">
              <button class="user-row-main" data-go="user" data-id="${u.id}">${avatar(u, 48)}
                <span class="user-row-text"><b>${esc(u.name)}</b><small>${matched ? 'It\'s a match 💘' : `Added ${timeAgo(c.time)} · kept secret 🤫`}</small>${near === 'on' ? nearLineFor(u.id, 'near-line') : near ? nearChipFor(u.id, { static: true }) : ''}</span></button>
              ${matched ? `<button class="btn btn-sm btn-primary" data-action="openMatchChat" data-id="${u.id}">Chat</button>`
                : `<button class="icon-btn sm" data-action="removeCrush" data-id="${u.id}" aria-label="Remove ${esc(u.name)} from Secret Crushes">${Icon('x', 18)}</button>`}
            </div>`;
          }).join('')}</div>` : emptyState({ emoji: '💘', title: 'No crushes yet', cls: 'empty-secret', text: 'Add someone you like. They\'ll only know it was you if they add you too.' }));
      }

      return `
        ${received}
        ${matchesHtml}
        <div class="section-head"><h2>Your Secret Crushes</h2>${paid && NX.limitOf('crushes') !== 0 ? '<button class="link" data-action="addCrushFromTab">+ Add</button>' : ''}</div>
        ${list}
        ${paid && NX.limitOf('crushes') !== 0 ? `<button class="btn btn-secret btn-block mt" data-action="addCrushFromTab">Add a Secret Crush 💘</button>` : ''}
        <div class="rule-card">${Icon('shieldCheck', 18)}<p><b>Only mutual crushes are revealed.</b> If it's not mutual, nobody ever finds out — not even whether they added you.</p></div>`;
    },

    async add(id) {
      const u = NX.user(id);
      const ok = await Modal.confirm({
        title: `Add ${u.name.split(' ')[0]} as a Secret Crush?`,
        message: `${esc(u.name.split(' ')[0])} will get <i>"Someone added you as a secret crush 👀"</i>. They'll only find out it's you if they add you too.`,
        confirm: 'Add Secret Crush 💘', icon: 'heart'
      });
      if (!ok) return;
      S.crushes.push({ userId: id, time: Date.now() });
      NX.save();
      if (S.crushedBy.includes(id)) { App.refresh(); setTimeout(() => Crush.match(id), 500); return; }
      App.refresh();
      Toast.show('Added to Secret Crush 👀', { type: 'success' });
    },

    async remove(id) {
      const u = NX.user(id);
      const ok = await Modal.confirm({ title: `Remove ${u.name.split(' ')[0]} from your crushes?`, message: 'They\'ll never know you added or removed them.', confirm: 'Remove', danger: true });
      if (!ok) return;
      S.crushes = S.crushes.filter(c => c.userId !== id);
      NX.save();
      App.refresh();
      Toast.show('Removed from Secret Crushes');
    },

    match(id) {
      const u = NX.user(id);
      if (NX.matchWith(id)) return;
      let chat = S.chats.find(c => c.userId === id);
      if (!chat) { chat = { id: 'cm_' + id, userId: id, kind: 'match', unread: 0, messages: [] }; S.chats.unshift(chat); }
      else { chat.kind = 'match'; S.chats = [chat, ...S.chats.filter(c => c !== chat)]; }
      chat.messages.push({ id: uid('m'), from: 'system', text: 'You matched via Secret Crush 💘', time: Date.now() });
      S.matches.unshift({ userId: id, time: Date.now(), chatId: chat.id });
      NX.notify({ type: 'match', userId: id, text: `Congratulations! It's a match 🎉 You and <b>${esc(u.username)}</b> added each other.`, target: { screen: 'chat', params: { id: chat.id } }, read: true });
      NX.save();
      /* The match chat opens automatically behind the celebration. */
      Nav.stack = [{ name: 'chats', params: {} }];
      Nav.go('chat', { id: chat.id });
      const near = NX.nearbyState(id);
      const el = Overlay.show(`
        <div class="match">
          <div class="match-hearts" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span style="--i:${i}">${i % 3 ? '💗' : '💘'}</span>`).join('')}</div>
          <div class="match-stage">
            <div class="match-avatars">
              <span class="ma ma-left">${avatar(S.me, 108)}</span>
              <span class="ma-heart" aria-hidden="true">💘</span>
              <span class="ma ma-right">${avatar(u, 108)}</span>
            </div>
            <p class="match-eyebrow">Congratulations!</p>
            <h1>It's a match 💘</h1>
            <p>You and <b>${esc(u.name)}</b> both added each other as a Secret Crush. Your chat is open.</p>
            ${near ? `<div class="match-near">${nearChipFor(id)}</div>` : ''}
            <div class="match-actions">
              <button class="btn btn-light btn-lg btn-block" data-action="matchStartChat" data-id="${chat.id}">Say hi 👋</button>
              <button class="btn btn-ghost-light btn-lg btn-block" data-action="matchOpenChats">Open chats</button>
            </div>
          </div>
        </div>`, 'match-overlay', { label: 'It\'s a match' });
      setTimeout(() => { confetti(80); const r = el.querySelector('.ma-heart').getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top + r.height / 2, 20); }, 450);
    },
  };
  window.Crush = Crush;

  Actions.toggleCrush = (el) => {
    const id = el.dataset.id;
    if (NX.hasCrush(id)) {
      return Modal.menu([
        { label: 'Remove from Secret Crushes', icon: 'x', danger: true, onClick: () => Crush.remove(id) },
      ], { title: 'This stays private. They\'ll only know if it\'s mutual.' });
    }
    if (!NX.isPaid() || NX.limitOf('crushes') === 0) return Nav.go('plans', { reason: 'crush' });
    if (NX.crushLeft() <= 0) return upgradeLimitModal('crush');
    Crush.add(id);
  };
  Actions.removeCrush = (el) => Crush.remove(el.dataset.id);
  Actions.addCrushFromTab = () => {
    if (NX.crushLeft() <= 0) return upgradeLimitModal('crush');
    Nav.go('search', { intent: 'crush' });
  };
  Actions.openMatchChat = (el) => {
    const m = NX.matchWith(el.dataset.id);
    const chatId = (m && m.chatId) || App.ensureChat(el.dataset.id).id;
    Nav.go('chat', { id: chatId });
  };
  Actions.matchStartChat = (el) => {
    Overlay.close(null, true);
    if (!(Nav.is('chat') && Nav.cur().params.id === el.dataset.id)) { Nav.stack = [{ name: 'chats', params: {} }]; Nav.go('chat', { id: el.dataset.id }); }
    setTimeout(() => { const i = $('#chatInput'); if (i) { i.value = 'Hi 👋'; i.focus(); } }, 120);
  };
  Actions.matchOpenChats = () => { Overlay.close(null, true); Nav.tab('chats'); };

  /* Demo helpers */
  NX.simulateCrush = () => {
    const pool = S.users.filter(u => !S.crushedBy.includes(u.id) && !NX.hasCrush(u.id));
    const u = pool[Math.floor(Math.random() * pool.length)];
    if (!u) { Toast.show('Everyone already has a crush on you 😄'); return; }
    S.crushedBy.push(u.id);
    const n = NX.notify({ type: 'crush', text: 'Someone added you as a secret crush 👀', target: { screen: 'secret', params: { tab: 'crush' } } });
    NX.save();
    App.incoming(n);
  };
  NX.simulateMutual = () => {
    const c = S.crushes.find(x => !S.crushedBy.includes(x.userId) && !NX.matchWith(x.userId));
    if (!c) { Toast.show('Add someone to your Secret Crushes first (needs Plus or Premium).', { type: 'info' }); return false; }
    S.crushedBy.push(c.userId);
    NX.notify({ type: 'crush', text: 'Someone added you as a secret crush 👀', target: { screen: 'secret', params: { tab: 'crush' } }, read: true });
    NX.save();
    Crush.match(c.userId);
    return true;
  };
})();
