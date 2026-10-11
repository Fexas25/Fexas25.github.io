/* Progressive enhancement: every entry is visible without JavaScript. */
document.querySelectorAll('[data-browser]').forEach(browser => {
  const entries = [...browser.querySelectorAll('[data-entry]')];
  const buttons = [...browser.querySelectorAll('[data-category-filter]')];
  const search = browser.querySelector('[data-search-input]');
  const year = browser.querySelector('[data-year-filter]');
  const tag = browser.querySelector('[data-tag-filter]');
  const tags = entry => { try { const value = JSON.parse(entry.dataset.tags || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  for (const [select, values] of [[year, entries.map(entry => entry.dataset.year).filter(Boolean).sort().reverse()], [tag, entries.flatMap(tags).sort()]]) {
    if (select) for (const value of new Set(values)) select.add(new Option(value, value));
    select?.addEventListener('change', () => update());
  }
  const filters = browser.querySelector('[data-archive-filters]');
  if (filters && entries.length) filters.hidden = false;
  let category = 'all';
  const update = () => {
    const query = (search?.value || '').trim().toLocaleLowerCase();
    let visible = 0;
    entries.forEach(entry => {
      const matches = (category === 'all' || entry.dataset.category === category) &&
        (!year?.value || entry.dataset.year === year.value) && (!tag?.value || tags(entry).includes(tag.value)) &&
        (!query || ((entry.dataset.search || '') + ' ' + tags(entry).join(' ')).toLocaleLowerCase().includes(query));
      entry.hidden = !matches;
      if (matches) visible++;
    });
    browser.querySelector('[data-no-results]').hidden = visible !== 0;
    browser.querySelector('[data-result-status]').textContent = `显示 ${visible} 项`;
    const summary = browser.querySelector('[data-filter-summary]');
    if (summary) summary.textContent = category !== 'all' || query || year?.value || tag?.value ? ` · 已筛选 ${visible} 项` : '';
    browser.querySelectorAll('[data-month-marker]').forEach(marker => {
      let sibling = marker.nextElementSibling, anyVisible = false;
      while (sibling && !sibling.hasAttribute('data-month-marker')) {
        if (sibling.hasAttribute('data-entry') && !sibling.hidden) anyVisible = true;
        sibling = sibling.nextElementSibling;
      }
      marker.hidden = !anyVisible;
    });
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
  const topLink = document.querySelector('[data-reading-top]');
  if (topLink) {
    let pending = false;
    const updateTop = () => {
      pending = false;
      topLink.hidden = article.getBoundingClientRect().height < window.innerHeight * 1.5 || window.scrollY < 600;
    };
    window.addEventListener('scroll', () => {
      if (!pending) { pending = true; requestAnimationFrame(updateTop); }
    }, {passive:true});
    window.addEventListener('resize', updateTop);
    window.addEventListener('load', updateTop);
    if (window.ResizeObserver) new ResizeObserver(updateTop).observe(article);
    updateTop();
  }
  const images = [...article.querySelectorAll('img')].filter(img => !img.closest('a, button') && img.getAttribute('src'));
  if (images.length && typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.showModal) {
    const dialog = document.createElement('dialog');
    dialog.className = 'reading-viewer';
    dialog.setAttribute('aria-label', '文章图片预览');
    const toolbar = document.createElement('div'); toolbar.className = 'viewer-toolbar';
    const zoom = document.createElement('button'); zoom.type = 'button'; zoom.textContent = '查看原尺寸'; zoom.setAttribute('aria-pressed','false');
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭图片 ×';
    const viewport = document.createElement('div'); viewport.className = 'viewer-viewport';
    const preview = document.createElement('img');
    const caption = document.createElement('p'); caption.className = 'viewer-caption'; caption.setAttribute('role','status');
    viewport.append(preview); toolbar.append(zoom, close); dialog.append(toolbar, viewport, caption); document.body.append(dialog);
    let opener, previousOverflow = '';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      preview.removeAttribute('src'); opener?.focus();
    });
    zoom.addEventListener('click', () => {
      const expanded = zoom.getAttribute('aria-pressed') !== 'true';
      zoom.setAttribute('aria-pressed',String(expanded)); zoom.textContent = expanded ? '适应屏幕' : '查看原尺寸';
      viewport.classList.toggle('original-size',expanded);
    });
    preview.addEventListener('error', () => { caption.textContent = '图片暂时无法加载，可以关闭后重试。'; });
    for (const img of images) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'article-image-open';
      button.setAttribute('aria-label', `放大图片：${img.alt || '正文配图'}`);
      button.setAttribute('aria-haspopup','dialog'); button.title = '点击放大图片';
      const element = img.parentElement.tagName === 'PICTURE' ? img.parentElement : img;
      element.before(button); button.append(element);
      button.addEventListener('click', () => {
        opener = button; previousOverflow = document.body.style.overflow;
        viewport.classList.remove('original-size'); zoom.setAttribute('aria-pressed','false'); zoom.textContent = '查看原尺寸';
        caption.textContent = img.alt || '正文配图'; preview.alt = img.alt;
        preview.src = img.currentSrc || img.src;
        dialog.showModal(); document.body.style.overflow = 'hidden'; close.focus();
        viewport.scrollTop = 0; viewport.scrollLeft = 0;
      });
    }
  }
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
