/* Stack-based navigation. Tabs reset the stack; screens push on top. */
(function () {
  const TABS = ['home', 'search', 'secret', 'plans', 'reels', 'chats', 'profile'];

  window.Nav = {
    stack: [{ name: 'splash', params: {} }],
    TABS,

    cur() { return this.stack[this.stack.length - 1]; },
    is(name) { return this.cur().name === name; },
    rootTab() {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        const s = Screens[this.stack[i].name];
        if (s && s.tab) return s.tab;
      }
      return null;
    },

    go(name, params = {}, { replace = false } = {}) {
      const c = this.cur();
      if (c) c.scroll = window.scrollY;
      if (replace) this.stack.pop();
      this.stack.push({ name, params });
      App.render('forward');
    },

    back() {
      if (Overlay.stack.length) { Overlay.close(); return; }
      if (Modal.stack.length) { Modal.close(); return; }
      if (this.stack.length > 1) {
        this.stack.pop();
        App.render('back');
      } else if (!['home', 'welcome', 'splash'].includes(this.cur().name) && S.session.loggedIn) {
        this.tab('home');
      }
    },

    tab(name, params = {}) {
      if (this.stack.length === 1 && this.cur().name === name && JSON.stringify(params) === JSON.stringify(this.cur().params || {})) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const r = document.querySelector('.reels');
        if (r) r.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      this.stack = [{ name, params }];
      App.render('fade');
    },

    reset(name, params = {}) {
      this.stack = [{ name, params }];
      App.render('fade');
    },
  };

  /* Keep the hardware/browser back button inside the app. */
  window.addEventListener('popstate', () => {
    Nav.back();
    history.pushState({ nx: 1 }, '');
  });
  history.pushState({ nx: 1 }, '');
})();
