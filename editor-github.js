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
  const privateMode = () => $('post-visibility').value === 'private' || Boolean(window.MXEditor.record()?.privateId);
  let sharedId = '', pendingPrivate = new Map();
  const newKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  async function privateAPI(data) {
    const origin=window.MX_COMMUNITY?.origin;
    if (!origin) throw Error('私密服务暂时不可用，请稍后重试。');
    const response=await fetch(origin+'/private/manage',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),signal:AbortSignal.timeout(60000)});
    if(response.status===401){token='';$('github-status').textContent='登录已失效，请重新登录。';controls();}
    if(!response.ok) throw Error(response.status===409?'远端内容已改变，请先备份草稿，再重新载入合并。':response.status===401?'请重新登录 GitHub。':'私密服务暂时不可用，请稍后重试。');
    return response.json();
  }
  function share(id,key='') {
    sharedId=id; $('private-share').hidden=false;
    $('private-link').value=location.origin+'/private/#'+id;
    $('private-key').value=key; $('private-key-label').hidden=!key; $('private-copy-key').hidden=!key;
    $('private-share-status').textContent=key?'请保存密钥；关闭页面后只可重新生成。链接和密钥请分别发送。':'密钥不会重新显示；遗失时可更换，旧密钥将失效。';
  }
  for(const kind of ['link','key']) $('private-copy-'+kind).addEventListener('click',async()=>{
    const field=$('private-'+kind);
    try {await navigator.clipboard.writeText(field.value);$('private-share-status').textContent='已复制。';}
    catch {field.focus();field.select();$('private-share-status').textContent='请长按或复制选中的文字。';}
  });
  $('private-rotate').addEventListener('click',async()=>{
    const record=window.MXEditor.record();if(busy||!record?.privateId||!token)return;
    busy=true;controls();const key=newKey();
    try {const saved=await privateAPI({action:'rotate',id:record.privateId,revision:record.sha,key});window.MXEditor.privateRevision(saved.revision);share(saved.id,key);}
    catch(error){result(error instanceof TypeError||error.name==='TimeoutError'?'密钥更换结果暂时无法确认。请重新打开这篇私密内容，再更换一次密钥。':error.message);}finally{busy=false;controls();}
  });
  function controls() {
    $('post-visibility').disabled=busy||Boolean(window.MXEditor.record());
    $('github-login').disabled = busy || !serviceReady;
    $('github-login').hidden = Boolean(token);
    $('github-logout').hidden = !token;
    $('github-logout').disabled = busy;
    $('github-publish').disabled = busy || !serviceReady;
    $('image-upload').disabled = busy || (!privateMode() && !serviceReady);
    $('private-rotate').disabled=busy||!token;
    if(sharedId!==window.MXEditor.record()?.privateId){$('private-share').hidden=true;$('private-key').value='';sharedId='';}
    $('github-publish').textContent = busy ? '处理中…' : token ? (window.MXEditor.record() ? '保存修改' : (privateMode() ? '发布私密内容' : '发布到网站')) : '登录后发布';
    ['github-load','github-refresh','github-article'].forEach(id => $(id).disabled = busy);
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
    const response = await fetch(apiRoot + path, {...options,signal:AbortSignal.timeout(60000),cache:'no-store',headers:{Accept:'application/vnd.github+json',...options.headers,'X-GitHub-Api-Version':'2022-11-28',...(token ? {Authorization:`Bearer ${token}`} : {}),...(options.body ? {'Content-Type':'application/json'} : {})}});
    if (!response.ok) {
      if (response.status === 401) { token = ''; $('github-status').textContent = '登录已失效，请重新登录。'; controls(); }
      const messages = {401:'登录已失效，请重新登录。',403:'GitHub 拒绝访问，请检查应用是否安装到网站仓库并拥有 Contents 读写权限，或稍后再试。',404:'未找到内容，可能已被移动或删除，或应用尚未安装到网站仓库。',409:'文章已在其他地方更新。请先导出当前草稿，再重新打开最新文章合并修改。',422:'提交未成功，文件可能已存在或内容不符合要求，请刷新列表后检查。'};
      const error = new Error(messages[response.status] || `GitHub 请求失败（${response.status}），请稍后重试。`); error.status = response.status; throw error;
    }
    return response.json();
  }
  const pathURL = path => '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  function decode(content) { return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content.replace(/\s/g,'')), c => c.charCodeAt(0))); }
  function encode(content) { let binary = ''; for (const byte of new TextEncoder().encode(content)) binary += String.fromCharCode(byte); return btoa(binary); }
  let imageTarget = null;
  $('image-upload').addEventListener('click', () => {
    if (busy) return;
    if (!token && !privateMode()) {
      $('image-upload-status').textContent = '请先完成 GitHub 登录，再点“上传图片”选择图片。';
      $('published-content').open = true; $('github-login').click(); return;
    }
    imageTarget = window.MXEditor.imageTarget();
    $('image-file').click();
  });
  $('image-file').addEventListener('change', async () => {
    const file = $('image-file').files[0];
    $('image-file').value = '';
    if (!file || busy) return;
    const status = $('image-upload-status'), target = imageTarget;
    if (!token && !privateMode()) { status.textContent = '请先登录 GitHub，再选择图片。'; return; }
    if (!target) { status.textContent = '请点“上传图片”重新选择。'; return; }
    busy = true; controls(); status.textContent = '正在检查图片…';
    try {
      if (!file.size || file.size > 5 * 1024 * 1024) throw Error('请选择非空且不超过 5 MB 的图片。');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const starts = signature => signature.every((byte, i) => bytes[i] === byte);
      const ascii = (a,b) => String.fromCharCode(...bytes.slice(a,b));
      const ext = starts([137,80,78,71,13,10,26,10]) ? 'png' : starts([255,216,255]) ? 'jpg' : /^GIF8[79]a$/.test(ascii(0,6)) ? 'gif' : ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP' ? 'webp' : '';
      if (!ext) throw Error('支持 JPG、PNG、WebP 和 GIF；HEIC 请先转为 JPG。');
      // Decode before uploading, so renamed or damaged files do not enter the repo.
      const local = URL.createObjectURL(file);
      try {
        await new Promise((resolve,reject) => {
          const img = new Image(), timer = setTimeout(() => { img.src=''; reject(Error('图片读取超时，请换一张图片。')); },10000);
          img.onload = () => { clearTimeout(timer); resolve(); };
          img.onerror = () => { clearTimeout(timer); reject(Error('图片无法读取，请重新导出后再试。')); };
          img.src = local;
        });
      } finally { URL.revokeObjectURL(local); }
      if(privateMode()) {
        if(file.size>512*1024) throw Error('私密图片请压缩至 512 KB 以内。');
        let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
        const dataURL='data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+btoa(binary);
        if(new TextEncoder().encode($('markdown-input').value+dataURL).length>1700000)throw Error('私密正文与图片合计过大，请减少或压缩图片。');
        window.MXEditor.insertImage(dataURL,file,target);status.textContent='图片已嵌入私密正文，不会上传公开仓库。';return;
      }
      const hex = data => [...new Uint8Array(data)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const hash = hex(await crypto.subtle.digest('SHA-256',bytes));
      const path = `picture/uploads/${hash}.${ext}`;
      const prefix = new TextEncoder().encode(`blob ${bytes.length}\0`), gitBytes = new Uint8Array(prefix.length + bytes.length);
      gitBytes.set(prefix); gitBytes.set(bytes,prefix.length);
      const expectedSha = hex(await crypto.subtle.digest('SHA-1',gitBytes));
      status.textContent = '正在上传图片…';
      let existing = null;
      try { existing = await api(pathURL(path)+'?ref=main',{headers:{Accept:'application/vnd.github.object+json'}}); }
      catch (error) { if (error.status !== 404) throw error; }
      if (existing && (existing.type !== 'file' || existing.sha !== expectedSha)) throw Error('图片路径已有不同内容，本次未覆盖，请联系站主检查。');
      if (!existing) {
        let binary = '';
        for (let i=0; i<bytes.length; i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
        await api(pathURL(path),{method:'PUT',body:JSON.stringify({message:`Upload image ${hash.slice(0,12)}`,branch:'main',content:btoa(binary)})});
      }
      window.MXEditor.insertImage('/'+path,file,target);
      status.textContent = '图片已插入正文。文章写好后，点发布或保存修改。';
    } catch (error) {
      status.textContent = error instanceof TypeError || error.name === 'TimeoutError' ? '网络中断或超时。请重新选择原图重试，系统会先检查是否已上传。' : error.message;
    } finally { busy = false; controls(); }
  });
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
      if(token && window.MX_COMMUNITY?.origin) {
        try { const privateData=await privateAPI({action:'list'});
          if(version!==listing||!token)return;
          const group=document.createElement('optgroup');group.label='私密内容';
          privateData.documents.forEach(item=>group.appendChild(new Option(item.title,'private:'+item.id)));
          if(group.children.length)select.appendChild(group);
        }catch(error){const unavailable=new Option('私密列表暂时无法读取，请刷新重试','');unavailable.disabled=true;select.append(unavailable);}
      }
      if (Array.from(select.options).some(option => option.value === selected)) select.value = selected;
      if (select.options.length === 1) select.options[0].textContent = '还没有文章，可以新建内容';
    } catch (error) { result(error.message); }
  }
  $('github-refresh').addEventListener('click',listArticles);
  $('github-load').addEventListener('click',async () => {
    const path = $('github-article').value;
    if (!path) { result('请先选择文章。'); return; }
    busy = true; controls();
    try {
      if(path.startsWith('private:')) {
        const data=await privateAPI({action:'read',id:path.slice(8)}),doc=data.document;
        const record=window.MXContent.parse(doc.text,doc.folder+'/'+doc.filename,data.revision);record.privateId=data.id;
        window.MXEditor.load(record);share(data.id);result('已载入私密内容。');return;
      }
      const file = await api(pathURL(path) + '?ref=main');
      if (file.encoding !== 'base64' || file.type !== 'file') throw Error('文件过大或格式不支持，请在 GitHub 编辑。');
      window.MXEditor.load(window.MXContent.parse(decode(file.content),path,file.sha));
      result('已载入文章。修改后点“保存修改”，会更新原文件。');
    } catch (error) { result(error.message); }
    finally { busy = false; controls(); }
  });
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
      await listArticles();
      $('github-status').textContent = '已登录 Fexas25 · 可以直接发布和保存修改。刷新或关闭页面后需重新登录。';
    } catch(error) { token = ''; result(error.message); $('github-status').textContent = '登录检查失败，请检查应用配置后重试。'; }
    finally { busy = false; controls(); }
  });
  $('github-logout').addEventListener('click',() => { token = '';pendingPrivate.clear();$('private-key').value='';$('private-share').hidden=true;sharedId='';listing++;for(const option of $('github-article').querySelectorAll('option'))if(option.value.startsWith('private:'))option.remove(); $('github-status').textContent = '已退出当前页面的登录，草稿仍保留。'; controls(); });
  $('github-publish').addEventListener('click',async () => {
    if (busy) return;
    if (!token) { $('published-content').open=true; $('github-login').click(); return; }
    if (!$('writing-form').reportValidity()) return;
    let file;
    try { file = window.MXEditor.exportDocument(); } catch(error) { result(error.message); return; }
    const path = `${file.folder}/${file.filename}`, record = window.MXEditor.record();
    busy = true; controls(); result(privateMode()?'正在保存私密内容…':'正在提交到 GitHub…');
    try {
      if(privateMode()) {
        const draft=window.MXEditor.draftId();
        if(!record?.privateId&&!pendingPrivate.has(draft))pendingPrivate.set(draft,{id:crypto.randomUUID(),key:newKey()});
        const entry=record?.privateId?{id:record.privateId}:pendingPrivate.get(draft);
        const saved=await privateAPI({action:'save',id:entry.id,key:entry.key,revision:record?.sha,document:{...file,title:$('post-title').value.trim()}});
        window.MXEditor.committed(file,saved.revision,saved.id);share(saved.id,entry.key||(sharedId===saved.id?$('private-key').value:''));pendingPrivate.delete(draft);
        result('私密内容已保存。仅持有链接和密钥的人可以阅读。');await listArticles();return;
      }
      if(window.MXContent.parse(file.text,path,'').metadata.private===true)throw Error('私密内容不能发布到公开仓库，请新建密钥访问草稿。');
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
