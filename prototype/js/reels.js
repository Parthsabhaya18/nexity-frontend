/* Reels: full-screen vertical viewer with snap scrolling, play/pause, likes, comments, share, follow. */
(function () {
  let observer = null;

  const reelCard = (r) => {
    const u = NX.user(r.userId);
    const mine = r.userId === 'me';
    const dur = Math.min(60, r.dur || 14 + (parseInt(r.id.replace(/\D/g, ''), 10) * 11) % 47);
    return `
      <article class="reel" data-reel="${r.id}" style="--dur:${dur}s" aria-label="Reel by ${esc(u.username)}, ${dur} seconds">
        <span class="reel-dur" aria-hidden="true">${Icon('play', 11)} 0:${String(dur).padStart(2, '0')}</span>
        <div class="reel-media" data-dbl="dblLikeReel" data-action="toggleReel" data-id="${r.id}">
          <img src="${esc(r.src)}" alt="" loading="lazy" onerror="this.remove()">
          <span class="reel-flash" aria-hidden="true">${Icon('play', 40)}</span>
          <span class="big-heart" aria-hidden="true">${Icon('heart', 110)}</span>
        </div>
        <div class="reel-shade" aria-hidden="true"></div>
        <div class="reel-progress" aria-hidden="true"><i></i></div>
        <div class="reel-side">
          <button class="reel-act like-btn${r.liked ? ' liked' : ''}" data-action="likeReel" data-id="${r.id}" aria-pressed="${r.liked}" aria-label="Like">${Icon('heart', 30)}<span data-likes="${r.id}">${fmtNum(r.likes)}</span></button>
          <button class="reel-act" data-action="openComments" data-id="${r.id}" data-kind="reel" aria-label="Comments">${Icon('comment', 29)}<span>${r.comments.length}</span></button>
          <button class="reel-act" data-action="share" data-id="${r.id}" data-kind="reel" aria-label="Share">${Icon('send', 28)}<span>Share</span></button>
          <button class="reel-act" data-action="reelMenu" data-id="${r.id}" aria-label="More">${Icon('more', 26)}</button>
        </div>
        <div class="reel-info">
          <div class="reel-user">
            <button class="reel-user-btn" data-go="user" data-id="${u.id}">${avatar(u, 34)}<b>${esc(u.username)}</b></button>
            ${!mine ? `<button class="btn btn-xs btn-outline-light" data-action="follow" data-id="${u.id}">${NX.isFollowing(u.id) ? 'Following' : 'Follow'}</button>` : ''}
          </div>
          <p class="reel-caption">${esc(r.caption)}</p>
          <p class="reel-audio">${Icon('music', 14)} <span>${esc(r.audio)}</span></p>
        </div>
      </article>`;
  };

  Screens.reels = {
    tab: 'reels', dark: true, title: 'Reels',
    render: () => {
      const list = S.reels.filter(r => !NX.isBlocked(r.userId));
      return `
        <div class="reels-wrap">
          <div class="reels-top"><h1>Reels</h1><button class="icon-btn" data-go="create" aria-label="Create">${Icon('camera', 24)}</button></div>
          <div class="reels" id="reels" data-keep-scroll="reels" tabindex="0" aria-label="Reels feed. Use arrow keys to move between reels.">
            ${list.length ? list.map(reelCard).join('') : `<div class="reel">${emptyState({ icon: 'reels', title: 'No reels right now', text: 'Check back soon for new reels.' })}</div>`}
          </div>
          <div class="reels-nav">
            <button class="icon-btn" data-action="reelStep" data-dir="-1" aria-label="Previous reel">${Icon('chevronUp', 26)}</button>
            <button class="icon-btn" data-action="reelStep" data-dir="1" aria-label="Next reel">${Icon('chevronDown', 26)}</button>
          </div>
        </div>`;
    },
    mount(el, params, dir) {
      const box = $('#reels', el);
      if (observer) observer.disconnect();
      observer = new IntersectionObserver((entries) => {
        entries.forEach(en => en.target.classList.toggle('active', en.isIntersecting && en.intersectionRatio > 0.6));
      }, { root: box, threshold: [0, 0.6, 1] });
      $$('.reel', box).forEach(r => observer.observe(r));
      if (App.reelStart && dir !== 'none') {
        const t = box.querySelector(`[data-reel="${App.reelStart}"]`);
        if (t) box.scrollTop = t.offsetTop;
        App.reelStart = null;
      }
      box.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
      });
    }
  };

  function step(d) {
    const box = $('#reels');
    if (!box) return;
    const h = box.clientHeight;
    box.scrollBy({ top: d * h, behavior: 'smooth' });
  }
  Actions.reelStep = (el) => step(+el.dataset.dir);

  Actions.toggleReel = (el) => {
    const reel = el.closest('.reel');
    const paused = reel.classList.toggle('paused');
    const f = $('.reel-flash', reel);
    f.innerHTML = Icon(paused ? 'pause' : 'play', 40);
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
  };
  Actions.likeReel = (el) => App.toggleLike(NX.findContent(el.dataset.id, 'reel'), 'reel');
  Actions.dblLikeReel = (el) => {
    App.toggleLike(NX.findContent(el.dataset.id, 'reel'), 'reel', true);
    el.classList.remove('show-heart'); void el.offsetWidth; el.classList.add('show-heart');
  };
  Actions.reelMenu = (el) => {
    const r = S.reels.find(x => x.id === el.dataset.id);
    const u = NX.user(r.userId);
    if (r.userId === 'me') return Modal.menu([{ label: 'Copy link', icon: 'link', onClick: () => Actions.copyLink({ dataset: { id: r.id, kind: 'reel' } }) }]);
    Modal.menu([
      { label: 'Copy link', icon: 'link', onClick: () => Actions.copyLink({ dataset: { id: r.id, kind: 'reel' } }) },
      { label: 'Report reel', icon: 'flag', danger: true, onClick: () => Safety.report({ userId: u.id, content: 'Reel', preview: r.caption }) },
      { label: `Block ${u.username}`, icon: 'ban', danger: true, onClick: () => Safety.block(u.id) },
    ]);
  };
})();
