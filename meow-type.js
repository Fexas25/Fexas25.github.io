(() => {
  const selector='.brand,.intro-brand,.meow-welcome>span,.shelf-about h1,.about-introduction h2,.interest-card h3';
  const active=new Map(),cooldown=new WeakMap(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function reset(){for(const [el,restore] of active)restore();}
  window.MXMeow={reset};
  function play(el){
    if(reduce.matches||active.has(el)||Date.now()-(cooldown.get(el)||0)<1800||el.closest('[data-private-content]'))return;
    reset();cooldown.set(el,Date.now());const originals=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let index=0;
    while(walker.nextNode())if(walker.currentNode.textContent.trim())originals.push(walker.currentNode);
    if(!originals.length)return;
    el.dataset.meowPlaying='';const replacements=[];
    for(const node of originals){
      const holder=document.createElement('span');holder.className='meow-letter-layer';holder.setAttribute('aria-label',node.textContent);
      for(const char of node.textContent){const part=document.createElement('span');part.textContent=char;part.className='meow-letter';part.setAttribute('aria-hidden','true');part.style.setProperty('--delay',Math.min(index++,50)*28+'ms');holder.append(part);}
      node.replaceWith(holder);replacements.push([holder,node]);
    }
    const fish=document.createElement('i');fish.className='meow-type-fish fish';fish.setAttribute('aria-hidden','true');el.append(fish);
    const duration=650+Math.min(index,50)*28;fish.style.setProperty('--swim-time',duration+'ms');
    const timer=setTimeout(restore,duration+80);
    function restore(){clearTimeout(timer);for(const [holder,node]of replacements)holder.replaceWith(node);fish.remove();delete el.dataset.meowPlaying;active.delete(el);}
    active.set(el,restore);
  }
  document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const el=event.target.closest(selector);if(el&&!el.contains(event.relatedTarget))play(el);});
  document.addEventListener('click',event=>{const el=event.target.closest(selector);if(el)play(el);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});reduce.addEventListener('change',reset);
})();
