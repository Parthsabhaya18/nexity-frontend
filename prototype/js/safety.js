/* Safety tools: report (users, content, anonymous messages) and block. Reports flow into the admin panel. */
(function () {
  const REASONS = ['Spam', 'Harassment or bullying', 'Inappropriate content', 'Fake account', 'Hate speech', 'Nearby misuse', 'Something else'];

  window.Safety = {
    /* opts: { userId, content: 'Post'|'Reel'|'Story'|'Profile'|'Comment'|'Secret Message'|'Chat', preview, anonymous } */
    report(opts) {
      const u = NX.user(opts.userId);
      const who = opts.anonymous ? 'this anonymous sender' : esc(u.username);
      const el = Modal.open({
        title: `Report ${opts.content === 'Profile' ? 'account' : opts.content.toLowerCase()}`,
        body: `
          <form data-form="report" id="reportForm" novalidate>
            <p class="muted small">Why are you reporting ${who}? ${opts.anonymous ? 'Their identity stays hidden from you — our safety team can still act on it.' : 'They won\'t know who reported them.'}</p>
            <div class="radio-list" role="radiogroup">
              ${REASONS.map((r, i) => `<label class="radio-row"><input type="radio" name="reason" value="${r}" ${i === 0 ? '' : ''}><span>${r}</span><i class="radio-dot"></i></label>`).join('')}
            </div>
            <div class="field">
              <label for="reportDetails">Add details <span class="muted">(optional)</span></label>
              <textarea class="input" id="reportDetails" name="details" rows="2" maxlength="300" placeholder="Anything that helps us understand"></textarea>
            </div>
            <p class="field-error" id="reportErr" role="alert"></p>
          </form>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" type="submit" form="reportForm">Submit report</button>`
      });
      el.querySelector('form').dataset.payload = JSON.stringify(opts);
    },

    async block(userId, { anonymous = false, onDone } = {}) {
      const u = NX.user(userId);
      const ok = await Modal.confirm({
        title: anonymous ? 'Block this sender?' : `Block ${u.username}?`,
        message: anonymous
          ? 'You won\'t receive messages from them again. Their identity stays hidden and they won\'t be notified.'
          : 'They won\'t be able to find your profile, see your posts or message you. They won\'t be notified.',
        confirm: 'Block', danger: true, icon: 'ban'
      });
      if (!ok) return false;
      if (anonymous) {
        // Anonymous blocks only stop secret messages. Hiding their public profile/posts would hint at who they are.
        S.blockedAnon = S.blockedAnon || [];
        if (!S.blockedAnon.includes(userId)) S.blockedAnon.push(userId);
      } else {
        if (!S.blocked.includes(userId)) S.blocked.push(userId);
        S.following = S.following.filter(id => id !== userId);
      }
      NX.save();
      Toast.show(anonymous ? 'Sender blocked' : 'User blocked', { type: 'success', icon: 'ban' });
      if (onDone) onDone(); else App.refresh();
      return true;
    },
  };

  Forms.report = async (form) => {
    const reason = (form.querySelector('[name=reason]:checked') || {}).value;
    if (!reason) { $('#reportErr').textContent = 'Please choose a reason.'; return; }
    const opts = JSON.parse(form.dataset.payload);
    const btn = document.querySelector('[form="reportForm"]');
    setBusy(btn, true, 'Submitting…');
    await delay(700);
    S.reports.unshift({
      id: 'RP-' + (209 + S.reports.length), reporterId: 'me', reportedId: opts.userId, content: opts.content,
      preview: opts.anonymous ? 'Anonymous message (content hidden from list)' : (opts.preview || opts.content).slice(0, 80),
      reason, details: form.details.value.trim(), date: Date.now(), status: 'open'
    });
    NX.save();
    Modal.closeAll();
    Toast.show('Report submitted. Thanks for keeping Nexity safe.', { type: 'success', icon: 'shieldCheck' });
  };

  Actions.unblock = async (el) => {
    const u = NX.user(el.dataset.id);
    if (!(await Modal.confirm({ title: `Unblock ${u.username}?`, message: 'They\'ll be able to see your profile and message you again.', confirm: 'Unblock' }))) return;
    S.blocked = S.blocked.filter(id => id !== u.id);
    NX.save();
    App.refresh();
    Toast.show(`${esc(u.username)} unblocked`, { type: 'success' });
  };
})();
