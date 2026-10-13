(() => {
  'use strict';
  const dialog = document.getElementById('quick-guestbook');
  if (!dialog) return;
  const form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]');
  const status = document.getElementById('quick-guestbook-status'), retry = dialog.querySelector('.mail-retry');
  const challenge = document.getElementById('quick-guestbook-challenge');
  let token = '', widget = null, loading = false, busy = false, opener, overflow, prefix = '', script;
  const config = window.MX_COMMUNITY;
  const expire = () => { token = ''; submit.disabled = true; };
  function render() {
    loading = false;
    if (!dialog.open || widget !== null) return;
    try {
      widget = window.turnstile.render(challenge, {
        sitekey:config.siteKey, action:'guestbook', size:form.clientWidth < 300 ? 'compact' : 'normal',
        callback(value) { token = value; submit.disabled = busy; },
        'expired-callback':expire,
        'error-callback'() { expire(); status.textContent = '验证暂不可用，请重试。'; retry.hidden = false; }
      });
    } catch { expire(); status.textContent = '验证加载失败，请重试。'; retry.hidden = false; }
  }
  function verify() {
    if (!config?.origin || !config.siteKey) { status.textContent = '留言暂未开放，可以稍后再来。'; return; }
    if (widget !== null) return;
    if (window.turnstile?.render) { render(); return; }
    if (loading) return;
    loading = true; retry.hidden = true;
    window.mxQuickGuestbookChallenge = render;
    script = document.createElement('script'); script.async = true;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mxQuickGuestbookChallenge&render=explicit';
    script.onerror = () => { loading = false; script.remove(); status.textContent = '验证加载失败，请重试。'; retry.hidden = false; };
    document.head.append(script);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-mail-open]');
    if (!link || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    if (dialog.open) return;
    opener = link; overflow = document.body.style.overflow;
    const heading = document.querySelector('[data-reading-content]') && document.querySelector('#article-top h1');
    prefix = heading ? `关于《${heading.textContent.trim().slice(0,100)}》\n${location.pathname}\n\n` : '';
    const context = document.getElementById('quick-guestbook-context');
    context.hidden = !heading; context.textContent = heading ? `关于《${heading.textContent.trim()}》` : '';
    form.elements.message.maxLength = Math.max(1,1000-prefix.length);
    dialog.showModal(); document.body.style.overflow = 'hidden'; verify();
  });
  dialog.querySelector('[data-mail-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = overflow || '';
    if (widget !== null && !busy) { window.turnstile?.remove(widget); widget = null; expire(); }
    opener?.focus({preventScroll:true});
  });
  retry.addEventListener('click', () => {
    if (widget !== null) { window.turnstile?.remove(widget); widget = null; }
    expire(); retry.hidden = true; status.textContent = ''; verify();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !token || !form.reportValidity()) return;
    busy = true; submit.disabled = true; form.elements.name.readOnly = form.elements.message.readOnly = true;
    status.textContent = '正在投递…';
    try {
      const data = {name:form.elements.name.value,message:prefix+form.elements.message.value,website:form.elements.website.value,token};
      const response = await fetch(config.origin+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error(response.status===429?'先歇一会儿，稍后再投递吧。':'提交失败，内容已保留，请重新验证后重试。');
      form.reset(); status.textContent = '收到啦，审核后会出现喵！';
      dialog.classList.remove('mail-delivered'); void dialog.offsetWidth; dialog.classList.add('mail-delivered');
    } catch(error) {
      status.textContent = error.name==='TimeoutError' || error instanceof TypeError ? '网络中断，尚不能确认投递结果。内容已保留，请稍后检查，避免重复留言。' : error.message;
    } finally {
      busy = false; expire(); form.elements.name.readOnly = form.elements.message.readOnly = false;
      if (widget !== null) { window.turnstile?.remove(widget); widget = null; }
      if (dialog.open) verify();
    }
  });
})();
