(() => {
  'use strict';
  document.getElementById('year').textContent = new Date().getFullYear();
  const dialog = document.getElementById('fortune-dialog');
  const closeButton = dialog.querySelector('.dialog-close');
  let opener;
  document.querySelectorAll('[data-draw]').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.MXFortune) { window.location.href = 'daily-checkin/'; return; }
      const reveal = () => {
      const result = window.MXFortune.draw();
      const fortune = result.item;
      opener = button;
      document.getElementById('fortune-date').textContent = fortune.date;
      document.getElementById('fortune-date').dateTime = fortune.date;
      document.getElementById('fortune-title').textContent = fortune.level;
      document.getElementById('fortune-description').textContent = fortune.text;
      document.getElementById('fortune-yi').textContent = fortune.auspicious || '—';
      document.getElementById('fortune-ji').textContent = fortune.inauspicious || '—';
      document.getElementById('fortune-number').textContent = fortune.luckyNumber || '—';
      document.getElementById('fortune-color').textContent = fortune.luckyColor || '—';
      document.getElementById('fortune-storage').textContent = result.persisted ? '' : '当前浏览器无法保存记录，本次签仍可查看。';
      document.querySelector('[data-draw-label]').textContent = result.persisted ? '今日已抽 · 点击查看' : '查看今日签';
      dialog.showModal();
      closeButton.focus();
      };
      if (window.MXFortune.hasDrawnToday() || !window.MXMotion) reveal();
      else window.MXMotion.draw(button,reveal);
    });
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
  const refreshDrawStatus = () => {
    document.querySelector('[data-draw-label]').textContent = window.MXFortune?.hasDrawnToday() ? '今日已抽 · 点击查看' : '看看今天的小惊喜';
  };
  refreshDrawStatus();
  window.addEventListener('pageshow', refreshDrawStatus);
  window.addEventListener('storage', event => { if (event.key === 'daily-checkin' || event.key === null) refreshDrawStatus(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDrawStatus(); });
  setInterval(() => { if (!document.hidden) refreshDrawStatus(); }, 60000);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('is-out-of-view', !entry.isIntersecting)));
    observer.observe(document.querySelector('.hero'));
  }
})();
