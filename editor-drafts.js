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
  window.MXDrafts = {
    state: () => library,
    error: () => failure,
    save(draft) {
      const item = {...draft,updatedAt:new Date().toISOString()};
      write({...library,active:item.id,items:[item,...library.items.filter(x=>x.id !== item.id)]});
    },
    select(id) { write({...library,active:id}); },
    remove(id) { write({...library,active:null,items:library.items.filter(x=>x.id !== id)}); },
    id: () => crypto.randomUUID()
  };
})();
