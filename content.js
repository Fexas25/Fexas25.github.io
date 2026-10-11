/* Progressive enhancement: every entry is visible without JavaScript. */
document.querySelectorAll('[data-browser]').forEach(browser => {
  const entries = [...browser.querySelectorAll('[data-entry]')];
  const buttons = [...browser.querySelectorAll('[data-category-filter]')];
  const search = browser.querySelector('[data-search-input]');
  let category = 'all';
  const update = () => {
    const query = (search?.value || '').trim().toLocaleLowerCase();
    let visible = 0;
    entries.forEach(entry => {
      const matches = (category === 'all' || entry.dataset.category === category) &&
        (!query || (entry.dataset.search || '').toLocaleLowerCase().includes(query));
      entry.hidden = !matches;
      if (matches) visible++;
    });
    browser.querySelector('[data-no-results]').hidden = visible !== 0;
    browser.querySelector('[data-result-status]').textContent = `显示 ${visible} 项`;
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.categoryFilter;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  search?.addEventListener('input', update);
  update();
});
