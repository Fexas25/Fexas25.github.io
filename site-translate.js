(() => {
  const skip='script,style,code,pre,kbd,textarea,input,select,option,[contenteditable],.notranslate,[translate="no"],[data-translation-status],.intro-bouncy,.intro-languages,[data-language],.writing-form,.draft-library,#preview-content,[data-guestbook-list],[data-private-content],#private-share,#github-result,#github-article,[data-meow-playing]'+(location.pathname==='/editor.html'?',#main':'');
  const records=new Map(), cache=new Map(), stored=new Map();
  const cacheKey='mx-translations-v2';
  try {const data=JSON.parse(localStorage.getItem(cacheKey)||'null');if(data?.expires>Date.now()&&Array.isArray(data.items))for(const [key,value]of data.items.slice(-200))if(typeof key==='string'&&typeof value==='string'&&key.length<10000&&value.length<20000){cache.set(key,value);stored.set(key,value);}}catch{}
  function remember(key,value){cache.set(key,value);stored.set(key,value);while(stored.size>200)stored.delete(stored.keys().next().value);try {const items=Array.from(stored);while(JSON.stringify(items).length>200000)items.shift();localStorage.setItem(cacheKey,JSON.stringify({expires:Date.now()+30*86400000,items}));}catch{}}

  let active=false, generation=0, debounce=0, busy=false, controller, retryAfter=0;
  const notice=document.createElement('p');notice.dataset.translationStatus='';notice.className='translation-status';notice.setAttribute('role','status');(document.querySelector('.header-tools')||document.body).append(notice);
  const retry=document.createElement('button');retry.type='button';retry.className='translation-retry notranslate';retry.textContent='Retry';retry.hidden=true;notice.after(retry);retry.addEventListener('click',()=>{retryAfter=0;translate();});
  const cacheController=new AbortController(),cacheTimeout=setTimeout(()=>cacheController.abort(),5000);
  const ready=fetch('/translation-cache.json',{signal:cacheController.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>Object.entries(data).forEach(([k,v])=>{if(typeof v==='string')cache.set(k,v);})).catch(()=>{}).finally(()=>clearTimeout(cacheTimeout));
  function status(text){if(notice.textContent!==text)notice.textContent=text;retry.hidden=!/unavailable/.test(text);}
  const chinese=text=>/[\u3400-\u9fff]/.test(text);
  function collect(){
    for(const node of records.keys())if(!node.isConnected)records.delete(node);
    const nodes=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;if(!node.parentElement||node.parentElement.closest(skip))continue;
      const text=node.textContent.trim();if(!chinese(text))continue;
      const previous=records.get(node);if(previous&&node.textContent===previous.output)continue;
      nodes.push({node,text});
    }return nodes;
  }
  function apply(node,text,value){
    if(!active||!node.isConnected||node.textContent.trim()!==text)return;
    const original=node.textContent;
    const output=original.replace(text,value);records.set(node,{original,output});node.textContent=output;
  }
  async function translate(){
    if(!active||busy)return;busy=true;const version=generation, signal=controller.signal;let missing=false;
    try{
      for(const item of collect())if(cache.has(item.text))apply(item.node,item.text,cache.get(item.text));
      await ready;if(!active||version!==generation)return;
      const pending=[];
      for(const item of collect()){
        if(cache.has(item.text))apply(item.node,item.text,cache.get(item.text));else pending.push(item);
      }
      const origin=window.MX_COMMUNITY?.origin;
      if(pending.length&&(!origin||Date.now()<retryAfter)){missing=true;return;}
      if(pending.length)status('Translating…');
      const unique=new Map();for(const item of pending){if(!unique.has(item.text))unique.set(item.text,[]);unique.get(item.text).push(item);}
      const queue=Array.from(unique).sort((a,b)=>Number(b[1][0].node.parentElement.getBoundingClientRect().top<innerHeight)-Number(a[1][0].node.parentElement.getBoundingClientRect().top<innerHeight));
      async function run(){
        while(queue.length&&active&&version===generation){
          const [source,items]=queue.shift();
          try {
            const chunks=source.match(/[\s\S]{1,350}(?:[。！？；，\s]|$)|[\s\S]{1,350}/g)||[source],translated=[];
            for(const text of chunks){
              if(signal.aborted||version!==generation)return;
              const timed=new AbortController(),abort=()=>timed.abort();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,15000);
              let data;
              try {const response=await fetch(origin+'/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:timed.signal});if(!response.ok)throw Error('unavailable');data=await response.json();}
              finally {clearTimeout(timeout);signal.removeEventListener('abort',abort);}
              if(typeof data.text!=='string'||!data.text.trim())throw Error('invalid');translated.push(data.text);
            }
            if(signal.aborted||version!==generation)return;
            const value=translated.join(' ');remember(source,value);
            for(const item of items)apply(item.node,item.text,value);
          }catch{missing=true;queue.length=0;if(version===generation)retryAfter=Date.now()+30000;}
        }
      }
      await Promise.all(Array.from({length:Math.min(3,queue.length)},()=>run()));
    }catch{missing=true;if(version===generation)retryAfter=Date.now()+30000;}finally{
      if(version===generation)busy=false;
      if(active&&version===generation)status(missing?'Translation unavailable · 部分保留原文':'Auto · 自动翻译');
    }
  }
  function setLanguage(english){
    window.MXMeow?.reset();
    active=english;generation++;controller?.abort();controller=new AbortController();busy=false;
    try{sessionStorage.setItem('mx-language',english?'en':'zh');}catch{}
    document.documentElement.lang=english?'en':'zh-CN';
    document.querySelectorAll('[data-language]:not(.intro-languages *)').forEach(button=>{button.dataset.language=english?'zh':'en';button.textContent=english?'中文':'English';});
    if(english){status('Translating…');translate();}
    else{for(const [node,{original,output}]of records){if(node.isConnected&&node.textContent===output)node.textContent=original;}records.clear();status('');}
  }
  let selected='zh';
  const intro=document.getElementById('studio-intro');
  const selection=()=>document.querySelectorAll('.intro-languages [data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===selected)));
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-language]');if(!button)return;
    selected=button.dataset.language;
    if(button.closest('.intro-languages')){selection();try{sessionStorage.setItem('mx-language',selected);}catch{};return;}
    setLanguage(selected==='en');
  });
  new MutationObserver(changes=>{
    if(!active||busy||!changes.some(c=>!(c.target.nodeType===1?c.target:c.target.parentElement)?.closest(skip)))return;
    clearTimeout(debounce);debounce=setTimeout(translate,300);
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  try{if(sessionStorage.getItem('mx-language')==='en')selected='en';}catch{}
  selection();
  if(intro?.open)intro.addEventListener('close',()=>setLanguage(selected==='en'),{once:true});
  else if(selected==='en')setLanguage(true);
})();
