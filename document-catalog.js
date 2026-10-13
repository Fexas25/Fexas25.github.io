(async()=>{
 const browser=document.querySelector('[data-browser]'),home=document.querySelector('#moments');
 const related=document.querySelector('.related-posts');
 if(!browser&&!home&&!related)return;
 if(related)related.hidden=true;
 document.querySelectorAll('[data-backend-entry],[data-month-marker],#moments .moment,#blog .blog-row').forEach(e=>e.remove());
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function card(doc,work=false){
  const a=make('article',null,work?'portfolio-card':'entry-card');a.dataset.backendEntry='';a.dataset.entry='';a.dataset.year=doc.date.slice(0,4);a.dataset.tags=JSON.stringify(doc.tags);a.dataset.search=doc.title;a.dataset.category=work?(doc.folder==='_gamejam'?'game':doc.type):doc.topic;
  const copy=work?make('div',null,'portfolio-copy'):a;
  const meta=make('div',null,'entry-meta');meta.append(make('time',doc.date.replaceAll('-','.')));if(doc.visibility==='private')meta.append(make('span','需要密钥'));
  const link=make('a',null,'entry-link');link.href=doc.url;link.append(make('h2',doc.title));if(doc.content)link.append(make('p',doc.content.slice(0,110)));copy.append(meta,link);
  if(work){const art=make('div',null,'portfolio-art art-'+doc.type);art.setAttribute('aria-hidden','true');art.append(make('span',doc.type==='game'?'＋':doc.type==='ai'?'✧':'✿'));a.append(art,copy);}
  const tags=make('div',null,'entry-tags');for(const tag of doc.tags){const link=make('a','# '+tag);link.href='/search/?tag='+encodeURIComponent(tag);tags.append(link);}copy.append(tags);return a;
 }
 try{
  const response=await fetch((window.MX_DOCUMENTS_ORIGIN||window.MX_COMMUNITY.origin)+'/documents',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();
  const {documents}=await response.json();
  if(related){const urls=new Set(documents.map(d=>new URL(d.url,location.origin).pathname));related.querySelectorAll('li').forEach(li=>{if(!urls.has(new URL(li.querySelector('a').href).pathname))li.remove();});related.hidden=!related.querySelector('li');}
  documents.sort((a,b)=>b.date.localeCompare(a.date));
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
    for(const doc of documents.filter(x=>x.folder===folder).slice(0,limit)){const link=make('a',null,folder==='_posts'?'moment':'blog-row');link.href=doc.url;const copy=make('div');copy.append(make('h3',doc.title),make('p',doc.date+(doc.visibility==='private'?' · 需要密钥':'')));if(folder==='_posts'&&doc.content)copy.append(make('p',doc.content.slice(0,92)));link.append(copy);target.append(link);}
   }
   const grid=document.querySelector('.works-grid');grid.querySelectorAll('[data-backend-entry]').forEach(e=>e.remove());
   for(const doc of documents.filter(x=>!['_posts','_cp'].includes(x.folder)).slice(0,3)){const node=card(doc,true);node.classList.add('work-card');grid.append(node);}
  }
 }catch{
  const target=browser||home;if(!target)return;const notice=make('p','最新内容暂时未加载，刷新可重试。','empty-note');notice.setAttribute('role','status');target.append(notice);
 }
})();
