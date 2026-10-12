/* Small, optional effects. Content and navigation remain usable without them. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 851px)');
  window.MXMotion = {
    draw(button, finish) {
      if (button.dataset.drawing) return;
      if (reduced.matches) { finish(); return; }
      button.dataset.drawing = 'true';
      button.disabled = true;
      button.setAttribute('aria-busy','true');
      button.classList.add('is-drawing');
      let complete = false;
      const done = () => {
        if (complete) return;
        complete = true;
        clearTimeout(timer);
        reduced.removeEventListener('change',done);
        button.classList.remove('is-drawing');
        delete button.dataset.drawing;
        button.removeAttribute('aria-busy');
        button.disabled = false;
        finish();
      };
      const timer = setTimeout(done,460);
      reduced.addEventListener('change',done);
    }
  };
  document.querySelector('[data-enter-zh]')?.addEventListener('click', () => document.getElementById('intro-enter')?.click());
  const intro = document.getElementById('studio-intro');
  if (!intro) return;
  function startPond() {
    const pond = intro.querySelector('.intro-pond');
    const effects = pond.querySelector('.pond-effects');
    const surfaceEffects = pond.querySelector('.pond-surface-effects');
    const water = pond.querySelector('.pond-water');
    const swimmers = [pond.querySelector('.intro-swimmer')];
    const lifetime = new Map();
    const jumpTimers = new Map();
    const lapDuration = 8000;
    let nextJump = 4600;
    let frame = 0, last = 0, elapsed = 0, lastCurrent = 0, pauseUntil = 0, stopped = false;
    let width = pond.clientWidth, height = pond.clientHeight;
    const removeEffect = node => { clearTimeout(lifetime.get(node)); lifetime.delete(node); node.remove(); };
    function effect(kind, x, y, heading = 0) {
      if (lifetime.size >= 28) removeEffect(lifetime.keys().next().value);
      const node = document.createElement('span');
      node.className = `pond-effect ${kind}`;
      node.style.left = `${x}px`; node.style.top = `${y}px`;
      if (kind === 'pond-current-wake') node.style.setProperty('--wake-heading', `${heading}deg`);
      if (kind === 'pond-clover') {
        node.innerHTML = '<svg viewBox="0 0 48 52" aria-hidden="true"><path d="M24 25q8 13-2 24" fill="none" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><path d="M24 25C5 24 4 11 12 10C18 9 23 14 24 25Z"/><path d="M24 25C23 6 36 1 39 9C41 15 35 22 24 25Z"/><path d="M24 25C43 24 48 37 40 40C34 42 27 36 24 25Z"/><path d="M24 25C25 44 12 49 9 41C7 35 13 28 24 25Z"/></g></svg>';
      }
      if (kind === 'pond-droplets') node.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
      const isWater = kind === 'pond-current-wake' || kind === 'pond-water-wave';
      (isWater ? surfaceEffects : effects).append(node);
      lifetime.set(node, setTimeout(() => removeEffect(node), isWater ? 2000 : kind === 'pond-resonance' ? 1800 : kind === 'pond-clover' ? 1500 : 1200));
    }
    function place() {
      swimmers.forEach((fish, index) => {
        const angle = elapsed / lapDuration * Math.PI * 2 - Math.PI / 2 - index * .48;
        const radius = Math.min(width, height) * .4;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        const heading = angle * 180 / Math.PI + 270;
        fish.style.transform = `translate(${x - 24}px,${y - 24}px)`;
        fish.style.setProperty('--fish-heading', `${heading}deg`);
        fish.pondPosition = { x, y, angle, heading };
      });
      water.style.setProperty('--water-x', `${swimmers[0].pondPosition.x}px`);
      water.style.setProperty('--water-y', `${swimmers[0].pondPosition.y}px`);
    }
    function jumpFish(fish, now = performance.now()) {
      if (fish.classList.contains('is-jumping')) return;
      pauseUntil = now + 700;
      fish.classList.add('is-jumping');
      const { x, y } = fish.pondPosition;
      effect('pond-splash', x, y);
      if (!reduced.matches) {
        effect('pond-droplets', x, y);
        effect('pond-water-wave', x, y);
      }
      const timer = setTimeout(() => {
        fish.classList.remove('is-jumping'); jumpTimers.delete(fish);
        if (!stopped && !document.hidden) {
          effect('pond-splash', fish.pondPosition.x, fish.pondPosition.y);
          if (!reduced.matches) {
            effect('pond-water-wave', fish.pondPosition.x, fish.pondPosition.y);
            effect('pond-resonance', width / 2, height / 2);
          }
        }
      }, 700);
      jumpTimers.set(fish, timer);
    }
    const jump = event => jumpFish(event.currentTarget);
    swimmers[0].addEventListener('click', jump);
    function tick(now) {
      frame = 0;
      if (stopped || document.hidden || reduced.matches) return;
      if (last && now >= pauseUntil) elapsed += Math.min(now - last, 64);
      last = now;
      // One new companion per completed lap; the leader can have three followers.
      if (swimmers.length < Math.min(4, 1 + Math.floor(elapsed / lapDuration))) {
        const fish = swimmers[0].cloneNode(true);
        fish.classList.remove('is-jumping');
        fish.setAttribute('aria-label', `摸摸跟随小鱼 ${swimmers.length}，让它跳起来`);
        fish.style.setProperty('--fish-color', ['#eeac99', '#9abfb5', '#b4a5cd', '#e9bf78'][swimmers.length]);
        fish.addEventListener('click', jump);
        pond.insertBefore(fish, document.getElementById('intro-enter'));
        swimmers.push(fish);
      }
      place();
      if (elapsed >= nextJump) {
        jumpFish(swimmers[Math.floor(Math.random() * swimmers.length)], now);
        nextJump = elapsed + 5200 + Math.random() * 3600;
      }
      if (elapsed - lastCurrent > 520) {
        swimmers.filter(fish => !fish.classList.contains('is-jumping')).forEach(fish => {
          const { x, y, angle, heading } = fish.pondPosition;
          // The fish faces left in its local coordinates; leave a tapered wake behind its tail.
          effect('pond-current-wake', x + Math.sin(angle) * 20, y - Math.cos(angle) * 20, heading);
        });
        lastCurrent = elapsed;
      }
      frame = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(frame); last = 0;
      if (!stopped && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    }
    const splash = event => {
      const rect = pond.getBoundingClientRect();
      const x = event.detail ? event.clientX - rect.left : width / 2;
      const y = event.detail ? event.clientY - rect.top : height * .78;
      effect('pond-splash', x, y);
      effect('pond-clover', x, y);
      if (!reduced.matches) effect('pond-water-wave', x, y);
    };
    const resize = () => { width = pond.clientWidth; height = pond.clientHeight; place(); };
    water.addEventListener('click', splash);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', resume);
    reduced.addEventListener('change', resume);
    place(); resume();
    return (clear = true) => {
      stopped = true; cancelAnimationFrame(frame);
      for (const timer of lifetime.values()) clearTimeout(timer);
      lifetime.clear();
      if (clear) { effects.replaceChildren(); surfaceEffects.replaceChildren(); }
      for (const timer of jumpTimers.values()) clearTimeout(timer);
      jumpTimers.clear();
      water.removeEventListener('click', splash);
      swimmers.forEach(fish => fish.removeEventListener('click', jump));
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', resume);
      reduced.removeEventListener('change', resume);
    };
  }
  const introKey = 'mx-studio-intro-seen-v2';
  let firstVisit = false;
  try { firstVisit = !sessionStorage.getItem(introKey); }
  catch { /* Keep the site accessible when session storage is unavailable. */ }
  if (firstVisit && !location.hash && typeof intro.showModal === 'function') {
    const enter = document.getElementById('intro-enter');
    const previousOverflow = document.body.style.overflow;
    let leaving = false, exitTimer;
    intro.showModal();
    const stopPond = startPond();
    document.body.style.overflow = 'hidden';
    const finish = () => { if (intro.open) intro.close(); };
    const enterStudio = () => {
      if (leaving) return;
      leaving = true;
      stopPond(false);
      enter.disabled = true;
      enter.setAttribute('aria-busy', 'true');
      intro.classList.add('intro-leaving');
      if (reduced.matches) finish();
      else exitTimer = setTimeout(finish, 380);
    };
    const motionChange = () => { if (reduced.matches && leaving) finish(); };
    enter.addEventListener('click', enterStudio);
    reduced.addEventListener('change', motionChange);
    intro.addEventListener('close', () => {
      clearTimeout(exitTimer);
      stopPond();
      reduced.removeEventListener('change', motionChange);
      enter.removeEventListener('click', enterStudio);
      document.body.style.overflow = previousOverflow;
      try { sessionStorage.setItem(introKey, '1'); } catch { /* Optional session memory. */ }
      document.querySelector('.hero').classList.add('scene-enter');
      document.getElementById('hero-title').focus({ preventScroll: true });
    }, { once: true });
  }
  const hero = document.querySelector('.hero');
  let frame = 0;
  let x = 0, y = 0;
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0;
    hero.style.removeProperty('--scene-x'); hero.style.removeProperty('--scene-y');
  };
  hero.addEventListener('pointermove',event => {
    if (!finePointer.matches || reduced.matches || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    x = ((event.clientX - rect.left) / rect.width - .5) * 12;
    y = ((event.clientY - rect.top) / rect.height - .5) * 8;
    if (!frame) frame = requestAnimationFrame(() => {
      hero.style.setProperty('--scene-x',`${x.toFixed(2)}px`);
      hero.style.setProperty('--scene-y',`${y.toFixed(2)}px`);
      frame = 0;
    });
  },{passive:true});
  hero.addEventListener('pointerleave',reset);
  finePointer.addEventListener('change',reset);
  reduced.addEventListener('change',reset);
  document.addEventListener('visibilitychange',() => { if (document.hidden) reset(); });
  const fishButton = document.getElementById('fish-play');
  fishButton.closest('.fish-corner').hidden = false;
  const messages = document.documentElement.lang === 'en' ? ['Splash!', 'Loop complete!', 'A little school of fish!'] : ['摸鱼成功！', '转个圈！', '鱼群来了！'];
  let message = 0, fishTimer;
  const corner = fishButton.closest('.fish-corner');
  const trail = document.createElement('span');
  trail.className = 'fish-play-trail'; trail.setAttribute('aria-hidden','true'); corner.append(trail);
  fishButton.addEventListener('click',() => {
    if (fishButton.classList.contains('fish-swimming')) return;
    const count = message++ % 3 + 1;
    document.getElementById('fish-message').textContent = messages[count-1];
    if (reduced.matches) return;
    trail.replaceChildren();
    for(let i=0;i<count;i++) {
      const fish = document.createElement('i'); fish.className = 'fish play-fish';
      fish.style.setProperty('--delay', `${i*90}ms`); trail.append(fish);
    }
    fishButton.classList.add('fish-swimming');
    clearTimeout(fishTimer);
    fishTimer = setTimeout(() => { fishButton.classList.remove('fish-swimming'); trail.replaceChildren(); },1100);
  });
  reduced.addEventListener('change', () => { if(reduced.matches) { clearTimeout(fishTimer); trail.replaceChildren(); fishButton.classList.remove('fish-swimming'); } });
})();
