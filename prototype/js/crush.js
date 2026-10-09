/* Secret Crush: private crush list, anonymous "someone added you" signals, mutual match + match screen.
   Rule: a non-mutual crush is never revealed — not even whether the other person added you. */
(function () {
  const { DAY } = NX.T;

  const Crush = {
    renderTab() {
      const n = S.crushedBy.filter(id => !NX.matchWith(id)).length;
      const paid = NX.isPaid();
      const canAdd = paid && NX.limitOf('crushes') !== 0;
      /* Crushes are kept when a plan ends, but paused: they can't create a match until the user re-subscribes. */
      const paused = !canAdd;
      const mine = S.crushes.filter(c => !NX.matchWith(c.userId)).sort((a, b) => b.time - a.time);
      const matches = S.matches.filter(m => !NX.isBlocked(m.userId));

      const received = `
        <section class="px-admirers${n ? '' : ' empty'}">
          <span class="px-admirers-eyes" aria-hidden="true">👀</span>
          <div class="px-admirers-text">
            ${n ? `<p class="px-admirers-n"><b>${n}</b> ${n === 1 ? 'person has' : 'people have'} a secret crush on you</p>
                   <p>We'll never tell you who. Add your own crushes — if one is mutual, it's a match.</p>`
              : `<p class="px-admirers-n">No secret crushes on you yet</p>
                 <p>When someone adds you, you'll be notified — never with their name.</p>`}
            ${n && !paid ? `<button class="btn btn-love btn-sm" data-go="plans" data-params='{"reason":"crush"}'>${Icon('unlock', 15)} Find out if it's mutual</button>` : ''}
          </div>
        </section>`;

      const matchesHtml = matches.length ? `
        <div class="px-head"><h2>Matches 💘</h2><span>${matches.length}</span></div>
        <div class="px-matches">${matches.map(m => {
          const u = NX.user(m.userId);
          return `
            <button class="px-match" data-action="openMatchChat" data-id="${u.id}" aria-label="Chat with ${esc(u.name)}, matched ${timeAgoLong(m.time)}">
              <span class="px-match-av">${avatar(u, 64)}<span class="px-match-heart" aria-hidden="true">💘</span></span>
              <b>${esc(u.name.split(' ')[0])}</b>
              <small>Matched ${timeAgo(m.time)} ago</small>
            </button>`;
        }).join('')}</div>` : '';

      const upsell = pxLockCard('crush');
      let list;
      if (!canAdd && !mine.length) {
        list = upsell;
      } else {
        const l = NX.limitOf('crushes');
        const used = mine.length;
        const spots = canAdd ? `
          <div class="px-usage">
            <span class="px-usage-ic love" aria-hidden="true">💘</span>
            <span class="px-usage-text">
              <b>${used} of ${l} crush spots used</b>
              <span class="px-hearts" aria-hidden="true">${Array.from({ length: l }, (_, i) => `<i class="${i < used ? 'on' : ''}">${Icon('heart', 13)}</i>`).join('')}</span>
              ${used >= l && S.me.plan === 'premium' ? '<small>Spots free up when you remove someone</small>' : ''}
            </span>
            ${used >= l && S.me.plan !== 'premium' ? '<button class="btn btn-premium btn-xs" data-go="plans" data-params=\'{"reason":"limit"}\'>Get more</button>' : ''}
          </div>` : upsell;
        list = spots + (mine.length ? `
          <div class="px-list">${mine.map(c => {
            const u = NX.user(c.userId);
            const near = NX.nearbyState(c.userId);
            return `
              <div class="px-row px-crush${paused ? ' paused' : ''}">
                <button class="px-row-main" data-go="user" data-id="${u.id}">
                  <span class="px-av">${avatar(u, 52)}<span class="px-av-badge love">${Icon('heart', 10)}</span></span>
                  <span class="px-row-body">
                    <b>${esc(u.name)}</b>
                    <small>${paused ? `${Icon('pause', 11)} Paused — renew your plan to reactivate` : `Added ${timeAgo(c.time) === 'now' ? 'just now' : `${timeAgo(c.time)} ago`} · kept secret 🤫`}</small>
                    ${near === 'on' ? `<small class="px-near">${esc(NX.nearText(u.id))}</small>` : near ? nearChipFor(u.id, { static: true }) : ''}
                  </span>
                </button>
                <button class="icon-btn sm px-remove" data-action="removeCrush" data-id="${u.id}" aria-label="Remove ${esc(u.name)} from Secret Crushes">${Icon('x', 18)}</button>
              </div>`;
          }).join('')}</div>` : `
          <div class="px-empty">
            <span aria-hidden="true">💘</span>
            <b>No crushes yet</b>
            <p>Add someone you like. They'll only know it was you if they add you too.</p>
          </div>`);
      }

      return `
        ${received}
        ${matchesHtml}
        <div class="px-head"><h2>Your Secret Crushes</h2>${canAdd ? `<button class="px-head-add" data-action="addCrushFromTab">${Icon('plus', 16)} Add</button>` : ''}</div>
        ${list}
        ${canAdd ? `<button class="btn btn-love btn-lg btn-block mt" data-action="addCrushFromTab">Add a Secret Crush 💘</button>` : ''}
        <div class="px-rule">${Icon('shieldCheck', 18)}<p><b>Only mutual crushes are revealed.</b> If it's not mutual, nobody ever finds out — not even whether they added you.</p></div>`;
    },

    add(id) {
      const u = NX.user(id);
      const first = esc(u.name.split(' ')[0]);
      return new Promise((resolve) => {
        let done = false;
        const el = Modal.open({
          cls: 'px-crush-sheet', hideHeader: true, label: `Add ${first} as a Secret Crush?`,
          onClose: () => { if (!done) resolve(false); },
          body: `
            <div class="px-cs">
              <div class="px-cs-art" aria-hidden="true">
                <span class="px-cs-av">${avatar(u, 84)}</span>
                <span class="px-cs-heart">💘</span>
              </div>
              <h2>Add ${first} as a Secret Crush?</h2>
              <p>${first} will get <i>"Someone added you as a Secret Crush 👀"</i>. They'll only find out it's you if they add you too.</p>
              <ul class="px-cs-points">
                <li>${Icon('eyeOff', 16)} Your name is never shown unless it's mutual</li>
                <li>${Icon('heart', 16)} Mutual? You both get a match and a love chat</li>
              </ul>
              <button class="btn btn-love btn-lg btn-block" data-confirm>Add Secret Crush 💘</button>
              <button class="btn btn-ghost btn-block" data-cancel>Cancel</button>
            </div>`
        });
        el.querySelector('[data-confirm]').addEventListener('click', () => { done = true; Modal.close(el, true); resolve(true); });
        el.querySelector('[data-cancel]').addEventListener('click', () => { done = true; Modal.close(el, true); resolve(false); });
      }).then((ok) => ok && Crush.commitAdd(id));
    },

    commitAdd(id) {
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
      NX.notify({ type: 'match', userId: id, text: `Congratulations! 🎉 You and <b>${esc(u.username)}</b> are a match 💘`, target: { screen: 'chat', params: { id: chat.id } }, read: true });
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
    if (NX.matchWith(id)) return Toast.show('You\'re matched 💘 To end it, delete the chat or block them.', { type: 'info' });
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
    if (!NX.isPaid() || NX.limitOf('crushes') === 0) return Nav.go('plans', { reason: 'crush' });
    if (NX.crushLeft() <= 0) return upgradeLimitModal('crush');
    openPeoplePicker('crush');
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
    const n = NX.notify({ type: 'crush', text: 'Someone added you as a Secret Crush 👀', target: { screen: 'secret', params: { tab: 'crush' } } });
    NX.save();
    App.incoming(n);
  };
  NX.simulateMutual = () => {
    const c = S.crushes.find(x => !S.crushedBy.includes(x.userId) && !NX.matchWith(x.userId));
    if (!c) { Toast.show('Add someone to your Secret Crushes first (needs Plus or Premium).', { type: 'info' }); return false; }
    S.crushedBy.push(c.userId);
    NX.notify({ type: 'crush', text: 'Someone added you as a Secret Crush 👀', target: { screen: 'secret', params: { tab: 'crush' } }, read: true });
    NX.save();
    Crush.match(c.userId);
    return true;
  };
})();
