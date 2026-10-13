document.addEventListener('DOMContentLoaded', () => {
  const config=window.MX_COMMUNITY,form=document.getElementById('guestbook-form'),status=document.getElementById('guestbook-status'),list=document.querySelector('[data-guestbook-list]'),more=document.getElementById('guestbook-more'),submit=form.querySelector('[type=submit]');
  document.querySelector('[data-guestbook-write]')?.addEventListener('click',()=>{requestAnimationFrame(()=>form.elements.message.focus({preventScroll:true}));});
  if(!config?.origin||!config.siteKey)return;
  const listStatus=document.getElementById('guestbook-list-status'),retry=document.getElementById('guestbook-verify-retry');
  let token='',cursor='',widget=null,busy=false,loading=false,challengeLoading=false,script,timer;
  function expire(){token='';submit.disabled=true;}
  function challengeFailure(){clearTimeout(timer);challengeLoading=false;expire();status.textContent='验证加载失败，请重试。';retry.hidden=false;}
  window.mxGuestbookChallenge=()=>{
    clearTimeout(timer);challengeLoading=false;if(widget!==null)return;
    try{widget=turnstile.render('#guestbook-challenge',{sitekey:config.siteKey,size:form.clientWidth<300?'compact':'normal',action:'guestbook',callback:value=>{token=value;submit.disabled=busy;retry.hidden=true;if(status.textContent.startsWith("验证"))status.textContent="";},'expired-callback':expire,'error-callback':challengeFailure});}catch{challengeFailure();}
  };
  function verify(){
    if(challengeLoading||widget!==null)return;retry.hidden=true;
    if(window.turnstile?.render){window.mxGuestbookChallenge();return;}
    challengeLoading=true;script?.remove();script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mxGuestbookChallenge&render=explicit';script.async=true;script.onerror=challengeFailure;
    timer=setTimeout(challengeFailure,12000);document.head.append(script);
  }
  retry.addEventListener('click',()=>{if(busy)return;if(widget!==null){window.turnstile?.remove(widget);widget=null;}expire();status.textContent='';verify();});
  async function load(){
    if(loading)return;loading=true;more.disabled=true;
    try{
      const res=await fetch(config.origin+'/messages?before='+encodeURIComponent(cursor),{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error();const data=await res.json();if(!Array.isArray(data.messages))throw Error();
      for(const message of data.messages){const article=document.createElement('article');article.className='guestbook-message';const name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');name.textContent=message.name;time.textContent=new Date(message.created*1000).toLocaleDateString();text.textContent=message.message;article.append(name,time,text);list.append(article);}
      cursor=data.next||'';more.hidden=!cursor;more.textContent='更多留言';listStatus.textContent=list.children.length?'':'还没有公开留言。';
    }catch{listStatus.textContent='留言暂时没加载出来。';more.textContent='重新加载留言';more.hidden=false;}finally{loading=false;more.disabled=false;}
  }
  status.textContent='';verify();load();more.addEventListener('click',load);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!token||!form.reportValidity())return;
    busy=true;submit.disabled=true;retry.disabled=true;form.elements.name.readOnly=form.elements.message.readOnly=true;status.textContent='正在提交…';
    try{
      const data=Object.fromEntries(new FormData(form));data.token=token;
      const res=await fetch(config.origin+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
      if(!res.ok)throw Error(res.status===429?'请稍后再试，内容已保留。':'提交失败，内容已保留，请重试。');form.reset();status.textContent='已提交，审核后显示。';
    }catch(error){status.textContent=error.name==='TimeoutError'||error instanceof TypeError?'网络中断，尚不能确认提交结果。内容已保留，请稍后查看，避免重复留言。':error.message;}
    finally{busy=false;expire();retry.disabled=false;form.elements.name.readOnly=form.elements.message.readOnly=false;if(widget!==null){try{window.turnstile.reset(widget);}catch{widget=null;retry.hidden=false;}}}
  });
});
