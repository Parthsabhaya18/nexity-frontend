/* Create post / story: live camera (getUserMedia) with upload, demo-camera and permission fallbacks,
   then an edit step (filters, caption, story text) that bakes the result into a single image. */
(function () {
  const FILTERS = [
    ['normal', 'Normal', 'none'],
    ['clarendon', 'Clarendon', 'contrast(1.18) saturate(1.35)'],
    ['juno', 'Juno', 'contrast(1.08) saturate(1.45) hue-rotate(-8deg)'],
    ['lark', 'Lark', 'brightness(1.08) contrast(.94) saturate(1.15)'],
    ['valencia', 'Valencia', 'sepia(.25) contrast(1.08) brightness(1.05) saturate(1.2)'],
    ['ocean', 'Ocean', 'hue-rotate(14deg) saturate(1.25) brightness(1.03)'],
    ['fade', 'Fade', 'contrast(.85) brightness(1.1) saturate(.8)'],
    ['moon', 'Moon', 'grayscale(1) contrast(1.1) brightness(1.06)'],
  ];
  const fcss = (id) => (FILTERS.find(f => f[0] === id) || FILTERS[0])[2];
  const TEXT_COLORS = ['#FFFFFF', '#0F172A', '#38BDF8', '#2563EB', '#FFD166', '#FF5C8A', '#22C55E'];
  const MAX_VIDEO = 15000;
  const MAX_PHOTOS = 10;
  const PLACES = [
    ['Marine Drive', 'Mumbai'], ['Gateway of India', 'Mumbai'], ['Juhu Beach', 'Mumbai'],
    ['Connaught Place', 'New Delhi'], ['India Gate', 'New Delhi'],
    ['Lalbagh Botanical Garden', 'Bengaluru'], ['Cubbon Park', 'Bengaluru'],
    ['Sabarmati Riverfront', 'Ahmedabad'], ['Law Garden', 'Ahmedabad'], ['Kankaria Lake', 'Ahmedabad'],
    ['Charminar', 'Hyderabad'], ['Marina Beach', 'Chennai'],
  ];

  const newDraft = (mode = 'post') => ({
    mode, stage: 'capture', images: [], active: 0, picks: [], img: null, type: 'photo', filter: 'normal',
    caption: '', hashtags: [], tags: [], location: '', mentions: [],
    text: '', textX: 50, textY: 42, textColor: '#FFFFFF', textBg: false, editingText: false, facing: 'user', cam: 'starting', demo: 0, flash: false
  });
  const draft = (mode) => {
    const d = (App.draft = App.draft || newDraft(mode));
    d.images = d.images || [];
    d.picks = d.picks || [];
    d.hashtags = d.hashtags || [];
    d.tags = d.tags || [];
    d.mentions = d.mentions || [];
    if (d.textX == null) d.textX = 50;
    if (d.textY == null) d.textY = 42;
    if (d.location == null) d.location = '';
    if (d.active == null) d.active = 0;
    if (d.mode === 'post' && d.stage === 'edit' && !d.images.length && d.img) d.images.push({ src: d.img, filter: d.filter || 'normal' });
    return d;
  };
  function syncActive(d) {
    const cur = d.images[d.active] || d.images[0];
    if (!cur) { d.img = null; d.filter = 'normal'; d.active = 0; return; }
    d.active = Math.max(0, d.images.indexOf(cur));
    d.img = cur.src;
    d.filter = cur.filter || 'normal';
  }
  const parseHashes = (text) => [...new Set((String(text || '').match(/#([A-Za-z\u0900-\u097F][\w\u0900-\u097F]{0,29})/g) || []).map(h => h.slice(1)))];

  /* ---------- Camera ---------- */
  const Cam = {
    stream: null, pending: false,
    async start() {
      const d = draft();
      if (this.pending) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) { d.cam = 'unsupported'; return App.refresh(); }
      this.pending = true;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: d.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        this.pending = false;
        if (!Nav.is('create') || !App.draft || App.draft.stage !== 'capture') { s.getTracks().forEach(t => t.stop()); return; }
        this.stream = s;
        d.cam = 'live';
      } catch (e) {
        this.pending = false;
        d.cam = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : e && e.name === 'NotFoundError' ? 'nocam' : 'denied';
      }
      if (Nav.is('create')) App.refresh();
    },
    attach() {
      const v = $('#camVideo');
      if (v && this.stream && v.srcObject !== this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); }
    },
    stop() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  };
  NX.Cam = Cam;

  /* ---------- Screen ---------- */
  Screens.create = {
    chrome: 'none', dark: true, title: (p) => ({ story: 'New story', reel: 'New reel' }[p.mode] || 'Create'),
    render: (p) => {
      const d = draft(p.mode);
      return d.stage === 'capture' ? captureView(d) : d.mode === 'story' ? storyEditView(d) : postEditView(d);
    },
    mount() {
      const d = draft();
      App.onLeave = () => { Cam.stop(); if (App.draft && App.draft.stage === 'capture') App.draft = null; };
      if (d.stage === 'edit') {
        if (d.mode === 'story') bindStoryDrag();
        else bindEditSwipe();
        return;
      }
      if (d.cam === 'starting') Cam.start();
      else if (d.cam === 'live') { if (Cam.stream) Cam.attach(); else { d.cam = 'starting'; Cam.start(); } }
      bindShutter();
    }
  };

  function camViewport(d) {
    const demoSrc = NX.img.pic(NX.galleryIds[d.demo % NX.galleryIds.length], 720, 1280);
    if (d.cam === 'live') return `<video id="camVideo" class="${d.facing === 'user' ? 'mirror' : ''}" autoplay playsinline muted aria-label="Camera preview"></video>`;
    if (d.cam === 'demo') return `<img id="camDemo" src="${demoSrc}" crossorigin="anonymous" alt="Demo camera preview"><span class="cam-badge">${Icon('aperture', 13)} Demo camera</span>`;
    if (d.cam === 'starting') return `<div class="cam-state">${spinner(30)}<p>Opening camera…</p><small>Allow camera access when your browser asks.</small></div>`;
    const title = d.cam === 'unsupported' ? 'Camera isn\'t available here' : d.cam === 'nocam' ? 'No camera found' : 'Camera access is off';
    const text = d.cam === 'unsupported' ? 'Your browser can\'t open the camera on this page. You can still take a photo with your phone camera or upload one.'
      : d.cam === 'nocam' ? 'We couldn\'t find a camera on this device. Upload a photo instead.'
      : 'To take photos in Nexity, allow camera access in your browser settings — or pick a photo instead.';
    return `
      <div class="cam-state">
        <span class="cam-state-ic">${Icon('camera', 30)}</span>
        <h2>${title}</h2>
        <p>${text}</p>
        <div class="cam-state-actions">
          ${d.cam === 'denied' ? `<button class="btn btn-light" data-action="camRetry">${Icon('refresh', 18)} Try again</button>` : ''}
          <label class="btn btn-glass">${Icon('camera', 18)} ${d.cam === 'unsupported' ? 'Open phone camera' : 'Take with device'}<input type="file" accept="image/*" capture="${d.facing === 'user' ? 'user' : 'environment'}" data-change="uploadDraft" hidden></label>
          <button class="btn btn-ghost-light" data-action="camDemo">${Icon('aperture', 18)} Use demo camera</button>
        </div>
      </div>`;
  }

  function captureView(d) {
    const story = d.mode === 'story', reel = d.mode === 'reel', vertical = story || reel;
    const ready = d.cam === 'live' || d.cam === 'demo';
    return `
      <div class="cam" data-mode="${d.mode}">
        <div class="cam-top">
          <button class="cam-btn" data-action="closeCreate" aria-label="Close camera">${Icon('x', 24)}</button>
          <span class="cam-title">${story ? 'Your story' : reel ? 'New reel' : 'New post'}</span>
          <button class="cam-btn ${d.flash ? 'on' : ''}" data-action="camFlash" aria-pressed="${d.flash}" aria-label="Flash ${d.flash ? 'on' : 'off'}" ${ready ? '' : 'disabled'}>${Icon(d.flash ? 'bolt' : 'boltOff', 22)}</button>
        </div>
        <div class="cam-view">
          <div class="cam-frame ${vertical ? 'story' : 'post'}">
            ${camViewport(d)}
            ${ready ? '<div class="cam-grid" aria-hidden="true"></div>' : ''}
            <div class="cam-flashfx" id="camFlashFx" aria-hidden="true"></div>
            <div class="cam-rec" id="camRec" hidden><i></i><span id="camRecTime">0:00</span></div>
          </div>
        </div>
        <div class="cam-bottom">
          <div class="cam-strip" aria-label="Recent photos">
            <label class="cam-thumb cam-upload" title="Upload from device">${Icon('upload', 20)}<input type="file" accept="image/*" ${story || reel ? '' : 'multiple'} data-change="uploadDraft" hidden><span class="sr-only">Upload ${story || reel ? 'a photo' : 'photos'}</span></label>
            ${NX.galleryIds.map(id => {
              const n = !story && !reel ? d.picks.indexOf(String(id)) : -1;
              return `<button class="cam-thumb${n >= 0 ? ' picked' : ''}" data-action="${story || reel ? 'pickDraft' : 'togglePick'}" data-id="${id}" aria-pressed="${n >= 0}" aria-label="${n >= 0 ? `Photo ${n + 1} selected` : 'Select this photo'}"><img src="${NX.img.pic(id, 160, 160)}" alt="" loading="lazy" onerror="this.remove()">${n >= 0 ? `<span class="cam-num">${n + 1}</span>` : ''}</button>`;
            }).join('')}
          </div>
          <div class="cam-controls">
            <label class="cam-side" title="Gallery">${Icon('image', 24)}<input type="file" accept="image/*" ${story || reel ? '' : 'multiple'} data-change="uploadDraft" hidden><span class="sr-only">${story || reel ? 'Choose from gallery' : 'Choose photos'}</span></label>
            <button class="shutter ${vertical ? 'story' : ''}" id="shutter" aria-label="${vertical ? 'Take photo, or hold to record video' : 'Take photo'}" ${ready ? '' : 'disabled'}><svg class="shutter-ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="39"/></svg><span></span></button>
            <button class="cam-side" data-action="camFlip" aria-label="Switch camera" ${ready ? '' : 'disabled'}>${Icon('flip', 24)}</button>
          </div>
          ${!story && !reel && d.picks.length ? `<button class="cam-next" data-action="picksNext">Next · ${d.picks.length}</button>` : ''}
          ${story ? '' : `<div class="cam-modes" role="tablist" aria-label="What are you creating?">
            <button role="tab" class="${!reel ? 'active' : ''}" aria-selected="${!reel}" data-action="createMode" data-mode="post">Post</button>
            <button role="tab" class="${reel ? 'active' : ''}" aria-selected="${reel}" data-action="createMode" data-mode="reel">Reel</button>
          </div>`}
          <p class="cam-tip">${vertical ? 'Tap for photo · hold for video (up to 15s)' : (d.picks.length ? 'Tap Next, or keep selecting up to 10 photos' : 'Tap photos to select more than one, or take a photo')}</p>
        </div>
      </div>`;
  }

  const filterStrip = (d, cls) => `
    <div class="${cls}" role="listbox" aria-label="Filters">
      ${FILTERS.map(([id, name, css]) => `<button role="option" class="ce-filter ${d.filter === id ? 'active' : ''}" aria-selected="${d.filter === id}" data-action="setFilter" data-f="${id}">
        <span class="ce-thumb"><img src="${esc(d.img)}" alt="" style="filter:${css}"></span><small>${name}</small></button>`).join('')}
    </div>`;

  const tagSummary = (d) => {
    const users = d.tags.map(NX.user).filter(Boolean);
    if (!users.length) return d.mode === 'reel' ? 'Mention people' : 'Tag people';
    const names = users.slice(0, 2).map(u => u.username).join(', ');
    return users.length > 2 ? `${names} +${users.length - 2}` : names;
  };

  function postEditView(d) {
    const reel = d.mode === 'reel';
    if (!reel) syncActive(d);
    const imgs = d.images.length ? d.images : (d.img ? [{ src: d.img, filter: d.filter }] : []);
    const many = !reel && imgs.length > 1;
    return `
      <header class="appbar create-head">
        <button class="icon-btn" data-action="createRetake" aria-label="Back to camera">${Icon('back', 24)}</button>
        <div class="appbar-title"><h1>${reel ? 'New reel' : 'New post'}</h1></div>
        <div class="appbar-actions"><button class="btn btn-sm btn-primary" data-action="publish">Share</button></div>
      </header>
      <div class="page create-edit">
        <div class="ce-preview${reel ? ' reel' : ''}">
          <img src="${esc(d.img)}" alt="${reel ? 'Your reel' : 'Your photo'}" style="filter:${fcss(d.filter)}">
          ${reel && d.type === 'video' ? `<span class="se-video">${Icon('play', 12)} Video</span>` : ''}
          ${many ? `<button class="ce-nav prev" data-action="postPhoto" data-dir="-1" aria-label="Previous photo">${Icon('back', 18)}</button>
            <button class="ce-nav next" data-action="postPhoto" data-dir="1" aria-label="Next photo">${Icon('chevronRight', 18)}</button>
            <div class="ce-dots">${imgs.map((_, i) => `<button class="${i === d.active ? 'on' : ''}" data-action="postPhotoGo" data-i="${i}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>
            <span class="ce-count">${d.active + 1}/${imgs.length}</span>` : ''}
        </div>
        ${!reel ? `<div class="ce-photos" aria-label="Selected photos">
          ${imgs.map((im, i) => `<div class="ce-photo-wrap${i === d.active ? ' on' : ''}">
            <button class="ce-photo" data-action="postPhotoGo" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(im.src)}" alt="" style="filter:${fcss(im.filter || 'normal')}"></button>
            <button class="ce-photo-x" data-action="removePhoto" data-i="${i}" aria-label="Remove photo ${i + 1}">${Icon('x', 12)}</button>
          </div>`).join('')}
          ${imgs.length < MAX_PHOTOS ? `<button class="ce-photo add" data-action="addMorePhotos" aria-label="Add photos">${Icon('plus', 22)}</button>` : ''}
        </div>` : ''}
        ${filterStrip(d, 'ce-filters')}
        <div class="ce-card">
          <div class="ce-caption">
            ${avatar(S.me, 38)}
            <div class="ce-caption-main">
              <span class="ce-label">Description</span>
              <label class="sr-only" for="caption">Description</label>
              <textarea id="caption" rows="3" maxlength="2200" placeholder="Write a description… #tags @people" data-input="caption">${esc(d.caption)}</textarea>
            </div>
          </div>
          <div class="ce-hash-block">
            <span class="ce-label">${Icon('hash', 14)} Hashtags</span>
            <form class="ce-hashes" data-form="addHashtag">
              ${d.hashtags.map(h => `<button type="button" class="ce-chip" data-action="removeHash" data-tag="${esc(h)}">#${esc(h)}${Icon('x', 12)}</button>`).join('')}
              <input name="tag" placeholder="${d.hashtags.length ? 'Add another' : 'Add a hashtag'}" maxlength="30" autocomplete="off" aria-label="Add a hashtag">
            </form>
          </div>
          <div class="ce-caption-foot"><span>${reel ? 'Shown on your reel' : 'Shown under your photos'}</span><span id="capCount">${d.caption.length}/2200</span></div>
        </div>
        <div class="ce-card ce-rows">
          <button class="ce-row" data-action="openLocation">${Icon('map', 20)}<span><b>${d.location ? esc(d.location) : 'Add location'}</b><small>${d.location ? 'Tap to change' : 'Where was this taken?'}</small></span>${Icon('chevronRight', 18)}</button>
          <button class="ce-row" data-action="openTagPeople">${Icon('userPlus', 20)}<span><b>${esc(tagSummary(d))}</b><small>${d.tags.length ? 'Tap to edit' : (reel ? 'Mention people in this reel' : 'Tag people in this post')}</small></span>${Icon('chevronRight', 18)}</button>
          ${d.tags.length ? `<div class="ce-chips">${d.tags.map(id => { const u = NX.user(id); return u ? `<button type="button" class="ce-chip" data-action="removeTag" data-id="${id}">${esc(u.username)}${Icon('x', 12)}</button>` : ''; }).join('')}</div>` : ''}
          <div class="ce-row">${Icon('users', 20)}<span><b>Audience</b><small>Visible to everyone who can see your profile</small></span></div>
          <button class="ce-row" data-action="createRetake">${Icon('camera', 20)}<span><b>${reel ? 'Retake or choose another' : 'Change photos'}</b><small>${reel ? 'Go back to the camera' : 'Back to the camera. Your description stays.'}</small></span>${Icon('chevronRight', 18)}</button>
        </div>
      </div>`;
  }

  function storyEditView(d) {
    const t = d.text;
    const stickers = (d.mentions || []).map(m =>
      `<button type="button" class="se-mention" data-drag="mention" data-id="${esc(m.id)}" style="left:${m.x}%;top:${m.y}%">@${esc(m.username)}</button>`).join('');
    const look = (FILTERS.find(f => f[0] === d.filter) || FILTERS[0])[1];
    return `
      <div class="se">
        <div class="se-stage" id="se-stage">
          <img src="${esc(d.img)}" alt="Your story" style="filter:${fcss(d.filter)}">
          ${stickers}
          ${t && !d.editingText ? `<button type="button" class="se-text ${d.textBg ? 'bg' : ''}" data-drag="text" style="left:${d.textX}%;top:${d.textY}%;--tc:${d.textColor}">${esc(t)}</button>` : ''}
          ${d.type === 'video' ? `<span class="se-video">${Icon('play', 12)} Video</span>` : ''}
          <div class="se-top">
            <button class="cam-btn" data-action="createRetake" aria-label="Back to camera">${Icon('back', 24)}</button>
            <span class="sv-spacer"></span>
            <button class="cam-btn" data-action="storyText" aria-label="Add text">${Icon('type', 22)}</button>
            <button class="cam-btn" data-action="storyMention" aria-label="Mention someone">${Icon('userPlus', 22)}</button>
            <button class="cam-btn" data-action="nextFilter" aria-label="Filter, ${esc(look)}">${Icon('sparkles', 22)}</button>
          </div>
          ${d.editingText ? `
            <div class="se-editor">
              <div class="se-editor-top">
                <button class="se-bg-toggle ${d.textBg ? 'on' : ''}" data-action="storyTextBg" aria-pressed="${d.textBg}" aria-label="Text background">A</button>
                <div class="se-colors">${TEXT_COLORS.map(c => `<button class="se-color ${d.textColor === c ? 'on' : ''}" style="--c:${c}" data-action="storyTextColor" data-c="${c}" aria-label="Text colour ${c}"></button>`).join('')}</div>
                <button class="btn btn-sm btn-light" data-action="storyTextDone">Done</button>
              </div>
              <textarea id="storyTextInput" class="se-input ${d.textBg ? 'bg' : ''}" style="--tc:${d.textColor}" rows="2" maxlength="120" placeholder="Type something…" data-input="storyTextInput" aria-label="Story text">${esc(t)}</textarea>
            </div>` : ''}
        </div>
        ${filterStrip(d, 'se-filters')}
        <p class="se-hint">Drag text and mentions to place them. Tap the text to edit it. Filter: ${esc(look)}</p>
        <div class="se-bottom">
          <p>${Icon('clock', 14)} Disappears after 24 hours · you'll see who viewed it</p>
          <button class="se-share" data-action="publish">${avatar(S.me, 30)}<span>Share to your story</span>${Icon('arrowRight', 18)}</button>
        </div>
      </div>`;
  }

  /* ---------- Capture ---------- */
  function frameSize(mode) { return mode === 'post' ? [1080, 1080] : [720, 1280]; }

  function grabFrame() {
    const d = draft();
    const src = d.cam === 'live' ? $('#camVideo') : $('#camDemo');
    if (!src) return null;
    const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
    if (!sw || !sh) return null;
    const [W, H] = frameSize(d.mode);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;
    if (d.cam === 'live' && d.facing === 'user') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    try { return c.toDataURL('image/jpeg', .86); } catch (e) { return d.cam === 'demo' ? src.src : null; }
  }

  function flashFx() {
    const fx = $('#camFlashFx');
    if (!fx) return;
    fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
  }

  function takeShot(type = 'photo') {
    const d = draft();
    const shot = grabFrame();
    if (!shot) { Toast.show('Camera isn\'t ready yet — try again in a second.', { type: 'error' }); return; }
    flashFx();
    setTimeout(() => {
      if (d.mode === 'post') {
        const picked = d.picks.map(id => ({ src: NX.img.pic(id, 1080, 1080), filter: 'normal', galleryId: id }));
        d.images = [...picked, { src: shot, filter: 'normal' }].slice(0, MAX_PHOTOS);
        d.picks = [];
        d.active = d.images.length - 1;
        syncActive(d);
      } else d.img = shot;
      d.type = type; d.stage = 'edit'; d.filter = d.mode === 'post' ? d.filter : 'normal';
      Cam.stop();
      App.refresh();
    }, 180);
  }

  /* Tap = photo. In story and reel mode, holding the shutter "records" up to 15s and saves a video. */
  function bindShutter() {
    const b = $('#shutter');
    if (!b) return;
    let holdT = null, recT = null, started = 0, recording = false, skipClick = false;
    const stopRec = () => {
      clearTimeout(holdT); clearInterval(recT); holdT = null;
      if (!recording) return;
      recording = false; skipClick = true;
      b.classList.remove('rec'); const r = $('#camRec'); if (r) r.hidden = true;
      takeShot('video');
    };
    b.addEventListener('pointerdown', (e) => {
      if (draft().mode === 'post' || b.disabled || e.button > 0) return;
      holdT = setTimeout(() => {
        recording = true; started = Date.now();
        b.classList.add('rec');
        const r = $('#camRec'); if (r) r.hidden = false;
        recT = setInterval(() => {
          const ms = Date.now() - started;
          const el = $('#camRecTime'); if (el) el.textContent = `0:${String(Math.min(15, Math.floor(ms / 1000))).padStart(2, '0')}`;
          if (ms >= MAX_VIDEO) stopRec();
        }, 200);
      }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stopRec));
    b.addEventListener('click', () => {
      if (skipClick) { skipClick = false; return; }
      if (recording || b.disabled) return;
      takeShot('photo');
    });
  }

  Actions.camRetry = () => { const d = draft(); d.cam = 'starting'; App.refresh(); };
  Actions.camDemo = () => { const d = draft(); Cam.stop(); d.cam = 'demo'; App.refresh(); };
  Actions.camFlash = () => { const d = draft(); d.flash = !d.flash; Toast.show(d.flash ? 'Flash on' : 'Flash off'); App.refresh(); };
  Actions.camFlip = () => {
    const d = draft();
    if (d.cam === 'demo') { d.demo += 1; return App.refresh(); }
    Cam.stop();
    d.facing = d.facing === 'user' ? 'environment' : 'user';
    d.cam = 'starting';
    App.refresh();
  };
  Actions.createMode = (el) => {
    const d = draft();
    d.mode = el.dataset.mode;
    if (d.mode !== 'post') d.picks = [];
    App.refresh();
  };
  Actions.togglePick = (el) => {
    const d = draft();
    const id = el.dataset.id;
    const i = d.picks.indexOf(id);
    if (i >= 0) d.picks.splice(i, 1);
    else if (d.picks.length >= MAX_PHOTOS) Toast.show('You can add up to 10 photos.', { type: 'warning' });
    else d.picks.push(id);
    App.refresh();
  };
  Actions.picksNext = () => {
    const d = draft();
    if (!d.picks.length) return;
    d.images = d.picks.map(id => ({ src: NX.img.pic(id, 1080, 1080), filter: 'normal', galleryId: id }));
    d.picks = [];
    d.active = 0;
    d.type = 'photo';
    d.stage = 'edit';
    syncActive(d);
    Cam.stop();
    App.refresh();
  };
  Actions.pickDraft = (el) => {
    const d = draft();
    const [W, H] = frameSize(d.mode);
    d.img = NX.img.pic(el.dataset.id, W, H); d.type = 'photo'; d.stage = 'edit'; d.filter = 'normal';
    Cam.stop();
    App.refresh();
  };
  Inputs.uploadDraft = async (el) => {
    const d = draft();
    const files = [...(el.files || [])];
    el.value = '';
    if (!files.length) return;
    try {
      if (d.mode !== 'post') {
        d.img = await readImage(files[0], 1080);
        d.type = 'photo'; d.stage = 'edit'; d.filter = 'normal';
        Cam.stop();
        App.refresh();
        return;
      }
      const room = MAX_PHOTOS - (d.stage === 'edit' ? d.images.length : 0);
      const batch = files.slice(0, Math.max(0, room));
      if (!batch.length) { Toast.show('You can add up to 10 photos.', { type: 'warning' }); return; }
      const loaded = [];
      for (const f of batch) loaded.push({ src: await readImage(f, 1080), filter: 'normal' });
      if (d.stage === 'edit') {
        d.active = d.images.length;
        d.images.push(...loaded);
      } else {
        const picked = d.picks.map(id => ({ src: NX.img.pic(id, 1080, 1080), filter: 'normal', galleryId: id }));
        d.images = [...picked, ...loaded].slice(0, MAX_PHOTOS);
        d.active = Math.max(0, d.images.length - loaded.length);
        d.picks = [];
        d.type = 'photo';
        d.stage = 'edit';
        Cam.stop();
      }
      syncActive(d);
      if (files.length > batch.length) Toast.show('You can add up to 10 photos.', { type: 'warning' });
      Modal.closeAll();
      App.refresh();
    } catch (e) { Toast.show(e.message, { type: 'error' }); }
  };

  /* ---------- Edit ---------- */
  Actions.createRetake = () => {
    const d = draft();
    const keep = d.mode === 'post' ? { caption: d.caption, hashtags: d.hashtags, tags: d.tags, location: d.location } : {};
    Object.assign(d, { stage: 'capture', img: null, images: [], picks: [], active: 0, type: 'photo', filter: 'normal', text: '', editingText: false, cam: d.cam === 'demo' ? 'demo' : 'starting' }, keep);
    App.refresh();
  };
  Actions.setFilter = (el) => {
    const d = draft();
    d.filter = el.dataset.f;
    if (d.mode === 'post' && d.images[d.active]) d.images[d.active].filter = d.filter;
    App.refresh();
  };
  Actions.postPhoto = (el) => {
    const d = draft();
    const n = d.images.length;
    if (n < 2) return;
    d.active = (d.active + (+el.dataset.dir) + n) % n;
    syncActive(d);
    App.refresh();
  };
  Actions.postPhotoGo = (el) => {
    const d = draft();
    d.active = +el.dataset.i;
    syncActive(d);
    App.refresh();
  };
  Actions.removePhoto = (el) => {
    const d = draft();
    d.images.splice(+el.dataset.i, 1);
    if (!d.images.length) return Actions.createRetake();
    d.active = Math.min(d.active, d.images.length - 1);
    syncActive(d);
    App.refresh();
  };
  function galleryPicker() {
    const d = draft();
    return NX.galleryIds.map(id => {
      const on = d.images.some(im => String(im.galleryId) === String(id));
      return `<button class="gallery-item${on ? ' selected' : ''}" data-action="addGalleryPhoto" data-id="${id}" aria-pressed="${on}" aria-label="${on ? 'Remove this photo' : 'Add this photo'}"><img src="${NX.img.pic(id, 240, 240)}" alt="" loading="lazy" onerror="this.remove()"></button>`;
    }).join('');
  }
  Actions.addMorePhotos = () => {
    Modal.open({
      title: 'Add photos', cls: 'sheet-tall',
      body: `<div class="gallery" id="addPhotoGrid">${galleryPicker()}</div>
        <label class="btn btn-secondary btn-block ce-upload-more">${Icon('upload', 18)} Upload from device<input type="file" accept="image/*" multiple data-change="uploadDraft" hidden></label>`,
      footer: '<button class="btn btn-primary btn-block" data-close>Done</button>',
      onClose: () => {
        const d = draft();
        if (!d || d.mode !== 'post' || d.stage !== 'edit') return;
        if (!d.images.length) {
          d.stage = 'capture';
          d.cam = d.cam === 'demo' ? 'demo' : 'starting';
        } else syncActive(d);
        if (Nav.is('create')) App.refresh();
      }
    });
  };
  Actions.addGalleryPhoto = (el) => {
    const d = draft();
    const id = el.dataset.id;
    const i = d.images.findIndex(im => im.galleryId === id);
    if (i >= 0) d.images.splice(i, 1);
    else if (d.images.length >= MAX_PHOTOS) { Toast.show('You can add up to 10 photos.', { type: 'warning' }); return; }
    else d.images.push({ src: NX.img.pic(id, 1080, 1080), filter: 'normal', galleryId: id });
    d.active = Math.max(0, Math.min(d.active, d.images.length - 1));
    if (i < 0) d.active = d.images.length - 1;
    const box = $('#addPhotoGrid');
    if (box) box.innerHTML = galleryPicker();
  };
  Actions.nextFilter = () => {
    const d = draft();
    const i = FILTERS.findIndex(f => f[0] === d.filter);
    d.filter = FILTERS[(i + 1) % FILTERS.length][0];
    App.refresh();
    Toast.show(FILTERS.find(f => f[0] === d.filter)[1]);
  };
  Inputs.caption = (el) => { draft().caption = el.value; const c = $('#capCount'); if (c) c.textContent = `${el.value.length}/2200`; };
  Forms.addHashtag = (form) => {
    const d = draft();
    const raw = form.tag.value.trim().replace(/^#/, '');
    if (!raw) return;
    raw.split(/[\s,]+/).forEach(part => {
      const tag = part.replace(/^#/, '').replace(/[^\w\u0900-\u097F]/g, '').slice(0, 30);
      if (!tag || d.hashtags.some(h => h.toLowerCase() === tag.toLowerCase())) return;
      if (d.hashtags.length >= 30) return;
      d.hashtags.push(tag);
    });
    App.refresh();
    setTimeout(() => { const i = document.querySelector('.ce-hashes input'); if (i) i.focus(); }, 40);
  };
  Actions.removeHash = (el) => {
    const d = draft();
    d.hashtags = d.hashtags.filter(h => h !== el.dataset.tag);
    App.refresh();
  };
  Actions.removeTag = (el) => {
    const d = draft();
    d.tags = d.tags.filter(id => id !== el.dataset.id);
    App.refresh();
  };
  function peopleSheet() {
    const d = draft();
    const q = (App.tagQuery || '').toLowerCase();
    const people = NX.allUsers().filter(u => u.id !== 'me' && !NX.isBlocked(u.id) && (!q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)));
    if (!people.length) return `<p class="tag-empty">${Icon('search', 26)}<b>No one matches that</b><span>Try another name.</span></p>`;
    return people.map(u => {
      const on = d.tags.includes(u.id);
      return `<button class="tag-person${on ? ' on' : ''}" data-action="toggleTag" data-id="${u.id}" aria-pressed="${on}">
        ${avatar(u, 44)}<span><b>${esc(u.username)}</b><small>${esc(u.name)}</small></span><i class="tag-check">${on ? Icon('check', 14) : ''}</i></button>`;
    }).join('');
  }
  Actions.openTagPeople = () => {
    App.tagQuery = '';
    Modal.open({
      title: draft().mode === 'reel' ? 'Mention people' : 'Tag people', cls: 'sheet-tall',
      body: `<div class="tag-search"><input class="input" id="tagSearch" placeholder="Search people" data-input="tagSearch" autocomplete="off" data-autofocus aria-label="Search people"></div><div class="tag-list" id="tagList">${peopleSheet()}</div>`,
      footer: '<button class="btn btn-primary btn-block" data-close>Done</button>',
      onClose: () => { if (Nav.is('create')) App.refresh(); }
    });
  };
  Inputs.tagSearch = (el) => { App.tagQuery = el.value.trim(); const list = $('#tagList'); if (list) list.innerHTML = peopleSheet(); };
  Actions.toggleTag = (el) => {
    const d = draft();
    const id = el.dataset.id;
    const i = d.tags.indexOf(id);
    if (i >= 0) d.tags.splice(i, 1);
    else if (d.tags.length >= 20) { Toast.show('You can tag up to 20 people.', { type: 'warning' }); return; }
    else d.tags.push(id);
    const list = $('#tagList');
    if (list) list.innerHTML = peopleSheet();
  };
  function placeSheet() {
    const q = (App.locQuery || '').trim().toLowerCase();
    const list = PLACES.filter(p => !q || `${p[0]} ${p[1]}`.toLowerCase().includes(q));
    const typed = (App.locQuery || '').trim();
    const custom = typed && !list.some(p => p[0].toLowerCase() === q)
      ? `<button class="tag-person" data-action="useTypedPlace"><span class="tag-ic">${Icon('map', 18)}</span><span><b>Use “${esc(typed)}”</b><small>Add this place</small></span></button>` : '';
    const rows = list.map(([name, city]) => `<button class="tag-person" data-action="pickPlace" data-place="${esc(name + ', ' + city)}"><span class="tag-ic">${Icon('map', 18)}</span><span><b>${esc(name)}</b><small>${esc(city)}</small></span></button>`).join('');
    return custom + rows || `<p class="tag-empty">${Icon('map', 26)}<b>No places match</b><span>Type a place name to use it.</span></p>`;
  }
  Actions.openLocation = () => {
    App.locQuery = '';
    const d = draft();
    const el = Modal.open({
      title: 'Add location', cls: 'sheet-tall',
      body: `<div class="tag-search"><input class="input" id="locSearch" placeholder="Search a place" data-input="locSearch" autocomplete="off" data-autofocus aria-label="Search a place"></div><div class="tag-list" id="locList">${placeSheet()}</div>`,
      footer: d.location ? '<button class="btn btn-ghost btn-block" data-action="clearLocation">Remove location</button>' : '',
      onClose: () => { if (Nav.is('create')) App.refresh(); }
    });
    const input = el.querySelector('#locSearch');
    input && input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = (App.locQuery || '').trim();
      if (!q) return;
      const hit = PLACES.find(p => p[0].toLowerCase() === q.toLowerCase());
      draft().location = hit ? `${hit[0]}, ${hit[1]}` : q.slice(0, 80);
      Modal.close();
    });
  };
  Inputs.locSearch = (el) => { App.locQuery = el.value; const list = $('#locList'); if (list) list.innerHTML = placeSheet(); };
  Actions.pickPlace = (el) => { draft().location = el.dataset.place; Modal.close(); };
  Actions.useTypedPlace = () => { draft().location = (App.locQuery || '').trim().slice(0, 80); Modal.close(); };
  Actions.clearLocation = () => { draft().location = ''; Modal.close(); };
  Actions.storyText = () => { draft().editingText = true; App.refresh(); setTimeout(() => { const t = $('#storyTextInput'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 50); };
  Inputs.storyTextInput = (el) => { draft().text = el.value; };
  Actions.storyTextColor = (el) => { draft().textColor = el.dataset.c; App.refresh(); const t = $('#storyTextInput'); t && t.focus(); };
  Actions.storyTextBg = () => { const d = draft(); d.textBg = !d.textBg; App.refresh(); const t = $('#storyTextInput'); t && t.focus(); };
  Actions.storyTextDone = () => { const d = draft(); d.text = d.text.trim(); d.editingText = false; App.refresh(); };
  function storyPeople() {
    const d = draft();
    const q = (App.tagQuery || '').toLowerCase();
    const people = NX.allUsers().filter(u => u.id !== 'me' && !NX.isBlocked(u.id) && (!q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)));
    if (!people.length) return `<p class="tag-empty">${Icon('search', 26)}<b>No one matches that</b><span>Try another name.</span></p>`;
    return people.map(u => {
      const on = d.mentions.some(m => m.userId === u.id);
      return `<button class="tag-person${on ? ' on' : ''}" data-action="toggleStoryMention" data-id="${u.id}" aria-pressed="${on}">
        ${avatar(u, 44)}<span><b>${esc(u.username)}</b><small>${esc(u.name)}</small></span><i class="tag-check">${on ? Icon('check', 14) : ''}</i></button>`;
    }).join('');
  }
  function openStoryMention() {
    Modal.open({
      title: 'Mention', cls: 'sheet-tall',
      body: `<div class="tag-search"><input class="input" id="tagSearch" placeholder="Search people" data-input="storyMentionSearch" autocomplete="off" data-autofocus aria-label="Search people" value="${esc(App.tagQuery || '')}"></div><div class="tag-list" id="tagList">${storyPeople()}</div>`,
      footer: '<button class="btn btn-primary btn-block" data-close>Done</button>',
      onClose: () => { App.tagQuery = ''; if (Nav.is('create')) App.refresh(); }
    });
  }
  Actions.storyMention = () => { App.tagQuery = ''; openStoryMention(); };
  Inputs.storyMentionSearch = (el) => { App.tagQuery = el.value.trim(); const list = $('#tagList'); if (list) list.innerHTML = storyPeople(); };
  Actions.toggleStoryMention = (el) => {
    const d = draft();
    const id = el.dataset.id;
    const i = d.mentions.findIndex(m => m.userId === id);
    if (i >= 0) d.mentions.splice(i, 1);
    else if (d.mentions.length >= 5) { Toast.show('You can mention up to 5 people.', { type: 'warning' }); return; }
    else {
      const u = NX.user(id);
      if (!u) return;
      d.mentions.push({ id: uid('mn'), userId: id, username: u.username, x: 50, y: Math.min(72, 30 + d.mentions.length * 12) });
    }
    const list = $('#tagList');
    if (list) list.innerHTML = storyPeople();
  };
  function bindStoryDrag() {
    const stage = document.getElementById('se-stage');
    if (!stage) return;
    stage.querySelectorAll('[data-drag]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = stage.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const origL = parseFloat(el.style.left);
        const origT = parseFloat(el.style.top);
        let moved = false;
        const move = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
          const left = Math.min(86, Math.max(14, origL + (dx / rect.width) * 100));
          const top = Math.min(86, Math.max(14, origT + (dy / rect.height) * 100));
          el.style.left = `${left}%`;
          el.style.top = `${top}%`;
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          const d = draft();
          const left = parseFloat(el.style.left);
          const top = parseFloat(el.style.top);
          if (el.dataset.drag === 'text') {
            d.textX = left;
            d.textY = top;
            if (!moved) Actions.storyText();
          } else {
            const sticker = d.mentions.find(m => m.id === el.dataset.id);
            if (sticker) { sticker.x = left; sticker.y = top; }
          }
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    });
  }

  Actions.addStory = () => { App.draft = newDraft('story'); Nav.go('create', { mode: 'story' }); };
  Actions.openCreateMenu = () => {
    const opt = (mode, ic, title, text) => `
      <button class="create-opt" data-action="startCreate" data-mode="${mode}">
        <span class="create-opt-ic ${mode}">${Icon(ic, 24)}</span>
        <span class="create-opt-txt"><b>${title}</b><small>${text}</small></span>${Icon('chevronRight', 18)}
      </button>`;
    Modal.open({
      title: 'Create', cls: 'create-sheet',
      body: `<div class="create-opts">
        ${opt('post', 'image', 'Post', 'Photos, a description, tags, a place and hashtags')}
        ${opt('reel', 'reels', 'Reel', 'Video, a description, mentions, a place and hashtags')}
      </div>`
    });
  };
  Actions.startCreate = (el) => {
    Modal.closeAll();
    App.draft = newDraft(el.dataset.mode);
    Nav.go('create', { mode: el.dataset.mode });
  };
  Actions.closeCreate = async () => {
    const d = draft();
    if (d.stage === 'edit' && !(await Modal.confirm({ title: 'Discard this draft?', message: 'If you leave now, you\'ll lose this photo and your edits.', confirm: 'Discard', danger: true }))) return;
    Cam.stop();
    App.draft = null;
    Nav.back();
  };
  Actions.closeCreateEdit = Actions.closeCreate;

  const loadImg = (src) => new Promise((res, rej) => {
    const im = new Image();
    if (!src.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });

  function wrapLines(ctx, text, maxW) {
    const out = [];
    text.split('\n').forEach(par => {
      let line = '';
      par.split(' ').forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }

  function bindEditSwipe() {
    const frame = $('.ce-preview');
    const d = draft();
    if (!frame || d.mode !== 'post' || d.images.length < 2) return;
    let x0 = 0, dx = 0, on = false;
    frame.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; on = true; x0 = e.clientX; dx = 0; });
    frame.addEventListener('pointermove', (e) => { if (on) dx = e.clientX - x0; });
    frame.addEventListener('pointerup', () => {
      if (!on) return;
      on = false;
      if (Math.abs(dx) < 48) return;
      d.active = (d.active + (dx < 0 ? 1 : -1) + d.images.length) % d.images.length;
      syncActive(d);
      App.refresh();
    });
    frame.addEventListener('pointercancel', () => { on = false; });
  }

  async function bakeShot(src, filter, mode) {
    const [W, H] = frameSize(mode);
    try {
      const im = await loadImg(src);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const k = Math.max(W / im.width, H / im.height), dw = im.width * k, dh = im.height * k;
      ctx.filter = fcss(filter);
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      return c.toDataURL('image/jpeg', .84);
    } catch (e) { return src; }
  }

  /* Bakes filter + story text into one JPEG so every surface (feed, grid, viewer) shows the same result. */
  async function bake(d) {
    const [W, H] = frameSize(d.mode);
    try {
      const im = await loadImg(d.img);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const k = Math.max(W / im.width, H / im.height), dw = im.width * k, dh = im.height * k;
      ctx.filter = fcss(d.filter);
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.filter = 'none';
      if (d.mode === 'story' && d.text) {
        ctx.font = '800 54px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const cx = ((d.textX ?? 50) / 100) * W;
        const cy = ((d.textY ?? 42) / 100) * H;
        const lines = wrapLines(ctx, d.text, W - 140), lh = 68, top = cy - ((lines.length - 1) * lh) / 2;
        lines.forEach((ln, i) => {
          const y = top + i * lh;
          if (d.textBg) {
            const w = ctx.measureText(ln).width + 40;
            ctx.fillStyle = d.textColor === '#FFFFFF' ? 'rgba(15,23,42,.82)' : '#FFFFFF';
            ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(cx - w / 2, y - 34, w, 68, 14) : ctx.rect(cx - w / 2, y - 34, w, 68)); ctx.fill();
          } else { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; }
          ctx.fillStyle = d.textColor; ctx.fillText(ln, cx, y);
          ctx.shadowBlur = 0;
        });
      }
      if (d.mode === 'story' && d.mentions && d.mentions.length) {
        ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        d.mentions.forEach((m) => {
          const label = `@${m.username}`;
          const x = (m.x / 100) * W;
          const y = (m.y / 100) * H;
          const w = ctx.measureText(label).width + 36;
          ctx.fillStyle = 'rgba(15,23,42,.78)';
          ctx.beginPath();
          (ctx.roundRect ? ctx.roundRect(x - w / 2, y - 24, w, 48, 24) : ctx.rect(x - w / 2, y - 24, w, 48));
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, x, y);
        });
      }
      return c.toDataURL('image/jpeg', .84);
    } catch (e) { return d.img; }
  }

  Actions.publish = async (el) => {
    const d = draft();
    if (!d.img) return;
    if (d.editingText) Actions.storyTextDone();
    const btn = $('[data-action="publish"]') || el;
    setBusy(btn, true, 'Sharing…');
    const img = d.mode === 'post' ? d.img : await bake(d);
    await delay(500);
    if (d.mode === 'story') {
      S.stories.push({ id: uid('st'), userId: 'me', type: d.type, src: img, time: Date.now(), views: [] });
      Toast.show('Added to your story ✨', { type: 'success' });
    } else if (d.mode === 'reel') {
      const id = uid('r');
      const caption = d.caption.trim();
      const hashtags = [...d.hashtags];
      parseHashes(caption).forEach(h => { if (!hashtags.some(x => x.toLowerCase() === h.toLowerCase())) hashtags.push(h); });
      S.reels.unshift({
        id, userId: 'me', src: img, caption, hashtags, tags: [...d.tags], location: (d.location || '').trim(),
        audio: `Original audio · ${S.me.username}`, likes: 0, liked: false, time: Date.now(), comments: [], dur: d.type === 'video' ? 15 : 10
      });
      App.draft = null;
      NX.save();
      App.reelStart = id;
      Toast.show('Reel shared ✨', { type: 'success' });
      return Nav.tab('reels');
    } else {
      const sources = d.images.length ? d.images : [{ src: d.img, filter: d.filter }];
      const images = [];
      for (const im of sources) images.push(await bakeShot(im.src, im.filter || 'normal', 'post'));
      const caption = d.caption.trim();
      const hashtags = [...d.hashtags];
      parseHashes(caption).forEach(h => { if (!hashtags.some(x => x.toLowerCase() === h.toLowerCase())) hashtags.push(h); });
      S.posts.unshift({
        id: uid('p'), userId: 'me', img: images[0], images, caption, hashtags,
        tags: [...d.tags], location: (d.location || '').trim(),
        likes: 0, liked: false, time: Date.now(), comments: []
      });
      Toast.show('Post shared ✨', { type: 'success' });
    }
    App.draft = null;
    NX.save();
    App.loaded.home = true;
    Nav.tab('home');
  };
})();
