(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ornaments = document.querySelector('.studio-ornaments');
  if (!ornaments) return;
  const marks = [...ornaments.querySelectorAll('.studio-mark')];
  const floaters = [...document.querySelectorAll('.shelf-character, .studio-ornaments')];
  const visible = new Set();
  const sync = () => floaters.forEach(el => el.classList.toggle('is-drifting', visible.has(el) && !document.hidden && !reduced.matches));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({target, isIntersecting}) => isIntersecting ? visible.add(target) : visible.delete(target));
      sync();
    });
    floaters.forEach(el => observer.observe(el));
  }
  // The birthday experience already owns its tap/firework interaction.
  if (document.body.dataset.nativeEffects === 'true') return;
  const effects = document.createElement('div');
  effects.className = 'studio-click-effects';
  effects.setAttribute('aria-hidden', 'true');
  document.body.append(effects);
  const timers = new Map();
  const remove = el => { clearTimeout(timers.get(el)); timers.delete(el); el.remove(); };
  const clear = () => [...timers.keys()].forEach(remove);
  let last = -Infinity, index = 0, down = null;
  document.addEventListener('pointerdown', event => {
    down = event.isPrimary && event.button === 0 ? { id:event.pointerId, x:event.clientX, y:event.clientY } : null;
  }, {passive:true});
  document.addEventListener('pointercancel', () => { down = null; }, {passive:true});
  document.addEventListener('pointerup', event => {
    const start = down; down = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX-start.x,event.clientY-start.y)>9) return;
    if (reduced.matches || document.hidden || !marks.length || document.querySelector('dialog[open]')) return;
    if (event.target.closest('input,textarea,select,button,a,summary,label,[contenteditable],pre,code,[data-buddy-scene],.prose,.guestbook-message')) return;
    if (getSelection()?.toString()) return;
    const now = performance.now();
    if (now-last<140) return;
    last = now;
    if (timers.size>=8) remove(timers.keys().next().value);
    const spark = document.createElement('span');
    spark.className = 'studio-click-spark';
    spark.style.setProperty('--spark-x', `${event.clientX}px`);
    spark.style.setProperty('--spark-y', `${event.clientY}px`);
    spark.append(marks[index++ % marks.length].cloneNode(true));
    effects.append(spark);
    timers.set(spark, setTimeout(() => remove(spark), 740));
  }, {passive:true});
  document.addEventListener('visibilitychange', () => { if(document.hidden) clear(); sync(); });
  addEventListener('pagehide', clear);
  reduced.addEventListener('change', () => { if(reduced.matches) clear(); sync(); });
})();
