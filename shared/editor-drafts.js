/* A single atomic write protects the draft library; old keys remain as backup. */
(() => {
  const key = 'mx-writing-drafts-v1';
  let raw;
  let library = {version:1,active:null,items:[]};
  let failure = '';
  try {
    raw = localStorage.getItem(key);
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (data?.version !== 1 || !Array.isArray(data.items) || data.items.some(x => !x || typeof x.id !== 'string' || typeof x.body !== 'string' || !x.meta || typeof x.meta !== 'object') || new Set(data.items.map(x=>x.id)).size !== data.items.length) throw Error();
      library = data;
    } else {
      const body = localStorage.getItem('markdown-draft');
      if (body !== null) {
        let meta = {};
        try { meta = JSON.parse(localStorage.getItem('mx-writing-meta')) || {}; } catch {}
        library.items = [{id:'legacy',body,meta,updatedAt:new Date().toISOString()}];
        library.active = 'legacy';
      }
    }
  } catch { failure = '无法读取草稿库。原数据未更改，请先导出当前内容备份。'; }
  function write(next) {
    if (failure) throw Error(failure);
    try {
      if (localStorage.getItem(key) !== raw) throw Error('另一标签页修改了草稿库。请先导出当前内容，再刷新本页。');
      const value = JSON.stringify(next);
      localStorage.setItem(key,value);
      raw = value;
      library = next;
    } catch (error) {
      throw Error(error.message.includes('另一标签页') ? error.message : '浏览器无法保存草稿，请先导出 Markdown；尚未切换或删除内容。');
    }
  }
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function validateBackup(data) {
    if (data?.format !== 'mx-writing-backup' || data.version !== 1 || !Array.isArray(data.items) || data.items.length > 1000) throw Error('请选择受支持的 MX 全部草稿备份文件。');
    const ids = new Set();
    function safe(value, depth = 0) {
      if (depth > 30) throw Error('备份中的文章信息嵌套过深。');
      if (value && typeof value === 'object') for (const k of Object.keys(value)) {
        if (['__proto__','constructor','prototype'].includes(k)) throw Error('备份中含不受支持的字段。');
        safe(value[k],depth + 1);
      }
    }
    const items = data.items.map(item => {
      if (!object(item) || typeof item.id !== 'string' || !item.id || item.id.length > 200 || ids.has(item.id) || typeof item.body !== 'string' || !object(item.meta)) throw Error('备份的草稿内容或编号格式不正确。');
      ids.add(item.id); safe(item.meta);
      for (const field of ['post-title','post-tags','post-topic','post-category','post-date','work-type','work-url','work-description','work-cover']) if (item.meta[field] !== undefined && typeof item.meta[field] !== 'string') throw Error('备份的文章信息格式不正确。');
      const category = item.meta['post-category'];
      if (category && !Object.hasOwn(window.MXContent.folders,category)) throw Error('备份中有无法识别的栏目。');
      if (item.meta.__imported != null && !object(item.meta.__imported)) throw Error('备份中的原始文章信息格式不正确。');
      const record = item.meta.__record;
      if (record != null && (!object(record) || !Object.hasOwn(window.MXContent.folders,record.category) || typeof record.path !== 'string' || !record.path.startsWith(window.MXContent.folders[record.category] + '/') || !/\.md$/i.test(record.path) || record.path.split('/').some(part => ['', '.', '..'].includes(part)) || typeof record.sha !== 'string' || !object(record.metadata))) throw Error('备份中的原文章关联信息不正确。');
      return {id:item.id,body:item.body,meta:item.meta,updatedAt:typeof item.updatedAt === 'string' ? item.updatedAt : '',...(item.restoredCopy ? {restoredCopy:true} : {})};
    });
    return {items,active:ids.has(data.active) ? data.active : null};
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
    return value;
  }
  function merge(items, incoming) {
    const result = [...items], ids = new Set(items.map(x=>x.id));
    const fingerprint = x => JSON.stringify([x.body,canonical(x.meta)]);
    const seen = new Set(items.map(fingerprint));
    let duplicates = 0, conflicts = 0;
    for (const item of incoming) {
      const hash = fingerprint(item);
      if (seen.has(hash)) { duplicates++; continue; }
      const collision = ids.has(item.id);
      let id = item.id;
      while (ids.has(id)) id = crypto.randomUUID();
      result.push({...item,id,...(collision ? {restoredCopy:true} : {})});
      conflicts += Number(collision); ids.add(id); seen.add(hash);
    }
    return {items:result,duplicates,conflicts,added:result.length-items.length};
  }
  window.MXDrafts = {
    state: () => library,
    error: () => failure,
    validateBackup,
    backup(current) {
      if (failure) throw Error(failure);
      // Include an unsaved editing copy without replacing the last saved version.
      const items = current ? merge(library.items,[current]).items : library.items;
      if (items.length > 1000) throw Error('草稿数量超过单份备份上限（1000 篇），请先分别导出部分文章。');
      return JSON.stringify({format:'mx-writing-backup',version:1,exportedAt:new Date().toISOString(),active:library.active,items},null,2);
    },
    restore(incoming) {
      const result = merge(library.items,incoming.items);
      const active = library.active || (result.items.some(x=>x.id === incoming.active) ? incoming.active : result.items[0]?.id || null);
      write({...library,active,items:result.items});
      return result;
    },
    save(draft) {
      const item = {...library.items.find(x=>x.id === draft.id),...draft,updatedAt:new Date().toISOString()};
      write({...library,active:item.id,items:[item,...library.items.filter(x=>x.id !== item.id)]});
    },
    select(id) { write({...library,active:id}); },
    remove(id) { write({...library,active:null,items:library.items.filter(x=>x.id !== id)}); },
    id: () => crypto.randomUUID()
  };
})();
