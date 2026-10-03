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

  const newDraft = (mode = 'post') => ({ mode, stage: 'capture', img: null, type: 'photo', filter: 'normal', caption: '', text: '', textColor: '#FFFFFF', textBg: false, editingText: false, facing: 'user', cam: 'starting', demo: 0, flash: false });
  const draft = (mode) => (App.draft = App.draft || newDraft(mode));

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
    chrome: 'none', dark: true, title: (p) => (p.mode === 'story' ? 'New story' : 'Create'),
    render: (p) => {
      const d = draft(p.mode);
      return d.stage === 'capture' ? captureView(d) : d.mode === 'story' ? storyEditView(d) : postEditView(d);
    },
    mount() {
      const d = draft();
      App.onLeave = () => { Cam.stop(); if (App.draft && App.draft.stage === 'capture') App.draft = null; };
      if (d.stage !== 'capture') return;
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
    const story = d.mode === 'story';
    const ready = d.cam === 'live' || d.cam === 'demo';
    return `
      <div class="cam" data-mode="${d.mode}">
        <div class="cam-top">
          <button class="cam-btn" data-action="closeCreate" aria-label="Close camera">${Icon('x', 24)}</button>
          <span class="cam-title">${story ? 'Your story' : 'New post'}</span>
          <button class="cam-btn ${d.flash ? 'on' : ''}" data-action="camFlash" aria-pressed="${d.flash}" aria-label="Flash ${d.flash ? 'on' : 'off'}" ${ready ? '' : 'disabled'}>${Icon(d.flash ? 'bolt' : 'boltOff', 22)}</button>
        </div>
        <div class="cam-view">
          <div class="cam-frame ${story ? 'story' : 'post'}">
            ${camViewport(d)}
            ${ready ? '<div class="cam-grid" aria-hidden="true"></div>' : ''}
            <div class="cam-flashfx" id="camFlashFx" aria-hidden="true"></div>
            <div class="cam-rec" id="camRec" hidden><i></i><span id="camRecTime">0:00</span></div>
          </div>
        </div>
        <div class="cam-bottom">
          <div class="cam-strip" aria-label="Recent photos">
            <label class="cam-thumb cam-upload" title="Upload from device">${Icon('upload', 20)}<input type="file" accept="image/*" data-change="uploadDraft" hidden><span class="sr-only">Upload a photo</span></label>
            ${NX.galleryIds.map(id => `<button class="cam-thumb" data-action="pickDraft" data-id="${id}" aria-label="Use this photo"><img src="${NX.img.pic(id, 160, 160)}" alt="" loading="lazy" onerror="this.remove()"></button>`).join('')}
          </div>
          <div class="cam-controls">
            <label class="cam-side" title="Gallery">${Icon('image', 24)}<input type="file" accept="image/*" data-change="uploadDraft" hidden><span class="sr-only">Choose from gallery</span></label>
            <button class="shutter ${story ? 'story' : ''}" id="shutter" aria-label="${story ? 'Take photo, or hold to record video' : 'Take photo'}" ${ready ? '' : 'disabled'}><svg class="shutter-ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="39"/></svg><span></span></button>
            <button class="cam-side" data-action="camFlip" aria-label="Switch camera" ${ready ? '' : 'disabled'}>${Icon('flip', 24)}</button>
          </div>
          <div class="cam-modes" role="tablist" aria-label="What are you creating?">
            <button role="tab" class="${!story ? 'active' : ''}" aria-selected="${!story}" data-action="createMode" data-mode="post">Post</button>
            <button role="tab" class="${story ? 'active' : ''}" aria-selected="${story}" data-action="createMode" data-mode="story">Story</button>
          </div>
          <p class="cam-tip">${story ? 'Tap for photo · hold for video (up to 15s)' : 'Tap to take a photo, or pick one from your gallery'}</p>
        </div>
      </div>`;
  }

  const filterStrip = (d, cls) => `
    <div class="${cls}" role="listbox" aria-label="Filters">
      ${FILTERS.map(([id, name, css]) => `<button role="option" class="ce-filter ${d.filter === id ? 'active' : ''}" aria-selected="${d.filter === id}" data-action="setFilter" data-f="${id}">
        <span class="ce-thumb"><img src="${esc(d.img)}" alt="" style="filter:${css}"></span><small>${name}</small></button>`).join('')}
    </div>`;

  function postEditView(d) {
    return `
      <header class="appbar create-head">
        <button class="icon-btn" data-action="createRetake" aria-label="Back to camera">${Icon('back', 24)}</button>
        <div class="appbar-title"><h1>New post</h1></div>
        <div class="appbar-actions"><button class="btn btn-sm btn-primary" data-action="publish">Share</button></div>
      </header>
      <div class="page create-edit">
        <div class="ce-preview"><img src="${esc(d.img)}" alt="Your photo" style="filter:${fcss(d.filter)}"></div>
        ${filterStrip(d, 'ce-filters')}
        <div class="ce-card">
          <div class="ce-caption">
            ${avatar(S.me, 38)}
            <label class="sr-only" for="caption">Caption</label>
            <textarea id="caption" rows="3" maxlength="2200" placeholder="Write a caption…" data-input="caption">${esc(d.caption)}</textarea>
          </div>
          <div class="ce-caption-foot"><span>${Icon('smile', 16)} Add emojis, #tags and @mentions</span><span id="capCount">${d.caption.length}/2200</span></div>
        </div>
        <div class="ce-card ce-rows">
          <div class="ce-row">${Icon('users', 20)}<span><b>Audience</b><small>Visible to everyone who can see your profile</small></span></div>
          <button class="ce-row" data-action="createRetake">${Icon('camera', 20)}<span><b>Retake or choose another</b><small>Go back to the camera</small></span>${Icon('chevronRight', 18)}</button>
        </div>
      </div>`;
  }

  function storyEditView(d) {
    const t = d.text;
    return `
      <div class="se">
        <div class="se-stage">
          <img src="${esc(d.img)}" alt="Your story" style="filter:${fcss(d.filter)}">
          ${t && !d.editingText ? `<button class="se-text ${d.textBg ? 'bg' : ''}" data-action="storyText" style="--tc:${d.textColor}">${esc(t)}</button>` : ''}
          ${d.type === 'video' ? `<span class="se-video">${Icon('play', 12)} Video</span>` : ''}
          <div class="se-top">
            <button class="cam-btn" data-action="createRetake" aria-label="Back to camera">${Icon('back', 24)}</button>
            <span class="sv-spacer"></span>
            <button class="cam-btn" data-action="storyText" aria-label="Add text">${Icon('type', 22)}</button>
            <button class="cam-btn" data-action="nextFilter" aria-label="Next filter">${Icon('sparkles', 22)}</button>
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
        <div class="se-bottom">
          <p>${Icon('clock', 14)} Disappears after 24 hours · you'll see who viewed it</p>
          <button class="se-share" data-action="publish">${avatar(S.me, 30)}<span>Share to your story</span>${Icon('arrowRight', 18)}</button>
        </div>
      </div>`;
  }

  /* ---------- Capture ---------- */
  function frameSize(mode) { return mode === 'story' ? [720, 1280] : [1080, 1080]; }

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
      d.img = shot; d.type = type; d.stage = 'edit'; d.filter = 'normal';
      Cam.stop();
      App.refresh();
    }, 180);
  }

  /* Tap = photo. In story mode, holding the shutter "records" up to 15s and saves a video story. */
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
      if (draft().mode !== 'story' || b.disabled || e.button > 0) return;
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
  Actions.createMode = (el) => { draft().mode = el.dataset.mode; App.refresh(); };
  Actions.pickDraft = (el) => {
    const d = draft();
    const [W, H] = frameSize(d.mode);
    d.img = NX.img.pic(el.dataset.id, W, H); d.type = 'photo'; d.stage = 'edit'; d.filter = 'normal';
    Cam.stop();
    App.refresh();
  };
  Inputs.uploadDraft = async (el) => {
    const d = draft();
    try {
      d.img = await readImage(el.files[0], 1080);
      d.type = 'photo'; d.stage = 'edit'; d.filter = 'normal';
      Cam.stop();
      App.refresh();
    } catch (e) { Toast.show(e.message, { type: 'error' }); }
  };

  /* ---------- Edit ---------- */
  Actions.createRetake = () => {
    const d = draft();
    Object.assign(d, { stage: 'capture', img: null, type: 'photo', filter: 'normal', text: '', editingText: false, cam: d.cam === 'demo' ? 'demo' : 'starting' });
    App.refresh();
  };
  Actions.setFilter = (el) => { draft().filter = el.dataset.f; App.refresh(); };
  Actions.nextFilter = () => {
    const d = draft();
    const i = FILTERS.findIndex(f => f[0] === d.filter);
    d.filter = FILTERS[(i + 1) % FILTERS.length][0];
    App.refresh();
    Toast.show(FILTERS.find(f => f[0] === d.filter)[1]);
  };
  Inputs.caption = (el) => { draft().caption = el.value; const c = $('#capCount'); if (c) c.textContent = `${el.value.length}/2200`; };
  Actions.storyText = () => { draft().editingText = true; App.refresh(); setTimeout(() => { const t = $('#storyTextInput'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 50); };
  Inputs.storyTextInput = (el) => { draft().text = el.value; };
  Actions.storyTextColor = (el) => { draft().textColor = el.dataset.c; App.refresh(); const t = $('#storyTextInput'); t && t.focus(); };
  Actions.storyTextBg = () => { const d = draft(); d.textBg = !d.textBg; App.refresh(); const t = $('#storyTextInput'); t && t.focus(); };
  Actions.storyTextDone = () => { const d = draft(); d.text = d.text.trim(); d.editingText = false; App.refresh(); };

  Actions.addStory = () => { App.draft = newDraft('story'); Nav.go('create', { mode: 'story' }); };
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
        const lines = wrapLines(ctx, d.text, W - 140), lh = 68, top = H / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((ln, i) => {
          const y = top + i * lh;
          if (d.textBg) {
            const w = ctx.measureText(ln).width + 40;
            ctx.fillStyle = d.textColor === '#FFFFFF' ? 'rgba(15,23,42,.82)' : '#FFFFFF';
            ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(W / 2 - w / 2, y - 34, w, 68, 14) : ctx.rect(W / 2 - w / 2, y - 34, w, 68)); ctx.fill();
          } else { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; }
          ctx.fillStyle = d.textColor; ctx.fillText(ln, W / 2, y);
          ctx.shadowBlur = 0;
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
    const img = await bake(d);
    await delay(500);
    if (d.mode === 'story') {
      S.stories.push({ id: uid('st'), userId: 'me', type: d.type, src: img, time: Date.now(), views: [] });
      Toast.show('Added to your story ✨', { type: 'success' });
    } else {
      S.posts.unshift({ id: uid('p'), userId: 'me', img, caption: d.caption.trim(), likes: 0, liked: false, time: Date.now(), comments: [] });
      Toast.show('Post shared ✨', { type: 'success' });
    }
    App.draft = null;
    NX.save();
    App.loaded.home = true;
    Nav.tab('home');
  };
})();
