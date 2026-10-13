(() => {
 const root=document.querySelector('[data-backend-id]');if(!root)return;
 const id=root.dataset.backendId||new URLSearchParams(location.search).get('id')||location.hash.slice(1),status=root.querySelector('[role=status]'),form=root.querySelector('form'),article=root.querySelector('[data-document-body]'),key=form.elements.key;
 let controller;
 const lock=()=>{controller?.abort();article.replaceChildren();article.hidden=true;form.hidden=false;key.value='';root.setAttribute('data-private-content','');root.setAttribute('translate','no');const toc=document.querySelector('[data-article-toc]');if(toc){toc.hidden=true;toc.querySelector('ol').replaceChildren();}document.querySelectorAll('[data-private-viewer]').forEach(e=>{e.close();e.remove();});};
 async function load(secret=''){
  if(!/^[a-f0-9-]{36}$/.test(id)){status.textContent='请从文章列表或分享链接打开内容。';return;}
  controller?.abort();controller=new AbortController();const current=controller;form.querySelector('button').disabled=true;status.textContent='正在打开…';
  try {
   const response=await fetch((window.MX_DOCUMENTS_ORIGIN||window.MX_COMMUNITY.origin)+'/documents/read',{method:'POST',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...(secret?{key:secret}:{})}),signal:AbortSignal.any([current.signal,AbortSignal.timeout(20000)])});
   const data=await response.json();if(current.signal.aborted)return;
   if(!response.ok){if(response.status===403){lock();status.textContent=secret?'密钥不正确，请重试。':'这篇内容需要密钥。';if(data.title)document.querySelector('.reading-header h1').textContent=data.title;return;}throw Error(response.status===429?'请稍等一分钟再试。':'暂时无法读取，请重试。');}
   const doc=data.document,record=window.MXContent.parse(doc.text,doc.folder+'/'+doc.filename,'');
   document.querySelector('.reading-header h1').textContent=data.title;document.title=data.title+' · MX的摸鱼生活';
   const time=document.querySelector('.reading-header time');if(time){time.dateTime=data.date;time.textContent=data.date.replaceAll('-','.');}
   const section={_posts:['/blog/','碎碎念'],_cp:['/competitive-programming/','博客'],_projects:['/projects/','作品'],_gamejam:['/game-jam/','游戏开发'],_art:['/art/','绘画创作']}[doc.folder];
   const crumb=document.querySelector('.crumb');if(crumb&&section){crumb.href=section[0];crumb.textContent='← 返回'+section[1];}
   const year=document.querySelector('.year-link');if(year){year.href='/search/?year='+data.date.slice(0,4);year.textContent='查看 '+data.date.slice(0,4)+' 年归档 →';}
   const tags=document.querySelector('.reading-header .entry-tags');if(tags)tags.remove();
   if(data.tags?.length){const list=document.createElement('div');list.className='entry-tags';for(const tag of data.tags){const a=document.createElement('a');a.href='/search/?tag='+encodeURIComponent(tag);a.textContent='# '+tag;list.append(a);}document.querySelector('.reading-header').append(list);}
   if(data.visibility==='private'){root.setAttribute('data-private-content','');root.setAttribute('translate','no');}else{root.removeAttribute('data-private-content');root.removeAttribute('translate');}
   const fragment=DOMPurify.sanitize(marked.parse(record.body),{RETURN_DOM_FRAGMENT:true,FORBID_TAGS:['video','audio','source','iframe','object','embed']});
   if(data.visibility==='private')for(const img of fragment.querySelectorAll('img')){const src=img.getAttribute('src')||'';if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)&&new URL(src,location.origin).origin!==location.origin){const note=document.createElement('span');note.textContent='[外部图片未自动加载]';img.replaceWith(note);}}
   article.replaceChildren(fragment);
   // Resolve original relative assets against the original public URL, not /document/.
   for(const el of article.querySelectorAll('[src],a[href]')){const attr=el.hasAttribute('src')?'src':'href',value=el.getAttribute(attr);if(value&&!value.startsWith('#')){const url=new URL(value,new URL(data.url,location.origin));if(attr==='href'&&!['http:','https:','mailto:'].includes(url.protocol))el.removeAttribute(attr);else el.setAttribute(attr,url.href);}}
   for(const a of article.querySelectorAll('a')){a.rel='noopener noreferrer';if(data.visibility==='private')a.referrerPolicy='no-referrer';}
   const external=record.metadata.external_url;
   if(typeof external==='string'&&/^(https?:\/\/|\/(?!\/))/.test(external)){const a=document.createElement('a');a.href=external;a.textContent='打开作品 ↗';a.className='primary-link';a.rel='noopener noreferrer';article.append(a);}
   if(data.visibility==='private'){const button=document.createElement('button');button.textContent='收起来';button.type='button';button.addEventListener('click',()=>{lock();key.focus();});article.prepend(button);}
   key.value='';form.hidden=true;article.hidden=false;status.textContent='';
   const toc=document.querySelector('[data-article-toc]');if(toc){toc.hidden=true;toc.querySelector('ol').replaceChildren();if(data.visibility==='private'){toc.setAttribute('data-private-content','');toc.setAttribute('translate','no');}else{toc.removeAttribute('data-private-content');toc.removeAttribute('translate');}}
   article.dataset.readingContent='';delete article.dataset.readingReady;window.dispatchEvent(new Event('mx-content-ready'));
  }catch(e){if(!current.signal.aborted)status.textContent='暂时无法读取，请重试。';}
  finally{if(controller===current)form.querySelector('button').disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();load(key.value.trim());});
 window.addEventListener('pagehide',lock);window.addEventListener('pageshow',event=>{if(event.persisted)load();});window.addEventListener('hashchange',()=>{if(!root.dataset.backendId&&!location.search&&/^[a-f0-9-]{36}$/.test(location.hash.slice(1))&&location.hash.slice(1)!==id)location.reload();});document.addEventListener('DOMContentLoaded',()=>load(),{once:true});
})();
