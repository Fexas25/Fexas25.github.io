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
  const intro = document.getElementById('studio-intro');
  if (!intro) return;
  let firstVisit = false;
  try {
    firstVisit = !sessionStorage.getItem('mx-studio-intro-seen');
    sessionStorage.setItem('mx-studio-intro-seen','1');
  } catch { /* Skip the intro when session storage is unavailable. */ }
  if (firstVisit && !reduced.matches && !location.hash && !document.hidden && typeof intro.showModal === 'function') {
    intro.showModal();
    const close = () => { if (intro.open) intro.close(); };
    const timer = setTimeout(close,1100);
    document.getElementById('intro-skip').addEventListener('click',close);
    reduced.addEventListener('change',close);
    intro.addEventListener('close',() => {
      clearTimeout(timer);
      reduced.removeEventListener('change',close);
      document.querySelector('.hero').classList.add('scene-enter');
    },{once:true});
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
  const messages = ['摸鱼成功！今天也给自己留一点空白。','灵感还没来？先伸个懒腰吧。','小鱼说：慢慢来，也是在往前走。','捕获一条灵感！去写点什么吧。'];
  let message = 0, fishTimer;
  fishButton.addEventListener('click',() => {
    document.getElementById('fish-message').textContent = messages[message++ % messages.length];
    if (reduced.matches || fishButton.classList.contains('fish-swimming')) return;
    fishButton.classList.add('fish-swimming');
    clearTimeout(fishTimer);
    fishTimer = setTimeout(() => fishButton.classList.remove('fish-swimming'),650);
  });
})();
