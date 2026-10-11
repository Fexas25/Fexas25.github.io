(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const folders = {blog:'_posts','competitive-programming':'_cp',projects:'_projects','game-jam':'_gamejam',art:'_art'};
  const repository = 'https://github.com/Fexas25/Fexas25.github.io';
  let publishRevision = 0;
  function invalidatePublish() {
    publishRevision++;
    $('publish-panel').hidden = true;
    $('publish-source').value = '';
  }
  const ids = ['post-title','post-category','post-date','work-type','work-url','work-description','work-cover'];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const isWork = () => ['projects','game-jam','art'].includes($('post-category').value);
  function updateFields() {
    $('work-fields').hidden = !isWork();
    const category = $('post-category').value;
    $('manage-category').href = `${repository}/tree/main/${folders[category] || '_posts'}`;
    $('work-type').disabled = category !== 'projects';
    if (category === 'game-jam') $('work-type').value = 'game';
    if (category === 'art') $('work-type').value = 'creative';
  }
  function preview() {
    const value = $('markdown-input').value;
    $('word-count').textContent = `${value.replace(/\s/g,'').length} 字`;
    const output = $('preview-content');
    if (!value.trim()) { output.textContent = '写点什么，预览就会出现在这里。'; return; }
    if (window.marked?.parse && window.DOMPurify?.sanitize) output.innerHTML = window.DOMPurify.sanitize(window.marked.parse(value), {FORBID_TAGS:['form','input','button','style'],FORBID_ATTR:['style']});
    else output.textContent = value;
  }
  function saveDraft() {
    $('export-status').hidden = true;
    invalidatePublish();
    try {
      localStorage.setItem('markdown-draft', $('markdown-input').value);
      localStorage.setItem('mx-writing-meta', JSON.stringify(Object.fromEntries(ids.map(id => [id,$(id).value]))));
      $('draft-status').textContent = '草稿已保存到当前浏览器。';
    } catch { $('draft-status').textContent = '浏览器无法保存草稿，请及时导出 Markdown。'; }
  }
  function restoreDraft() {
    invalidatePublish();
    $('export-status').hidden = true;
    try {
      const body = localStorage.getItem('markdown-draft');
      if (body === null) { $('draft-status').textContent = '还没有保存的草稿。'; return; }
      $('markdown-input').value = body;
      try {
        const meta = JSON.parse(localStorage.getItem('mx-writing-meta'));
        if (meta && typeof meta === 'object') ids.forEach(id => { if(typeof meta[id] === 'string') $(id).value = meta[id]; });
      } catch { /* Legacy text-only drafts can still be restored. */ }
      if (!folders[$('post-category').value]) $('post-category').value = 'blog';
      if (!$('post-date').value) $('post-date').value = today();
      updateFields(); preview();
      $('draft-status').textContent = '已恢复草稿。';
    } catch { $('draft-status').textContent = '浏览器无法读取草稿。'; }
  }
  function slugify(title) { return title.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'') || 'note'; }
  function validAddress(value) {
    if (!value) return true;
    if (value.startsWith('/') && !value.startsWith('//') && !/[\s\\]/.test(value)) return true;
    try { const url = new URL(value); return ['http:','https:'].includes(url.protocol); } catch { return false; }
  }
  function exportDocument() {
    const title = $('post-title').value.trim(), category = $('post-category').value;
    const date = $('post-date').value, body = $('markdown-input').value.trim();
    const link = $('work-url').value.trim(), cover = $('work-cover').value.trim();
    if (!title || !folders[category] || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (!body && !(isWork() && link))) throw Error('请填写标题、日期和内容；作品也可以只填写链接。');
    if (isWork() && (!validAddress(link) || !validAddress(cover))) throw Error('作品和封面地址请使用 http(s) 链接，或以 / 开头的站内路径。');
    const lines = ['---',`title: ${JSON.stringify(title)}`,`date: ${date}`,`category: ${category}`];
    if (isWork()) {
      lines.push(`type: ${$('work-type').value}`);
      for (const [key,value] of [['external_url',link],['description',$('work-description').value.trim()],['cover',cover]]) if(value) lines.push(`${key}: ${JSON.stringify(value)}`);
    }
    lines.push('---','',body,'');
    return {folder:folders[category],filename:`${category === 'blog' ? date+'-' : ''}${slugify(title)}.md`,text:lines.join('\n')};
  }
  function showPublish(file, message) {
    $('publish-panel').hidden = false;
    $('publish-status').textContent = message;
    $('publish-path').textContent = `${file.folder}/${file.filename}`;
    $('publish-new').href = `${repository}/new/main/${file.folder}?filename=${encodeURIComponent(file.filename)}`;
    $('publish-upload').href = `${repository}/upload/main/${file.folder}`;
    $('manual-copy').hidden = true;
    $('publish-source').value = file.text;
  }
  $('prepare-publish').addEventListener('click', async () => {
    const status = $('export-status'); status.hidden = true;
    if (!$('writing-form').reportValidity()) return;
    try {
      const file = exportDocument(), revision = ++publishRevision;
      showPublish(file, '正在复制完整发布内容…');
      try {
        await navigator.clipboard.writeText(file.text);
        if (revision !== publishRevision) return;
        $('publish-status').textContent = '完整内容已复制。点击下方按钮，在 GitHub 正文编辑区粘贴即可；此时还没有发布。';
      } catch {
        if (revision !== publishRevision) return;
        $('publish-status').textContent = '浏览器未能自动复制。请先在下面的文本框中全选并复制，再打开 GitHub。';
        $('manual-copy').hidden = false;
        $('publish-source').focus(); $('publish-source').select();
      }
    } catch (error) { invalidatePublish(); status.hidden = false; status.textContent = error.message; }
  });
  const formats = {bold:['**','**'],italic:['*','*'],heading:['## ',''],list:['- ',''],code:['```\n','\n```'],link:['[','](https://example.com)'],image:['![','](/picture/image.jpg)']};
  function format(kind) {
    const input = $('markdown-input'), [before,after] = formats[kind];
    const start = input.selectionStart, end = input.selectionEnd;
    input.setRangeText(before + input.value.slice(start,end) + after,start,end,'select');
    input.focus(); input.setSelectionRange(start+before.length,start+before.length+(end-start));
    preview(); saveDraft();
  }
  $('post-date').value = today();
  restoreDraft();
  const category = new URLSearchParams(window.location.search).get('category');
  if (folders[category]) $('post-category').value = category;
  updateFields(); preview();
  ids.forEach(id => $(id).addEventListener('input', () => { updateFields(); saveDraft(); }));
  $('markdown-input').addEventListener('input', () => { preview(); saveDraft(); });
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => format(button.dataset.format)));
  $('restore-draft').addEventListener('click', restoreDraft);
  $('clear-editor').addEventListener('click', () => {
    if (!window.confirm('清空当前内容及保存的草稿？')) return;
    invalidatePublish();
    $('post-title').value = ''; $('markdown-input').value = '';
    ['work-url','work-description','work-cover'].forEach(id => $(id).value = '');
    $('post-date').value = today(); preview(); $('export-status').hidden = true;
    try { localStorage.removeItem('markdown-draft');localStorage.removeItem('mx-writing-meta');$('draft-status').textContent = '草稿已清空，可以开始新的记录。'; }
    catch { $('draft-status').textContent = '当前内容已清空，浏览器中的旧草稿未能删除。'; }
  });
  $('writing-form').addEventListener('submit', event => {
    event.preventDefault();
    const status = $('export-status'); status.hidden = false;
    try {
      const file = exportDocument();
      publishRevision++;
      const url = URL.createObjectURL(new Blob([file.text],{type:'text/markdown;charset=utf-8'}));
      const a = document.createElement('a');a.href=url;a.download=file.filename;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      showPublish(file, '文件已导出。点击“上传已导出的文件”，拖入刚下载的 Markdown 文件并提交即可。');
      $('manual-copy').hidden = false;
      status.textContent = `已导出 ${file.filename}。发布步骤和对应文件夹入口在下方。`;
    } catch(error) { status.textContent = error.message; }
  });
})();
