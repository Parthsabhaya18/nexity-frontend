/* Nexity prototype — mock data seed (no backend). Times are relative to the moment state is built. */
window.NX = window.NX || {};
(function () {
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const av = (n) => `https://i.pravatar.cc/300?img=${n}`;
  const pic = (id, w = 900, h = 900) => `https://picsum.photos/id/${id}/${w}/${h}`;
  NX.T = { MIN, HOUR, DAY };
  NX.img = { av, pic };

  const U = (id, name, username, img, gender, bio, followers, following, extra = {}) => Object.assign({
    id, name, username, avatar: av(img), gender, bio, followers, following,
    online: false, lastSeen: 3 * HOUR, nearbyEnabled: false, nearDays: null,
    email: username.replace(/\./g, '') + '@gmail.com', plan: 'free', status: 'active', joined: '2026-01-10'
  }, extra);

  NX.seedUsers = () => [
    U('u1', 'Aarav Shah', 'aarav.shah', 12, 'Man', 'Product designer. Chai over coffee, always. Collecting sunsets one weekend at a time.', 1284, 312, { online: true, plan: 'plus', joined: '2026-03-14', nearbyEnabled: true, nearDays: 2 }),
    U('u2', 'Riya Patel', 'riya.patel', 47, 'Woman', 'Dancer · dog mom to Bruno 🐶 · writing a little every day.', 2391, 418, { online: true, plan: 'premium', joined: '2025-12-02', nearbyEnabled: true, nearDays: 0 }),
    U('u3', 'Kabir Mehta', 'kabir.mehta', 15, 'Man', 'Guitar, gym, and too many playlists. Ask me for a song.', 967, 540, { lastSeen: 20 * MIN, plan: 'plus', joined: '2026-02-19', nearbyEnabled: true, nearDays: 1 }),
    U('u4', 'Mahi Joshi', 'mahi.joshi', 44, 'Woman', 'Architecture student. Sketching buildings that don\'t exist yet.', 1543, 601, { online: true, joined: '2026-04-01' }),
    U('u5', 'Ishaan Verma', 'ishaan.v', 33, 'Man', 'Startup things by day, street food hunts by night.', 734, 290, { lastSeen: 2 * HOUR, plan: 'premium', joined: '2025-10-21', nearbyEnabled: true, nearDays: 0 }),
    U('u6', 'Ananya Rao', 'ananya.rao', 45, 'Woman', 'Bookworm 📚 Currently reading: everything.', 3120, 377, { lastSeen: 45 * MIN, plan: 'plus', joined: '2026-01-28' }),
    U('u7', 'Vihaan Kapoor', 'vihaan.kapoor', 59, 'Man', 'Photographer. I see the world in 35mm.', 4210, 212, { lastSeen: 5 * HOUR, joined: '2026-05-09', nearbyEnabled: true, nearDays: 5 }),
    U('u8', 'Saanvi Iyer', 'saanvi.iyer', 32, 'Woman', 'Carnatic vocals & cold coffee. Big on kindness.', 1876, 455, { online: true, plan: 'plus', joined: '2026-02-03', nearbyEnabled: true, nearDays: 3 }),
    U('u9', 'Arjun Nair', 'arjun.nair', 53, 'Man', 'Marathoner in training. 21K done, 42K loading…', 1102, 388, { lastSeen: DAY, joined: '2026-06-17' }),
    U('u10', 'Diya Malhotra', 'diya.m', 49, 'Woman', 'Baking my way through life 🍰', 2640, 512, { lastSeen: 3 * HOUR, plan: 'premium', joined: '2025-11-11' }),
    U('u11', 'Rohan Gupta', 'rohan.gupta', 68, 'Man', 'Engineer who secretly wants to be a chef.', 588, 301, { lastSeen: 6 * HOUR, joined: '2026-07-22' }),
    U('u12', 'Meera Desai', 'meera.desai', 26, 'Woman', 'Painting, plants, and Sunday markets.', 1990, 620, { online: true, joined: '2026-03-30' }),
  ];

  NX.meDefaults = () => ({
    id: 'me', name: 'Tara Mehra', username: 'tara.mehra', email: 'tara@nexity.app', avatar: av(5),
    bio: 'Coffee, poetry & late-night playlists. Here for real connections ✨', followers: 842, following: 261,
    gender: 'Woman', dob: '2000-06-12', plan: 'free', planExpiry: null, planSource: null, planMethod: null, autoRenew: true,
    nearbyEnabled: false, nearbyConsent: false, status: 'active', joined: '2025-11-02', online: true
  });

  const POSTS = [
    ['u2', 1025, 'Bruno has officially claimed the couch. I live here now apparently 🐶', 842, 2, ['u4', 'u6', 'u1']],
    ['u1', 1018, 'Took the long way up. Worth every single step ⛰️', 516, 4, ['u3', 'u9']],
    ['u4', 1067, 'City lights, quiet thoughts.', 1203, 7, ['u12', 'u2', 'u7']],
    ['u7', 1015, 'Some places just ask you to slow down.', 2310, 10, ['u1', 'u6']],
    ['u10', 1080, 'Summer in a bowl 🍓 Recipe on request!', 934, 14, ['u2', 'u8', 'u12']],
    ['u6', 1060, 'The barista said this one was "special". He was right ☕', 688, 20, ['u4']],
    ['u3', 1035, 'Found a waterfall. Lost my phone signal. Perfect day.', 455, 26, ['u5', 'u9']],
    ['u8', 106, 'Spring is showing off again 🌸', 1420, 30, ['u10', 'u6']],
    ['u12', 225, 'Tea, a sketchbook, and absolutely no plans.', 774, 40, ['u4', 'u8']],
    ['u9', 1011, 'Paddling into the weekend like…', 602, 52, ['u1']],
    ['u5', 292, 'Market haul. Dinner tonight is going to be elite.', 388, 60, ['u11']],
    ['u11', 326, 'Attempt #4 at homemade ramen. Getting there 🍜', 291, 70, ['u5', 'u3']],
    ['u2', 1069, 'Aquarium day. Jellyfish are just floating vibes.', 1105, 80, ['u8']],
    ['u7', 1074, 'Golden hour does something to everyone.', 3012, 96, ['u1', 'u4', 'u6']],
    ['me', 1084, 'Weekend mode: unlocked.', 212, 120, ['u2', 'u1']],
    ['me', 1050, 'Slow days are the best days 🌊', 348, 200, ['u6']],
  ];
  const CMTS = ['This is stunning 😍', 'Okay this made my day', 'Frame-worthy 🔥', 'The colours though!', 'Saving this one', 'Take me with you next time 🙌', 'Obsessed with this', 'You always find the best moments', 'Need this energy today', 'Wow, just wow'];

  NX.seedPosts = (now) => POSTS.map((p, i) => ({
    id: 'p' + (i + 1), userId: p[0], img: pic(p[1]), caption: p[2], likes: p[3], liked: i % 4 === 1,
    time: now - p[4] * HOUR,
    comments: p[5].map((u, j) => ({ id: `cm${i}_${j}`, userId: u, text: CMTS[(i + j * 3) % CMTS.length], time: now - p[4] * HOUR + (j + 1) * 20 * MIN }))
  }));

  const STORIES = [
    ['u2', [[1002, 'photo', 1], [1003, 'video', 3]]],
    ['u3', [[1004, 'photo', 5]]],
    ['u1', [[1006, 'photo', 2], [1008, 'photo', 8]]],
    ['u4', [[1010, 'video', 6]]],
    ['u8', [[1012, 'photo', 9]]],
    ['u6', [[1013, 'photo', 11], [1014, 'photo', 12]]],
    ['u10', [[1016, 'photo', 15]]],
    ['u12', [[1019, 'video', 18]]],
    ['u7', [[1020, 'photo', 22]]],
  ];
  NX.seedStories = (now) => {
    const out = [];
    STORIES.forEach(([userId, items]) => items.forEach(([id, type, h], i) => out.push({
      id: `st_${userId}_${i}`, userId, type, src: pic(id, 720, 1280), time: now - h * HOUR, views: []
    })));
    return out;
  };
  NX.ownStory = (now) => ({ id: 'st_me_0', userId: 'me', type: 'photo', src: pic(1021, 720, 1280), time: now - 3 * HOUR, views: ['u1', 'u2', 'u4', 'u6', 'u3'] });

  const REELS = [
    ['u7', 1036, 'Snowfall in slow motion ❄️ Turn the sound up.', 'Original audio · vihaan.kapoor', 18200],
    ['u2', 1039, 'Rain + waterfall = instant calm. Watch till the end 💧', 'Monsoon Lofi · Kabira Beats', 9400],
    ['u3', 1043, 'Morning run through the woods. 5K done before 7.', 'Run It Up · Kabir Mehta', 3200],
    ['u10', 1069, 'If jellyfish had a playlist, this would be it.', 'Deep Blue · Ocean Tapes', 12800],
    ['u5', 1074, 'Golden hour hits different when you\'re not rushing.', 'Golden · Lo & Slow', 6100],
    ['u12', 1084, 'Sunday market finds 🌿', 'Original audio · meera.desai', 2700],
    ['me', 1047, 'Tiny moments I didn\'t want to forget.', 'Original audio · tara.mehra', 940],
  ];
  NX.seedReels = (now) => REELS.map((r, i) => ({
    id: 'r' + (i + 1), userId: r[0], src: pic(r[1], 720, 1280), caption: r[2], audio: r[3], likes: r[4], liked: false,
    time: now - (i + 1) * 9 * HOUR,
    comments: [0, 1].map(j => ({ id: `rc${i}_${j}`, userId: ['u1', 'u4', 'u6', 'u8', 'u12', 'u9'][(i + j) % 6], text: CMTS[(i * 2 + j) % CMTS.length], time: now - (i + 1) * 8 * HOUR }))
  }));

  const m = (now, from, text, ago, extra = {}) => Object.assign({ id: 'm' + Math.random().toString(36).slice(2, 9), from, text, time: now - ago, seen: true }, extra);
  NX.msg = m;
  NX.seedChats = (now) => [
    { id: 'c1', userId: 'u2', kind: 'normal', unread: 2, messages: [
      m(now, 'them', 'Heyy! Are you coming to the open mic on Friday?', 26 * HOUR),
      m(now, 'me', 'Obviously! Wouldn\'t miss it 🎤', 25.8 * HOUR),
      m(now, 'them', 'Yay! I\'m performing a new piece 🙈', 40 * MIN, { seen: false }),
      m(now, 'them', 'Tell me honestly after, okay?', 38 * MIN, { seen: false })] },
    { id: 'c2', userId: 'u1', kind: 'normal', unread: 0, messages: [
      m(now, 'them', 'Sent you the trek photos!', 5 * HOUR),
      m(now, 'me', 'These are unreal. That sunrise one 😍', 4.6 * HOUR),
      m(now, 'them', 'Right?? Next trip you\'re coming', 4.5 * HOUR),
      m(now, 'me', 'Deal. Pick a weekend.', 4.4 * HOUR)] },
    { id: 'c3', userId: 'u4', kind: 'normal', unread: 1, messages: [
      m(now, 'me', 'How did the jury go?', 22 * HOUR),
      m(now, 'them', 'They loved the model!! Celebrating tonight 🥳', 9 * HOUR, { seen: false })] },
    { id: 'c4', userId: 'u6', kind: 'normal', unread: 0, messages: [
      m(now, 'them', 'Finished the book you lent me. I need to talk about that ending.', 2 * DAY),
      m(now, 'me', 'I KNOW. Call me later?', 2 * DAY - 10 * MIN)] },
    { id: 'c5', userId: 'u9', kind: 'normal', unread: 0, messages: [
      m(now, 'them', 'Sunday run at 6? Easy 10K.', 3 * DAY),
      m(now, 'me', '6 is brutal but okay 😅', 3 * DAY - 30 * MIN)] },
  ];

  NX.chatReplies = ['Haha, so true 😄', 'Wait, tell me more!', 'That sounds amazing ✨', 'Okay I\'m smiling at my phone now', 'Same here honestly', 'Let\'s plan it this week!', '😂😂', 'You\'re the best'];

  NX.seedSecretInbox = (now) => [
    { id: 'sm1', senderId: 'u3', createdAt: now - 3 * HOUR, repliesUsed: 0, revealed: false, chatId: null,
      messages: [{ from: 'them', text: 'I\'ve wanted to say this for a while — your laugh genuinely makes every room better. 💜', time: now - 3 * HOUR }],
      script: ['Okay wow, you actually replied 😄 I\'m smiling way too much right now.', 'Alright… one more reply and you\'ll know who I am. No pressure 🙈'] },
    { id: 'sm2', senderId: 'u7', createdAt: now - 26 * HOUR, repliesUsed: 0, revealed: false, chatId: null,
      messages: [{ from: 'them', text: 'The way you talk about books makes me want to read all of them. Got a recommendation for me?', time: now - 26 * HOUR }],
      script: ['Adding it to my list right now 📚 Thank you!', 'You might be surprised who this is…'] },
  ];
  NX.extraSecret = (now) => ({
    id: 'sm3', senderId: 'u5', createdAt: now - 50 * MIN, repliesUsed: 1, revealed: false, chatId: null,
    messages: [
      { from: 'them', text: 'You probably don\'t know this, but you made my whole week when you said hi at the café.', time: now - 50 * MIN },
      { from: 'me', text: 'Wait, really? That\'s so sweet. Give me a hint!', time: now - 40 * MIN },
      { from: 'them', text: 'Hint: I ordered the same thing as you. Reply once more and I\'m all yours to judge 😅', time: now - 38 * MIN }],
    script: ['Okay, deep breath… here goes 🙈', 'Thanks for giving this a chance.']
  });
  NX.secretPool = [
    { text: 'Every time you post, I end up smiling at my screen. Just thought you should know 🌙', script: ['You replied! Okay, I\'m officially nervous 😅', 'One more and the mystery is over…'] },
    { text: 'You have the kindest energy. Whoever you\'re talking to always seems happier.', script: ['That means more than you know 💜', 'Ready to find out who I am?'] },
    { text: 'I\'ve rewritten this message eleven times. You\'re honestly amazing, that\'s all.', script: ['Okay eleven drafts was worth it 😄', 'Last chance to keep the mystery alive…'] },
  ];

  NX.seedNotifications = (now) => [
    { id: 'n1', type: 'secret', text: 'Someone sent you a secret message 💌', time: now - 3 * HOUR, read: false, target: { screen: 'secretThread', params: { id: 'sm1' } } },
    { id: 'n2', type: 'chat', userId: 'u2', text: 'You have a new message 💬', time: now - 38 * MIN, read: false, target: { screen: 'chat', params: { id: 'c1' } } },
    { id: 'n3', type: 'crush', text: 'Someone added you as a secret crush 👀', time: now - 5 * HOUR, read: false, target: { screen: 'secret', params: { tab: 'crush' } } },
    { id: 'n4', type: 'like', text: 'Someone liked your post ❤️', time: now - 6 * HOUR, read: true, target: { screen: 'post', params: { id: 'p15' } } },
    { id: 'n5', type: 'like', userId: 'u6', text: '<b>ananya.rao</b> commented on your post: "Saving this one"', time: now - 9 * HOUR, read: true, target: { screen: 'post', params: { id: 'p16' } } },
    { id: 'n6', type: 'secret', text: 'Someone sent you a secret message 💌', time: now - 26 * HOUR, read: true, target: { screen: 'secretThread', params: { id: 'sm2' } } },
    { id: 'n7', type: 'crush', text: 'Someone added you as a secret crush 👀', time: now - 30 * HOUR, read: true, target: { screen: 'secret', params: { tab: 'crush' } } },
    { id: 'n8', type: 'like', text: 'Someone liked your post ❤️', time: now - 2 * DAY, read: true, target: { screen: 'post', params: { id: 'p16' } } },
    { id: 'n9', type: 'subscription', text: 'Unlock Secret Messages and Secret Crush with Plus — from ₹99/month.', time: now - 2.5 * DAY, read: true, target: { screen: 'plans', params: {} } },
  ];

  const EXTRA = [
    ['Kavya Reddy', 'kavya.reddy', 9, 'premium', 'active'], ['Aditya Singh', 'aditya.singh', 11, 'free', 'active'], ['Pooja Nair', 'pooja.nair', 16, 'plus', 'active'],
    ['Siddharth Jain', 'sid.jain', 13, 'free', 'disabled'], ['Neha Kulkarni', 'neha.k', 20, 'free', 'active'], ['Rahul Bose', 'rahul.bose', 14, 'plus', 'active'],
    ['Tanvi Shetty', 'tanvi.shetty', 23, 'free', 'active'], ['Karan Malhotra', 'karan.m', 17, 'premium', 'active'], ['Ira Sen', 'ira.sen', 24, 'free', 'active'],
    ['Dev Patel', 'dev.patel', 18, 'free', 'active'], ['Nisha Arora', 'nisha.arora', 25, 'plus', 'active'], ['Yash Thakur', 'yash.thakur', 51, 'free', 'disabled'],
    ['Aisha Khan', 'aisha.khan', 29, 'premium', 'active'], ['Manav Chopra', 'manav.chopra', 52, 'free', 'active'], ['Ritika Das', 'ritika.das', 31, 'free', 'active'],
    ['Varun Pillai', 'varun.pillai', 54, 'plus', 'active'], ['Simran Kaur', 'simran.kaur', 36, 'free', 'active'], ['Harsh Vora', 'harsh.vora', 56, 'free', 'active'],
    ['Prisha Gill', 'prisha.gill', 38, 'plus', 'active'], ['Om Rathod', 'om.rathod', 57, 'free', 'active'], ['Kiara Bhatia', 'kiara.bhatia', 40, 'free', 'active'],
    ['Laksh Menon', 'laksh.menon', 58, 'premium', 'active'], ['Avni Saxena', 'avni.saxena', 41, 'free', 'active'], ['Reyansh Rao', 'reyansh.rao', 60, 'free', 'active'],
  ];
  NX.seedExtraUsers = () => EXTRA.map((e, i) => U('x' + (i + 1), e[0], e[1], e[2], i % 2 ? 'Man' : 'Woman', '', 100 + i * 37, 80 + i * 11, {
    plan: e[3], status: e[4], joined: new Date(2026, (i * 7) % 9, 1 + (i * 5) % 27).toISOString().slice(0, 10)
  }));

  const METHODS = ['UPI', 'Card', 'UPI', 'Wallet', 'Net Banking', 'UPI', 'Card'];
  NX.seedTransactions = (now) => {
    const payers = ['u2', 'x1', 'u5', 'x3', 'u1', 'x8', 'u10', 'x6', 'u6', 'x11', 'u8', 'x13', 'u3', 'x16', 'x19', 'x22', 'u2', 'x1', 'u5', 'x8', 'u10', 'x13'];
    const statusFor = (i) => (i === 3 || i === 11 || i === 18) ? 'failed' : (i === 6 || i === 15) ? 'pending' : 'success';
    return payers.map((uid, i) => {
      const plans = { u2: 'premium', x1: 'premium', u5: 'premium', x8: 'premium', u10: 'premium', x13: 'premium', x22: 'premium' };
      const plan = plans[uid] || 'plus';
      return { id: 'TXN' + (48213 - i * 37), userId: uid, plan, amount: plan === 'premium' ? 249 : 99, date: now - i * 0.8 * DAY - (i % 3) * HOUR, method: METHODS[i % METHODS.length], status: statusFor(i) };
    });
  };

  NX.seedIssues = (now) => [
    { id: 'NX-1031', userId: 'u9', subject: 'Payments & subscription', message: 'I was charged for Plus but my plan still shows Free on my profile.', date: now - 5 * HOUR, status: 'pending', screenshot: null },
    { id: 'NX-1030', userId: 'u4', subject: 'Report a bug', message: 'Stories freeze for a second when I swipe to the next person.', date: now - 20 * HOUR, status: 'pending', screenshot: null },
    { id: 'NX-1029', userId: 'x3', subject: 'Account', message: 'How do I change my username?', date: now - 2 * DAY, status: 'resolved', screenshot: null },
    { id: 'NX-1028', userId: 'u11', subject: 'Secret Messages', message: 'Can I unsend a secret message after sending it?', date: now - 3 * DAY, status: 'pending', screenshot: null },
    { id: 'NX-1027', userId: 'x7', subject: 'Nearby', message: 'Does Nearby share my exact location with anyone?', date: now - 4 * DAY, status: 'resolved', screenshot: null },
    { id: 'NX-1026', userId: 'u6', subject: 'Other', message: 'Would love a way to save drafts of posts.', date: now - 6 * DAY, status: 'resolved', screenshot: null },
  ];

  NX.seedReports = (now) => [
    { id: 'RP-208', reporterId: 'u6', reportedId: 'x12', content: 'Comment', preview: '"Nobody asked for your opinion…"', reason: 'Harassment or bullying', date: now - 3 * HOUR, status: 'open' },
    { id: 'RP-207', reporterId: 'u4', reportedId: 'x4', content: 'Secret Message', preview: 'Anonymous message (content hidden from list)', reason: 'Harassment or bullying', date: now - 9 * HOUR, status: 'open' },
    { id: 'RP-206', reporterId: 'x5', reportedId: 'x14', content: 'Profile', preview: 'Profile photo & bio', reason: 'Fake account', date: now - 1 * DAY, status: 'open' },
    { id: 'RP-205', reporterId: 'u12', reportedId: 'x18', content: 'Nearby', preview: 'Repeated unwanted contact after Nearby indicator', reason: 'Nearby misuse', date: now - 2 * DAY, status: 'reviewed' },
    { id: 'RP-204', reporterId: 'u2', reportedId: 'x20', content: 'Post', preview: 'Post image', reason: 'Spam', date: now - 3 * DAY, status: 'dismissed' },
    { id: 'RP-203', reporterId: 'x9', reportedId: 'x12', content: 'Reel', preview: 'Reel video', reason: 'Inappropriate content', date: now - 4 * DAY, status: 'actioned' },
    { id: 'RP-202', reporterId: 'u8', reportedId: 'x24', content: 'Nearby', preview: 'Felt followed after seeing indicator', reason: 'Nearby misuse', date: now - 6 * DAY, status: 'open' },
  ];

  NX.galleryIds = [1027, 1029, 1031, 1033, 1037, 1038, 1040, 1041, 1042];
  NX.avatarChoices = [5, 1, 9, 10, 16, 20, 23, 24, 25, 29, 31, 36];
})();
