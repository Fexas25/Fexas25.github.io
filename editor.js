(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const folders = {blog:'_posts','competitive-programming':'_cp',projects:'_projects','game-jam':'_gamejam',art:'_art'};
  const repository = 'https://github.com/Fexas25/Fexas25.github.io';
  let publishRevision = 0;
  let currentRecord = null;
  const imagePreviews = new Map();
  function invalidatePublish() {
    publishRevision++;
    $('github-result').hidden=true;
    $('image-upload-status').textContent='';
    $('publish-panel').hidden = true;
    $('publish-source').value = '';
  }
  const ids = ['post-visibility','post-title','post-tags','post-topic','post-category','post-date','work-type','work-url','work-description','work-cover'];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const isWork = () => ['projects','game-jam','art'].includes($('post-category').value);
  function updateFields() {
    $('work-fields').hidden = !isWork();
    $('blog-topic-field').hidden = $('post-category').value !== 'competitive-programming';
    $('post-category').disabled = Boolean(currentRecord);
    $('post-visibility').disabled = Boolean(currentRecord?.privateId&&!currentRecord?.documentId);
    const privateMode=$('post-visibility').value==='private';
    $('private-note').hidden = !privateMode;
    const help=privateMode?'私密图片 · 嵌入正文，单张最多 512 KB':'公开图片 · 单张最多 5 MB';
    if($('image-upload-help').textContent!==help){$('image-upload-help').textContent=help;$('image-upload-status').textContent='';}
    $('prepare-publish').disabled = $('post-visibility').value === 'private';
    $('editing-status').textContent = currentRecord ? `正在修改：${currentRecord.path}（保留原文件名）` : '正在新建内容';
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
    if (window.marked?.parse && window.DOMPurify?.sanitize) {
      const fragment = window.DOMPurify.sanitize(window.marked.parse(value), {FORBID_TAGS:['form','input','button','style'],FORBID_ATTR:['style'],RETURN_DOM_FRAGMENT:true});
      fragment.querySelectorAll('img').forEach(img => {
        const path = img.getAttribute('src');
        if (/^\/picture\/uploads\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(path)) {
          // The repository is ready before Pages finishes deploying the image.
          img.src = imagePreviews.get(path) || 'https://raw.githubusercontent.com/Fexas25/Fexas25.github.io/main' + path;
        }
      });
      output.replaceChildren(fragment);
    }
    else output.textContent = value;
  }
  let activeDraft = null;
  let importedMetadata = null;
  let dirty = false;
  const drafts = window.MXDrafts;
  function draftStatus(message) {
    for(const id of ['draft-status','draft-library-status'])if($(id).textContent!==message)$(id).textContent=message;
  }
  const categoryNames = {blog:'碎碎念','competitive-programming':'博客',projects:'作品 · 项目 / AI 工作流','game-jam':'作品 · 游戏开发',art:'作品 · 绘画创作'};
  const timeFormatter = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const editTime = item => typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? Date.parse(item.updatedAt) : 0;
  const timeLabel = item => editTime(item) ? timeFormatter.format(new Date(item.updatedAt)) : '暂无编辑时间';
  function selectionInfo() {
    const item = drafts.state().items.find(item => item.id === $('draft-select').value);
    $('draft-selection-info').textContent = item ? `${item.meta['post-title'] || '未命名草稿'} · ${categoryNames[item.meta['post-category']] || '碎碎念'} · 最近编辑：${timeLabel(item)}${item.id === activeDraft ? ' · 正在写' : ''}` : '';
  }
  function refreshLibrary(preferActive = false) {
    const select = $('draft-select');
    const selected = select.value;
    const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase();
    const query = normalize($('draft-search').value.trim());
    const category = $('draft-category-filter').value;
    const all = drafts.state().items;
    const items = all.filter(item => (!category || (item.meta['post-category'] || 'blog') === category) && normalize(item.meta['post-title'] || '未命名草稿').includes(query)).slice().sort((a,b) => editTime(b) - editTime(a));
    select.replaceChildren();
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.meta['post-title'] || '未命名草稿'}${item.restoredCopy ? '（恢复副本）' : ''} · ${timeLabel(item)}${item.id === activeDraft ? '（正在写）' : ''}`;
      select.append(option);
    }
    if (!items.length) select.append(new Option(all.length ? '没有符合条件的草稿' : '还没有草稿',''));
    const candidates = preferActive ? [activeDraft,selected] : [selected,activeDraft];
    select.value = candidates.find(id => items.some(item => item.id === id)) || items[0]?.id || '';
    select.disabled = !items.length;
    $('draft-open').disabled = !items.length;
    $('draft-find').querySelector('summary').textContent = query || category ? '查找草稿 · 已筛选' : '查找草稿';
    $('draft-filter-status').textContent = `显示 ${items.length} / ${all.length} 篇草稿。${all.length && !items.length ? '换个标题或清除筛选试试。' : ''}${activeDraft && !items.some(item => item.id === activeDraft) ? '正在编辑的草稿不在当前筛选结果中，内容仍保留在下方。' : ''}`;
    selectionInfo();
    window.dispatchEvent(new Event('mx-editor-change'));
  }
  function saveDraft() {
    $('export-status').hidden = true;
    invalidatePublish();
    const id = activeDraft || drafts.id();
    try {
      drafts.save({id,body:$('markdown-input').value,meta:{...Object.fromEntries(ids.map(id => [id,$(id).value])),__record:currentRecord,__imported:importedMetadata}});
      activeDraft = id; dirty = false;
      refreshLibrary();
      draftStatus('当前草稿已自动保存到此浏览器。');
      return true;
    } catch (error) { dirty = true; draftStatus(error.message); return false; }
  }
  function showDraft(item) {
    const meta = item.meta;
    currentRecord = meta.__record && typeof meta.__record.path === 'string' && typeof meta.__record.sha === 'string' && meta.__record.metadata ? meta.__record : null;
    importedMetadata = meta.__imported || null;
    ids.forEach(id => $(id).value = typeof meta[id] === 'string' ? meta[id] : '');
    if (typeof meta['post-tags'] !== 'string') $('post-tags').value = window.MXContent.tags(currentRecord?.metadata.tags || importedMetadata?.tags).join(', ');
    if (currentRecord) $('post-category').value = currentRecord.category;
    if (!['private','public'].includes($('post-visibility').value)) $('post-visibility').value = 'public';
    if (currentRecord?.privateId) $('post-visibility').value = 'private';
    if (!folders[$('post-category').value]) $('post-category').value = 'blog';
    if (!$('post-date').value) $('post-date').value = today();
    if (!$('post-topic').value) $('post-topic').value = window.MXContent.topic(currentRecord?.metadata || importedMetadata || {});
    if (!$('work-type').value) $('work-type').value = 'creative';
    $('markdown-input').value = item.body;
    activeDraft = item.id; dirty = false;
    invalidatePublish(); updateFields(); preview(); refreshLibrary(true);
  }
  function restoreDraft() {
    const item = drafts.state().items.find(x=>x.id === activeDraft || (!activeDraft && x.id === drafts.state().active)) || drafts.state().items[0];
    if (item) showDraft(item);
    else refreshLibrary();
    draftStatus(drafts.error() || (item ? '已恢复上次编辑的草稿。' : '开始写作后，会自动保存草稿。'));
  }
  function preserveCurrent() {
    if (activeDraft && !dirty) return true;
    return !(activeDraft || ids.some(id=>!['post-visibility','post-category','post-date','post-topic','work-type'].includes(id) && $(id).value) || $('markdown-input').value) || saveDraft();
  }
  function blankDocument() {
    dirty = false;
    activeDraft = null; currentRecord = null; importedMetadata = null;
    ['post-title','post-tags','post-topic','markdown-input','work-url','work-description','work-cover'].forEach(id => $(id).value = '');
    $('post-visibility').value = 'public';
    $('post-date').value = today(); $('work-type').value = 'creative'; $('post-topic').value = 'notes';
    invalidatePublish(); updateFields(); preview(); refreshLibrary();
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
    if (category === 'competitive-programming') lines.push(`topic: ${$('post-topic').value || 'notes'}`);
    lines.push(`tags: ${JSON.stringify(window.MXContent.tags($('post-tags').value))}`);
    if (isWork()) {
      lines.push(`type: ${$('work-type').value}`);
      for (const [key,value] of [['external_url',link],['description',$('work-description').value.trim()],['cover',cover]]) if(value) lines.push(`${key}: ${JSON.stringify(value)}`);
    }
    if ($('post-visibility').value === 'private' || currentRecord?.privateId) lines.push('private: true');
    lines.push('---','',body,'');
    const file = {folder:folders[category],filename:`${category === 'blog' ? date+'-' : ''}${slugify(title)}.md`,text:lines.join('\n')};
    const record = currentRecord || (importedMetadata ? {path:`${file.folder}/${file.filename}`,category,metadata:importedMetadata,sha:''} : null);
    return window.MXContent.update(file,record);
  }
  function showPublish(file, message) {
    if($('post-visibility').value==='private'||currentRecord?.privateId){$('publish-panel').hidden=true;return;}
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
    if ($('post-visibility').value === 'private' || currentRecord?.privateId) { status.hidden=false; status.textContent='私密内容请使用密钥发布，不能复制到公开仓库。'; return; }
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
  if (!activeDraft && folders[category]) $('post-category').value = category;
  updateFields(); preview();
  ids.forEach(id => $(id).addEventListener('input', () => { updateFields(); saveDraft(); }));
  $('markdown-input').addEventListener('input', () => { preview(); saveDraft(); });
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => format(button.dataset.format)));
  $('restore-draft').addEventListener('click', restoreDraft);
  $('draft-open').addEventListener('click', () => {
    const id = $('draft-select').value;
    if (!id || id === activeDraft || !preserveCurrent()) return;
    try {
      drafts.select(id);
      showDraft(drafts.state().items.find(x=>x.id === id));
      draftStatus('已切换草稿，可以继续写。');
    } catch (error) { draftStatus(error.message); }
  });
  $('draft-new').addEventListener('click', () => window.MXEditor.newDocument());
  let draftComposing = false;
  $('draft-search').addEventListener('compositionstart', () => { draftComposing = true; });
  $('draft-search').addEventListener('compositionend', () => { draftComposing = false; refreshLibrary(); });
  $('draft-search').addEventListener('input', event => { if (!draftComposing && !event.isComposing) refreshLibrary(); });
  $('draft-category-filter').addEventListener('change', () => refreshLibrary());
  $('draft-select').addEventListener('change', selectionInfo);
  $('draft-filter-clear').addEventListener('click', () => {
    $('draft-search').value = ''; $('draft-category-filter').value = ''; refreshLibrary(); $('draft-search').focus();
  });
  $('draft-backup-export').addEventListener('click', () => {
    try {
      const saved = preserveCurrent();
      const snapshot = {id:activeDraft || drafts.id(),body:$('markdown-input').value,meta:{...Object.fromEntries(ids.map(id=>[id,$(id).value])),__record:currentRecord,__imported:importedMetadata},updatedAt:new Date().toISOString()};
      const text = drafts.backup(saved ? null : snapshot);
      const blob = new Blob([text],{type:'application/json;charset=utf-8'});
      if (blob.size > 20 * 1024 * 1024) throw Error('备份超过 20 MB，请分别导出部分文章后重试。');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `mx-writing-backup-${today()}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('draft-backup-status').textContent = `已生成 ${JSON.parse(text).items.length} 篇草稿的备份，请保存下载的 JSON 文件。${saved ? '' : '当前未保存内容也已作为副本收入备份。'}`;
    } catch (error) { $('draft-backup-status').textContent = error.message; }
  });
  $('draft-backup-import').addEventListener('click',()=>$('draft-backup-file').click());
  $('draft-backup-file').addEventListener('change',async () => {
    const file = $('draft-backup-file').files[0];
    if (!file) return;
    $('draft-backup-import').disabled = true;
    try {
      if (file.size > 20 * 1024 * 1024) throw Error('请选择小于 20 MB 的全部草稿备份。');
      let data;
      try { data = JSON.parse(await file.text()); } catch { throw Error('无法读取此 JSON 文件，请选择“备份全部草稿”生成的文件。'); }
      const incoming = drafts.validateBackup(data);
      if (!preserveCurrent()) throw Error('当前草稿无法保存，尚未恢复备份。请先备份全部草稿或导出当前 Markdown。');
      const result = drafts.restore(incoming);
      if (!activeDraft && drafts.state().active) showDraft(drafts.state().items.find(x=>x.id === drafts.state().active));
      else refreshLibrary();
      $('draft-backup-status').textContent = `恢复完成：新增 ${result.added} 篇，跳过 ${result.duplicates} 篇相同内容，${result.conflicts} 篇另存为恢复副本。原草稿已保留。`;
    } catch (error) { $('draft-backup-status').textContent = error.message; }
    finally { $('draft-backup-import').disabled = false; $('draft-backup-file').value = ''; }
  });
  $('markdown-import').addEventListener('click', () => $('markdown-file').click());
  $('markdown-file').addEventListener('change', async () => {
    const file = $('markdown-file').files[0];
    if (!file) return;
    $('markdown-import').disabled = true;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('请选择小于 2 MB 的 Markdown 文件。');
      if (!/\.(md|markdown|mdown)$/i.test(file.name)) throw Error('请选择 .md、.markdown 或 .mdown 文件。');
      const parsed = window.MXContent.importMarkdown(await file.text(),file.name,$('post-category').value);
      if (!preserveCurrent()) throw Error('当前内容尚未保存，请先导出备份，再导入。');
      const meta = {'post-visibility':parsed.metadata.private===true?'private':'public','post-topic':window.MXContent.topic(parsed.metadata),'post-tags':window.MXContent.tags(parsed.metadata.tags).join(', '),'post-title':parsed.title,'post-category':parsed.category,'post-date':parsed.date || today(),'work-type':parsed.metadata.type || 'creative','work-url':parsed.metadata.external_url || '','work-description':parsed.metadata.description || '','work-cover':parsed.metadata.cover || '',__imported:parsed.metadata};
      const item = {id:drafts.id(),body:parsed.body,meta};
      drafts.save(item);
      showDraft(item);
      draftStatus(`已将 ${file.name} 导入为新草稿，原草稿已保留。`);
    } catch (error) { $('draft-library-status').textContent = error.message; }
    finally { $('markdown-import').disabled = false; $('markdown-file').value = ''; }
  });
  $('clear-editor').addEventListener('click', () => {
    if (!window.confirm('删除当前这一篇草稿？其他草稿和网站文章不受影响。')) return;
    try {
      if (activeDraft) drafts.remove(activeDraft);
      blankDocument();
      draftStatus('当前草稿已删除，其他草稿已保留。');
    } catch (error) { draftStatus(error.message); }
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
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
      status.textContent = $('post-visibility').value==='private'||currentRecord?.privateId ? `已导出本地私密副本 ${file.filename}，请妥善保存，不要上传公开仓库。` : `已导出 ${file.filename}。发布步骤和对应文件夹入口在下方。`;
    } catch(error) { status.textContent = error.message; }
  });
  window.MXEditor = {
    draftId: () => activeDraft,
    privateRevision(sha) { if(currentRecord?.privateId){currentRecord.sha=sha;saveDraft();} },
    imageTarget() {
      const input = $('markdown-input');
      return {draft:activeDraft, body:input.value, start:input.selectionStart, end:input.selectionEnd};
    },
    insertImage(path, file, target) {
      const input = $('markdown-input');
      if (target.draft !== activeDraft || target.body !== input.value) throw Error('当前草稿已改变，图片已上传。请重新选择原图插入，不会重复上传。');
      if (imagePreviews.has(path)) URL.revokeObjectURL(imagePreviews.get(path));
      imagePreviews.set(path, URL.createObjectURL(file));
      if (imagePreviews.size > 30) {
        const oldest = imagePreviews.keys().next().value;
        URL.revokeObjectURL(imagePreviews.get(oldest)); imagePreviews.delete(oldest);
      }
      input.setRangeText(`\n\n![图片](${path})\n\n`, target.start, target.end, 'end');
      preview(); saveDraft();
    },
    exportDocument,
    record: () => currentRecord,
    hasContent: () => Boolean($('post-title').value.trim() || $('markdown-input').value.trim() || $('work-url').value.trim()),
    load(record) {
      if (!preserveCurrent()) throw Error('当前草稿未保存，请先导出备份。');
      activeDraft = null; importedMetadata = null;
      const meta = record.metadata;
      currentRecord = record;
      $('post-category').value = record.category;
      $('post-visibility').value = record.visibility || (record.privateId ? 'private' : 'public');
      $('post-title').value = String(meta.title || '');
      $('post-tags').value = window.MXContent.tags(meta.tags).join(', ');
      $('post-topic').value = window.MXContent.topic(meta);
      $('post-date').value = String(meta.date || record.path.match(/\d{4}-\d{2}-\d{2}/)?.[0] || today()).slice(0,10);
      $('work-type').value = ['creative','game','ai'].includes(meta.type) ? meta.type : 'creative';
      for (const [id,key] of [['work-url','external_url'],['work-description','description'],['work-cover','cover']]) $(id).value = String(meta[key] || '');
      $('markdown-input').value = record.body;
      updateFields(); preview(); saveDraft();
    },
    newDocument() {
      if (!preserveCurrent()) return;
      const item = {id:drafts.id(),body:'',meta:{'post-category':$('post-category').value,'post-date':today(),'work-type':'creative'}};
      try { drafts.save(item); showDraft(item); draftStatus('已新建草稿，上一篇已保留。'); }
      catch (error) { draftStatus(error.message); }
    },
    committed(file, sha, privateId, documentId, visibility) {
      currentRecord = window.MXContent.parse(file.text, `${file.folder}/${file.filename}`, sha);
      if (privateId) currentRecord.privateId = privateId;
        if(documentId){currentRecord.documentId=documentId;currentRecord.visibility=visibility;}
      updateFields(); saveDraft();
    }
  };
})();
