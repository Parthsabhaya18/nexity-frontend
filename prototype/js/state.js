/* Nexity prototype — app state, personas, persistence and business rules.
   Shared by the user app (index.html) and the admin panel (admin.html) via localStorage. */
(function () {
  const KEY = 'nexity.proto.v1';
  const VERSION = 6;
  const { MIN, HOUR, DAY } = NX.T;
  NX.KEY = KEY;
  NX.moods = [
    ['happy', '😊', 'Happy'],
    ['calm', '😌', 'Calm'],
    ['romantic', '❤️', 'Romantic'],
    ['sad', '😢', 'Sad'],
    ['angry', '😡', 'Angry'],
    ['cool', '😎', 'Cool'],
    ['relaxed', '🌿', 'Relaxed'],
    ['excited', '🔥', 'Excited'],
    ['tired', '😴', 'Tired'],
    ['motivated', '🤩', 'Motivated'],
  ];

  NX.defaultPlans = () => ({
    free: {
      id: 'free', name: 'Free', description: 'Everything you need to share and connect.', mrp: 0, price: 0, active: true,
      features: ['Posts, Reels & Stories', 'Chat with friends', 'Get notified about Secret Messages', 'Get notified about Secret Crushes'],
      limits: { secretMessages: 0, crushes: 0, readSecret: false, nearby: false }
    },
    plus: {
      id: 'plus', name: 'Plus', description: 'Start your secret side.', mrp: 149, price: 99, active: true,
      features: ['Open & reply to Secret Messages', 'Send 5 Secret Messages a month', 'Add up to 3 Secret Crushes', 'Match animation & chat', 'See who was near you today or yesterday'],
      limits: { secretMessages: 5, crushes: 3, readSecret: true, nearby: true }
    },
    premium: {
      id: 'premium', name: 'Premium', description: 'More mystery, more crushes, a 👑 badge.', mrp: 399, price: 249, active: true,
      features: ['Unlimited Secret Messages (fair use)', 'Add up to 10 Secret Crushes', 'Open & reply to Secret Messages', 'See who was near you today or yesterday', 'Premium profile badge 👑', 'Priority support'],
      limits: { secretMessages: -1, crushes: 10, readSecret: true, nearby: true }
    },
  });

  const monthKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };

  function setPlan(s, plan, days = 30, source = 'paid', method = 'UPI') {
    s.me.plan = plan;
    s.me.planExpiry = plan === 'free' ? null : Date.now() + days * DAY;
    s.me.planSource = plan === 'free' ? null : source;
    s.me.planMethod = plan === 'free' ? null : method;
    s.me.autoRenew = source === 'paid';
  }
  NX.setPlan = (plan, days, source, method) => setPlan(S, plan, days, source, method);

  /* Server-side Nearby configuration (backend env vars in nearby-encounters.md §16). Admins can tune it. */
  NX.defaultNearbyConfig = () => ({
    radiusMeters: 50, minDurationSeconds: 120, accuracyLimitMeters: 40,
    encounterCooldownMinutes: 30, notificationCooldownMinutes: 360, maxPushesPerDay: 3,
    retentionDays: 2, tokenTtlMinutes: 15, presenceTtlSeconds: 300,
  });
  /* Simulated phone: Bluetooth adapter, BLE advertising support, location services and OS permissions. */
  NX.defaultDevice = () => ({ bluetooth: true, bleSupported: true, btPermission: null, locationServices: true, precise: true, locPermission: null });

  function nearbyOn(s) {
    Object.assign(s.me, { nearbyEnabled: true, nearbyConsent: true, nearbyBluetooth: true, nearbyLocation: true, nearbyNotifications: true });
    Object.assign(s.device, { btPermission: 'granted', locPermission: 'granted' });
  }

  /* Local calendar helpers. The demo clock can be moved forward to test today → yesterday → hidden. */
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
  NX.startOfDay = startOfDay;
  NX.calendarDiff = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY);
  NX.encounterExpiry = (t, cfg) => addDays(startOfDay(t), cfg.retentionDays) - 1;

  /* One row per pair, latest detection only. Seeds an encounter n calendar days ago. */
  function seedEncounters(s, now) {
    const cfg = s.admin.nearbyConfig;
    const out = [];
    s.users.forEach((u, i) => {
      if (!u.nearbyEnabled || u.nearDays == null) return;
      const day = startOfDay(addDays(now, -u.nearDays));
      const at = u.nearDays === 0 ? Math.max(day, Math.min(now - 5 * MIN, day + 14 * HOUR)) : day + 14 * HOUR;
      const expiresAt = NX.encounterExpiry(at, cfg);
      if (expiresAt < now - DAY) return; // TTL already deleted it
      out.push({ userId: u.id, detectedAt: at, lastDetectedAt: at, source: ['ble', 'location', 'hybrid'][i % 3], expiresAt });
    });
    return out;
  }

  NX.buildState = function (persona = 'free') {
    const now = Date.now();
    const s = {
      v: VERSION, persona, theme: 'system', mood: null,
      session: { loggedIn: true },
      accounts: [{ email: 'tara@nexity.app', password: 'demo1234' }],
      me: NX.meDefaults(),
      users: NX.seedUsers(),
      following: ['u1', 'u2', 'u3', 'u4', 'u6', 'u9'],
      posts: NX.seedPosts(now),
      stories: NX.seedStories(now),
      reels: NX.seedReels(now),
      chats: NX.seedChats(now),
      secretInbox: NX.seedSecretInbox(now),
      secretSent: [],
      crushes: [], crushedBy: ['u3', 'u8'], matches: [],
      notifications: NX.seedNotifications(now),
      usage: { month: monthKey(), secretSent: 0 },
      blocked: [], blockedAnon: [], recentSearches: ['riya.patel', 'kabir.mehta'],
      seenStories: [],
      notifSettings: { push: true, chat: true, likes: true, comments: true, secretMessage: true, secretCrush: true, match: true, subscription: true },
      privacy: { private: false, messages: 'everyone', activity: true },
      plans: NX.defaultPlans(),
      transactions: NX.seedTransactions(now),
      issues: NX.seedIssues(now),
      reports: NX.seedReports(now),
      extraUsers: NX.seedExtraUsers(),
      admin: { nearbyGlobal: true, nearbyConfig: NX.defaultNearbyConfig(), loggedIn: false, gifts: [], audit: [{ text: 'Nearby feature enabled globally', time: now - 12 * DAY }], indicatorsBase: 1284, emailAlerts: true, weeklyDigest: true },
      /* bleInRange: people whose phones are within Bluetooth range right now (simulated). */
      demo: { offline: false, failNextPayment: false, clockOffset: 0, bleInRange: [], ignoredDevices: 0 },
      device: NX.defaultDevice(),
      encounters: [], nearbyPresence: [], nearbyPushLog: [],
      offers: { quarterly: 10, yearly: 25 },
      coupons: [{ code: 'NEXITY20', pct: 20, note: '20% off any plan' }, { code: 'WELCOME50', pct: 50, note: '50% off your first month', firstOnly: true }],
      security: { failed: 0, lockedUntil: 0 },
    };

    s.users.forEach(u => { u.nearbyBluetooth = u.nearbyLocation = !!u.nearbyEnabled; });
    s.encounters = seedEncounters(s, now);

    const myTxn = (plan) => s.transactions.unshift({ id: 'TXN' + (48300 + Math.floor(Math.random() * 99)), userId: 'me', plan, amount: s.plans[plan].price, date: now - 2 * DAY, method: 'UPI', status: 'success' });

    switch (persona) {
      case 'plus':
        setPlan(s, 'plus'); myTxn('plus');
        break;
      case 'premium':
        setPlan(s, 'premium'); myTxn('premium');
        nearbyOn(s);
        s.stories.push(NX.ownStory(now));
        break;
      case 'secret-receiver':
        setPlan(s, 'plus'); myTxn('plus');
        nearbyOn(s);
        s.secretInbox.unshift(NX.extraSecret(now));
        s.notifications.unshift({ id: 'n0', type: 'secret', text: 'Someone is trying to reach you with a Secret Message 💌', time: now - 50 * MIN, read: false, target: { screen: 'secretThread', params: { id: 'sm3' } } });
        break;
      case 'crush-receiver':
        setPlan(s, 'plus'); myTxn('plus');
        nearbyOn(s);
        s.crushedBy = ['u2', 'u5'];
        s.notifications.unshift({ id: 'n0', type: 'crush', text: 'Someone added you as a Secret Crush 👀', time: now - 12 * MIN, read: false, target: { screen: 'secret', params: { tab: 'crush' } } });
        break;
      case 'matched': {
        setPlan(s, 'premium'); myTxn('premium');
        nearbyOn(s);
        s.crushes = [{ userId: 'u3', time: now - 2 * DAY }, { userId: 'u12', time: now - 1 * DAY }];
        s.matches = [{ userId: 'u3', time: now - 1 * DAY, chatId: 'cm_u3' }];
        s.chats.unshift({ id: 'cm_u3', userId: 'u3', kind: 'match', unread: 1, messages: [
          NX.msg(now, 'system', 'You matched via Secret Crush 💘', DAY),
          NX.msg(now, 'them', 'Okay I did NOT expect this 😳 Hi!', DAY - 5 * MIN),
          NX.msg(now, 'me', 'Haha hi! I\'m honestly so happy right now', DAY - 3 * MIN),
          NX.msg(now, 'them', 'Coffee this weekend? ☕', 30 * MIN, { seen: false })] });
        s.notifications.unshift({ id: 'n0', type: 'match', userId: 'u3', text: 'Congratulations! It\'s a match 🎉 You and <b>kabir.mehta</b> added each other.', time: now - DAY, read: false, target: { screen: 'chat', params: { id: 'cm_u3' } } });
        break;
      }
      case 'nearby':
        setPlan(s, 'plus'); myTxn('plus');
        nearbyOn(s);
        s.notifications.unshift({ id: 'n0', type: 'nearby', text: 'Someone is near you on Nexity. ✨', time: now - 40 * MIN, read: false, target: { screen: 'nearby', params: {} } });
        s.nearbyPushLog.push({ pairKey: 'me:u2', time: now - 40 * MIN });
        s.demo.bleInRange = ['u2', 'u4'];
        break;
      case 'new':
        s.session.loggedIn = false;
        break;
      default:
        break;
    }
    return s;
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== VERSION) return null;
      if (s.mood === undefined) s.mood = null;
      return s;
    } catch (e) { return null; }
  }

  NX.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { console.warn('Nexity: could not persist state', e); }
  };
  NX.reset = (persona = 'free', opts = {}) => {
    const theme = window.S ? S.theme : 'system';
    const mood = window.S && S.mood ? S.mood : null;
    window.S = NX.buildState(persona);
    S.theme = theme;
    S.mood = mood;
    if (opts.loggedOut) S.session.loggedIn = false;
    NX.save();
  };
  NX.reload = () => { const s = load(); if (s) window.S = s; };

  window.S = load() || (() => { const s = NX.buildState('free'); s.session.loggedIn = false; return s; })();

  /* ---------- Queries & business rules ---------- */
  NX.user = (id) => id === 'me' ? S.me : (S.users.find(u => u.id === id) || S.extraUsers.find(u => u.id === id));
  NX.allUsers = () => [S.me, ...S.users, ...S.extraUsers];
  NX.plan = () => S.plans[S.me.plan] || S.plans.free;
  NX.isPaid = () => S.me.plan !== 'free';
  NX.isRemoved = (id) => { const u = NX.user(id); return !!u && (u.status === 'deleted' || u.status === 'disabled') && id !== 'me'; };
  NX.isBlocked = (id) => S.blocked.includes(id) || NX.isRemoved(id);
  NX.isFollowing = (id) => S.following.includes(id);
  NX.limitOf = (key) => NX.plan().limits[key];
  NX.secretLeft = () => { const l = NX.limitOf('secretMessages'); return l < 0 ? Infinity : Math.max(0, l - S.usage.secretSent); };
  NX.crushLeft = () => { const l = NX.limitOf('crushes'); return l < 0 ? Infinity : Math.max(0, l - S.crushes.filter(c => !NX.matchWith(c.userId)).length); };
  NX.canReadSecret = () => !!NX.limitOf('readSecret');
  NX.canSeeNearby = () => !!NX.limitOf('nearby');
  NX.hasCrush = (id) => S.crushes.some(c => c.userId === id);
  NX.matchWith = (id) => S.matches.find(m => m.userId === id);

  /* ---------- Nearby (mirrors the backend rules in nearby-encounters.md) ---------- */
  NX.now = () => Date.now() + (S.demo.clockOffset || 0);
  NX.nearbyConfig = () => S.admin.nearbyConfig;
  const pairKey = (id) => ['me', id].sort().join(':');

  /* Both people opted in, the signal is on for both, neither blocked, both active, feature on globally. */
  NX.nearbyEligible = (userId, signal) => {
    const u = NX.user(userId);
    if (!S.admin.nearbyGlobal || !S.me.nearbyEnabled || !u || !u.nearbyEnabled || NX.isBlocked(userId)) return false;
    if ((S.blockedAnon || []).includes(userId)) return false;
    if (signal === 'ble') return !!(S.me.nearbyBluetooth && u.nearbyBluetooth);
    if (signal === 'location') return !!(S.me.nearbyLocation && u.nearbyLocation);
    return true;
  };

  /* Latest encounter day as a calendar difference: 'today' | 'yesterday' | null (2+ days, expired, missing, ineligible).
     Only the day exists in the UI — never a place, time, distance, source or count. */
  NX.nearHint = (userId) => {
    if (!NX.nearbyEligible(userId)) return null;
    const e = S.encounters.find(x => x.userId === userId);
    const now = NX.now();
    if (!e || !Number.isFinite(e.lastDetectedAt) || e.expiresAt <= now) return null;
    if (e.lastDetectedAt > now + 5 * MIN) return null;
    const diff = NX.calendarDiff(e.lastDetectedAt, now);
    return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : null;
  };
  NX.nearbyState = (userId) => NX.nearHint(userId) == null ? null : NX.canSeeNearby() ? 'on' : 'locked';
  NX.nearText = (userId) => {
    const h = NX.nearHint(userId);
    return h === 'today' ? 'This person was near you today.' : h === 'yesterday' ? 'This person was near you yesterday.' : '';
  };

  /* Upsert by pair; refresh at most once per encounter cooldown. Never creates a message, crush or match. */
  NX.recordEncounter = (userId, source) => {
    if (!NX.nearbyEligible(userId, source)) return { status: 'ineligible' };
    const cfg = NX.nearbyConfig();
    const now = NX.now();
    const e = S.encounters.find(x => x.userId === userId);
    if (!e) {
      S.encounters.push({ userId, detectedAt: now, lastDetectedAt: now, source, expiresAt: NX.encounterExpiry(now, cfg) });
      return { status: 'created' };
    }
    if (now - e.lastDetectedAt < cfg.encounterCooldownMinutes * MIN) return { status: 'deduped' };
    e.lastDetectedAt = now;
    e.expiresAt = NX.encounterExpiry(now, cfg);
    if (e.source !== source) e.source = 'hybrid';
    return { status: 'refreshed' };
  };

  /* Verified Bluetooth presence (both phones saw each other). Expires after presenceTtlSeconds. */
  NX.livePresence = () => {
    const ttl = NX.nearbyConfig().presenceTtlSeconds * 1000;
    const now = NX.now();
    return S.nearbyPresence.filter(p => now - p.verifiedAt < ttl && NX.nearbyEligible(p.userId, 'ble'));
  };

  /* Generic push with idempotency: per-pair cooldown + daily cap per recipient. */
  NX.nearbyPushAllowed = (userId) => {
    const cfg = NX.nearbyConfig();
    const now = NX.now();
    const key = pairKey(userId);
    if (S.nearbyPushLog.some(p => p.pairKey === key && now - p.time < cfg.notificationCooldownMinutes * MIN)) return 'cooldown';
    const today = S.nearbyPushLog.filter(p => NX.calendarDiff(p.time, now) === 0).length;
    if (today >= cfg.maxPushesPerDay) return 'daily-cap';
    return 'ok';
  };
  NX.logNearbyPush = (userId) => S.nearbyPushLog.push({ pairKey: pairKey(userId), time: NX.now() });

  /* Opt-out: stop processing at once and drop everything derived from this device. */
  NX.clearNearbyRuntime = () => { S.nearbyPresence = []; };

  NX.notify = (n) => {
    const item = Object.assign({ id: 'n' + Math.random().toString(36).slice(2, 9), time: Date.now(), read: false }, n);
    S.notifications.unshift(item);
    return item;
  };
  NX.unreadNotifications = () => S.notifications.filter(n => !n.read).length;
  NX.unreadChats = () => S.chats.filter(c => c.unread > 0 && !NX.isBlocked(c.userId)).length;
  NX.secretBadge = () => S.notifications.filter(n => !n.read && (n.type === 'secret' || n.type === 'crush')).length;

  NX.housekeeping = () => {
    let changed = false;
    if (S.me.plan !== 'free' && S.me.planExpiry && S.me.planExpiry < Date.now()) {
      const old = S.plans[S.me.plan].name;
      setPlan(S, 'free');
      NX.notify({ type: 'subscription', text: `Your ${old} plan has ended. Renew anytime to keep your secret side.`, target: { screen: 'plans', params: {} } });
      changed = true;
    }
    if (S.me.plan !== 'free' && S.me.planExpiry && S.me.planExpiry - Date.now() < 3 * DAY && S.me.remindedFor !== S.me.planExpiry) {
      S.me.remindedFor = S.me.planExpiry;
      NX.notify({ type: 'subscription', text: 'Your plan expires in 3 days', target: { screen: 'plans', params: {} } });
      changed = true;
    }
    if (S.usage.month !== monthKey()) { S.usage = { month: monthKey(), secretSent: 0 }; changed = true; }
    /* Backs up the TTL indexes: drop encounters past expiry and stale presence. */
    const nowN = NX.now();
    const encBefore = S.encounters.length;
    S.encounters = S.encounters.filter(e => e.expiresAt > nowN - DAY);
    S.nearbyPresence = S.nearbyPresence.filter(p => nowN - p.verifiedAt < 30 * MIN);
    S.nearbyPushLog = S.nearbyPushLog.filter(p => nowN - p.time < 2 * DAY);
    if (S.encounters.length !== encBefore) changed = true;
    const cutoff = Date.now() - DAY;
    const before = S.stories.length;
    S.stories = S.stories.filter(st => st.time > cutoff);
    if (S.stories.length !== before) changed = true;
    // Keep the demo lively: refresh friends' stories once every seeded story has expired.
    if (!S.stories.some(st => st.userId !== 'me')) { S.stories = NX.seedStories(Date.now()).concat(S.stories); S.seenStories = []; changed = true; }
    if (changed) NX.save();
  };
  NX.housekeeping();
})();
