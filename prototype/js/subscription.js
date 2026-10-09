/* Subscription: pricing, checkout (UPI / Card / Net Banking / Wallet), processing, success, failure, active plan. */
(function () {
  const REASONS = {
    'secret-send': { emoji: '💌', title: 'Secret Messages need Plus or Premium', text: 'Send anonymous messages — you\'re only revealed after they reply twice.' },
    'secret-read': { emoji: '💌', title: 'Someone is trying to reach you', text: 'Upgrade to reply. Their name and message unseal together after your 2nd reply.' },
    crush: { emoji: '💘', title: 'Secret Crush needs Plus or Premium', text: 'Add your crushes privately. If it\'s mutual, it\'s a match.' },
    nearby: { emoji: '✨', title: 'See who was near you', text: 'Plus and Premium show "This person was near you today." or "yesterday." in Secret Messages and Secret Crush — never a place, time or distance.' },
    limit: { emoji: '👑', title: 'You\'ve reached your plan limit', text: 'Premium gives unlimited Secret Messages (fair use), up to 10 Secret Crushes and a 👑 badge.' },
  };
  const ORDER = ['free', 'plus', 'premium'];
  const lim = (v) => v < 0 ? 'Unlimited' : v === 0 ? '—' : v;
  const yes = (b) => b ? `<span class="yes">${Icon('check', 16)}</span>` : `<span class="no">${Icon('x', 16)}</span>`;

  function planCard(p) {
    const cur = S.me.plan === p.id;
    const curIdx = ORDER.indexOf(S.me.plan), idx = ORDER.indexOf(p.id);
    let cta;
    if (cur) cta = p.id === 'free' ? `<button class="btn btn-block btn-secondary" disabled>Your current plan</button>` : `<button class="btn btn-block btn-secondary" data-go="mySubscription">Manage subscription</button>`;
    else if (idx < curIdx) cta = `<p class="pc-note">${p.id === 'free' ? 'Included in every plan' : `Included in ${S.plans[S.me.plan].name}`}</p>`;
    else cta = `<button class="btn btn-block ${p.id === 'premium' ? 'btn-premium' : 'btn-primary'}" data-go="checkout" data-params='{"plan":"${p.id}"}'>${p.id === 'premium' ? 'Get Premium' : `Upgrade to ${esc(p.name)}`}</button>`;
    const save = p.mrp > p.price && p.price > 0 ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const missing = p.id === 'free' ? ['Send or read Secret Messages', 'Add Secret Crushes', 'Nearby hints in Secret Messages & Crush'] : [];
    return `
      <article class="plan-card plan-${p.id} ${cur ? 'current' : ''}" aria-label="${esc(p.name)} plan">
        ${p.id === 'premium' ? '<span class="ribbon">Most loved</span>' : ''}
        <div class="pc-head">
          <span class="pc-ic">${Icon(p.id === 'premium' ? 'crown' : p.id === 'plus' ? 'sparkles' : 'user', 20)}</span>
          <h3>${esc(p.name)}</h3>
          ${cur ? '<span class="chip chip-ok">Current</span>' : ''}
        </div>
        <p class="pc-desc">${esc(p.description)}</p>
        <div class="pc-price">
          ${p.price ? `<b>${inr(p.price)}</b><span>/month</span>` : '<b>₹0</b><span>forever</span>'}
          ${save ? `<s>${inr(p.mrp)}</s><span class="save">Save ${save}%</span>` : ''}
        </div>
        <ul class="pc-features">
          ${p.features.map(f => `<li>${Icon('check', 16)}<span>${esc(f)}</span></li>`).join('')}
          ${missing.map(f => `<li class="off">${Icon('x', 16)}<span>${f}</span></li>`).join('')}
        </ul>
        ${cta}
      </article>`;
  }

  Screens.plans = {
    tab: 'secret', title: 'Plans',
    render: (p) => {
      const r = REASONS[p.reason];
      if (p.to) App.afterUpgrade = { screen: 'secretCompose', params: { id: p.to } };
      else if (p.reason === 'secret-read') App.afterUpgrade = { tab: 'secret', params: { tab: 'messages' } };
      else if (p.reason === 'crush') App.afterUpgrade = { tab: 'secret', params: { tab: 'crush' } };
      else App.afterUpgrade = null;
      const plans = ORDER.map(id => S.plans[id]).filter(pl => pl && (pl.active || pl.id === S.me.plan));
      const P = S.plans;
      return `
        ${appbar({ title: 'Plans', back: Nav.stack.length > 1 })}
        <div class="page plans">
          ${r ? `<div class="reason-banner"><span>${r.emoji}</span><div><b>${r.title}</b><p>${r.text}</p></div></div>` : `
            <div class="plans-head"><h2>Unlock your secret side</h2><p>Simple plans. Save up to ${S.offers ? S.offers.yearly : 25}% when you pay yearly.</p></div>`}
          <div class="current-plan">${Icon('info', 16)} You're on <b>${esc(NX.plan().name)}</b>${NX.isPaid() ? ` · active until ${fmtDate(S.me.planExpiry)}` : ''}</div>
          <div class="plan-grid">${plans.map(planCard).join('')}</div>
          <section class="compare card">
            <h3>Compare plans</h3>
            <div class="table-scroll"><table>
              <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Plus</th><th scope="col">Premium</th></tr></thead>
              <tbody>
                <tr><th scope="row">Posts, Reels, Stories & Chat</th><td>${yes(true)}</td><td>${yes(true)}</td><td>${yes(true)}</td></tr>
                <tr><th scope="row">Secret notifications</th><td>${yes(true)}</td><td>${yes(true)}</td><td>${yes(true)}</td></tr>
                <tr><th scope="row">Send Secret Messages / month</th><td>${lim(P.free.limits.secretMessages)}</td><td>${lim(P.plus.limits.secretMessages)}</td><td>${lim(P.premium.limits.secretMessages)}</td></tr>
                <tr><th scope="row">Read & reply to Secret Messages</th><td>${yes(P.free.limits.readSecret)}</td><td>${yes(P.plus.limits.readSecret)}</td><td>${yes(P.premium.limits.readSecret)}</td></tr>
                <tr><th scope="row">Secret Crush spots</th><td>${lim(P.free.limits.crushes)}</td><td>${lim(P.plus.limits.crushes)}</td><td>${lim(P.premium.limits.crushes)}</td></tr>
                <tr><th scope="row">Match animation &amp; chat</th><td>${yes(false)}</td><td>${yes(true)}</td><td>${yes(true)}</td></tr>
                <tr><th scope="row">Premium profile badge 👑</th><td>${yes(false)}</td><td>${yes(false)}</td><td>${yes(true)}</td></tr>
                <tr><th scope="row">Nearby screen &amp; notifications</th><td>${yes(true)}</td><td>${yes(true)}</td><td>${yes(true)}</td></tr>
                <tr><th scope="row">"This person was near you today."</th><td>${yes(P.free.limits.nearby)}</td><td>${yes(P.plus.limits.nearby)}</td><td>${yes(P.premium.limits.nearby)}</td></tr>
              </tbody>
            </table></div>
          </section>
          <div class="trust-row"><span>${Icon('repeat', 16)} Monthly, 3-month or yearly</span><span>${Icon('x', 16)} Cancel anytime</span><span>${Icon('shieldCheck', 16)} Secure payment</span></div>
        </div>`;
    }
  };

  /* ---------- Checkout ---------- */
  const METHODS = [
    { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm & more', icon: 'phone' },
    { id: 'card', label: 'Credit / Debit card', sub: 'Visa, Mastercard, RuPay', icon: 'card' },
    { id: 'netbanking', label: 'Net Banking', sub: 'All major Indian banks', icon: 'bank' },
    { id: 'wallet', label: 'Wallet', sub: 'Paytm, Amazon Pay, MobiKwik', icon: 'wallet' },
  ];
  const METHOD_NAME = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet' };

  function methodDetail(c) {
    if (c.method === 'upi') return `
      <div class="chip-group" role="radiogroup" aria-label="UPI app">
        ${['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map(a => `<button type="button" class="chip ${c.upiApp === a ? 'active' : ''}" data-action="pickUpiApp" data-v="${a}" aria-pressed="${c.upiApp === a}">${a}</button>`).join('')}
      </div>
      <div class="or-line"><span>or pay with UPI ID</span></div>
      ${field({ label: 'UPI ID', name: 'upi', id: 'payUpi', placeholder: 'yourname@okbank', value: c.upiId, extra: 'data-input="payField" data-k="upiId" autocapitalize="none"' })}`;
    if (c.method === 'card') return `
      ${field({ label: 'Card number', name: 'cardNo', id: 'payCard', placeholder: '1234 5678 9012 3456', value: c.cardNo, extra: 'inputmode="numeric" maxlength="19" data-input="cardNo" data-k="cardNo"', autocomplete: 'cc-number' })}
      <div class="field-row">
        ${field({ label: 'Expiry', name: 'exp', id: 'payExp', placeholder: 'MM/YY', value: c.exp, extra: 'inputmode="numeric" maxlength="5" data-input="cardExp" data-k="exp"', autocomplete: 'cc-exp' })}
        ${field({ label: 'CVV', name: 'cvv', id: 'payCvv', type: 'password', placeholder: '•••', value: c.cvv, extra: 'inputmode="numeric" maxlength="4" data-input="payField" data-k="cvv"', autocomplete: 'cc-csc' })}
      </div>
      ${field({ label: 'Name on card', name: 'cardName', id: 'payName', placeholder: 'As printed on card', value: c.cardName, extra: 'data-input="payField" data-k="cardName"', autocomplete: 'cc-name' })}`;
    if (c.method === 'netbanking') return `
      <div class="field"><label for="payBank">Choose your bank</label>
        <select class="input" id="payBank" data-change="payField" data-k="bank">
          <option value="">Select a bank</option>
          ${['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'Other bank'].map(b => `<option ${c.bank === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select></div>`;
    return `
      <div class="chip-group" role="radiogroup" aria-label="Wallet">
        ${['Paytm Wallet', 'Amazon Pay', 'MobiKwik'].map(w => `<button type="button" class="chip ${c.wallet === w ? 'active' : ''}" data-action="pickWallet" data-v="${w}" aria-pressed="${c.wallet === w}">${w}</button>`).join('')}
      </div>`;
  }

  const PERIODS = [[1, 'Monthly'], [3, '3 months'], [12, 'Yearly']];
  const periodPct = (m) => { const o = S.offers || { quarterly: 10, yearly: 25 }; return m === 12 ? o.yearly : m === 3 ? o.quarterly : 0; };
  const hasPaidBefore = () => S.transactions.some(t => t.userId === 'me' && t.status === 'success');
  /* Price breakdown for the current checkout: plan × period, period saving, then coupon. */
  function quote(plan, c) {
    const m = c.period, base = plan.price * m, mrpBase = Math.max(plan.mrp, plan.price) * m;
    const periodOff = Math.round(base * periodPct(m) / 100);
    const afterPeriod = base - periodOff;
    const couponOff = c.coupon ? Math.round(afterPeriod * c.coupon.pct / 100) : 0;
    return { m, base, mrpBase, launchOff: mrpBase - base, periodOff, couponOff, total: Math.max(0, afterPeriod - couponOff) };
  }
  NX.quote = quote;

  Screens.checkout = {
    chrome: 'none', title: 'Checkout',
    render: (p) => {
      const plan = S.plans[p.plan] || S.plans.plus;
      if (!App.checkout || App.checkout.plan !== plan.id) App.checkout = { plan: plan.id, period: 1, coupon: null, method: 'upi', upiApp: 'Google Pay', upiId: '', cardNo: '', exp: '', cvv: '', cardName: '', bank: '', wallet: '' };
      const c = App.checkout;
      const q = quote(plan, c);
      const label = c.period === 1 ? 'Monthly' : c.period === 3 ? '3-month' : 'Yearly';
      return `
        ${appbar({ title: 'Checkout' })}
        <div class="page checkout">
          <section class="order card plan-${plan.id}">
            <div class="order-head"><span class="pc-ic">${Icon(plan.id === 'premium' ? 'crown' : 'sparkles', 20)}</span><div><b>Nexity ${esc(plan.name)}</b><small>${label} plan · renews automatically · cancel anytime</small></div></div>
            <div class="period-pick" role="radiogroup" aria-label="Billing period">
              ${PERIODS.map(([m, l]) => { const pct = periodPct(m); const t = quote(plan, { period: m, coupon: null }).total; return `
                <button type="button" class="period ${c.period === m ? 'active' : ''}" role="radio" aria-checked="${c.period === m}" data-action="pickPeriod" data-m="${m}">
                  ${pct ? `<span class="period-save">Save ${pct}%</span>` : ''}
                  <b>${l}</b><span>${inr(t)}</span><small>${m > 1 ? `${inr(Math.round(t / m))}/mo` : 'per month'}</small>
                </button>`; }).join('')}
            </div>
            <dl class="order-rows">
              <div><dt>${esc(plan.name)} × ${q.m} month${q.m > 1 ? 's' : ''}</dt><dd>${inr(q.mrpBase)}</dd></div>
              ${q.launchOff ? `<div class="disc"><dt>Launch discount</dt><dd>−${inr(q.launchOff)}</dd></div>` : ''}
              ${q.periodOff ? `<div class="disc"><dt>${label} saving (${periodPct(q.m)}%)</dt><dd>−${inr(q.periodOff)}</dd></div>` : ''}
              ${q.couponOff ? `<div class="disc"><dt>Coupon ${esc(c.coupon.code)}</dt><dd>−${inr(q.couponOff)}</dd></div>` : ''}
              <div class="total"><dt>Total today</dt><dd>${inr(q.total)}</dd></div>
            </dl>
            <div class="coupon">
              ${c.coupon ? `<div class="coupon-on">${Icon('gift', 16)}<span><b>${esc(c.coupon.code)}</b> applied · ${esc(c.coupon.note)}</span><button class="link" data-action="removeCoupon">Remove</button></div>` : `
                <div class="coupon-row">
                  <input class="input" id="couponInput" placeholder="Have a coupon code?" autocomplete="off" autocapitalize="characters" aria-label="Coupon code" data-input="couponInput">
                  <button type="button" class="btn btn-secondary" data-action="applyCoupon">Apply</button>
                </div>
                <p class="field-error" id="couponErr" role="alert"></p>`}
            </div>
            <p class="fine">Inclusive of all taxes. Next renewal on ${fmtDate(Date.now() + 30 * q.m * NX.T.DAY)}. Demo codes: <b>NEXITY20</b>, <b>WELCOME50</b>.</p>
          </section>
          <h2 class="h-section">Payment method</h2>
          <div class="pay-methods" role="radiogroup" aria-label="Payment method">
            ${METHODS.map(m => `
              <button type="button" class="pay-method ${c.method === m.id ? 'active' : ''}" role="radio" aria-checked="${c.method === m.id}" data-action="pickMethod" data-m="${m.id}">
                <span class="pm-ic">${Icon(m.icon, 20)}</span><span class="pm-text"><b>${m.label}</b><small>${m.sub}</small></span><i class="radio-dot"></i>
              </button>
              ${c.method === m.id ? `<div class="pay-detail">${methodDetail(c)}</div>` : ''}`).join('')}
          </div>
          <p class="field-error" id="payErr" role="alert"></p>
          <div class="demo-hint"><span>${Icon('info', 16)} Demo: UPI ID <b>fail@upi</b> or a card ending <b>0000</b> simulates a failed payment.</span></div>
          <button class="btn ${plan.id === 'premium' ? 'btn-premium' : 'btn-primary'} btn-lg btn-block" data-action="pay">Pay ${inr(q.total)}</button>
          <p class="fine center">${Icon('lock', 13)} Payments are simulated in this prototype. No money is charged.</p>
        </div>`;
    }
  };
  Actions.pickPeriod = (el) => { App.checkout.period = Number(el.dataset.m); App.refresh(); };
  Inputs.couponInput = () => { const e = $('#couponErr'); if (e) e.textContent = ''; };
  Actions.applyCoupon = () => {
    const code = ($('#couponInput').value || '').trim().toUpperCase();
    const err = (m) => { $('#couponErr').textContent = m; };
    if (!code) return err('Enter a coupon code.');
    const cp = (S.coupons || []).find(x => x.code === code);
    if (!cp) return err('That code isn\'t valid or has expired.');
    if (cp.firstOnly && hasPaidBefore()) return err('This code is only for your first subscription.');
    App.checkout.coupon = cp;
    App.refresh();
    Toast.show(`Coupon applied — ${cp.pct}% off 🎉`, { type: 'success' });
  };
  Actions.removeCoupon = () => { App.checkout.coupon = null; App.refresh(); };
  Actions.pickMethod = (el) => { App.checkout.method = el.dataset.m; $('#payErr').textContent = ''; App.refresh(); };
  Actions.pickUpiApp = (el) => { App.checkout.upiApp = el.dataset.v; App.checkout.upiId = ''; App.refresh(); };
  Actions.pickWallet = (el) => { App.checkout.wallet = el.dataset.v; App.refresh(); };
  Inputs.payField = (el) => {
    App.checkout[el.dataset.k] = el.value;
    if (el.dataset.k === 'upiId' && el.value) { App.checkout.upiApp = ''; $$('[data-action="pickUpiApp"]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }); }
    $('#payErr').textContent = '';
  };
  Inputs.cardNo = (el) => {
    const d = el.value.replace(/\D/g, '').slice(0, 16);
    el.value = d.replace(/(.{4})/g, '$1 ').trim();
    App.checkout.cardNo = el.value;
  };
  Inputs.cardExp = (el) => {
    let d = el.value.replace(/\D/g, '').slice(0, 4);
    if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2);
    el.value = d;
    App.checkout.exp = d;
  };

  Actions.pay = (el) => {
    const c = App.checkout;
    const err = (m) => { $('#payErr').textContent = m; };
    if (c.method === 'upi') {
      if (c.upiId && !/^[\w.\-]{2,}@[a-z]{2,}$/i.test(c.upiId)) return err('Enter a valid UPI ID, like name@okbank.');
      if (!c.upiId && !c.upiApp) return err('Choose a UPI app or enter your UPI ID.');
    }
    if (c.method === 'card') {
      const num = c.cardNo.replace(/\s/g, '');
      if (num.length !== 16) return err('Enter a valid 16-digit card number.');
      const [mm, yy] = (c.exp || '').split('/').map(Number);
      const now = new Date();
      if (!mm || mm > 12 || !yy || (2000 + yy < now.getFullYear()) || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)) return err('Enter a valid, unexpired expiry date (MM/YY).');
      if (!/^\d{3,4}$/.test(c.cvv)) return err('Enter the 3-digit CVV.');
      if (c.cardName.trim().length < 2) return err('Enter the name on the card.');
    }
    if (c.method === 'netbanking' && !c.bank) return err('Choose your bank.');
    if (c.method === 'wallet' && !c.wallet) return err('Choose a wallet.');
    const fail = S.demo.failNextPayment || c.upiId.toLowerCase() === 'fail@upi' || (c.method === 'card' && c.cardNo.replace(/\s/g, '').endsWith('0000'));
    const q = quote(S.plans[c.plan], c);
    Nav.go('processing', { plan: c.plan, method: c.method, fail, amount: q.total, months: q.m, coupon: c.coupon ? c.coupon.code : null });
  };

  Screens.processing = {
    chrome: 'none', title: 'Processing payment',
    render: (p) => `
      <div class="done-screen processing">
        <div class="proc-ring" aria-hidden="true"><span></span>${Icon('lock', 28)}</div>
        <h1>Processing payment…</h1>
        <p id="procStep" aria-live="polite">Connecting to ${esc(METHOD_NAME[p.method] || 'your bank')}…</p>
        <p class="fine">Please don't close this screen.</p>
      </div>`,
    mount(el, p) {
      const steps = ['Waiting for approval…', 'Confirming with your bank…'];
      steps.forEach((s, i) => setTimeout(() => { const e = $('#procStep'); if (e) e.textContent = s; }, 900 * (i + 1)));
      setTimeout(() => {
        if (!Nav.is('processing')) return;
        const plan = S.plans[p.plan];
        const months = p.months || 1;
        const txn = { id: 'TXN' + (48400 + Math.floor(Math.random() * 9000)), userId: 'me', plan: p.plan, amount: p.amount != null ? p.amount : plan.price, months, coupon: p.coupon || null, date: Date.now(), method: METHOD_NAME[p.method], status: p.fail ? 'failed' : 'success' };
        S.transactions.unshift(txn);
        if (p.fail) {
          S.demo.failNextPayment = false;
          NX.save();
          Nav.go('payFailed', { plan: p.plan, method: p.method }, { replace: true });
          return;
        }
        NX.setPlan(p.plan, 30 * months, 'paid', METHOD_NAME[p.method]);
        S.me.planMonths = months;
        NX.notify({ type: 'subscription', text: `Payment successful — your ${esc(plan.name)} plan is active until ${fmtDate(S.me.planExpiry)}.`, target: { screen: 'mySubscription', params: {} }, read: true });
        App.checkout = null;
        NX.save();
        Nav.go('paySuccess', { plan: p.plan, txn: txn.id }, { replace: true });
      }, 2800);
    }
  };

  Screens.paySuccess = {
    chrome: 'none', title: 'Payment successful',
    render: (p) => {
      const plan = S.plans[p.plan];
      const after = App.afterUpgrade;
      return `
        <div class="done-screen success plan-${plan.id}">
          <div class="success-check big">${Icon('check', 48)}</div>
          <p class="eyebrow">Payment successful</p>
          <h1>You're on ${esc(plan.name)} 🎉</h1>
          <p>Your plan is active until <b>${fmtDate(S.me.planExpiry)}</b>. Transaction ${esc(p.txn)}.</p>
          <ul class="unlocked">${plan.features.map(f => `<li>${Icon('unlock', 16)} ${esc(f)}</li>`).join('')}</ul>
          <div class="done-actions">
            ${after && after.screen === 'secretCompose' ? `<button class="btn btn-primary btn-lg btn-block" data-action="afterUpgrade">Continue your Secret Message 💌</button>`
              : `<button class="btn btn-primary btn-lg btn-block" data-action="afterUpgrade">Explore Secret ✨</button>`}
            <button class="btn btn-ghost btn-lg btn-block" data-action="goSubscription">View subscription</button>
          </div>
        </div>`;
    },
    mount() { setTimeout(() => confetti(70), 200); Toast.show('Payment successful', { type: 'success' }); }
  };
  Actions.afterUpgrade = () => {
    const a = App.afterUpgrade;
    App.afterUpgrade = null;
    if (a && a.screen === 'secretCompose') { Nav.stack = [{ name: 'user', params: a.params }]; Nav.go('secretCompose', a.params); return; }
    Nav.tab('secret', a && a.params ? a.params : {});
  };
  Actions.goSubscription = () => { App.afterUpgrade = null; Nav.stack = [{ name: 'profile', params: {} }]; Nav.go('mySubscription'); };

  Screens.payFailed = {
    chrome: 'none', title: 'Payment failed',
    render: (p) => {
      const plan = S.plans[p.plan];
      return `
        <div class="done-screen failed">
          <div class="fail-x">${Icon('x', 44)}</div>
          <h1>Payment failed</h1>
          <p>Your bank declined the ${esc(METHOD_NAME[p.method] || '')} payment of <b>${inr(plan.price)}</b>. No money was deducted.</p>
          <div class="fail-tips"><p>${Icon('info', 16)} Check your balance or limits, or try a different payment method.</p></div>
          <div class="done-actions">
            <button class="btn btn-primary btn-lg btn-block" data-go="checkout" data-params='{"plan":"${p.plan}"}' data-replace>Try again</button>
            <button class="btn btn-secondary btn-lg btn-block" data-action="back">Back to plans</button>
            <button class="link" data-go="contact" data-params='{"subject":"Payments & subscription"}'>Contact support</button>
          </div>
        </div>`;
    },
    mount() { Toast.show('Payment failed', { type: 'error' }); }
  };

  /* ---------- Active subscription ---------- */
  Screens.mySubscription = {
    title: 'Subscription',
    render: () => {
      const plan = NX.plan();
      const paid = NX.isPaid();
      const txns = S.transactions.filter(t => t.userId === 'me');
      const l = plan.limits;
      return `
        ${appbar({ title: 'Subscription' })}
        <div class="page">
          <section class="sub-card plan-${plan.id}">
            <div class="sub-top">
              <span class="pc-ic">${Icon(plan.id === 'premium' ? 'crown' : plan.id === 'plus' ? 'sparkles' : 'user', 22)}</span>
              <div><p class="eyebrow">Current plan</p><h2>${esc(plan.name)}</h2></div>
              ${paid ? `<span class="chip ${S.me.autoRenew ? 'chip-ok' : 'chip-warn'}">${S.me.planSource === 'admin' ? 'Gifted' : S.me.autoRenew ? 'Active' : 'Ends soon'}</span>` : ''}
            </div>
            ${paid ? `
              <dl class="sub-rows">
                <div><dt>${S.me.autoRenew ? 'Renews on' : 'Active until'}</dt><dd>${fmtDate(S.me.planExpiry)}</dd></div>
                <div><dt>Price</dt><dd>${S.me.planSource === 'admin' ? 'Free (gift from Nexity)' : (S.me.planMonths || 1) > 1 ? `${inr(NX.quote(plan, { period: S.me.planMonths, coupon: null }).total)} / ${S.me.planMonths === 12 ? 'year' : '3 months'}` : inr(plan.price) + '/month'}</dd></div>
                <div><dt>Payment method</dt><dd>${S.me.planSource === 'admin' ? '—' : esc(S.me.planMethod || 'UPI')}</dd></div>
              </dl>` : `<p class="sub-free">You're on the Free plan. Upgrade to send and read Secret Messages, add Secret Crushes and see who was near you.</p>`}
          </section>
          ${paid ? `
          <section class="card usage-card">
            <h3>This month</h3>
            <div class="usage-grid">
              <div><b>${l.secretMessages < 0 ? '∞' : Math.max(0, l.secretMessages - S.usage.secretSent)}</b><span>Secret Messages left</span></div>
              <div><b>${l.crushes < 0 ? '∞' : Math.max(0, l.crushes - S.crushes.length)}</b><span>Crush spots left</span></div>
              <div><b>${l.nearby ? '✓' : '—'}</b><span>Nearby hints</span></div>
            </div>
          </section>` : ''}
          <div class="stack-btns">
            <button class="btn btn-primary btn-block" data-go="plans">${paid ? (S.me.plan === 'premium' ? 'View plans' : 'Upgrade to Premium') : 'See plans'}</button>
            ${paid && S.me.planSource !== 'admin' ? (S.me.autoRenew ? `<button class="btn btn-ghost btn-block danger-text" data-action="cancelSub">Cancel subscription</button>` : `<button class="btn btn-secondary btn-block" data-action="resumeSub">Resume auto-renew</button>`) : ''}
          </div>
          <div class="section-head"><h2>Billing history</h2></div>
          ${txns.length ? `<div class="card list billing">${txns.map(t => `
            <div class="bill-row"><div><b>${esc(S.plans[t.plan] ? S.plans[t.plan].name : t.plan)} · ${t.months === 12 ? 'Yearly' : t.months === 3 ? '3 months' : 'Monthly'}</b><small>${fmtDate(t.date)} · ${esc(t.method)} · ${esc(t.id)}</small></div>
              <div class="bill-right"><b>${inr(t.amount)}</b><span class="status s-${t.status}">${t.status === 'success' ? 'Paid' : t.status === 'failed' ? 'Failed' : 'Pending'}</span></div></div>`).join('')}</div>`
            : emptyState({ icon: 'card', title: 'No payments yet', text: 'Your receipts will appear here.' })}
        </div>`;
    }
  };
  Actions.cancelSub = async () => {
    const ok = await Modal.confirm({ title: 'Cancel your subscription?', message: `You'll keep ${esc(NX.plan().name)} until ${fmtDate(S.me.planExpiry)}. After that you'll move to Free and lose access to Secret features.`, confirm: 'Cancel subscription', cancel: 'Keep my plan', danger: true, icon: 'alert' });
    if (!ok) return;
    S.me.autoRenew = false;
    commit();
    Toast.show(`Auto-renew off. ${esc(NX.plan().name)} stays active until ${fmtDate(S.me.planExpiry)}.`);
  };
  Actions.resumeSub = () => { S.me.autoRenew = true; commit(); Toast.show('Auto-renew is back on', { type: 'success' }); };
})();
