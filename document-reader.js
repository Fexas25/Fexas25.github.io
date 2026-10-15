(() => {
 const root=document.querySelector('[data-backend-id]');if(!root)return;
 const id=root.dataset.backendId||new URLSearchParams(location.search).get('id')||location.hash.slice(1),status=root.querySelector('[role=status]'),form=root.querySelector('form'),article=root.querySelector('[data-document-body]'),key=form.elements.key;
 const retry=form.querySelector("[data-document-retry]"),unlock=form.querySelector("button[type=submit]"),label=key.closest("label"),site=window.MX_SITE_ORIGIN||location.origin;
 // Translate only fixed unlock controls locally; private body text never enters translation.
 const labels={'访问密钥':'Access key','打开':'Open','重试':'Retry','正在打开…':'Opening…','请从文章列表或分享链接打开内容。':'Open an article from the list or a shared link.','内容已移除或暂不可用。':'This content is unavailable.','密钥不正确，请重试。':'Incorrect key. Try again.','这篇内容需要密钥。':'This content requires an access key.','暂时无法读取，请重试。':'Could not load. Please retry.'};

 for(const [zh,en] of Object.entries({"当前网络已断开。": "You are offline.", "连接超时，请稍后重试。": "Connection timed out. Please try again.", "无法连接内容服务，请检查网络后重试。": "Cannot reach the content service. Check your connection and retry.", "内容服务暂不可用，请稍后重试。": "The content service is temporarily unavailable. Please try again."}))labels['暂时无法读取，请重试。'+zh]='Could not load. Please retry. '+en;
 const localize=()=>{const en=document.documentElement.lang==='en',walker=document.createTreeWalker(form,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode,value=node.textContent.trim(),zh=Object.keys(labels).find(k=>k===value||labels[k]===value);if(zh){const next=node.textContent.replace(value,en?labels[zh]:zh);if(next!==node.textContent)node.textContent=next;}}};
 new MutationObserver(localize).observe(form,{subtree:true,childList:true,characterData:true});new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});localize();
 const share=document.querySelector('[data-document-share]');let shareUrl='',shareTimer;
 share?.addEventListener('click',async()=>{if(!shareUrl)return;clearTimeout(shareTimer);try{const url=new URL(shareUrl);if(document.documentElement.lang==='en')url.searchParams.set('lang','en');await navigator.clipboard.writeText(url.href);share.textContent=document.documentElement.lang==='en'?'Copied':'已复制';shareTimer=setTimeout(()=>{share.textContent=document.documentElement.lang==='en'?'Copy link':'复制链接';},3500);}catch{share.textContent=document.documentElement.lang==='en'?'Copy failed. Retry':'复制失败，请重试';}});
 let controller;
 retry?.addEventListener("click",()=>load(key.value.trim()));
 const lock=()=>{controller?.abort();if(share)share.hidden=true;shareUrl="";article.replaceChildren();article.hidden=true;form.hidden=false;key.value='';root.setAttribute('data-private-content','');root.setAttribute('translate','no');const toc=document.querySelector('[data-article-toc]');if(toc){toc.hidden=true;toc.querySelector('ol').replaceChildren();}document.querySelectorAll('[data-private-viewer]').forEach(e=>{e.close();e.remove();});};
 async function load(secret=''){
  if(!/^[a-f0-9-]{36}$/.test(id)){status.textContent='请从文章列表或分享链接打开内容。';return;}
  controller?.abort();controller=new AbortController();const current=controller;unlock.disabled=true;if(retry){retry.disabled=true;retry.hidden=true;}status.textContent='正在打开…';
  try {
   const response=await fetch((window.MX_DOCUMENTS_ORIGIN||window.MX_COMMUNITY.origin)+'/documents/read',{method:'POST',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...(secret?{key:secret}:{})}),signal:AbortSignal.any([current.signal,AbortSignal.timeout(20000)])});
   const data=await response.json();if(current.signal.aborted)return;
   if(!response.ok){if(response.status===404){lock();label.hidden=true;unlock.hidden=true;status.textContent='内容已移除或暂不可用。';return;}if(response.status===403){lock();label.hidden=false;unlock.hidden=false;status.textContent=secret?'密钥不正确，请重试。':'这篇内容需要密钥。';if(data.title)document.querySelector('.reading-header h1').textContent=data.title;return;}throw Object.assign(Error(),{status:response.status});}
   if(share){shareUrl=data.visibility==='public'?data.readingUrl||'':'';share.hidden=!shareUrl;}
   const doc=data.document,record=window.MXContent.parse(doc.text,doc.folder+'/'+doc.filename,'');
   document.querySelector('.reading-header h1').textContent=data.title;document.title=data.title+' · MX的摸鱼生活';
   const time=document.querySelector('.reading-header time');if(time){time.dateTime=data.date;time.textContent=data.date.replaceAll('-','.');}
   const section={_posts:['/blog/','碎碎念'],_cp:['/competitive-programming/','博客'],_projects:['/projects/','作品'],_gamejam:['/game-jam/','游戏开发'],_art:['/art/','绘画创作']}[doc.folder];
   const crumb=document.querySelector('.crumb');if(crumb&&section){crumb.href=site+section[0];crumb.textContent='← 返回'+section[1];}
   const end=document.querySelector('.reading-end .quiet-link');if(end&&section){end.href=site+section[0];end.textContent='继续看看'+section[1]+' →';}const eyebrow=document.querySelector('.reading-header .shelf-eyebrow');if(eyebrow&&section)eyebrow.textContent='MX / '+section[1];
   const year=document.querySelector('.year-link');if(year){year.href=site+'/search/?year='+data.date.slice(0,4);year.textContent='查看 '+data.date.slice(0,4)+' 年归档 →';}
   const tags=document.querySelector('.reading-header .entry-tags');if(tags)tags.remove();
   if(data.tags?.length){const list=document.createElement('div');list.className='entry-tags';for(const tag of data.tags){const a=document.createElement('a');a.href=site+'/search/?tag='+encodeURIComponent(tag);a.textContent='# '+tag;list.append(a);}document.querySelector('.reading-header').append(list);}
   if(data.visibility==='private'){root.setAttribute('data-private-content','');root.setAttribute('translate','no');}else{root.removeAttribute('data-private-content');root.removeAttribute('translate');}
   const fragment=DOMPurify.sanitize(marked.parse(record.body),{RETURN_DOM_FRAGMENT:true,FORBID_TAGS:['video','audio','source','iframe','object','embed']});
   if(data.visibility==='private')for(const img of fragment.querySelectorAll('img')){const src=img.getAttribute('src')||'';if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)&&new URL(src,site).origin!==site){const note=document.createElement('span');note.dataset.fixedUi='';note.textContent='[外部图片未自动加载]';img.replaceWith(note);}}
   article.replaceChildren(fragment);
   // Resolve original relative assets against the original public URL, not /document/.
   for(const el of article.querySelectorAll('[src],a[href]')){const attr=el.hasAttribute('src')?'src':'href',value=el.getAttribute(attr);if(value&&!value.startsWith('#')){const url=new URL(value,new URL(data.url,site));if(attr==='href'&&!['http:','https:','mailto:'].includes(url.protocol))el.removeAttribute(attr);else el.setAttribute(attr,url.href);}}
   for(const a of article.querySelectorAll('a')){a.rel='noopener noreferrer';if(data.visibility==='private')a.referrerPolicy='no-referrer';}
   const external=record.metadata.external_url;
   if(typeof external==='string'&&/^(https?:\/\/|\/(?!\/))/.test(external)){const a=document.createElement('a');a.href=external;a.dataset.fixedUi='';a.textContent='打开作品 ↗';a.className='primary-link';a.rel='noopener noreferrer';article.append(a);}
   if(data.visibility==='private'){const button=document.createElement('button');button.dataset.fixedUi='';button.textContent='收起来';button.type='button';button.addEventListener('click',()=>{lock();label.hidden=false;unlock.hidden=false;status.textContent='这篇内容需要密钥。';key.focus();});article.prepend(button);}
   key.value='';form.hidden=true;article.hidden=false;status.textContent='';
   const toc=document.querySelector('[data-article-toc]');if(toc){toc.hidden=true;toc.querySelector('ol').replaceChildren();if(data.visibility==='private'){toc.setAttribute('data-private-content','');toc.setAttribute('translate','no');}else{toc.removeAttribute('data-private-content');toc.removeAttribute('translate');}}
   article.dataset.readingContent='';delete article.dataset.readingReady;window.dispatchEvent(new Event('mx-content-ready'));
  }catch(e){if(!current.signal.aborted){form.hidden=false;status.textContent='暂时无法读取，请重试。'+window.MXRequestHint(e);if(retry)retry.hidden=false;}}
  finally{if(controller===current){unlock.disabled=false;if(retry)retry.disabled=false;}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();load(key.value.trim());});
 window.addEventListener('pagehide',lock);window.addEventListener('pageshow',event=>{if(event.persisted)load();});window.addEventListener('hashchange',()=>{if(!root.dataset.backendId&&!location.search&&/^[a-f0-9-]{36}$/.test(location.hash.slice(1))&&location.hash.slice(1)!==id)location.reload();});document.addEventListener('DOMContentLoaded',()=>load(),{once:true});
})();
