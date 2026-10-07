/* Nexity prototype — app state, personas, persistence and business rules.
   Shared by the user app (index.html) and the admin panel (admin.html) via localStorage. */
(function () {
  const KEY = 'nexity.proto.v1';
  const VERSION = 5;
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
      features: ['Open & reply to Secret Messages', 'Send 5 Secret Messages a month', 'Add up to 3 Secret Crushes', 'Match animation & chat', 'See "Was near you today 💫"'],
      limits: { secretMessages: 5, crushes: 3, readSecret: true, nearby: true }
    },
    premium: {
      id: 'premium', name: 'Premium', description: 'More mystery, more crushes, a 👑 badge.', mrp: 399, price: 249, active: true,
      features: ['Unlimited Secret Messages (fair use)', 'Add up to 10 Secret Crushes', 'Open & reply to Secret Messages', 'See "Was near you today 💫"', 'Premium profile badge 👑', 'Priority support'],
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
      admin: { nearbyGlobal: true, loggedIn: false, gifts: [], audit: [{ text: 'Nearby feature enabled globally', time: now - 12 * DAY }], indicatorsBase: 1284, emailAlerts: true, weeklyDigest: true },
      demo: { offline: false, failNextPayment: false },
      offers: { quarterly: 10, yearly: 25 },
      coupons: [{ code: 'NEXITY20', pct: 20, note: '20% off any plan' }, { code: 'WELCOME50', pct: 50, note: '50% off your first month', firstOnly: true }],
      security: { failed: 0, lockedUntil: 0 },
    };

    const myTxn = (plan) => s.transactions.unshift({ id: 'TXN' + (48300 + Math.floor(Math.random() * 99)), userId: 'me', plan, amount: s.plans[plan].price, date: now - 2 * DAY, method: 'UPI', status: 'success' });

    switch (persona) {
      case 'plus':
        setPlan(s, 'plus'); myTxn('plus');
        break;
      case 'premium':
        setPlan(s, 'premium'); myTxn('premium');
        s.me.nearbyEnabled = true; s.me.nearbyConsent = true; s.me.locPermission = 'while-using';
        s.stories.push(NX.ownStory(now));
        break;
      case 'secret-receiver':
        setPlan(s, 'plus'); myTxn('plus');
        s.me.nearbyEnabled = true; s.me.nearbyConsent = true; s.me.locPermission = 'while-using';
        s.secretInbox.unshift(NX.extraSecret(now));
        s.notifications.unshift({ id: 'n0', type: 'secret', text: 'Someone is trying to reach you with a Secret Message 💌', time: now - 50 * MIN, read: false, target: { screen: 'secretThread', params: { id: 'sm3' } } });
        break;
      case 'crush-receiver':
        setPlan(s, 'plus'); myTxn('plus');
        s.me.nearbyEnabled = true; s.me.nearbyConsent = true; s.me.locPermission = 'while-using';
        s.crushedBy = ['u2', 'u5'];
        s.notifications.unshift({ id: 'n0', type: 'crush', text: 'Someone added you as a Secret Crush 👀', time: now - 12 * MIN, read: false, target: { screen: 'secret', params: { tab: 'crush' } } });
        break;
      case 'matched': {
        setPlan(s, 'premium'); myTxn('premium');
        s.me.nearbyEnabled = true; s.me.nearbyConsent = true; s.me.locPermission = 'while-using';
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

  /* Only the most recent day two opted-in people were near each other is kept (0 = today, 1 = yesterday, n = n days ago).
     It is only ever shown for anonymous senders/crushes or already-revealed people. When either person has it off,
     nothing at all is shown — never an "off" state. No place, time, distance or history exists in state. */
  const NEAR_MAX_DAYS = 30;
  NX.nearDays = (userId) => {
    if (!S.admin.nearbyGlobal || !S.me.nearbyEnabled) return null;
    const u = NX.user(userId);
    if (!u || !u.nearbyEnabled || u.nearDays == null || u.nearDays > NEAR_MAX_DAYS) return null;
    return u.nearDays;
  };
  NX.nearbyState = (userId) => NX.nearDays(userId) == null ? null : NX.canSeeNearby() ? 'on' : 'locked';
  NX.nearText = (userId) => {
    const d = NX.nearDays(userId);
    if (d == null) return '';
    return d === 0 ? 'Was near you today' : d === 1 ? 'Was near you yesterday' : `Was near you ${d} days ago`;
  };

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
