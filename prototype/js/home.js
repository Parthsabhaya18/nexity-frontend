/* Home feed, posts, comments, sharing, create post/story and the story viewer. */
(function () {
  const { HOUR, DAY } = NX.T;

  /* ---------- Story helpers ---------- */
  NX.activeStories = (userId) => S.stories.filter(s => s.userId === userId && s.time > Date.now() - DAY).sort((a, b) => a.time - b.time);
  NX.storySeen = (userId) => NX.activeStories(userId).every(s => S.seenStories.includes(s.id));
  NX.hasStory = (userId) => NX.activeStories(userId).length > 0;
  const storyUsers = () => {
    const ids = [...new Set(S.stories.filter(s => s.userId !== 'me' && !NX.isBlocked(s.userId)).map(s => s.userId))].filter(NX.hasStory);
    return ids.sort((a, b) => NX.storySeen(a) - NX.storySeen(b));
  };

  function storiesRow() {
    const mine = NX.hasStory('me');
    return `
      <div class="stories" role="list" aria-label="Stories">
        <div class="story-item" role="listitem">
          <div class="story-own">
            <button class="story-btn" data-action="${mine ? 'openStory' : 'addStory'}" data-id="me" aria-label="${mine ? 'View your story' : 'Add to your story'}">
              ${avatar(S.me, 64, { ring: mine, seen: mine && NX.storySeen('me') })}
            </button>
            <button class="story-add" data-action="addStory" aria-label="Add to your story">${Icon('plus', 14)}</button>
          </div>
          <span class="story-name">Your story</span>
        </div>
        ${storyUsers().map(id => {
          const u = NX.user(id);
          return `<div class="story-item" role="listitem">
            <button class="story-btn" data-action="openStory" data-id="${id}" aria-label="View ${esc(u.username)}'s story">${avatar(u, 64, { ring: true, seen: NX.storySeen(id) })}</button>
            <span class="story-name">${esc(u.username.split('.')[0])}</span></div>`;
        }).join('')}
      </div>`;
  }

  /* ---------- Post card ---------- */
  const postImages = (p) => (p.images && p.images.length ? p.images : [p.img]).filter(Boolean);
  const hashBtn = (tag) => `<button type="button" class="hash" data-action="openHashtag" data-tag="${esc(tag)}">#${esc(tag)}</button>`;
  const richCaption = (text) => esc(text || '').replace(/#([A-Za-z\u0900-\u097F][\w\u0900-\u097F]*)/g, (_, t) => hashBtn(t));
  const tagsLine = (ids) => {
    const users = (ids || []).map(NX.user).filter(Boolean);
    if (!users.length) return '';
    const btn = (u) => `<button class="link-strong" data-go="user" data-id="${u.id}">${esc(u.username)}</button>`;
    const line = users.length === 1 ? btn(users[0])
      : users.length === 2 ? `${btn(users[0])} and ${btn(users[1])}`
      : `${btn(users[0])} and ${users.length - 1} others`;
    return `<p class="post-with">with ${line}</p>`;
  };

  window.postCard = (p) => {
    const u = NX.user(p.userId);
    if (!u) return '';
    const mine = p.userId === 'me';
    const n = p.comments.length;
    const imgs = postImages(p);
    const extraTags = (p.hashtags || []).filter(h => !(p.caption || '').toLowerCase().includes('#' + h.toLowerCase()));
    const media = imgs.length > 1
      ? `<div class="post-slides" data-slide="${p.id}" data-i="0">${imgs.map(src => `<img src="${esc(src)}" alt="Photo shared by ${esc(u.username)}" draggable="false" loading="lazy" onerror="this.remove()">`).join('')}</div>
          <button class="post-arrow left" data-action="postSlide" data-id="${p.id}" data-dir="-1" aria-label="Previous photo">${Icon('back', 18)}</button>
          <button class="post-arrow right" data-action="postSlide" data-id="${p.id}" data-dir="1" aria-label="Next photo">${Icon('chevronRight', 18)}</button>
          <div class="post-dots" aria-hidden="true">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
          <span class="post-multi" aria-label="${imgs.length} photos">${Icon('layers', 18)}</span>`
      : `<img src="${esc(imgs[0] || '')}" alt="Photo shared by ${esc(u.username)}" loading="lazy" onerror="this.remove()">`;
    return `
      <article class="post card" data-post="${p.id}">
        <header class="post-head">
          <button class="post-user" data-go="user" data-id="${u.id}">
            ${avatar(u, 38, { ring: NX.hasStory(u.id), seen: NX.storySeen(u.id) })}
            <span><b>${esc(u.username)}${premiumBadge(u)}</b><small>${p.location ? `<span class="post-loc">${esc(p.location)}</span> · ` : ''}${timeAgoLong(p.time)}</small></span>
          </button>
          ${!mine && !NX.isFollowing(u.id) ? `<button class="btn btn-xs btn-tonal" data-action="follow" data-id="${u.id}">Follow</button>` : ''}
          <button class="icon-btn" data-action="postMenu" data-id="${p.id}" aria-label="More options">${Icon('more', 22)}</button>
        </header>
        <div class="post-media" data-dbl="dblLikePost" data-id="${p.id}">
          ${media}
          <span class="big-heart" aria-hidden="true">${Icon('heart', 96)}</span>
        </div>
        <div class="post-actions">
          <button class="icon-btn like-btn${p.liked ? ' liked' : ''}" data-action="likePost" data-id="${p.id}" aria-pressed="${p.liked}" aria-label="Like">${Icon('heart', 26)}</button>
          <button class="icon-btn" data-action="openComments" data-id="${p.id}" data-kind="post" aria-label="Comments">${Icon('comment', 25)}</button>
          <button class="icon-btn" data-action="share" data-id="${p.id}" data-kind="post" aria-label="Share">${Icon('send', 24)}</button>
        </div>
        <div class="post-body">
          <p class="post-likes"><b data-likes="${p.id}">${p.likes.toLocaleString('en-IN')}</b> likes</p>
          ${tagsLine(p.tags)}
          ${p.caption || extraTags.length ? `<p class="post-caption"><button class="link-strong" data-go="user" data-id="${u.id}">${esc(u.username)}</button> ${richCaption(p.caption)}${extraTags.length ? ' ' + extraTags.map(hashBtn).join(' ') : ''}</p>` : ''}
          <button class="link-muted" data-action="openComments" data-id="${p.id}" data-kind="post">${n ? `View all ${n} comment${n > 1 ? 's' : ''}` : 'Add a comment…'}</button>
        </div>
      </article>`;
  };

  function setPostSlide(slides, i) {
    const n = slides.children.length;
    const next = (i + n) % n;
    slides.dataset.i = next;
    slides.style.transform = `translateX(-${next * 100}%)`;
    const dots = slides.parentElement.querySelectorAll('.post-dots i');
    dots.forEach((d, k) => d.classList.toggle('on', k === next));
  }
  function bindPostCarousels(root) {
    (root || document).querySelectorAll('.post-slides').forEach(slides => {
      const media = slides.parentElement;
      let x0 = 0, dx = 0, tracking = false;
      media.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.post-arrow')) return;
        tracking = true; x0 = e.clientX; dx = 0;
      });
      media.addEventListener('pointermove', (e) => { if (tracking) dx = e.clientX - x0; });
      const end = () => {
        if (!tracking) return;
        tracking = false;
        if (Math.abs(dx) < 42) return;
        setPostSlide(slides, +(slides.dataset.i || 0) + (dx < 0 ? 1 : -1));
      };
      media.addEventListener('pointerup', end);
      media.addEventListener('pointercancel', () => { tracking = false; });
    });
  }
  Actions.postSlide = (el) => {
    const slides = document.querySelector(`[data-slide="${el.dataset.id}"]`);
    if (slides) setPostSlide(slides, +(slides.dataset.i || 0) + (+el.dataset.dir));
  };
  Actions.openHashtag = (el) => {
    const tag = (el.dataset.tag || '').replace(/^#/, '');
    const key = tag.toLowerCase();
    const posts = S.posts.filter(p => (p.hashtags || []).some(h => h.toLowerCase() === key) || (p.caption || '').toLowerCase().includes('#' + key));
    Modal.open({
      title: '#' + tag, cls: 'sheet-tall',
      body: posts.length
        ? `<p class="fine hash-count">${posts.length} post${posts.length > 1 ? 's' : ''}</p><div class="hash-grid">${posts.map(p => `<button class="hash-grid-item" data-go="post" data-id="${p.id}" aria-label="Open post"><img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()"></button>`).join('')}</div>`
        : `<div class="tag-empty">${Icon('hash', 28)}<b>No posts for #${esc(tag)}</b><span>When someone shares this hashtag, it will show up here.</span></div>`
    });
  };

  const feedSkeleton = () => [0, 1].map(() => `
    <div class="post card skeleton-card" aria-hidden="true">
      <div class="post-head"><span class="sk sk-circle"></span><span class="sk sk-line" style="width:40%"></span></div>
      <div class="sk sk-media"></div>
      <div class="post-body"><span class="sk sk-line" style="width:30%"></span><span class="sk sk-line" style="width:80%"></span></div>
    </div>`).join('');

  function suggestions() {
    const list = S.users.filter(u => !NX.isFollowing(u.id) && !NX.isBlocked(u.id)).slice(0, 6);
    if (!list.length) return '';
    return `
      <section class="suggest card" aria-label="Suggested for you">
        <div class="section-head"><h2>Suggested for you</h2><button class="link" data-go="search">See all</button></div>
        <div class="suggest-row">
          ${list.map(u => `<div class="suggest-card">
              <button class="suggest-main" data-go="user" data-id="${u.id}">${avatar(u, 64)}<b>${esc(u.username)}</b><small>${esc(u.name)}</small></button>
              ${followBtn(u)}</div>`).join('')}
        </div>
      </section>`;
  }

  function feed() {
    const posts = S.posts.filter(p => p.userId !== 'me' || true).filter(p => !NX.isBlocked(p.userId)).sort((a, b) => b.time - a.time);
    if (!posts.length) return emptyState({ icon: 'image', title: 'No posts yet', text: 'Follow people to see their photos and moments here.', actions: '<button class="btn btn-primary" data-go="search">Find people</button>' });
    return posts.map((p, i) => postCard(p) + (i === 1 ? suggestions() : '')).join('') +
      `<div class="feed-end">${Icon('check', 18)}<p>You're all caught up</p><small>You've seen all new posts from the past few days.</small></div>`;
  }

  Screens.home = {
    tab: 'home', title: 'Home',
    render: () => `
      <header class="appbar appbar-home">
        <div class="brand">${Wordmark(32)}</div>
        <div class="home-actions">
          <button class="icon-btn" data-go="notifications" aria-label="Notifications">${Icon('bell', 24)}${NX.unreadNotifications() ? `<span class="dot-badge">${NX.unreadNotifications()}</span>` : ''}</button>
          <button class="icon-btn" data-nav-tab="chats" aria-label="Chats">${Icon('chat', 24)}${NX.unreadChats() ? `<span class="dot-badge">${NX.unreadChats()}</span>` : ''}</button>
          <button class="home-me" data-nav-tab="profile" aria-label="Your profile">${avatar(S.me, 34)}</button>
        </div>
      </header>
      <div class="page page-feed">
        ${storiesRow()}
        ${S.demo.offline ? emptyState({ icon: 'refresh', title: 'You\'re offline', text: 'We couldn\'t load your feed. Check your connection and try again.', actions: '<button class="btn btn-primary" data-action="retryFeed">Try again</button>', cls: 'empty-error' })
          : App.loaded.home ? feed() : feedSkeleton()}
      </div>`,
    mount(root) {
      bindPostCarousels(root);
      if (!App.loaded.home && !S.demo.offline) setTimeout(() => { App.loaded.home = true; if (Nav.is('home')) App.refresh(); }, 700);
      if (!S.me.locPermission && !S.me.nearbyEnabled && !App.locAsking) { App.locAsking = true; setTimeout(askLocation, 1500); }
    }
  };

  /* Location permission is requested once when the app opens. Nearby itself stays off until the user opts in. */
  function askLocation() {
    App.locAsking = false;
    if (S.me.locPermission || !S.session.loggedIn || Modal.stack.length || Overlay.top()) return;
    const el = Modal.open({
      cls: 'confirm-layer os-permission', hideHeader: true, label: 'Location permission',
      body: `<div class="confirm">
        <div class="confirm-ic">${Icon('radar', 26)}</div>
        <h2>Allow location</h2>
        <p>Nearby needs location. Open Settings and turn Location on. Your place is never shown.</p>
        <div class="confirm-actions os">
          <button class="btn btn-block btn-primary" data-perm="while-using">Open Settings</button>
          <button class="btn btn-block btn-ghost" data-perm="denied">Not now</button>
        </div></div>`
    });
    el.querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', () => {
      Modal.close(el, true);
      S.me.locPermission = b.dataset.perm;
      NX.save();
    }));
  }
  Actions.retryFeed = async (el) => {
    setBusy(el, true, 'Retrying…');
    await delay(900);
    if (S.demo.offline) { setBusy(el, false); Toast.show('Still offline. Turn off "Network error" in Demo controls.', { type: 'error' }); return; }
    App.refresh();
  };

  Screens.post = {
    title: 'Post',
    render: (p) => {
      const post = S.posts.find(x => x.id === p.id);
      return `${appbar({ title: 'Post' })}<div class="page">${post && !NX.isBlocked(post.userId) ? postCard(post) : emptyState({ icon: 'image', title: 'Post unavailable', text: 'This post was removed or is no longer available.' })}</div>`;
    },
    mount(root) { bindPostCarousels(root); }
  };

  /* ---------- Likes ---------- */
  NX.findContent = (id, kind) => (kind === 'reel' ? S.reels : S.posts).find(x => x.id === id);
  App.toggleLike = (item, kind, forceOn = false) => {
    if (forceOn && item.liked) return;
    item.liked = !item.liked;
    item.likes += item.liked ? 1 : -1;
    NX.save();
    const act = kind === 'reel' ? 'likeReel' : 'likePost';
    $$(`[data-action="${act}"][data-id="${item.id}"]`).forEach(b => {
      b.classList.toggle('liked', item.liked);
      b.setAttribute('aria-pressed', item.liked);
      if (item.liked) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    });
    $$(`[data-likes="${item.id}"]`).forEach(x => { x.textContent = kind === 'reel' ? fmtNum(item.likes) : item.likes.toLocaleString('en-IN'); });
  };
  Actions.likePost = (el) => App.toggleLike(NX.findContent(el.dataset.id, 'post'), 'post');
  Actions.dblLikePost = (el) => {
    App.toggleLike(NX.findContent(el.dataset.id, 'post'), 'post', true);
    el.classList.remove('show-heart'); void el.offsetWidth; el.classList.add('show-heart');
  };

  /* ---------- Comments ---------- */
  const commentItem = (c) => {
    const u = NX.user(c.userId);
    return `<li class="comment">${avatar(u, 34)}<div><p><b>${esc(u.username)}</b> ${esc(c.text)}</p><small>${timeAgo(c.time)}</small></div></li>`;
  };
  Actions.openComments = (el) => {
    const kind = el.dataset.kind || 'post';
    const item = NX.findContent(el.dataset.id, kind);
    if (!item) return;
    const list = () => item.comments.length ? item.comments.map(commentItem).join('') : `<li class="comments-empty">${Icon('comment', 26)}<b>No comments yet</b><span>Start the conversation.</span></li>`;
    const m = Modal.open({
      title: 'Comments', cls: 'sheet-tall',
      body: `<ul class="comments" id="commentList">${list()}</ul>`,
      footer: `<form class="composer" data-form="addComment" data-id="${item.id}" data-kind="${kind}">${avatar(S.me, 34)}
        <input class="input" id="commentInput" name="text" placeholder="Add a comment…" autocomplete="off" maxlength="300" aria-label="Add a comment" data-autofocus>
        <button class="btn btn-sm btn-primary" type="submit">Post</button></form>`
    });
    m.dataset.kind = kind;
  };
  Forms.addComment = (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    const item = NX.findContent(form.dataset.id, form.dataset.kind);
    item.comments.push({ id: uid('cm'), userId: 'me', text, time: Date.now() });
    NX.save();
    form.text.value = '';
    const ul = $('#commentList');
    ul.innerHTML = item.comments.map(commentItem).join('');
    ul.lastElementChild.classList.add('fresh');
    ul.lastElementChild.scrollIntoView({ block: 'nearest' });
    App.refresh();
  };

  /* ---------- Share ---------- */
  Actions.share = (el) => {
    const kind = el.dataset.kind || 'post';
    const people = [...new Set([...S.chats.map(c => c.userId), ...S.following])].filter(id => !NX.isBlocked(id)).slice(0, 8).map(NX.user).filter(Boolean);
    Modal.open({
      title: 'Share', cls: kind === 'reel' ? 'on-dark' : '',
      body: `<div class="share-grid">${people.map(u => `
          <button class="share-person" data-action="sendShare" data-id="${u.id}" data-item="${el.dataset.id}" data-kind="${kind}">${avatar(u, 56)}<span>${esc(u.name.split(' ')[0])}</span></button>`).join('')}
        </div>
        <div class="share-row">
          <button class="share-opt" data-action="copyLink" data-id="${el.dataset.id}" data-kind="${kind}"><span>${Icon('link', 20)}</span>Copy link</button>
          <button class="share-opt" data-action="copyLink" data-id="${el.dataset.id}" data-kind="${kind}" data-ext="1"><span>${Icon('arrowUp', 20)}</span>Share to…</button>
        </div>`
    });
  };
  Actions.sendShare = (el) => {
    const chat = App.ensureChat(el.dataset.id);
    chat.messages.push({ id: uid('m'), from: 'me', text: `Shared a ${el.dataset.kind === 'reel' ? 'reel' : 'post'} with you`, share: { id: el.dataset.item, kind: el.dataset.kind }, time: Date.now(), seen: false });
    NX.save();
    el.classList.add('sent');
    el.querySelector('span').textContent = 'Sent ✓';
    el.disabled = true;
    Toast.show(`Sent to ${esc(NX.user(el.dataset.id).name.split(' ')[0])}`, { type: 'success' });
  };
  Actions.copyLink = (el) => {
    const url = `https://nexity.com/${el.dataset.kind === 'reel' ? 'reels' : 'posts'}/${el.dataset.id}`;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    Modal.closeAll();
    Toast.show(el.dataset.ext ? 'Link ready to share' : 'Link copied', { type: 'success', icon: 'link' });
  };

  /* ---------- Post menu ---------- */
  Actions.postMenu = (el) => {
    const p = S.posts.find(x => x.id === el.dataset.id);
    const u = NX.user(p.userId);
    if (p.userId === 'me') {
      return Modal.menu([
        { label: 'Copy link', icon: 'link', onClick: () => Actions.copyLink({ dataset: { id: p.id, kind: 'post' } }) },
        { label: 'Delete post', icon: 'trash', danger: true, onClick: async () => {
          if (await Modal.confirm({ title: 'Delete this post?', message: 'This can\'t be undone.', confirm: 'Delete', danger: true, icon: 'trash' })) {
            S.posts = S.posts.filter(x => x.id !== p.id);
            commit();
            if (Nav.is('post')) Nav.back();
            Toast.show('Post deleted');
          }
        } },
      ]);
    }
    Modal.menu([
      { label: NX.isFollowing(u.id) ? `Unfollow ${u.username}` : `Follow ${u.username}`, icon: NX.isFollowing(u.id) ? 'userCheck' : 'userPlus', onClick: () => Actions.follow({ dataset: { id: u.id } }) },
      { label: 'Go to profile', icon: 'user', onClick: () => Nav.go('user', { id: u.id }) },
      { label: 'Copy link', icon: 'link', onClick: () => Actions.copyLink({ dataset: { id: p.id, kind: 'post' } }) },
      { label: 'Report post', icon: 'flag', danger: true, onClick: () => Safety.report({ userId: u.id, content: 'Post', preview: p.caption }) },
      { label: `Block ${u.username}`, icon: 'ban', danger: true, onClick: () => Safety.block(u.id) },
    ]);
  };

  /* ---------- Story viewer ---------- */
  const SV = {
    open(userId) {
      this.queue = userId === 'me' ? ['me'] : storyUsers();
      this.uIndex = Math.max(0, this.queue.indexOf(userId));
      const items = this.items();
      const firstUnseen = items.findIndex(s => !S.seenStories.includes(s.id));
      this.sIndex = firstUnseen >= 0 ? firstUnseen : 0;
      this.el = Overlay.show('<div class="sv" id="sv"></div>', 'story-overlay', { label: 'Story viewer', onClose: () => this.stop(true) });
      this.keyHandler = (e) => {
        if (!Overlay.top() || Overlay.top().el !== this.el || Modal.stack.length || e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowRight') this.next();
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === ' ') { e.preventDefault(); this.togglePause(); }
      };
      document.addEventListener('keydown', this.keyHandler);
      this.renderItem();
    },
    items() { return NX.activeStories(this.queue[this.uIndex]); },
    renderItem() {
      const items = this.items();
      const st = items[this.sIndex];
      if (!st) return this.close();
      const u = NX.user(st.userId);
      const mine = st.userId === 'me';
      if (!S.seenStories.includes(st.id)) { S.seenStories.push(st.id); NX.save(); }
      const left = Math.max(1, Math.ceil((st.time + DAY - Date.now()) / HOUR));
      $('#sv').innerHTML = `
        <div class="sv-stage">
          <div class="sv-media ${st.type === 'video' ? 'is-video' : ''}"><img src="${esc(st.src)}" alt="Story by ${esc(u.username)}" onerror="this.remove()"></div>
          <div class="sv-shade"></div>
          <div class="sv-top">
            <div class="sv-bars">${items.map((_, i) => `<span><i style="width:${i < this.sIndex ? 100 : 0}%"></i></span>`).join('')}</div>
            <div class="sv-head">
              <button class="sv-user" data-action="svProfile" data-id="${u.id}">${avatar(u, 34)}<b>${esc(u.username)}</b><small>${timeAgo(st.time)}</small></button>
              ${st.type === 'video' ? `<span class="sv-tag">${Icon('play', 11)} Video</span>` : ''}
              <span class="sv-tag" title="Stories expire after 24 hours">${Icon('clock', 12)} ${left}h left</span>
              <span class="sv-spacer"></span>
              <button class="icon-btn" data-action="svPause" aria-label="Pause">${Icon('pause', 20)}</button>
              ${mine ? `<button class="icon-btn" data-action="svOwnMenu" aria-label="Story options">${Icon('more', 22)}</button>` : `<button class="icon-btn" data-action="svMenu" aria-label="Story options">${Icon('more', 22)}</button>`}
              <button class="icon-btn" data-action="svClose" aria-label="Close stories">${Icon('x', 24)}</button>
            </div>
          </div>
          <button class="sv-tap sv-prev" data-action="svPrev" aria-label="Previous"></button>
          <button class="sv-tap sv-next" data-action="svNext" aria-label="Next"></button>
          <div class="sv-bottom">
            ${mine ? `<button class="sv-views" data-action="svViews">${Icon('eye', 18)} Seen by ${st.views.length}</button>
                      <button class="btn btn-sm btn-glass" data-action="svAdd">${Icon('plus', 16)} Add to story</button>`
              : `<form class="sv-reply" data-form="storyReply" data-id="${u.id}">
                   <input class="input" id="svReply" name="text" placeholder="Reply to ${esc(u.username)}…" autocomplete="off" aria-label="Reply to story">
                   <button class="icon-btn" type="submit" aria-label="Send reply">${Icon('send', 22)}</button>
                 </form>
                 <button class="icon-btn sv-like ${st.liked ? 'liked' : ''}" data-action="svLike" aria-label="Like story">${Icon('heart', 26)}</button>`}
          </div>
        </div>
        <button class="sv-arrow left" data-action="svPrev" aria-label="Previous story">${Icon('back', 24)}</button>
        <button class="sv-arrow right" data-action="svNext" aria-label="Next story">${Icon('chevronRight', 24)}</button>`;
      const media = $('.sv-media', this.el);
      const stage = $('.sv-stage', this.el);
      stage.addEventListener('pointerdown', (e) => { if (e.target.closest('.sv-tap, .sv-media')) { this.downAt = Date.now(); this.pause(true); } });
      stage.addEventListener('pointerup', () => { if (this.downAt) { this.pause(false); } });
      const reply = $('#svReply');
      if (reply) { reply.addEventListener('focus', () => this.pause(true, true)); reply.addEventListener('blur', () => this.pause(false, true)); }
      media.classList.add('enter');
      this.start(st.type === 'video' ? 8000 : 5000);
    },
    start(dur) {
      clearInterval(this.timer);
      this.progress = 0; this.paused = false; this.hardPause = false;
      const bar = $$('.sv-bars i', this.el)[this.sIndex];
      this.timer = setInterval(() => {
        if (this.paused || this.hardPause) return;
        this.progress += 50 / dur;
        if (bar) bar.style.width = Math.min(100, this.progress * 100) + '%';
        if (this.progress >= 1) this.next();
      }, 50);
    },
    pause(on, hard) {
      if (hard) this.hardPause = on; else this.paused = on;
      const b = $('[data-action="svPause"]', this.el);
      if (b) b.innerHTML = Icon(this.paused || this.hardPause ? 'play' : 'pause', 20);
    },
    togglePause() { this.hardPause = !this.hardPause; this.pause(this.hardPause, true); },
    held() { const h = this.downAt && Date.now() - this.downAt > 280; this.downAt = 0; return h; },
    next() {
      if (this.held()) return;
      const items = this.items();
      if (this.sIndex < items.length - 1) { this.sIndex++; return this.renderItem(); }
      if (this.uIndex < this.queue.length - 1) { this.uIndex++; this.sIndex = 0; return this.renderItem(); }
      this.close();
    },
    prev() {
      if (this.held()) return;
      if (this.sIndex > 0) { this.sIndex--; return this.renderItem(); }
      if (this.uIndex > 0) { this.uIndex--; this.sIndex = this.items().length - 1; return this.renderItem(); }
      this.renderItem();
    },
    stop(fromClose) {
      clearInterval(this.timer);
      document.removeEventListener('keydown', this.keyHandler);
      if (fromClose) App.refresh();
    },
    close() { this.stop(); Overlay.close(this.el, true); App.refresh(); },
    current() { return this.items()[this.sIndex]; },
  };
  window.StoryViewer = SV;
  Actions.openStory = (el) => SV.open(el.dataset.id);
  Actions.svNext = () => SV.next();
  Actions.svPrev = () => SV.prev();
  Actions.svClose = () => SV.close();
  Actions.svPause = () => SV.togglePause();
  Actions.svProfile = (el) => { SV.close(); el.dataset.id === 'me' ? Nav.tab('profile') : Nav.go('user', { id: el.dataset.id }); };
  Actions.svAdd = () => { SV.close(); Actions.addStory(); };
  Actions.svLike = (el) => {
    const st = SV.current(); st.liked = !st.liked; NX.save();
    el.classList.toggle('liked', st.liked);
    if (st.liked) { const r = el.getBoundingClientRect(); burstHearts(r.left + r.width / 2, r.top, 8, ['💜', '💗']); }
  };
  Actions.svViews = () => {
    const st = SV.current();
    SV.pause(true, true);
    Modal.open({
      title: `Seen by ${st.views.length}`,
      body: st.views.length ? `<div class="list">${st.views.map(id => userRow(NX.user(id), '', { size: 44 })).join('')}</div>`
        : emptyState({ icon: 'eye', title: 'No views yet', text: 'When people see your story, they\'ll show up here.' }),
      onClose: () => SV.pause(false, true)
    });
  };
  Actions.svMenu = () => {
    const st = SV.current();
    SV.pause(true, true);
    const m = Modal.menu([
      { label: 'Report story', icon: 'flag', danger: true, onClick: () => { SV.close(); Safety.report({ userId: st.userId, content: 'Story', preview: 'Story' }); } },
      { label: `Block ${NX.user(st.userId).username}`, icon: 'ban', danger: true, onClick: () => { SV.close(); Safety.block(st.userId); } },
    ]);
    const obs = new MutationObserver(() => { if (!document.contains(m)) { SV.pause(false, true); obs.disconnect(); } });
    obs.observe(document.getElementById('overlay-root'), { childList: true });
  };
  Actions.svOwnMenu = () => {
    const st = SV.current();
    SV.pause(true, true);
    Modal.menu([{ label: 'Delete story', icon: 'trash', danger: true, onClick: async () => {
      if (await Modal.confirm({ title: 'Delete this story?', confirm: 'Delete', danger: true, icon: 'trash' })) {
        S.stories = S.stories.filter(s => s.id !== st.id); NX.save();
        Toast.show('Story deleted');
        if (!NX.hasStory('me')) SV.close(); else { SV.sIndex = Math.max(0, SV.sIndex - 1); SV.renderItem(); }
      } else SV.pause(false, true);
    } }]);
  };
  Forms.storyReply = (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    const chat = App.ensureChat(form.dataset.id);
    chat.messages.push({ id: uid('m'), from: 'me', text: `Replied to your story: ${text}`, time: Date.now(), seen: false });
    NX.save();
    form.text.value = '';
    form.text.blur();
    Toast.show('Reply sent', { type: 'success', icon: 'send' });
  };
})();
