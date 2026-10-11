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

document.querySelectorAll('[data-reading-content]').forEach(article => {
  const toc = document.querySelector('[data-article-toc]');
  const headings = [...article.querySelectorAll('h2, h3')].filter(h => h.textContent.trim());
  if (toc && headings.length >= 3) {
    headings.forEach((heading, index) => {
      if (!heading.id) {
        let id = `section-${index + 1}`;
        while (document.getElementById(id)) id += '-';
        heading.id = id;
      }
      const item = document.createElement('li');
      if (heading.tagName === 'H3') item.className = 'toc-subsection';
      const link = document.createElement('a');
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.textContent;
      item.append(link);
      toc.querySelector('ol').append(item);
    });
    toc.hidden = false;
  }
  article.querySelectorAll('pre').forEach((pre, index) => {
    const actions = document.createElement('div');
    actions.className = 'code-actions';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = '复制代码';
    button.setAttribute('aria-label', `复制第 ${index + 1} 段代码`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await navigator.clipboard.writeText((pre.querySelector('code') || pre).textContent);
        status.textContent = '已复制';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = '请复制已选中的代码';
      } finally { button.disabled = false; }
    });
    actions.append(status, button);
    pre.before(actions);
  });
});
