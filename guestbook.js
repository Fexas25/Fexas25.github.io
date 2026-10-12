document.addEventListener('DOMContentLoaded', () => {
  const config=window.MX_COMMUNITY,form=document.getElementById('guestbook-form'),status=document.getElementById('guestbook-status'),list=document.querySelector('[data-guestbook-list]'),more=document.getElementById('guestbook-more'),submit=form.querySelector('[type=submit]');
  if(!config?.origin||!config.siteKey)return;
  let token='',cursor='',widget,busy=false;
  window.mxGuestbookChallenge=()=>{widget=turnstile.render('#guestbook-challenge',{sitekey:config.siteKey,action:'guestbook',callback:value=>{token=value;submit.disabled=false;},'expired-callback':()=>{token='';submit.disabled=true;},'error-callback':()=>{status.textContent='验证暂不可用，请刷新后重试。';submit.disabled=true;}});};
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mxGuestbookChallenge&render=explicit';script.async=true;script.onerror=()=>{status.textContent='验证加载失败，请刷新重试。';};document.head.append(script);
  async function load(){
    more.disabled=true;
    try{const res=await fetch(config.origin+'/messages?before='+encodeURIComponent(cursor));if(!res.ok)throw Error();const data=await res.json();if(!Array.isArray(data.messages))throw Error();
      for(const message of data.messages){const article=document.createElement('article');article.className='guestbook-message';const name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');name.textContent=message.name;time.textContent=new Date(message.created*1000).toLocaleDateString();text.textContent=message.message;article.append(name,time,text);list.append(article);}cursor=data.next||'';more.hidden=!cursor;
    }catch{status.textContent='留言加载失败，请刷新重试。';}finally{more.disabled=false;}
  }
  status.textContent='';load();more.addEventListener('click',load);
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!token||!form.reportValidity())return;busy=true;submit.disabled=true;status.textContent='正在提交…';
    try{const data=Object.fromEntries(new FormData(form));data.token=token;const res=await fetch(config.origin+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!res.ok)throw Error(res.status===429?'请稍后再试。':'提交失败，内容已保留，请重试。');form.reset();status.textContent='已提交，审核后显示。';}
    catch(error){status.textContent=error.message;}finally{busy=false;token='';turnstile.reset(widget);}
  });
});
