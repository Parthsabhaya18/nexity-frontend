/* Nearby: Bluetooth "people nearby" screen, OS permission flows, signal switches and the simulator used by Demo controls.
   Mirrors documentation/modules/nearby/nearby-encounters.md. Nothing here uses real Bluetooth or GPS — the phone,
   the other users and the server checks are simulated in the browser. */
(function () {
  const { DAY } = NX.T;
  window.Nearby = window.Nearby || {};
  let scanTimer = null;

  /* ---------- Signal status (what the Settings rows and the Nearby screen show) ---------- */
  NX.signalStatus = (k) => {
    const d = S.device;
    if (k === 'bluetooth') {
      if (!S.me.nearbyBluetooth) return { ok: false, text: 'Off' };
      if (!d.bleSupported) return { ok: false, text: 'Not supported on this phone' };
      if (d.btPermission === 'blocked') return { ok: false, text: 'Permission off · allow it in phone Settings' };
      if (d.btPermission !== 'granted') return { ok: false, text: 'Needs the Nearby devices permission' };
      if (!d.bluetooth) return { ok: false, text: 'Bluetooth is off on this phone' };
      return { ok: true, text: 'On · scans only while the Nearby screen is open' };
    }
    if (!S.me.nearbyLocation) return { ok: false, text: 'Off' };
    if (d.locPermission === 'blocked') return { ok: false, text: 'Permission off · allow it in phone Settings' };
    if (d.locPermission !== 'granted') return { ok: false, text: 'Needs location permission' };
    if (!d.locationServices) return { ok: false, text: 'Location is off on this phone' };
    if (!d.precise) return { ok: false, text: 'Precise location is off · notifications paused' };
    return { ok: true, text: 'On · checked only while you use Nexity' };
  };
  NX.locationActive = () => !!(S.admin.nearbyGlobal && S.me.nearbyEnabled && NX.signalStatus('location').ok);

  /* ---------- OS permission popups (simulated) ---------- */
  const OS = {
    bt: { key: 'btPermission', icon: 'bluetooth', label: 'Bluetooth permission', title: 'Allow Nexity to find and connect to nearby devices?', why: 'Used only to find other Nexity users who turned on Nearby, while the Nearby screen is open.', options: [['granted', 'Allow'], ['denied', 'Don\'t allow']], settingsPath: 'Nearby devices / Bluetooth' },
    loc: { key: 'locPermission', icon: 'pin', label: 'Location permission', title: 'Allow Nexity to access this device\'s location?', why: 'Used only while you use Nexity to tell you when someone is near. Never shown to anyone.', options: [['granted', 'While using the app'], ['granted', 'Only this time'], ['denied', 'Don\'t allow']], settingsPath: 'Location' },
  };

  Nearby.ask = (kind) => new Promise((resolve) => {
    const o = OS[kind];
    const cur = S.device[o.key];
    if (cur === 'granted') return resolve(true);
    if (cur === 'blocked') return resolve(Nearby.openPhoneSettings(kind));
    const el = Modal.open({
      cls: 'confirm-layer os-permission', hideHeader: true, label: o.label, dismissible: false,
      body: `<div class="confirm os-sheet">
        <div class="confirm-ic">${Icon(o.icon, 26)}</div>
        <h2>${esc(o.title)}</h2>
        <p>${esc(o.why)}</p>
        ${kind === 'loc' ? `<label class="os-precise"><input type="checkbox" id="osPrecise" checked><span>Precise location</span></label>` : ''}
        <div class="confirm-actions os">${o.options.map(([v, l], i) => `<button class="btn btn-block ${i === 0 ? 'btn-primary' : 'btn-ghost'}" data-perm="${v}">${l}</button>`).join('')}</div>
      </div>`
    });
    el.querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.perm;
      if (kind === 'loc' && v === 'granted') { const p = el.querySelector('#osPrecise'); S.device.precise = !p || p.checked; }
      Modal.close(el, true);
      /* A second "Don't allow" means the OS stops asking: only phone Settings can change it. */
      S.device[o.key] = v === 'granted' ? 'granted' : (cur === 'denied' ? 'blocked' : 'denied');
      NX.save();
      resolve(v === 'granted');
    }));
  });

  Nearby.openPhoneSettings = async (kind) => {
    const o = OS[kind];
    const ok = await Modal.confirm({
      title: `${kind === 'bt' ? 'Bluetooth' : 'Location'} permission is off`,
      message: `You turned it off for Nexity. Open phone Settings → Nexity → ${o.settingsPath} to allow it.`,
      confirm: 'Open Settings', icon: o.icon
    });
    if (!ok) return false;
    S.device[o.key] = 'granted';
    NX.save();
    Toast.show('Prototype: permission allowed in phone Settings', { type: 'info' });
    return true;
  };

  /* ---------- Signal switches ---------- */
  /* Turns one signal on, asking for permission first. Saves but does not re-render; callers do. */
  Nearby.enableSignal = async (k) => {
    if (k === 'notifications') { S.me.nearbyNotifications = true; NX.save(); return true; }
    if (k === 'bluetooth') {
      if (!S.device.bleSupported) { Toast.show('This phone can\'t use Bluetooth discovery. Location notifications still work.', { type: 'warning' }); return false; }
      if (!(await Nearby.ask('bt'))) { Toast.show('Bluetooth discovery needs the Nearby devices permission.', { type: 'warning' }); return false; }
      S.me.nearbyBluetooth = true;
      NX.save();
      if (!S.device.bluetooth && await Modal.confirm({ title: 'Turn on Bluetooth?', message: 'Nearby uses Bluetooth to find people around you. You can turn it off anytime.', confirm: 'Turn on', icon: 'bluetooth' })) S.device.bluetooth = true;
    } else {
      if (!(await Nearby.ask('loc'))) { Toast.show('Location notifications need location permission. Bluetooth discovery still works.', { type: 'warning' }); return false; }
      S.me.nearbyLocation = true;
      NX.save();
      if (!S.device.locationServices && await Modal.confirm({ title: 'Turn on Location?', message: 'Your phone\'s Location is off. Nexity can\'t check for nearby people without it.', confirm: 'Turn on', icon: 'pin' })) S.device.locationServices = true;
      if (!S.device.precise) Toast.show('Precise location is off, so location notifications are paused. Bluetooth discovery still works.', { type: 'info' });
    }
    NX.save();
    return true;
  };

  Nearby.disableSignal = (k) => {
    if (k === 'bluetooth') {
      S.me.nearbyBluetooth = false;
      NX.clearNearbyRuntime();
      Nearby.stopScan();
      Toast.show('Bluetooth discovery is off. Your Bluetooth ids were revoked.');
    } else if (k === 'location') {
      S.me.nearbyLocation = false;
      Toast.show('Location notifications are off. Your last location was deleted.');
    } else {
      S.me.nearbyNotifications = false;
      Toast.show('Nearby notifications are off');
    }
    NX.save();
  };

  Actions.nearbySignal = async (el) => {
    const k = el.dataset.k;
    const field = { bluetooth: 'nearbyBluetooth', location: 'nearbyLocation', notifications: 'nearbyNotifications' }[k];
    if (S.me[field] && el.dataset.on === undefined) Nearby.disableSignal(k);
    else if (await Nearby.enableSignal(k)) Toast.show({ bluetooth: 'Bluetooth discovery is on', location: 'Location notifications are on', notifications: 'Nearby notifications are on' }[k], { type: 'success' });
    App.refresh();
  };

  /* Master switch off: stop scanning, revoke ids, stop location checks. Already-sent pushes can still arrive. */
  Nearby.turnOff = () => {
    S.me.nearbyEnabled = false;
    NX.clearNearbyRuntime();
    Nearby.stopScan();
    commit();
    Toast.show('Nearby is off. Notifications that were already sent may still arrive.');
  };

  Actions.nearbyAdapterOn = () => { S.device.bluetooth = true; App.nearbyScan = null; commit(); };
  Actions.nearbyOpenSettings = async (el) => { if (await Nearby.openPhoneSettings(el.dataset.kind)) { App.nearbyScan = null; App.refresh(); } };
  Actions.nearbyRescan = () => { Nearby.stopScan(); App.refresh(); };

  /* ---------- Bluetooth scan session (foreground only) ---------- */
  const READY = ['scanning', 'found', 'empty'];
  function screenState() {
    if (!S.admin.nearbyGlobal) return 'unavailable';
    if (!S.me.nearbyEnabled) return 'disabled';
    if (S.demo.offline) return 'offline';
    if (!S.me.nearbyBluetooth) return 'btSettingOff';
    if (!S.device.bleSupported) return 'unsupported';
    if (S.device.btPermission === 'blocked') return 'permBlocked';
    if (S.device.btPermission !== 'granted') return 'permNeeded';
    if (!S.device.bluetooth) return 'btAdapterOff';
    if (!App.nearbyScan || App.nearbyScan.phase === 'scanning') return 'scanning';
    return NX.livePresence().length ? 'found' : 'empty';
  }
  Nearby.screenState = screenState;

  /* Both phones saw each other's current id and the server matched them → verified presence + encounter. */
  function verify(id) {
    if (!NX.nearbyEligible(id, 'ble')) return false;
    const now = NX.now();
    const p = S.nearbyPresence.find(x => x.userId === id);
    if (p) p.verifiedAt = now; else S.nearbyPresence.push({ userId: id, verifiedAt: now });
    NX.recordEncounter(id, 'ble');
    return true;
  }

  Nearby.startScan = () => {
    clearTimeout(scanTimer);
    App.nearbyScan = { phase: 'scanning', started: Date.now() };
    scanTimer = setTimeout(() => {
      if (!App.nearbyScan) return;
      S.demo.bleInRange.forEach(verify);
      App.nearbyScan.phase = 'live';
      NX.save();
      if (Nav.is('nearby')) App.refresh();
    }, 2200);
  };
  Nearby.stopScan = () => { clearTimeout(scanTimer); App.nearbyScan = null; };
  Nearby.scanning = () => Nav.is('nearby') && READY.includes(screenState()) && !!App.nearbyScan;

  /* ---------- Screen ---------- */
  const state = (icon, title, text, actions = '') => emptyState({ icon, title, text, actions, cls: 'nearby-state' });
  const radar = (on) => `<div class="radar big ${on ? '' : 'idle'}" aria-hidden="true"><i></i><i></i><i></i><span>${Icon('radar', 30)}</span></div>`;

  const card = (p) => {
    const u = NX.user(p.userId);
    return `
      <div class="nearby-card">
        <button class="nearby-card-main" data-go="user" data-id="${u.id}">
          ${avatar(u, 52)}
          <span class="nearby-card-text"><b>${esc(u.name)}${premiumBadge(u)}</b><small>@${esc(u.username)}</small><span class="nearby-now">${Icon('radar', 12)} Nearby now</span></span>
        </button>
        ${followBtn(u)}
        <button class="icon-btn" data-action="nearbyMenu" data-id="${u.id}" aria-label="More options for ${esc(u.username)}">${Icon('more', 20)}</button>
      </div>`;
  };

  function body(st) {
    switch (st) {
      case 'unavailable': return state('radar', 'Nearby is unavailable right now', 'Nearby is paused for everyone for a moment. Try again later.');
      case 'disabled': return `
        <section class="nearby-intro">
          ${radar(false)}
          <h2>See who's around you</h2>
          <p>Find Nexity users close by, get a notification when someone is near, and see "This person was near you today." in Secret Messages and Secret Crush.</p>
          <button class="btn btn-primary btn-lg btn-block" data-go="nearbyConsent">Turn on Nearby</button>
          <p class="fine">Off by default. Exact location, distance and time are never shown.</p>
        </section>`;
      case 'offline': return state('refresh', 'Couldn\'t reach Nexity', 'Check your connection. Nexity needs the server to confirm who\'s really nearby.', '<button class="btn btn-primary" data-action="nearbyRescan">Try again</button>');
      case 'btSettingOff': return state('bluetoothOff', 'Bluetooth discovery is off', 'Turn it on to see Nexity users near you. Location notifications work on their own.', '<button class="btn btn-primary" data-action="nearbySignal" data-k="bluetooth" data-on>Turn on Bluetooth discovery</button>');
      case 'unsupported': return state('bluetoothOff', 'This phone can\'t use Bluetooth discovery', 'Your phone can\'t send the Bluetooth signal Nearby needs. You can still get location notifications.', '<button class="btn btn-secondary" data-go="settingsNearby">Nearby settings</button>');
      case 'permNeeded': return state('bluetooth', 'Allow Nearby devices', 'Nexity needs the Bluetooth (Nearby devices) permission to find people around you. It\'s only used while this screen is open.', '<button class="btn btn-primary" data-action="nearbySignal" data-k="bluetooth" data-on>Allow</button>');
      case 'permBlocked': return state('bluetoothOff', 'Bluetooth permission is off', 'You turned it off for Nexity. Allow it in phone Settings to find people nearby.', '<button class="btn btn-primary" data-action="nearbyOpenSettings" data-kind="bt">Open Settings</button>');
      case 'btAdapterOff': return state('bluetoothOff', 'Bluetooth is off', 'Turn on Bluetooth to find people nearby.', '<button class="btn btn-primary" data-action="nearbyAdapterOn">Turn on Bluetooth</button>');
      case 'scanning': return `
        <section class="nearby-scan" aria-live="polite">
          ${radar(true)}
          <h2>Looking for people nearby…</h2>
          <p>Keep this screen open. Only people who also turned on Nearby can be found.</p>
        </section>`;
      case 'found': {
        const live = NX.livePresence();
        return `
          <section class="nearby-found-head" aria-live="polite">
            <span class="nearby-pulse" aria-hidden="true">${Icon('radar', 18)}</span>
            <div><b>${live.length} ${live.length === 1 ? 'person' : 'people'} nearby</b><small>Both phones confirmed each other</small></div>
            <button class="btn btn-sm btn-ghost" data-action="nearbyRescan">${Icon('refresh', 16)} Scan again</button>
          </section>
          <div class="nearby-list">${live.map(card).join('')}</div>`;
      }
      default: return `
        <section class="nearby-scan">
          ${radar(false)}
          <h2>No one nearby right now</h2>
          <p>Only people who turned on Nearby and are close by show up here.</p>
          <button class="btn btn-secondary" data-action="nearbyRescan">${Icon('refresh', 16)} Scan again</button>
        </section>`;
    }
  }

  const locationRow = () => {
    const s = NX.signalStatus('location');
    return `<button class="set-row nearby-loc" data-go="settingsNearby">
      <span class="set-ic">${Icon('pin', 20)}</span>
      <span class="set-text"><b>Location notifications</b><small class="${s.ok ? 'ok' : ''}">${esc(s.text)}</small></span>
      ${Icon('chevronRight', 18, 'set-chev')}
    </button>`;
  };

  Screens.nearby = {
    title: 'Nearby',
    render: () => {
      const st = screenState();
      const on = S.admin.nearbyGlobal && S.me.nearbyEnabled;
      return `
        ${appbar({ title: 'Nearby', actions: `<button class="icon-btn" data-go="settingsNearby" aria-label="Nearby settings">${Icon('settings', 22)}</button>` })}
        <div class="page nearby-page">
          ${body(st)}
          ${on ? `<div class="set-card nearby-loc-card">${locationRow()}</div>` : ''}
          ${on ? `<p class="fine">${Icon('shieldCheck', 14)} Exact location, distance and time are never shown. Blocked people never appear.</p>` : ''}
        </div>`;
    },
    mount: () => {
      if (READY.includes(screenState()) && !App.nearbyScan) Nearby.startScan();
      App.onLeave = () => Nearby.stopScan();
    }
  };

  Actions.nearbyMenu = (el) => {
    const u = NX.user(el.dataset.id);
    Modal.menu([
      { label: 'View profile', icon: 'user', onClick: () => Nav.go('user', { id: u.id }) },
      { label: `Report ${u.username}`, icon: 'flag', danger: true, onClick: () => Safety.report({ userId: u.id, content: 'Profile', preview: 'Seen in Nearby' }) },
      { label: `Block ${u.username}`, icon: 'ban', danger: true, onClick: () => Safety.block(u.id, { onDone: () => { S.nearbyPresence = S.nearbyPresence.filter(p => p.userId !== u.id); commit(); } }) },
    ], { title: u.username });
  };

  /* ---------- Simulator (Demo controls) ---------- */
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const note = (text) => { S.demo.lastNearby = text; NX.save(); };

  Nearby.sim = {
    /* A Nexity user with Nearby on walks into Bluetooth range. Found only while the Nearby screen is scanning. */
    bleArrive() {
      if (!S.me.nearbyEnabled) return Toast.show('Turn on Nearby first.', { type: 'warning' });
      const pool = S.users.filter(u => u.nearbyEnabled && u.nearbyBluetooth && !S.demo.bleInRange.includes(u.id) && !NX.isBlocked(u.id));
      if (!pool.length) return Toast.show('Everyone with Nearby on is already in range.');
      const u = pick(pool);
      S.demo.bleInRange.push(u.id);
      if (Nearby.scanning() && App.nearbyScan.phase === 'live') {
        const ok = verify(u.id);
        note(`${u.username} came into Bluetooth range · ${ok ? 'verified' : 'not eligible'}`);
        App.refresh();
        Toast.show(ok ? `${u.username} is nearby` : 'A phone came into range but couldn\'t be verified', { icon: 'radar' });
        return;
      }
      note(`${u.username} came into Bluetooth range · not scanning`);
      App.refresh();
      Toast.show('A Nexity user came into Bluetooth range. Bluetooth only scans while the Nearby screen is open.', { icon: 'radar', duration: 4500, action: { label: 'Open', onClick: () => { Modal.closeAll(); Nav.go('nearby'); } } });
    },
    bleLeave() {
      S.demo.bleInRange = [];
      S.nearbyPresence = [];
      note('Everyone left Bluetooth range');
      App.refresh();
      Toast.show('Everyone left Bluetooth range');
    },
    /* A nearby phone that isn't a verified Nexity user (or replays an old id). */
    unknownDevice() {
      S.demo.ignoredDevices = (S.demo.ignoredDevices || 0) + 1;
      note('Unknown Bluetooth device ignored');
      Toast.show('An unknown Bluetooth device was ignored — it had no valid Nexity id.', { icon: 'shield' });
    },
    /* Server finds two opted-in people within the radius for long enough → encounter + one generic push. */
    locationEncounter() {
      if (!S.me.nearbyEnabled) return Toast.show('Turn on Nearby first.', { type: 'warning' });
      if (!NX.locationActive()) return Toast.show(`No location check — ${NX.signalStatus('location').text.toLowerCase()}.`, { type: 'warning' });
      if (S.demo.offline) return Toast.show('Offline — the location check wasn\'t sent. Nothing was recorded.', { type: 'warning' });
      const pool = S.users.filter(u => NX.nearbyEligible(u.id, 'location'));
      if (!pool.length) return Toast.show('Nobody with location notifications on is around.');
      const related = pool.filter(u => S.crushes.some(c => c.userId === u.id) || S.secretSent.some(m => m.toId === u.id) || S.secretInbox.some(m => m.senderId === u.id) || S.crushedBy.includes(u.id));
      const u = pick(related.length ? related : pool);
      const r = NX.recordEncounter(u.id, 'location');
      const push = NX.nearbyPushAllowed(u.id);
      if (push === 'ok' && S.me.nearbyNotifications) {
        NX.logNearbyPush(u.id);
        const n = NX.notify({ type: 'nearby', text: 'Someone is near you on Nexity. ✨', target: { screen: 'nearby', params: {} } });
        note(`Location encounter with ${u.username} · ${r.status} · notification sent`);
        App.refresh();
        App.incoming(n, 'Nexity · Someone is near you on Nexity. ✨');
        return;
      }
      const why = !S.me.nearbyNotifications ? 'Nearby notifications are off' : push === 'cooldown' ? 'already notified about this person recently' : 'daily notification limit reached';
      note(`Location encounter with ${u.username} · ${r.status} · no notification (${why})`);
      App.refresh();
      Toast.show(`Encounter saved. No notification — ${why}.`, { icon: 'bell' });
    },
    advanceDay() {
      S.demo.clockOffset = (S.demo.clockOffset || 0) + DAY;
      NX.housekeeping();
      note(`Clock moved to ${fmtDate(NX.now())}`);
      App.refresh();
      Toast.show(`Clock moved forward 1 day · ${fmtDate(NX.now())}`, { icon: 'clock' });
    },
    resetClock() {
      S.demo.clockOffset = 0;
      note('Clock reset to now');
      App.refresh();
      Toast.show('Clock reset to now', { icon: 'clock' });
    },
  };
})();
