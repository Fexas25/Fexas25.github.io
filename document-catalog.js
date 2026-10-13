(()=>{
 const browser=document.querySelector('[data-browser]'),home=document.querySelector('#moments');
 const root=document.querySelector('[data-backend-id]'),neighbors=document.querySelector('[data-document-neighbors]'),site=window.MX_SITE_ORIGIN||location.origin;
 const related=document.querySelector('.related-posts');
 if(!browser&&!home&&!related)return;
 if(related)related.hidden=true;
 document.querySelectorAll('[data-backend-entry],[data-month-marker],#moments .moment,#blog .blog-row').forEach(e=>e.remove());
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function card(doc,work=false){
  const a=make('article',null,work?'portfolio-card':'entry-card');a.dataset.backendEntry='';if(doc.slug)a.dataset.projectSlug=doc.slug;a.dataset.entry='';a.dataset.year=doc.date.slice(0,4);a.dataset.tags=JSON.stringify(doc.tags);a.dataset.search=doc.title;a.dataset.category=work?(doc.folder==='_gamejam'?'game':doc.type):doc.topic;
  const copy=work?make('div',null,'portfolio-copy'):a;
  const meta=make('div',null,'entry-meta');meta.append(make('time',doc.date.replaceAll('-','.')));if(doc.visibility==='private')meta.append(make('span','需要密钥'));
  const link=make('a',null,'entry-link');link.href=new URL(doc.url,site).href;link.append(make('h2',doc.title));if(doc.content)link.append(make('p',doc.content.slice(0,110)));copy.append(meta,link);
  if(work){const art=make('div',null,'portfolio-art art-'+doc.type);art.setAttribute('aria-hidden','true');art.append(make('span',doc.slug==='dad-birthday'?'♡':doc.type==='game'?'＋':doc.type==='ai'?'✧':'✿'));if(doc.slug==='dad-birthday'){art.classList.add('birthday-cover');art.append(make('i','Happy Birthday'));}a.append(art,copy);}
  const tags=make('div',null,'entry-tags');for(const tag of doc.tags){const link=make('a','# '+tag);link.href=site+'/search/?tag='+encodeURIComponent(tag);tags.append(link);}copy.append(tags);return a;
 }
 let busy=false;const notice=make('div',null,'catalog-retry'),message=make('span'),retry=make('button','重试','quiet-link');notice.setAttribute('role','status');retry.type='button';notice.append(message,retry);retry.addEventListener('click',load);
 async function load(){if(busy)return;busy=true;retry.disabled=true;message.textContent='正在加载…';
 try{
  const response=await fetch((window.MX_DOCUMENTS_ORIGIN||window.MX_COMMUNITY.origin)+'/documents',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();
  const {documents}=await response.json();
  documents.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const id=root?.dataset.backendId||new URLSearchParams(location.search).get('id'),current=documents.find(d=>d.id===id);
  if(neighbors){neighbors.replaceChildren();if(current){const group=documents.filter(d=>d.folder===current.folder),i=group.findIndex(d=>d.id===id);for(const [doc,label] of [[group[i+1],'← 上一篇'],[group[i-1],'下一篇 →']]){if(!doc)continue;const link=make('a');link.href=new URL(doc.url,site).href;link.append(make('span',label),make('strong',doc.title+(doc.visibility==='private'?' · 需要密钥':'')));neighbors.append(link);}}neighbors.hidden=!neighbors.children.length;}
  if(related){const list=related.querySelector('ul');list.replaceChildren();if(current)for(const doc of documents.filter(d=>d.id!==id&&d.tags.some(t=>current.tags.includes(t))).slice(0,3)){const li=make('li'),link=make('a');link.href=new URL(doc.url,site).href;link.append(make('span',doc.title+(doc.visibility==='private'?' · 需要密钥':'')),make('time',doc.date));li.append(link);list.append(li);}related.hidden=!list.children.length;}
  if(browser){
   const pathname=location.pathname.replace(/index\.html$/,''),folders=pathname==='/blog/'?['_posts']:pathname==='/competitive-programming/'?['_cp']:pathname==='/game-jam/'?['_gamejam']:pathname==='/art/'?['_art']:['_projects','_gamejam','_art'];
   const selected=documents.filter(d=>folders.includes(d.folder)),work=!folders.includes('_posts')&&!folders.includes('_cp');
   browser.querySelectorAll('[data-backend-entry],[data-month-marker]').forEach(e=>e.remove());
   const grid=browser.querySelector('.portfolio-grid');
   for(const doc of selected){const node=card(doc,work);if(grid)grid.append(node);else browser.querySelector('[data-no-results]').before(node);}
   const count=browser.querySelector('.small-count');if(count)count.textContent=selected.length+' 篇';
   if(selected.length)browser.querySelectorAll('.empty-note:not([data-no-results])').forEach(e=>e.remove());
   if(selected.some(x=>x.type==='ai'))browser.querySelectorAll('.upcoming[data-category=ai]').forEach(e=>e.remove());
   window.dispatchEvent(new Event('mx-documents-ready'));
  }
  if(home){
   for(const [selector,folder,limit] of [['#moments','_posts',2],['#blog','_cp',3]]){
    const target=document.querySelector(selector);target.querySelectorAll('.moment,.blog-row').forEach(e=>e.remove());
    for(const doc of documents.filter(x=>x.folder===folder).slice(0,limit)){const link=make('a',null,folder==='_posts'?'moment':'blog-row');link.href=new URL(doc.url,site).href;const copy=make('div');copy.append(make('h3',doc.title),make('p',doc.date+(doc.visibility==='private'?' · 需要密钥':'')));if(folder==='_posts'&&doc.content)copy.append(make('p',doc.content.slice(0,92)));link.append(copy);target.append(link);}
   }
   const grid=document.querySelector('.works-grid');grid.querySelectorAll('[data-backend-entry]').forEach(e=>e.remove());
   for(const doc of documents.filter(x=>!['_posts','_cp'].includes(x.folder)).slice(0,3)){const node=card(doc,true);node.classList.add('work-card');grid.append(node);}
  }
  notice.remove();
 }catch{
  const target=browser||home||root;if(target){message.textContent='内容列表暂时未加载。';target.append(notice);}
 }finally{busy=false;retry.disabled=false;}
 }
 load();
})();
