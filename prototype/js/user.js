/* Profiles (own + others), edit profile, followers/following lists. */
(function () {
  App.profileTab = App.profileTab || 'posts';

  function stats(u) {
    const posts = S.posts.filter(p => p.userId === u.id).length;
    return `
      <div class="profile-stats">
        <div class="stat"><b>${posts}</b><span>Posts</span></div>
        <button class="stat" data-action="openFollowList" data-id="${u.id}" data-type="followers"><b>${fmtNum(u.followers)}</b><span>Followers</span></button>
        <button class="stat" data-action="openFollowList" data-id="${u.id}" data-type="following"><b>${fmtNum(u.following)}</b><span>Following</span></button>
      </div>`;
  }

  function tabs(u) {
    const t = App.profileTab;
    const posts = S.posts.filter(p => p.userId === u.id).sort((a, b) => b.time - a.time);
    const reels = S.reels.filter(r => r.userId === u.id);
    const isMe = u.id === 'me';
    let grid;
    if (t === 'posts') {
      grid = posts.length ? `<div class="grid">${posts.map(p => `<button class="grid-item" data-go="post" data-id="${p.id}" aria-label="Open post"><img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()"></button>`).join('')}</div>`
        : emptyState({ icon: 'camera', title: isMe ? 'Share your first photo' : 'No posts yet', text: isMe ? 'Your photos and moments will appear here.' : `When ${esc(u.name.split(' ')[0])} shares photos, you'll see them here.`, actions: isMe ? '<button class="btn btn-primary" data-go="create">Create a post</button>' : '' });
    } else {
      grid = reels.length ? `<div class="grid grid-reels">${reels.map(r => `<button class="grid-item" data-action="openReel" data-id="${r.id}" aria-label="Open reel"><img src="${esc(r.src)}" alt="" loading="lazy" onerror="this.remove()"><span class="grid-reel-meta">${Icon('play', 12)} ${fmtNum(r.likes)}</span></button>`).join('')}</div>`
        : emptyState({ icon: 'reels', title: 'No reels yet', text: isMe ? 'Reels you create will show up here.' : 'No reels to show right now.' });
    }
    return `
      <div class="tabs" role="tablist">
        <button role="tab" class="tab ${t === 'posts' ? 'active' : ''}" aria-selected="${t === 'posts'}" data-action="profileTab" data-tab="posts">${Icon('grid', 20)}<span>Posts</span></button>
        <button role="tab" class="tab ${t === 'reels' ? 'active' : ''}" aria-selected="${t === 'reels'}" data-action="profileTab" data-tab="reels">${Icon('reels', 20)}<span>Reels</span></button>
      </div>
      <div class="tab-panel" role="tabpanel">${grid}</div>`;
  }
  Actions.profileTab = (el) => { App.profileTab = el.dataset.tab; App.refresh(); };
  Actions.openReel = (el) => { App.reelStart = el.dataset.id; Nav.tab('reels'); };

  /* ---------- My profile ---------- */
  Screens.profile = {
    tab: 'profile', title: 'Profile',
    render: () => {
      const u = S.me;
      const plan = NX.plan();
      const story = NX.hasStory('me');
      return `
        <header class="appbar">
          <div class="appbar-title"><h1>${esc(u.username)}</h1></div>
          <div class="appbar-actions">
            <button class="icon-btn" data-go="create" aria-label="Create">${Icon('plusSquare', 24)}</button>
            <button class="icon-btn" data-go="settings" aria-label="Settings">${Icon('settings', 24)}</button>
          </div>
        </header>
        <div class="page">
          <section class="profile-head">
            <div class="profile-top">
              <button class="profile-avatar" data-action="${story ? 'openStory' : 'editProfile'}" data-id="me" aria-label="${story ? 'View your story' : 'Change profile photo'}">${avatar(u, 88, { ring: story, seen: story && NX.storySeen('me') })}</button>
              ${stats(u)}
            </div>
            <div class="profile-info">
              <h2>${esc(u.name)}${premiumBadge(u)} ${planChip(u.plan)}</h2>
              ${u.bio ? `<p>${esc(u.bio)}</p>` : `<button class="link" data-action="editProfile">+ Add a bio</button>`}
            </div>
            <div class="profile-btns">
              <button class="btn btn-secondary" data-action="editProfile">Edit profile</button>
              <button class="btn btn-secondary" data-action="shareProfile">Share profile</button>
            </div>
          </section>
          <section class="quick-links card">
            <button class="ql" data-go="${NX.isPaid() ? 'mySubscription' : 'plans'}">
              <span class="ql-ic ${u.plan}">${Icon(u.plan === 'premium' ? 'crown' : 'sparkles', 20)}</span>
              <span class="ql-text"><b>Subscription</b><small>${NX.isPaid() ? `${plan.name} · active until ${fmtDate(u.planExpiry)}` : 'Free plan · Unlock Secret features'}</small></span>
              ${NX.isPaid() ? Icon('chevronRight', 18) : '<span class="btn btn-xs btn-primary" aria-hidden="true">Upgrade</span>'}
            </button>
            <button class="ql" data-go="contact"><span class="ql-ic">${Icon('headset', 20)}</span><span class="ql-text"><b>Contact us</b><small>Questions, feedback or a problem</small></span>${Icon('chevronRight', 18)}</button>
            <button class="ql" data-go="settings"><span class="ql-ic">${Icon('settings', 20)}</span><span class="ql-text"><b>Settings</b><small>Privacy, Nearby, notifications, theme</small></span>${Icon('chevronRight', 18)}</button>
          </section>
          ${tabs(u)}
        </div>`;
    }
  };
  Actions.shareProfile = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(`https://nexity.com/u/${S.me.username}`).catch(() => {});
    Toast.show('Profile link copied', { type: 'success', icon: 'link' });
  };

  /* ---------- Other user's profile ---------- */
  function secretActions(u) {
    const paid = NX.isPaid();
    const crush = NX.hasCrush(u.id);
    const match = NX.matchWith(u.id);
    const intent = App.intent;
    return `
      <section class="secret-actions" aria-label="Secret actions">
        <div class="sa-head">${Icon('mask', 18)}<span>Your secret side</span><button class="icon-btn sm" data-action="secretHowItWorks" aria-label="How secret features work">${Icon('info', 16)}</button></div>
        <button class="secret-btn ${intent === 'secret' ? 'pulse' : ''}" data-action="startSecretMessage" data-id="${u.id}">
          <span class="sb-emoji" aria-hidden="true">💌</span>
          <span class="sb-text"><b>Send Secret Message</b><small>You stay anonymous until they reply twice</small></span>
          ${paid ? Icon('chevronRight', 18) : `<span class="sb-lock">${Icon('lock', 14)}</span>`}
        </button>
        ${match ? `
        <button class="secret-btn matched" data-action="openMatchChat" data-id="${u.id}">
          <span class="sb-emoji" aria-hidden="true">💘</span>
          <span class="sb-text"><b>It's a match!</b><small>You both added each other · Open chat</small></span>${Icon('chevronRight', 18)}
        </button>` : `
        <button class="secret-btn ${crush ? 'added' : ''} ${intent === 'crush' ? 'pulse' : ''}" data-action="toggleCrush" data-id="${u.id}" aria-pressed="${crush}">
          <span class="sb-emoji" aria-hidden="true">💘</span>
          <span class="sb-text"><b>${crush ? 'In your Secret Crushes' : 'Add Secret Crush'}</b><small>${crush ? 'They\'ll only know if it\'s mutual · Tap to manage' : 'Only revealed if it\'s mutual'}</small></span>
          ${crush ? `<span class="sb-check">${Icon('check', 14)}</span>` : paid ? Icon('chevronRight', 18) : `<span class="sb-lock">${Icon('lock', 14)}</span>`}
        </button>`}
      </section>`;
  }

  Screens.user = {
    title: (p) => { const u = NX.user(p.id); return u ? u.username : 'Profile'; },
    render: (p) => {
      const u = NX.user(p.id);
      if (!u) return `${appbar({ title: 'Profile' })}<div class="page">${emptyState({ icon: 'user', title: 'Profile not found', text: 'This account may have been removed.' })}</div>`;
      const more = `<button class="icon-btn" data-action="userMenu" data-id="${u.id}" aria-label="More options">${Icon('more', 22)}</button>`;
      if (NX.isRemoved(u.id)) {
        return `${appbar({ title: u.username })}
          <div class="page">${emptyState({ icon: 'ban', title: 'This account isn\'t available', text: 'The profile may have been removed or temporarily restricted.' })}</div>`;
      }
      if (NX.isBlocked(u.id)) {
        return `${appbar({ title: u.username, actions: more })}
          <div class="page">${emptyState({ icon: 'ban', title: `You blocked ${esc(u.username)}`, text: 'They can\'t see your profile, posts or message you. They haven\'t been notified.', actions: `<button class="btn btn-secondary" data-action="unblock" data-id="${u.id}">Unblock</button>` })}</div>`;
      }
      const story = NX.hasStory(u.id);
      const f = NX.isFollowing(u.id);
      return `
        ${appbar({ title: u.username, actions: more })}
        <div class="page">
          <section class="profile-head">
            <div class="profile-top">
              ${story ? `<button class="profile-avatar" data-action="openStory" data-id="${u.id}" aria-label="View story">${avatar(u, 88, { ring: true, seen: NX.storySeen(u.id) })}</button>` : `<span class="profile-avatar">${avatar(u, 88)}</span>`}
              ${stats(u)}
            </div>
            <div class="profile-info">
              <h2>${esc(u.name)}${premiumBadge(u)}</h2>
              <p>${esc(u.bio)}</p>
            </div>
            <div class="profile-btns">
              <button class="btn ${f ? 'btn-secondary' : 'btn-primary'}" data-action="follow" data-id="${u.id}" aria-pressed="${f}">${f ? `Following ${Icon('chevronDown', 16)}` : 'Follow'}</button>
              <button class="btn btn-secondary" data-action="messageUser" data-id="${u.id}">Message</button>
            </div>
          </section>
          ${secretActions(u)}
          ${tabs(u)}
        </div>`;
    }
  };

  Actions.messageUser = (el) => {
    const chat = App.ensureChat(el.dataset.id);
    NX.save();
    Nav.go('chat', { id: chat.id });
  };
  Actions.userMenu = (el) => {
    const u = NX.user(el.dataset.id);
    const blocked = NX.isBlocked(u.id);
    Modal.menu([
      { label: 'Copy profile link', icon: 'link', onClick: () => { navigator.clipboard && navigator.clipboard.writeText(`https://nexity.com/u/${u.username}`).catch(() => {}); Toast.show('Profile link copied', { type: 'success', icon: 'link' }); } },
      { label: `Report ${u.username}`, icon: 'flag', danger: true, onClick: () => Safety.report({ userId: u.id, content: 'Profile', preview: 'Profile' }) },
      blocked ? { label: `Unblock ${u.username}`, icon: 'ban', onClick: () => Actions.unblock({ dataset: { id: u.id } }) }
        : { label: `Block ${u.username}`, icon: 'ban', danger: true, onClick: () => Safety.block(u.id) },
    ], { title: u.username });
  };

  /* ---------- Followers / following ---------- */
  Actions.openFollowList = (el) => {
    const u = NX.user(el.dataset.id);
    const type = el.dataset.type;
    let list;
    if (u.id === 'me') list = type === 'following' ? S.following.map(NX.user) : S.users.filter((x, i) => i % 3 !== 2);
    else list = S.users.filter((x, i) => x.id !== u.id && (i + (type === 'followers' ? 0 : 1)) % 2 === 0);
    list = list.filter(x => x && !NX.isBlocked(x.id));
    Modal.open({
      title: type === 'followers' ? 'Followers' : 'Following', cls: 'sheet-tall',
      body: list.length ? `<div class="list">${list.map(x => userRow(x, followBtn(x), { size: 44 })).join('')}</div>`
        : emptyState({ icon: 'users', title: type === 'followers' ? 'No followers yet' : 'Not following anyone yet', text: 'Find people you know with Search.', actions: '<button class="btn btn-primary" data-go="search">Find people</button>' })
    });
  };

  /* ---------- Edit profile ---------- */
  Actions.editProfile = () => {
    const u = S.me;
    App.editAvatar = u.avatar;
    Modal.open({
      title: 'Edit profile', cls: 'sheet-tall',
      body: `
        <form data-form="editProfile" id="editProfileForm" novalidate>
          <div class="edit-avatar">
            <span id="editAvatarPreview">${avatar(u, 88)}</span>
            <label class="btn btn-sm btn-secondary">${Icon('upload', 16)} Upload photo<input type="file" accept="image/*" data-change="uploadAvatar" hidden></label>
          </div>
          <div class="avatar-choices" role="radiogroup" aria-label="Choose a profile photo">
            ${NX.avatarChoices.map(n => { const src = NX.img.av(n); return `<button type="button" class="avatar-choice ${u.avatar === src ? 'selected' : ''}" data-action="pickAvatar" data-src="${src}" aria-label="Choose photo"><img src="${src}" alt="" loading="lazy" onerror="this.remove()"></button>`; }).join('')}
          </div>
          ${field({ label: 'Name', name: 'name', id: 'epName', value: u.name, autocomplete: 'name' })}
          ${field({ label: 'Username', name: 'username', id: 'epUser', value: u.username, extra: 'autocapitalize="none" spellcheck="false"' })}
          <div class="field">
            <label for="epBio">Bio</label>
            <textarea class="input" id="epBio" name="bio" rows="3" maxlength="150" data-input="bioCount" placeholder="Tell people a little about you">${esc(u.bio)}</textarea>
            <p class="field-hint right" id="bioCount">${u.bio.length}/150</p>
          </div>
        </form>`,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="editProfileForm">Save changes</button>`
    });
  };
  Inputs.bioCount = (el) => { $('#bioCount').textContent = `${el.value.length}/150`; };
  Actions.pickAvatar = (el) => {
    App.editAvatar = el.dataset.src;
    $$('.avatar-choice').forEach(b => b.classList.toggle('selected', b === el));
    $('#editAvatarPreview').innerHTML = avatar(Object.assign({}, S.me, { avatar: App.editAvatar }), 88);
  };
  Inputs.uploadAvatar = async (el) => {
    try {
      App.editAvatar = await readImage(el.files[0], 400);
      $$('.avatar-choice').forEach(b => b.classList.remove('selected'));
      $('#editAvatarPreview').innerHTML = avatar(Object.assign({}, S.me, { avatar: App.editAvatar }), 88);
    } catch (e) { Toast.show(e.message, { type: 'error' }); }
  };
  Forms.editProfile = async (form) => {
    const name = form.name.value.trim(), username = form.username.value.trim().toLowerCase(), bio = form.bio.value.trim();
    let ok = true;
    if (name.length < 2) { fieldError(form, 'name', 'Please enter your name.'); ok = false; } else fieldError(form, 'name', '');
    if (!/^[a-z0-9._]{3,20}$/.test(username)) { fieldError(form, 'username', 'Use 3–20 lowercase letters, numbers, dots or underscores.'); ok = false; }
    else if (S.users.some(u => u.username === username)) { fieldError(form, 'username', 'That username is taken.'); ok = false; }
    else fieldError(form, 'username', '');
    if (!ok) return;
    const btn = document.querySelector('[form="editProfileForm"]');
    setBusy(btn, true, 'Saving…');
    await delay(600);
    Object.assign(S.me, { name, username, bio, avatar: App.editAvatar });
    NX.save();
    Modal.closeAll();
    App.refresh();
    Toast.show('Profile updated', { type: 'success' });
  };
})();
