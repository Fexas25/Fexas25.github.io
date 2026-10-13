document.addEventListener('DOMContentLoaded', () => {
  const config=window.MX_COMMUNITY,list=document.querySelector('[data-guestbook-list]'),more=document.getElementById('guestbook-more'),listStatus=document.getElementById('guestbook-list-status');
  if(!config?.origin){listStatus.textContent='留言板暂未开放。';return;}
  let cursor='',loading=false;
  async function load(){
    if(loading)return;loading=true;more.disabled=true;
    try{
      const res=await fetch(config.origin+'/messages?before='+encodeURIComponent(cursor),{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error();const data=await res.json();if(!Array.isArray(data.messages))throw Error();
      for(const message of data.messages){const article=document.createElement('article');article.className='guestbook-message';const heading=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');heading.className='guestbook-message-meta';name.textContent=message.name;const date=new Date(message.created*1000);time.textContent=date.toLocaleDateString();if(!Number.isNaN(date.getTime()))time.dateTime=date.toISOString();text.textContent=message.message;heading.append(name,time);article.append(heading,text);list.append(article);}
      cursor=data.next||'';more.hidden=!cursor;more.textContent='更多留言';listStatus.textContent=list.children.length?'':'还没有公开留言。';
    }catch{listStatus.textContent='留言暂时没加载出来。';more.textContent='重新加载留言';more.hidden=false;}finally{loading=false;more.disabled=false;}
  }
  load();more.addEventListener('click',load);
});
