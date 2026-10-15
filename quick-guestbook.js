(() => {
  'use strict';
  const dialog = document.getElementById('quick-guestbook');
  if (!dialog) return;
  const form = dialog.querySelector('form'), submit = form.querySelector('[type=submit]');
  const status = document.getElementById('quick-guestbook-status'), retry = dialog.querySelector('.mail-retry');
  const choices=dialog.querySelector('.mail-choices'),note=dialog.querySelector('.mail-note');
  const returnLink=dialog.querySelector('.mail-return'),returnLabel=dialog.querySelector('[data-mail-return-label]');let returnToBoard=false;
  returnLink.addEventListener('click',event=>{if(location.pathname.replace(/index\.html$/,'')!=='/guestbook/')return;event.preventDefault();returnToBoard=true;dialog.close();});
  form.addEventListener('input',()=>{if(dialog.classList.contains('mail-delivered')){dialog.classList.remove('mail-delivered');status.textContent='';returnLabel.textContent='看看大家的留言';verify();}});
  function write(){choices.hidden=true;form.hidden=false;note.hidden=false;fitKeyboard();verify();form.elements.name.focus({preventScroll:true});}
  dialog.querySelector('[data-mail-write]').addEventListener('click',write);
  const challenge = document.getElementById('quick-guestbook-challenge');
  let token = '', widget = null, loading = false, busy = false, opener, overflow, prefix = '', script, timer;
  const config = window.MX_COMMUNITY;
  const expire = () => { token = ''; submit.disabled = true; };
  function render() {
    clearTimeout(timer); loading = false;
    if (!dialog.open || form.hidden || widget !== null) return;
    try {
      widget = window.turnstile.render(challenge, {
        sitekey:config.siteKey, action:'guestbook', language:document.documentElement.lang==='en'?'en':'zh-cn', size:form.clientWidth < 300 ? 'compact' : 'normal',
        callback(value) { token = value; submit.disabled = busy; retry.hidden = true; if(/^(验证|Verification|Could not load verification)/.test(status.textContent)) status.textContent = ""; },
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
    script.onerror = () => { clearTimeout(timer);loading = false; script.remove(); status.textContent = '验证加载失败，请重试。'; retry.hidden = false; };
    timer=setTimeout(()=>script.onerror(),12000);
    document.head.append(script);
  }
  function fitKeyboard(){
    const viewport=window.visualViewport,keyboard=viewport&&window.innerHeight-viewport.height>150;
    dialog.classList.toggle('mail-keyboard',Boolean(keyboard&&dialog.open));
    if(keyboard){dialog.style.setProperty('--mail-height',viewport.height+'px');dialog.style.setProperty('--mail-top',viewport.offsetTop+'px');}
    if(dialog.open)requestAnimationFrame(()=>{
      const active=document.activeElement;
      if(!dialog.open||!active?.matches('input,textarea,select')||!dialog.contains(active))return;
      const box=dialog.getBoundingClientRect(),field=active.getBoundingClientRect();
      const top=Math.max(box.top,viewport?.offsetTop||0)+16;
      const bottom=Math.min(box.bottom,(viewport?.offsetTop||0)+(viewport?.height||innerHeight))-16;
      if(field.top<top)dialog.scrollTop+=field.top-top;
      else if(field.bottom>bottom)dialog.scrollTop+=Math.min(field.bottom-bottom,field.top-top);
    });
  }
  dialog.addEventListener('focusin',fitKeyboard);
  window.visualViewport?.addEventListener('resize',fitKeyboard);
  window.visualViewport?.addEventListener('scroll',fitKeyboard);
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-mail-open]');
    if (!link || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    if (dialog.open) return;
    opener = link; overflow = document.body.style.overflow;
    const heading = document.querySelector('[data-reading-content]') && document.querySelector('#article-top h1');
    const documentId=document.querySelector('[data-backend-id]')?.dataset.backendId||new URLSearchParams(location.search).get('id')||location.hash.slice(1);
    const source=/^[a-f0-9-]{36}$/.test(documentId||'')?config.origin+'/read/'+documentId:location.origin+location.pathname;
    prefix = heading ? `${document.documentElement.lang==='en'?'About':'关于'}《${heading.textContent.trim().slice(0,100)}》\n${source}\n\n` : '';
    const context = document.getElementById('quick-guestbook-context');
    context.hidden = !heading;context.replaceChildren();if(heading){const label=document.createElement('span');label.textContent='关于：';context.append(label,document.createTextNode(' '+heading.textContent.trim()));}
    form.elements.message.maxLength = Math.max(1,1000-prefix.length);
    const choosing=link.hasAttribute('data-mail-choice');
    choices.hidden=!choosing;form.hidden=choosing;note.hidden=choosing;
    dialog.showModal(); document.body.style.overflow = 'hidden';fitKeyboard();if(!choosing){verify();if(link.hasAttribute('data-guestbook-write'))form.elements.name.focus({preventScroll:true});}
  });
  dialog.querySelector('[data-mail-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = overflow || '';dialog.classList.remove('mail-keyboard');
    if (widget !== null && !busy) { window.turnstile?.remove(widget); widget = null; expire(); }
    if(returnToBoard){returnToBoard=false;const board=document.getElementById('guestbook-messages');history.replaceState(history.state,'','#guestbook-messages');board?.focus({preventScroll:true});board?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}else opener?.focus({preventScroll:true});
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
      dialog.classList.remove('mail-delivered'); void dialog.offsetWidth; dialog.classList.add('mail-delivered');returnLabel.textContent='返回留言板';returnLink.focus({preventScroll:true});returnLink.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    } catch(error) {
      status.textContent = error.name==='TimeoutError' || error.name==='AbortError' || error instanceof TypeError ? '网络中断，尚不能确认投递结果。内容已保留，请稍后检查，避免重复留言。' : error.message;
    } finally {
      busy = false; expire(); form.elements.name.readOnly = form.elements.message.readOnly = false;
      if (widget !== null) { window.turnstile?.remove(widget); widget = null; }
      if (dialog.open && !form.hidden && !dialog.classList.contains('mail-delivered')) verify();
    }
  });
})();
