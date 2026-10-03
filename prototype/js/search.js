/* Search people by name or username, with recent searches and an intent banner for secret flows. */
(function () {
  let q = '';
  let timer = null;

  const INTENT = {
    secret: { emoji: '💌', text: 'Pick someone to send a Secret Message. Open their profile and tap <b>Send Secret Message</b>.' },
    crush: { emoji: '💘', text: 'Who\'s your crush? Open their profile and tap <b>Add Secret Crush</b>.' },
  };

  function results(query) {
    const v = query.trim().toLowerCase().replace(/^@/, '');
    const pool = S.users.filter(u => !NX.isBlocked(u.id));
    if (!v) {
      const recent = S.recentSearches.map(un => S.users.find(u => u.username === un)).filter(u => u && !NX.isBlocked(u.id));
      const sugg = pool.filter(u => !S.recentSearches.includes(u.username)).slice(0, 6);
      return `
        ${recent.length ? `<div class="section-head"><h2>Recent</h2><button class="link" data-action="clearRecent">Clear all</button></div>
          <div class="list">${recent.map(u => userRow(u, `<button class="icon-btn sm" data-action="removeRecent" data-u="${esc(u.username)}" aria-label="Remove ${esc(u.username)} from recent">${Icon('x', 18)}</button>`, { onOpen: 'addRecent' })).join('')}</div>` : ''}
        <div class="section-head"><h2>Suggested for you</h2></div>
        <div class="list">${sugg.map(u => userRow(u, followBtn(u), { onOpen: 'addRecent' })).join('')}</div>`;
    }
    const found = pool.filter(u => u.name.toLowerCase().includes(v) || u.username.includes(v));
    if (!found.length) return emptyState({ icon: 'search', title: 'No results', text: `We couldn't find anyone matching "<b>${esc(query)}</b>". Try a different name or username.` });
    return `<p class="results-count">${found.length} ${found.length === 1 ? 'person' : 'people'}</p>
      <div class="list">${found.map(u => userRow(u, followBtn(u), { onOpen: 'addRecent', sub: `${u.name} · ${fmtNum(u.followers)} followers` })).join('')}</div>`;
  }

  Screens.search = {
    title: 'Search',
    render: (p) => {
      const intent = INTENT[p.intent];
      App.intent = p.intent || null;
      return `
        <header class="appbar appbar-search">
          <button class="icon-btn" data-action="back" aria-label="Go back">${Icon('back', 24)}</button>
          <div class="search-box">
            ${Icon('search', 18)}
            <input id="searchInput" type="search" placeholder="Search by name or username" value="${esc(q)}" data-input="search" autocomplete="off" aria-label="Search people" data-no-keep>
            <button class="icon-btn sm search-clear" data-action="clearSearch" aria-label="Clear search" ${q ? '' : 'hidden'}>${Icon('x', 16)}</button>
          </div>
        </header>
        <div class="page">
          ${intent ? `<div class="intent-banner"><span>${intent.emoji}</span><p>${intent.text}</p></div>` : ''}
          <div id="searchResults" aria-live="polite">${results(q)}</div>
        </div>`;
    },
    mount(el, p, dir) {
      if (dir !== 'none' && dir !== 'back') setTimeout(() => { const i = $('#searchInput'); i && i.focus(); }, 280);
    }
  };

  Inputs.search = (el) => {
    q = el.value;
    $('.search-clear').hidden = !q;
    const box = $('#searchResults');
    clearTimeout(timer);
    if (q.trim()) box.innerHTML = `<div class="list">${[0, 1, 2].map(() => `<div class="user-row skeleton-row"><span class="sk sk-circle"></span><span class="sk sk-line" style="width:45%"></span></div>`).join('')}</div>`;
    timer = setTimeout(() => { box.innerHTML = results(q); }, q.trim() ? 260 : 0);
  };
  Actions.clearSearch = () => { q = ''; App.refresh(); $('#searchInput').value = ''; $('#searchInput').focus(); };
  Actions.addRecent = (el) => {
    const id = el.dataset.id;
    const u = NX.user(id);
    if (!u) return;
    S.recentSearches = [u.username, ...S.recentSearches.filter(x => x !== u.username)].slice(0, 6);
    NX.save();
  };
  Actions.removeRecent = (el) => { S.recentSearches = S.recentSearches.filter(x => x !== el.dataset.u); NX.save(); $('#searchResults').innerHTML = results(q); };
  Actions.clearRecent = () => { S.recentSearches = []; NX.save(); $('#searchResults').innerHTML = results(q); };
})();
