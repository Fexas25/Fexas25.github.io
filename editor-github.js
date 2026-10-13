(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const apiRoot = 'https://api.github.com/repos/Fexas25/Fexas25.github.io';
  const labels = {blog:'碎碎念','competitive-programming':'博客',projects:'项目 / AI', 'game-jam':'游戏',art:'绘画'};
  let token = '', popup = null, channel = '', loginTimer, busy = false, listing = 0;
  let authOrigin = '', serviceReady = false;
  try {
    const url = new URL(window.MX_PUBLISH.authOrigin);
    if (url.protocol === 'https:') authOrigin = url.origin;
  } catch { /* Configuration is completed once by the site owner. */ }
  $('github-setup').hidden = Boolean(authOrigin);
  if (authOrigin) $('github-status').textContent = '正在连接发布服务…';
  if (!authOrigin) $('github-status').textContent = '文章可以打开编辑；站主完成一次性配置后，即可登录并直接发布。';
  function controls() {
    $('github-login').disabled = busy || !serviceReady;
    $('github-login').hidden = Boolean(token);
    $('github-logout').hidden = !token;
    $('github-logout').disabled = busy;
    $('github-publish').disabled = busy || !serviceReady;
    $('github-publish').textContent = busy ? '处理中…' : token ? (window.MXEditor.record() ? '保存修改' : '发布到网站') : '登录后发布';
    ['github-load','github-new','github-refresh','github-article'].forEach(id => $(id).disabled = busy);
    $('writing-form').inert = busy;
    document.querySelector('.draft-library').inert = busy;
  }
  function result(message) { $('github-result').hidden = false; $('github-result').textContent = message; }
  async function checkService() {
    if (!authOrigin) return;
    try {
      const response=await fetch(authOrigin+'/health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();serviceReady=response.ok&&data.configured===true;
      $('github-status').textContent=serviceReady?'登录后可直接发布；也可以先打开已有文章修改。':'发布服务还差一次性配置，草稿和导出可照常使用。';
      $('github-setup').hidden=serviceReady;
    } catch { $('github-status').textContent='暂时无法连接发布服务，请刷新重试。草稿和导出可照常使用。'; }
    controls();
  }
  async function api(path, options = {}) {
    const response = await fetch(apiRoot + path, {...options,cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token ? {Authorization:`Bearer ${token}`} : {}),...(options.body ? {'Content-Type':'application/json'} : {})}});
    if (!response.ok) {
      if (response.status === 401) { token = ''; controls(); }
      const messages = {401:'登录已失效，请重新登录。',403:'GitHub 拒绝访问，请检查应用是否安装到网站仓库并拥有 Contents 读写权限，或稍后再试。',404:'未找到内容，可能已被移动或删除，或应用尚未安装到网站仓库。',409:'文章已在其他地方更新。请先导出当前草稿，再重新打开最新文章合并修改。',422:'提交未成功，文件可能已存在或内容不符合要求，请刷新列表后检查。'};
      const error = new Error(messages[response.status] || `GitHub 请求失败（${response.status}），请稍后重试。`); error.status = response.status; throw error;
    }
    return response.json();
  }
  const pathURL = path => '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  function decode(content) { return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content.replace(/\s/g,'')), c => c.charCodeAt(0))); }
  function encode(content) { let binary = ''; for (const byte of new TextEncoder().encode(content)) binary += String.fromCharCode(byte); return btoa(binary); }
  async function listArticles() {
    const version = ++listing;
    try {
      const data = await api('/git/trees/main?recursive=1');
      if (version !== listing) return;
      if (data.truncated) throw Error('文章列表过大，GitHub 未返回完整列表，请暂时使用 GitHub 管理入口。');
      const select = $('github-article'), selected = select.value;
      select.replaceChildren(new Option('选择一篇已有文章…',''));
      for (const [category,folder] of Object.entries(window.MXContent.folders)) {
        const group = document.createElement('optgroup'); group.label = labels[category];
        data.tree.filter(item => item.type === 'blob' && item.path.startsWith(folder + '/') && /\.md$/i.test(item.path)).sort((a,b) => b.path.localeCompare(a.path)).forEach(item => group.appendChild(new Option(item.path.slice(folder.length+1).replace(/\.md$/i,''),item.path)));
        if (group.children.length) select.appendChild(group);
      }
      if (Array.from(select.options).some(option => option.value === selected)) select.value = selected;
      if (select.options.length === 1) select.options[0].textContent = '还没有文章，可以新建内容';
    } catch (error) { result(error.message); }
  }
  function canSwitch() { return true; } // The editor preserves the current draft before switching.
  $('github-refresh').addEventListener('click',listArticles);
  $('github-load').addEventListener('click',async () => {
    const path = $('github-article').value;
    if (!path) { result('请先选择文章。'); return; }
    if (!canSwitch()) return;
    busy = true; controls();
    try {
      const file = await api(pathURL(path) + '?ref=main');
      if (file.encoding !== 'base64' || file.type !== 'file') throw Error('文件过大或格式不支持，请在 GitHub 编辑。');
      window.MXEditor.load(window.MXContent.parse(decode(file.content),path,file.sha));
      result('已载入文章。修改后点“保存修改”，会更新原文件。');
    } catch (error) { result(error.message); }
    finally { busy = false; controls(); }
  });
  $('github-new').addEventListener('click',() => { if (canSwitch()) { window.MXEditor.newDocument(); $('github-result').hidden = true; controls(); } });
  window.addEventListener('mx-editor-change',controls);
  $('clear-editor').addEventListener('click',controls);
  $('restore-draft').addEventListener('click',controls);
  $('github-login').addEventListener('click',() => {
    if (!serviceReady || busy) return;
    if (popup && !popup.closed) { popup.focus(); return; }
    channel = crypto.randomUUID();
    popup = window.open(`${authOrigin}/login?channel=${encodeURIComponent(channel)}`,'mx-github-login','popup,width=600,height=750');
    if (!popup) { result('浏览器阻止了登录窗口，请允许本站弹出窗口后重试。'); return; }
    $('github-status').textContent = '请在弹出的 GitHub 窗口完成登录授权。';
    const started = Date.now(); clearInterval(loginTimer);
    loginTimer = setInterval(() => {
      if (!popup || popup.closed || Date.now()-started > 600000) {
        clearInterval(loginTimer); channel = ''; popup?.close(); popup = null;
        if (!token) $('github-status').textContent = '登录未完成，可以重新点击“登录 GitHub”。';
      }
    },1000);
  });
  window.addEventListener('message',async event => {
    if (!authOrigin || event.origin !== authOrigin || event.source !== popup || !channel || event.data?.channel !== channel || event.data?.type !== 'mx-github-auth') return;
    clearInterval(loginTimer); channel = ''; popup?.close(); popup = null;
    if (event.data.error) { result(event.data.error); $('github-status').textContent = '登录未完成，请重试。'; return; }
    if (typeof event.data.token !== 'string') return;
    busy = true; token = event.data.token; controls();
    try {
      const repository = await api('');
      if (!repository.permissions?.push) throw Error('当前登录没有网站仓库的写入权限。');
      $('github-status').textContent = '已登录 Fexas25 · 可以直接发布和保存修改。刷新或关闭页面后需重新登录。';
    } catch(error) { token = ''; result(error.message); $('github-status').textContent = '登录检查失败，请检查应用配置后重试。'; }
    finally { busy = false; controls(); }
  });
  $('github-logout').addEventListener('click',() => { token = ''; $('github-status').textContent = '已退出当前页面的登录，草稿仍保留。'; controls(); });
  $('github-publish').addEventListener('click',async () => {
    if (busy) return;
    if (!token) { $('published-content').open=true; $('github-login').click(); return; }
    if (!$('writing-form').reportValidity()) return;
    let file;
    try { file = window.MXEditor.exportDocument(); } catch(error) { result(error.message); return; }
    const path = `${file.folder}/${file.filename}`, record = window.MXEditor.record();
    busy = true; controls(); result('正在提交到 GitHub…');
    try {
      // Check before every write, including retries after an interrupted request.
      let latest = null;
      try { latest = await api(pathURL(path) + '?ref=main'); } catch(error) { if (error.status !== 404) throw error; }
      if (latest && latest.encoding === 'base64' && decode(latest.content) === file.text) {
        window.MXEditor.committed(file,latest.sha); result('GitHub 中已是这份内容，无需重复提交。可在部署状态中查看是否上线。'); return;
      }
      if (record && (!latest || latest.sha !== record.sha)) throw Error('远端文章已改变。请先导出当前草稿，再重新打开最新文章合并修改；本次没有覆盖远端内容。');
      if (!record && latest) throw Error('同名文章已存在，请从文章列表打开修改，或为新内容换一个标题。');
      const saved = await api(pathURL(path),{method:'PUT',body:JSON.stringify({message:`${record ? 'Update' : 'Add'} ${path}`,branch:'main',content:encode(file.text),...(record ? {sha:record.sha} : {})})});
      window.MXEditor.committed(file,saved.content.sha);
      result('已提交到 GitHub，网站正在等待部署。通常几分钟后上线；可点下方“查看部署状态”查看进度。');
      await listArticles();
    } catch(error) {
      result(error instanceof TypeError ? '网络中断，提交结果暂时无法确认。草稿仍保留；恢复网络后可再点发布，系统会先检查远端以避免重复提交。' : error.message);
    } finally { busy = false; controls(); }
  });
  controls(); checkService(); listArticles();
})();
