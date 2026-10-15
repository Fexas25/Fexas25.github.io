document.addEventListener('DOMContentLoaded', () => {
  const config=window.MX_COMMUNITY,list=document.querySelector('[data-guestbook-list]'),more=document.getElementById('guestbook-more'),listStatus=document.getElementById('guestbook-list-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),feedback=new WeakMap();
  let touch=null;
  list.addEventListener('pointerdown',event=>{
    const note=event.target.closest('.guestbook-message');
    touch=note&&event.isPrimary&&event.pointerType!=='mouse'?{note,id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()}:null;
  },{passive:true});
  list.addEventListener('pointercancel',()=>{touch=null;},{passive:true});
  list.addEventListener('pointermove',event=>{if(touch&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>8)touch=null;},{passive:true});
  list.addEventListener('pointerup',event=>{
    const start=touch;touch=null;
    if(!start||start.id!==event.pointerId||performance.now()-start.time>350||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8||!start.note.contains(event.target)||getSelection()?.toString())return;
    feedback.get(start.note)?.cancel();
    const shadows=['0 4px 12px #65566d06','0 7px 18px #65566d16','0 4px 12px #65566d06'];
    const frames=shadows.map((boxShadow,i)=>({boxShadow,...(reduced.matches?{}:{transform:`translateY(${i===1?-2:0}px)`})}));
    feedback.set(start.note,start.note.animate(frames,{duration:260,easing:'ease-out'}));
  },{passive:true});
  if(!config?.origin){listStatus.textContent='留言板暂未开放。';return;}
  let cursor='',loading=false;
  async function load(){
    if(loading)return;loading=true;more.disabled=true;
    try{
      const res=await fetch(config.origin+'/messages?before='+encodeURIComponent(cursor),{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error();const data=await res.json();if(!Array.isArray(data.messages))throw Error();
      for(const message of data.messages){const article=document.createElement('article');article.className='guestbook-message';const heading=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');heading.className='guestbook-message-meta';name.textContent=message.name;const date=new Date(message.created*1000);time.textContent=date.toLocaleDateString();if(!Number.isNaN(date.getTime()))time.dateTime=date.toISOString();text.textContent=message.message;heading.append(name,time);article.append(heading,text);
        if(typeof message.reply==='string'&&message.reply.trim()){
          const response=document.createElement('section'),by=document.createElement('strong'),answer=document.createElement('p');
          response.className='guestbook-reply';response.setAttribute('aria-label','MX 的回复');by.textContent='MX 回复';by.setAttribute('data-mail-ui','');answer.textContent=message.reply;response.append(by,answer);article.append(response);
        }
        list.append(article);}
      cursor=data.next||'';more.hidden=!cursor;more.textContent='更多留言';listStatus.textContent=list.children.length?'':'还没有公开留言。';
    }catch{listStatus.textContent='留言暂时没加载出来。';more.textContent='重新加载留言';more.hidden=false;}finally{loading=false;more.disabled=false;}
  }
  load();more.addEventListener('click',load);
});
