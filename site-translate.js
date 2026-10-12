(() => {
  const skip='script,style,code,pre,kbd,textarea,input,select,option,[contenteditable],.notranslate,[translate="no"],[data-translation-status],.intro-bouncy,.intro-languages,[data-language],.writing-form,.draft-library,#preview-content,[data-guestbook-list]';
  const records=new Map(), cache=new Map();
  let active=false, generation=0, debounce=0, busy=false, controller, retryAfter=0;
  const notice=document.createElement('p');notice.dataset.translationStatus='';notice.className='translation-status';notice.setAttribute('role','status');document.body.append(notice);
  const ready=fetch('/translation-cache.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>Object.entries(data).forEach(([k,v])=>cache.set(k,v))).catch(()=>{});
  function status(text){if(notice.textContent!==text)notice.textContent=text;}
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
      await ready;if(!active||version!==generation)return;
      const pending=[];
      for(const item of collect()){
        if(cache.has(item.text))apply(item.node,item.text,cache.get(item.text));else pending.push(item);
      }
      const origin=window.MX_COMMUNITY?.origin;
      if(pending.length&&(!origin||Date.now()<retryAfter)){missing=true;return;}
      for(const item of pending){
        if(!active||version!==generation)return;
        if(!cache.has(item.text)){
          // Preserve punctuation and code/link boundaries; never send form values.
          const chunks=item.text.match(/[\s\S]{1,350}(?:[。！？；，\s]|$)|[\s\S]{1,350}/g)||[item.text];
          const translated=[];
          for(const text of chunks){
            if(signal.aborted||version!==generation)return;
            const response=await fetch(origin+'/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal});
            if(!response.ok)throw Error('unavailable');const data=await response.json();
            if(typeof data.text!=='string'||!data.text.trim())throw Error('invalid');translated.push(data.text);
          }
          if(signal.aborted||version!==generation)return;
          cache.set(item.text,translated.join(' '));
        }
        apply(item.node,item.text,cache.get(item.text));
      }
    }catch{missing=true;if(version===generation)retryAfter=Date.now()+30000;}finally{
      if(version===generation)busy=false;
      if(active&&version===generation)status(missing?'部分内容保留原文 · Translation unavailable for some text.':'自动翻译 · Machine translation');
    }
  }
  function setLanguage(english){
    active=english;generation++;controller?.abort();controller=new AbortController();busy=false;
    try{sessionStorage.setItem('mx-language',english?'en':'zh');}catch{}
    document.documentElement.lang=english?'en':'zh-CN';
    document.querySelectorAll('[data-language]:not(.intro-languages *)').forEach(button=>{button.dataset.language=english?'zh':'en';button.textContent=english?'中文':'English';});
    if(english){status('Translating…');translate();document.getElementById('intro-enter')?.click();}
    else{for(const [node,{original,output}]of records){if(node.isConnected&&node.textContent===output)node.textContent=original;}records.clear();status('');}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-language]');if(button)setLanguage(button.dataset.language==='en');});
  new MutationObserver(changes=>{
    if(!active||busy||!changes.some(c=>!(c.target.nodeType===1?c.target:c.target.parentElement)?.closest(skip)))return;
    clearTimeout(debounce);debounce=setTimeout(translate,300);
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  try{if(sessionStorage.getItem('mx-language')==='en')setLanguage(true);}catch{}
})();
