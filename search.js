/* Build-generated local index; no visitor queries are sent to a search service. */
(() => {
  'use strict';
  const root = document.querySelector('[data-site-search]');
  if (!root) return;
  const form = root.querySelector('form'), status = root.querySelector('[data-search-status]');
  const results = root.querySelector('[data-search-results]'), fallback = root.querySelector('[data-search-fallback]');
  const more = root.querySelector('.search-more'), retry = root.querySelector('.search-retry');
  const fields = Object.fromEntries(['q','category','year','tag'].map(key => [key, form.elements.namedItem(key)]));
  const labels = {moments:'碎碎念',writing:'博客',works:'作品',pages:'其他页面'};
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
  let entries = [], limit = 20, timer, composing = false;
  // Map normalized matches back to original text (e.g. full-width letters and ligatures).
  function ranges(text, words) {
    let normalized = '', offsets = [], offset = 0;
    for (const character of text) {
      const value = normalize(character);
      for (let i = 0; i < value.length; i++) offsets.push([offset, offset + character.length]);
      normalized += value; offset += character.length;
    }
    const found = [];
    for (const word of words) {
      let start = normalized.indexOf(word);
      while (start !== -1) {
        found.push([offsets[start][0], offsets[start + word.length - 1][1]]);
        start = normalized.indexOf(word, start + word.length);
      }
    }
    const merged = [];
    for (const range of found.sort((a,b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    return merged;
  }
  function highlight(element, text, words) {
    let offset = 0;
    for (const [start, end] of ranges(text, words)) {
      element.append(document.createTextNode(text.slice(offset, start)), make('mark', text.slice(start, end)));
      offset = end;
    }
    element.append(document.createTextNode(text.slice(offset)));
    return element;
  }
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function readURL() {
    const params = new URLSearchParams(location.search);
    const shown = Number(params.get('shown'));
    limit = Number.isSafeInteger(shown) && shown > 20 ? Math.min(shown, Math.max(20, entries.length)) : 20;
    for (const [key, field] of Object.entries(fields)) {
      const value = params.get(key) || '';
      // Keep unknown shared filters visible, with an honest empty result.
      field.querySelectorAll('[data-unknown]').forEach(option => option.remove());
      if (key !== 'q' && value && ![...field.options].some(option => option.value === value)) {
        const option = new Option(value, value); option.dataset.unknown = ''; field.add(option);
      }
      field.value = key === 'q' ? value.slice(0,200) : value;
    }
  }
  function render(syncURL = true) {
    clearTimeout(timer);
    const state = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
    const words = normalize(state.q).split(/\s+/).filter(Boolean);
    if (syncURL) {
      const url = new URL(location.href); url.search = '';
      for (const [key, value] of Object.entries(state)) if (value) url.searchParams.set(key, value);
      if (limit > 20) url.searchParams.set('shown', String(limit));
      history.replaceState(null, '', url);
    }
    const matches = entries.filter(entry => (!state.category || entry.category === state.category) &&
      (!state.year || entry.date.slice(0,4) === state.year) && (!state.tag || entry.tags.includes(state.tag)) &&
      words.every(word => entry.searchText.includes(word)));
    results.replaceChildren();
    status.textContent = matches.length ? `找到 ${matches.length} 项，显示 ${Math.min(limit, matches.length)} 项` : '没有找到符合条件的内容，试试更短的关键词或清除筛选。';
    let currentYear, list;
    for (const entry of matches.slice(0, limit)) {
      const year = entry.date.slice(0,4) || '其他记录';
      if (year !== currentYear) {
        const group = make('section', null, 'search-year');
        group.append(make('h2', year, 'month-marker'));
        list = make('div'); group.append(list); results.append(group); currentYear = year;
      }
      const card = make('article', null, 'entry-card'), meta = make('div', null, 'entry-meta');
      meta.append(make('span', labels[entry.category] || '作品'));
      if(entry.privateId)meta.append(make('span','需要密钥'));
      if (entry.date) { const time = make('time', entry.date.replaceAll('-','.')); time.dateTime = entry.date; meta.append(time); }
      const link = make('a', null, 'entry-link'); link.href = entry.url;
      link.append(highlight(make('h3'), entry.title, words));
      const position = ranges(entry.content, words)[0]?.[0] || 0;
      const start = Math.max(0, position - 35), excerpt = entry.content.slice(start, start + 150);
      link.append(highlight(make('p'), (start ? '…' : '') + excerpt + (entry.content.length > start + 150 ? '…' : ''), words));
      card.append(meta, link);
      if (entry.tags.length) {
        const tags = make('div', null, 'entry-tags');
        for (const value of entry.tags) {
          const a = make('a', '# ' + value), url = new URL(location.href);
          url.searchParams.delete('shown');
          url.searchParams.set('tag',value); a.href = url.pathname + url.search;
          a.addEventListener('click', event => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); fields.tag.value = value; limit = 20; render(); fields.tag.focus();
          }); tags.append(a);
        }
        card.append(tags);
      }
      list.append(card);
    }
    more.hidden = matches.length <= limit;
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (composing) return; limit = 20; render(); });
  const scheduleSearch = () => { clearTimeout(timer); timer = setTimeout(() => { limit = 20; render(); }, 120); };
  // Keep the pressed link in the DOM until the browser dispatches its click.
  let pressingResult = false;
  results.addEventListener('pointerdown', () => { pressingResult = true; clearTimeout(timer); });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, () => {
    if (!pressingResult) return;
    pressingResult = false;
    if (!composing) scheduleSearch();
  });
  fields.q.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
  fields.q.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
  fields.q.addEventListener('input', event => { if (!composing && !event.isComposing) scheduleSearch(); });
  for (const key of ['category','year','tag']) fields[key].addEventListener('change', () => { limit = 20; render(); });
  root.querySelector('.filter-reset').addEventListener('click', () => {
    for (const field of Object.values(fields)) field.value = '';
    limit = 20; render(); fields.q.focus();
  });
  more.addEventListener('click', () => {
    const previous = results.querySelectorAll('.entry-card').length;
    limit += 20; render(); results.querySelectorAll('.entry-link')[previous]?.focus();
  });
  window.addEventListener('popstate', () => { readURL(); if (entries.length) render(false); });
  async function load() {
    retry.hidden = true; status.textContent = '正在准备搜索…';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(root.dataset.indexUrl, {signal:controller.signal});
      if (!response.ok) throw Error('index unavailable');
      let data = await response.json();
      if (!Array.isArray(data)) throw Error('invalid index');
      data=data.filter(entry=>!entry.backendId);
      let catalogFailed=false;
      const catalogOrigin=window.MX_DOCUMENTS_ORIGIN||window.MX_COMMUNITY?.origin;
      if(catalogOrigin){
        try {
          const response=await fetch(catalogOrigin+'/documents',{cache:'no-store',signal:AbortSignal.timeout(5000)});
          if(!response.ok)throw Error('catalog');
          const {documents}=await response.json();
          for(const doc of documents){
            if(!/^[a-f0-9-]{36}$/.test(doc.id)||typeof doc.title!=='string')continue;
            const existing=data.find(entry=>entry.backendId===doc.id);
            const entry={title:doc.title,url:doc.readingUrl||doc.url,privateId:doc.visibility==='private'?doc.id:'',backendId:doc.id,content:doc.visibility==='private'?'':doc.content||'',tags:doc.tags||[],date:doc.date||'',category:doc.folder==='_posts'?'moments':doc.folder==='_cp'?'writing':'works'};
            if(existing)Object.assign(existing,entry);else data.push(entry);
          }
        }catch {catalogFailed=true;}
      }
      entries = data.map(entry => {
        const url = new URL(entry.url, location.origin);
        const backendLink=entry.backendId&&url.origin==='https://mx-community.liuwanting830.workers.dev'&&url.pathname==='/read/'+entry.backendId;
        if ((!backendLink&&url.origin !== location.origin) || !['http:','https:'].includes(url.protocol) || typeof entry.title !== 'string' || typeof entry.content !== 'string') throw Error('invalid entry');
        const tags = Array.isArray(entry.tags) ? entry.tags.filter(tag => typeof tag === 'string') : [];
        return {...entry, date:entry.date || '', tags, url:backendLink?url.href:url.pathname + url.search + url.hash, searchText:normalize([entry.title,entry.content,...tags].join(' '))};
      }).sort((a,b) => b.date.localeCompare(a.date));
      for (const [key, values] of [['year', entries.map(entry => entry.date.slice(0,4)).filter(Boolean).sort().reverse()], ['tag', entries.flatMap(entry => entry.tags).sort()]]) {
        for (const value of new Set(values)) if(![...fields[key].options].some(o=>o.value===value))fields[key].add(new Option(value, value));
      }
      const shown=Number(new URLSearchParams(location.search).get('shown'));if(Number.isSafeInteger(shown)&&shown>20)limit=Math.min(shown,Math.max(20,entries.length));
      render(false); if(catalogFailed){status.textContent+=' · 最新内容目录暂未加载，可重试';retry.hidden=false;} form.hidden = false; results.hidden = false; fallback.hidden = true;
    } catch {
      status.textContent = '搜索暂时没加载好，请稍后重试。'; retry.hidden = false;
    } finally { clearTimeout(timeout); }
  }
  retry.addEventListener('click', load);
  readURL(); load();
})();
