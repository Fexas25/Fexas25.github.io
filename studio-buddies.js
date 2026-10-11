(() => {
  'use strict';
  const scene = document.querySelector('[data-buddy-scene]');
  if (!scene) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const message = scene.querySelector('.buddy-message');
  const speech = scene.querySelector('.buddy-speech');
  const plane = scene.querySelector('.buddy-plane');
  const send = scene.querySelector('.buddy-send');
  const toggle = scene.querySelector('.buddy-toggle');
  const names = { orange: '橙橙', pink: '桃桃', blue: '蓝蓝' };
  const lines = {
    orange: ['今天的快乐，分你一半！', '我在收集生活里的小事。', '散步也会遇见好灵感。'],
    pink: ['脑洞接收中……收到！', '写累了就伸个懒腰吧。', '换个角落，继续摸鱼。'],
    blue: ['被你发现啦！一起摸鱼？', '我去前面探探路。', '我负责脑洞，你负责开心！']
  };
  const actors = [...scene.querySelectorAll('[data-buddy]')].map(el => ({ el, id: el.dataset.buddy, x: 0, y: 0, w: 0, h: 0, placed: false, count: 0, pause: 0, target: null }));
  const touched = new Set();
  const buckets = new Map();
  let width = 0, height = 0, drag = null, resting = false, editing = false, modal = false;
  let refreshTimer = 0, scrollTimer = 0, speechTimer = 0, flightTimer = 0, catchIndex = 0;
  let frame = 0, previousTime = 0;
  try { resting = sessionStorage.getItem('mx-buddies-resting-v1') === '1'; } catch (_) { /* optional preference */ }

  function rect(x, y, w, h, padding = 4) {
    return { l: x - padding, t: y - padding, r: x + w + padding, b: y + h + padding };
  }
  function intersects(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }
  function addObstacle(box, padding = 5) {
    if (!box.width || !box.height) return;
    const r = rect(box.left + scrollX, box.top + scrollY, box.width, box.height, padding);
    for (let row = Math.floor(r.t / 96); row <= Math.floor(r.b / 96); row++) {
      if (!buckets.has(row)) buckets.set(row, []);
      buckets.get(row).push(r);
    }
  }
  function safe(actor, x, y) {
    if (x < 4 || x + actor.w > width - 4 || y < 12 || y + actor.h > height - 4) return false;
    const r = rect(x, y, actor.w, actor.h, 3);
    r.t -= 9; // Reserve the bounce and walking animation above the hit area too.
    for (let row = Math.floor(r.t / 96); row <= Math.floor(r.b / 96); row++) {
      if ((buckets.get(row) || []).some(other => intersects(r, other))) return false;
    }
    return !actors.some(other => other !== actor && other.placed && !other.el.hidden && intersects(r, rect(other.x, other.y, other.w, other.h, 3)));
  }
  function findSpace(actor, x, y, global = true) {
    const clamp = (px, py) => ({ x: Math.max(4, Math.min(width - actor.w - 4, px)), y: Math.max(12, Math.min(height - actor.h - 4, py)) });
    const origin = clamp(x, y);
    if (safe(actor, origin.x, origin.y)) return origin;
    for (let radius = 20; radius <= (global ? 360 : 160); radius += 20) {
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const p = clamp(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
        if (safe(actor, p.x, p.y)) return p;
      }
    }
    if (global) {
      for (let py = 16; py < height - actor.h; py += 28) {
        for (let px = 4; px < width - actor.w; px += 24) if (safe(actor, px, py)) return { x: px, y: py };
      }
    }
    return null;
  }
  function paint(actor, x, y) {
    actor.x = Math.max(4, Math.min(width - actor.w - 4, x));
    actor.y = Math.max(12, Math.min(height - actor.h - 4, y));
    actor.el.style.setProperty('--buddy-x', `${actor.x.toFixed(2)}px`);
    actor.el.style.setProperty('--buddy-y', `${actor.y.toFixed(2)}px`);
  }
  function seed(actor, index) {
    const anchor = index === 1 ? document.querySelector('.writing-grid') : index === 2 ? document.querySelector('.works-section') :
      document.querySelector('.hero') || document.querySelector('.shelf-intro') || document.querySelector('.reading-header') || document.querySelector('main');
    const box = anchor ? anchor.getBoundingClientRect() : { top: 120, bottom: 300, height: 180 };
    return { x: width * [.68, .17, .82][index % 3] - actor.w / 2, y: scrollY + (index ? box.top - actor.h - 12 : box.top + box.height * .62) };
  }
  function arrange(actor, position) {
    actor.el.hidden = !position;
    actor.placed = !!position;
    actor.target = null;
    actor.el.classList.remove('is-walking');
    if (position) paint(actor, position.x, position.y);
  }
  function refresh(reposition = true) {
    refreshTimer = 0;
    width = document.documentElement.clientWidth;
    // offsetHeight excludes our absolutely positioned artwork, preventing a growing scroll area.
    height = Math.max(innerHeight, document.body.offsetHeight);
    // Keep the hit-testing layer as large as the document in WebKit too.
    scene.style.setProperty('--buddy-page-height', `${height}px`);
    buckets.clear();
    const ignored = el => el.closest('[data-buddy-scene], script, style, noscript') || getComputedStyle(el).visibility === 'hidden';
    document.querySelectorAll('a,button,input,textarea,select,summary,nav,pre,table,iframe,video,canvas,img,.site-header,.shelf-character').forEach(el => {
      if (ignored(el) || el.matches('.room')) return;
      for (const box of el.getClientRects()) addObstacle(box, 7);
    });
    // Protect actual text lines rather than whole cards, so their empty margins remain walkable.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.textContent.trim() && !ignored(node.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const range = document.createRange();
    while (walker.nextNode()) {
      range.selectNodeContents(walker.currentNode);
      for (const box of range.getClientRects()) addObstacle(box, 4);
    }
    addObstacle(scene.querySelector('.buddy-tools').getBoundingClientRect(), 8);
    actors.forEach((actor, index) => {
      actor.el.hidden = false;
      actor.w = actor.el.offsetWidth;
      actor.h = actor.el.offsetHeight;
      if (drag?.actor === actor || !reposition) return;
      const wanted = actor.placed ? actor : seed(actor, index);
      arrange(actor, findSpace(actor, wanted.x, wanted.y));
      actor.pause = Math.max(actor.pause, performance.now() + 900 + index * 500);
    });
    modal = !!document.querySelector('dialog[open]');
    scene.classList.toggle('has-dialog', modal);
    wake();
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 140);
  }
  function animate(actor, kind = 'is-happy') {
    clearTimeout(actor.animationTimer);
    actor.el.classList.remove('is-happy', 'is-catching');
    void actor.el.offsetWidth;
    actor.el.classList.add(kind);
    actor.animationTimer = setTimeout(() => actor.el.classList.remove(kind), 700);
  }
  function say(text, actor) {
    message.textContent = text;
    clearTimeout(speechTimer);
    speech.hidden = true;
    if (!actor || !actor.placed) return;
    speech.textContent = text;
    speech.hidden = false;
    speech.style.visibility = 'hidden';
    const size = { w: speech.offsetWidth, h: speech.offsetHeight };
    const position = findSpace(size, actor.x + actor.w / 2 - size.w / 2, actor.y - size.h - 14, false);
    if (position && position.y >= scrollY + 90 && position.y + size.h < scrollY + innerHeight) {
      speech.style.left = `${position.x}px`;
      speech.style.top = `${position.y}px`;
      speech.style.visibility = '';
    } else speech.hidden = true;
    speechTimer = setTimeout(() => { speech.hidden = true; }, 3200);
  }
  function greet(actor) {
    actor.pause = performance.now() + 6500;
    actor.target = null;
    actor.el.classList.remove('is-walking');
    touched.add(actor);
    animate(actor);
    if (actors.length > 1 && touched.size === actors.length) {
      touched.clear();
      actors.forEach(other => animate(other));
      say('全员集合！今天的摸鱼搭子就是你啦。', actor);
    } else say(`${names[actor.id]}：${lines[actor.id][actor.count++ % 3]}`, actor);
  }
  function land(actor, cancelled = false) {
    const friend = actors.find(other => other !== actor && other.placed && Math.hypot(other.x - actor.x, other.y - actor.y) < 100);
    arrange(actor, findSpace(actor, actor.x, actor.y));
    actor.pause = performance.now() + 15000;
    if (cancelled) say(`${names[actor.id]}：回到刚才的位置啦。`, actor);
    else if (friend) { animate(friend); say(`${names[actor.id]}和${names[friend.id]}：贴贴！一起散个步。`, actor); }
    else say(`${names[actor.id]}：这个位置不错，就在这里陪你。`, actor);
    animate(actor);
  }
  function stopDrag(cancelled = false) {
    if (!drag) return;
    const current = drag;
    drag = null;
    current.actor.el.classList.remove('is-picked');
    if (current.actor.el.hasPointerCapture(current.pointer)) current.actor.el.releasePointerCapture(current.pointer);
    if (cancelled) paint(current.actor, current.x, current.y);
    current.actor.suppressUntil = current.moved ? performance.now() + 250 : 0;
    if (current.moved || cancelled) { refresh(false); land(current.actor, cancelled); }
  }
  actors.forEach((actor, index) => {
    const el = actor.el;
    el.style.setProperty('--buddy-delay', `${index * -1.3}s`);
    el.addEventListener('click', event => {
      if (performance.now() >= (actor.suppressUntil || 0)) greet(actor);
    });
    el.addEventListener('pointerenter', () => { actor.hover = true; });
    el.addEventListener('pointerleave', () => { actor.hover = false; });
    el.addEventListener('focus', () => { actor.focused = !actor.pointerFocus; });
    el.addEventListener('blur', () => { actor.focused = false; actor.pause = performance.now() + 2500; });
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      actor.target = null;
      actor.el.classList.remove('is-walking');
      drag = { actor, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: actor.x, y: actor.y, scroll: scrollY, clientX: event.clientX, clientY: event.clientY, moved: false };
      actor.pointerFocus = true;
      actor.focused = false;
      el.focus({ preventScroll: true });
      actor.pointerFocus = false;
      el.setPointerCapture(event.pointerId);
      speech.hidden = true;
      wake();
    });
    el.addEventListener('pointermove', event => {
      if (!drag || drag.actor !== actor || drag.pointer !== event.pointerId) return;
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.moved = true;
      el.classList.add('is-picked');
      paint(actor, drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY + scrollY - drag.scroll);
    });
    el.addEventListener('pointerup', event => {
      if (drag?.pointer !== event.pointerId) return;
      const tapped = !drag.moved;
      stopDrag();
      // Touch browsers need not emit a compatibility click after pointer capture.
      // Handle the completed tap here, then ignore any duplicate synthetic click.
      actor.suppressUntil = performance.now() + 700;
      if (tapped) greet(actor);
    });
    el.addEventListener('pointercancel', () => stopDrag(true));
    el.addEventListener('lostpointercapture', () => stopDrag(true));
    el.addEventListener('keydown', event => {
      actor.focused = true;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) greet(actor);
        actor.suppressUntil = performance.now() + 700;
        return;
      }
      if (event.key === 'Escape') { stopDrag(true); return; }
      const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
      if (!delta && event.key !== 'Home') return;
      event.preventDefault();
      actor.target = null;
      const p = event.key === 'Home' ? seed(actor, index) : { x: actor.x + delta[0], y: actor.y + delta[1] };
      paint(actor, p.x, p.y);
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    });
    el.addEventListener('keyup', event => { if (/^Arrow|^Home$/.test(event.key)) land(actor); });
  });

  function destination(actor) {
    for (let attempt = 0; attempt < 18; attempt++) {
      const angle = attempt < 4 ? attempt * Math.PI / 2 : Math.random() * Math.PI * 2;
      const distance = 24 + Math.random() * 100;
      const x = actor.x + Math.cos(angle) * distance, y = actor.y + Math.sin(angle) * distance;
      let clear = true;
      for (let t = 1; t <= Math.ceil(distance / 6); t++) {
        const f = t / Math.ceil(distance / 6);
        if (!safe(actor, actor.x + (x - actor.x) * f, actor.y + (y - actor.y) * f)) { clear = false; break; }
      }
      if (clear) return { x, y };
    }
    return null;
  }
  function tick(now) {
    frame = 0;
    const dt = Math.min(50, now - (previousTime || now)) / 1000;
    previousTime = now;
    if (document.hidden || resting || editing || modal) return;
    if (drag?.moved) {
      // The user's drag can cross the entire document, including beyond the current screen.
      const edge = drag.clientY < 50 ? -1 : drag.clientY > innerHeight - 50 ? 1 : 0;
      if (edge) {
        scrollBy({ top: edge * 300 * dt, behavior: 'instant' });
        paint(drag.actor, drag.x + drag.clientX - drag.startX, drag.y + drag.clientY - drag.startY + scrollY - drag.scroll);
      }
    }
    if (!motion.matches && !scene.classList.contains('is-scrolling')) actors.forEach(actor => {
      const visible = actor.placed && actor.y + actor.h > scrollY && actor.y < scrollY + innerHeight;
      if (actor.inView !== visible) { actor.inView = visible; actor.el.classList.toggle('is-offscreen', !visible); }
      const paused = !visible || drag?.actor === actor || actor.hover || actor.focused || actor.pause > now;
      actor.el.classList.toggle('is-walking', !paused && !!actor.target);
      if (paused) return;
      if (!actor.target) { actor.target = destination(actor); if (!actor.target) actor.pause = now + 3500; }
      if (!actor.target) return;
      const dx = actor.target.x - actor.x, dy = actor.target.y - actor.y;
      const length = Math.hypot(dx, dy);
      const step = Math.min(length, dt * (width <= 700 ? 16 : 23));
      const x = actor.x + dx / (length || 1) * step, y = actor.y + dy / (length || 1) * step;
      if (length < 1 || !safe(actor, x, y)) { actor.target = null; actor.pause = now + 2500 + Math.random() * 2500; }
      else paint(actor, x, y);
    });
    if (!motion.matches || drag) frame = requestAnimationFrame(tick);
  }
  function wake() { if (!frame && !document.hidden && !resting && !editing && !modal) { previousTime = 0; frame = requestAnimationFrame(tick); } }
  function applyRest() {
    scene.classList.toggle('is-resting', resting);
    toggle.setAttribute('aria-pressed', String(resting));
    toggle.textContent = resting ? '叫小伙伴出来走走' : '小伙伴休息一下';
    send.disabled = resting;
    if (resting) { stopDrag(true); cancelAnimationFrame(frame); frame = 0; }
    else { refresh(); wake(); }
  }
  toggle.addEventListener('click', () => {
    resting = !resting;
    try { sessionStorage.setItem('mx-buddies-resting-v1', resting ? '1' : '0'); } catch (_) { /* optional preference */ }
    applyRest();
  });
  send.addEventListener('click', () => {
    if (flightTimer || drag || resting) return;
    refresh();
    const actor = actors[catchIndex++ % actors.length];
    const origin = send.getBoundingClientRect();
    if (actor.y < scrollY + 100 || actor.y > scrollY + innerHeight - actor.h) {
      arrange(actor, findSpace(actor, origin.left, origin.top + scrollY - actor.h - 35));
    }
    actor.pause = performance.now() + 5000;
    const from = { x: Math.min(width - 28, origin.left), y: origin.top + scrollY - 24 };
    const to = { x: Math.min(width - 28, actor.x), y: actor.y };
    if (!motion.matches) plane.animate([
      { transform: `translate(${from.x}px,${from.y}px) rotate(-35deg)`, opacity: 0 },
      { transform: `translate(${(from.x + to.x) / 2}px,${Math.max(10, Math.min(from.y, to.y) - 35)}px) rotate(-10deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${to.x}px,${to.y}px) rotate(20deg)`, opacity: 0 }
    ], { duration: 800, easing: 'ease-in-out' });
    send.setAttribute('aria-disabled', 'true');
    say('一架装着灵感的纸飞机，起飞！');
    flightTimer = setTimeout(() => {
      send.removeAttribute('aria-disabled');
      animate(actor, 'is-catching');
      say(`${names[actor.id]}接住了纸飞机：${['今天也要做一点喜欢的事。', '下一站，是还没做出来的小游戏！', '灵感收到，开心也收到。'][(catchIndex - 1) % 3]}`, actor);
      flightTimer = 0;
    }, motion.matches ? 0 : 800);
  });
  addEventListener('scroll', () => {
    scene.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { refresh(); scene.classList.remove('is-scrolling'); }, 160);
  }, { passive: true });
  addEventListener('resize', scheduleRefresh, { passive: true });
  new ResizeObserver(scheduleRefresh).observe(document.body);
  new MutationObserver(records => {
    if (records.some(record => !scene.contains(record.target))) scheduleRefresh();
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open', 'class'] });
  document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement && !scene.contains(event.target)) scheduleRefresh(); }, true);
  document.addEventListener('visibilitychange', () => {
    scene.classList.toggle('is-inactive', document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake();
  });
  const focus = () => {
    editing = !!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
    scene.classList.toggle('is-writing', editing);
    if (!editing) wake();
  };
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', () => setTimeout(focus, 0));
  motion.addEventListener('change', () => { actors.forEach(actor => { actor.target = null; actor.el.classList.remove('is-walking'); }); wake(); });
  scene.hidden = false;
  refresh();
  applyRest();
  document.fonts.ready.then(scheduleRefresh);
})();
