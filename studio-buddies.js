(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-buddy-scene]').forEach(scene => {
    const floor = scene.querySelector('.buddy-floor');
    const buddies = [...scene.querySelectorAll('[data-buddy]')];
    const message = scene.querySelector('.buddy-message');
    const send = scene.querySelector('.buddy-send');
    const names = { orange: '橙橙', pink: '桃桃', blue: '蓝蓝' };
    const lines = {
      orange: ['今天的快乐，分你一半！', '嘘——我在收集生活里的小事。', '你一来，今天就有值得记下的事啦。'],
      pink: ['脑洞接收中……收到一个好主意！', '写累了就伸个懒腰吧。', '这道题先放一放，摸鱼一分钟。'],
      blue: ['被你发现啦！一起摸鱼？', '作品还在生长，灵感先跳个舞。', '我负责脑洞，你负责开心！']
    };
    let activeDrag = null;
    let flightTimer = 0;
    let touched = new Set();
    let catchIndex = 0;
    let inView = true;
    const timers = new Map();
    const positions = new Map();
    const counts = new Map();
    function say(text) { message.textContent = text; }
    function animate(buddy, kind = 'is-happy') {
      clearTimeout(timers.get(buddy));
      buddy.classList.remove('is-happy', 'is-catching');
      void buddy.offsetWidth;
      buddy.classList.add(kind);
      timers.set(buddy, setTimeout(() => buddy.classList.remove(kind), 850));
    }
    function place(buddy, fraction) {
      const width = floor.clientWidth;
      if (!width) return;
      const edge = Math.min(.5, (buddy.offsetWidth / 2 + 4) / width);
      const x = Math.max(edge, Math.min(1 - edge, fraction));
      positions.set(buddy, x);
      buddy.style.setProperty('--buddy-x', `${x * 100}%`);
    }
    function greet(buddy) {
      const id = buddy.dataset.buddy;
      const count = counts.get(buddy) || 0;
      counts.set(buddy, count + 1);
      touched.add(buddy);
      animate(buddy);
      if (buddies.length > 1 && touched.size === buddies.length) {
        touched.clear();
        buddies.forEach(b => animate(b));
        scene.classList.remove('is-party');
        void scene.offsetWidth;
        scene.classList.add('is-party');
        say('全员集合！今天的摸鱼搭子就是你啦。');
      } else say(`${names[id]}：${lines[id][count % lines[id].length]}`);
    }
    function land(buddy) {
      const near = buddies.find(other => other !== buddy && Math.abs(positions.get(other) - positions.get(buddy)) * floor.clientWidth < (buddy.offsetWidth + other.offsetWidth) / 2);
      if (near) {
        animate(near);
        animate(buddy);
        say(`${names[buddy.dataset.buddy]}和${names[near.dataset.buddy]}：贴贴！一起等下一个灵感。`);
        // Return to spaced seats so a dropped character never blocks another button.
        buddies.forEach((b, i) => place(b, (i + .5) / buddies.length));
      } else { animate(buddy); say(`${names[buddy.dataset.buddy]}：这个位置不错，就在这里陪你。`); }
    }
    scene.hidden = false;
    buddies.forEach((buddy, index) => {
      place(buddy, (index + .5) / buddies.length);
      buddy.style.setProperty('--buddy-delay', `${index * -1.3}s`);
      let suppressClick = false;
      buddy.addEventListener('click', () => { if (!suppressClick) greet(buddy); });
      buddy.addEventListener('pointerdown', event => {
        if (event.button !== 0 || activeDrag) return;
        activeDrag = { buddy, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: positions.get(buddy), moved: false };
        suppressClick = false;
        buddy.setPointerCapture(event.pointerId);
      });
      buddy.addEventListener('pointermove', event => {
        const drag = activeDrag;
        if (!drag || drag.buddy !== buddy || drag.pointer !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        if (Math.hypot(dx, event.clientY - drag.startY) < 7 && !drag.moved) return;
        drag.moved = true;
        buddy.classList.add('is-picked');
        buddy.style.setProperty('--buddy-tilt', `${Math.max(-12, Math.min(12, dx / 5))}deg`);
        place(buddy, drag.x + dx / floor.clientWidth);
      });
      function release(event) {
        const drag = activeDrag;
        if (!drag || drag.buddy !== buddy || drag.pointer !== event.pointerId) return;
        activeDrag = null;
        buddy.classList.remove('is-picked');
        if (buddy.hasPointerCapture(event.pointerId)) buddy.releasePointerCapture(event.pointerId);
        suppressClick = drag.moved;
        if (drag.moved) land(buddy);
        // Pointer clicks arrive before the next task; keyboard clicks remain available.
        setTimeout(() => { suppressClick = false; }, 0);
      }
      buddy.addEventListener('pointerup', release);
      buddy.addEventListener('pointercancel', release);
      buddy.addEventListener('lostpointercapture', release);
      buddy.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
        event.preventDefault();
        place(buddy, event.key === 'Home' ? (index + .5) / buddies.length : positions.get(buddy) + (event.key === 'ArrowLeft' ? -.07 : .07));
        say(`${names[buddy.dataset.buddy]}：挪一挪，换个好位置。`);
      });
      buddy.addEventListener('keyup', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') land(buddy);
      });
    });
    send.addEventListener('click', () => {
      if (flightTimer || activeDrag) return;
      const catcher = buddies[catchIndex++ % buddies.length];
      scene.style.setProperty('--plane-end', `${positions.get(catcher) * 100}%`);
      scene.classList.add('is-flying');
      send.setAttribute('aria-disabled', 'true');
      say('一架装着灵感的纸飞机，起飞！');
      flightTimer = setTimeout(() => {
        scene.classList.remove('is-flying');
        send.removeAttribute('aria-disabled');
        animate(catcher, 'is-catching');
        say(`${names[catcher.dataset.buddy]}接住了纸飞机：${['今天也要做一点喜欢的事。', '下一站，是还没做出来的小游戏！', '灵感收到，开心也收到。'][(catchIndex - 1) % 3]}`);
        flightTimer = 0;
      }, motion.matches ? 0 : 1000);
    });
    const resize = new ResizeObserver(() => buddies.forEach(b => place(b, positions.get(b) ?? .5)));
    resize.observe(floor);
    const rest = () => scene.classList.toggle('is-resting', !inView || document.hidden);
    const visibility = new IntersectionObserver(entries => entries.forEach(entry => { inView = entry.isIntersecting; rest(); }));
    visibility.observe(scene);
    document.addEventListener('visibilitychange', rest);
  });
})();
