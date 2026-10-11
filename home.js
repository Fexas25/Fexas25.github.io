(() => {
  'use strict';
  document.getElementById('year').textContent = new Date().getFullYear();
  const dialog = document.getElementById('fortune-dialog');
  const closeButton = dialog.querySelector('.dialog-close');
  let opener;
  document.querySelectorAll('[data-draw]').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.MXFortune) { window.location.href = 'daily-checkin/'; return; }
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
    });
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
  if (window.MXFortune?.hasDrawnToday()) document.querySelector('[data-draw-label]').textContent = '今日已抽 · 点击查看';
  const filters = document.querySelectorAll('[data-filter]');
  const cards = document.querySelectorAll('[data-kind]');
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    let count = 0;
    cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.kind !== button.dataset.filter; if (!card.hidden) count++; });
    document.getElementById('filter-status').textContent = `${button.textContent}：显示 ${count} 个条目`;
  }));
})();
