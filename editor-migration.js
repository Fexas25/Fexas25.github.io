(() => {
  const drafts=window.MXDrafts, status=document.getElementById('migration-status'), button=document.getElementById('draft-backup-export');
  if(!drafts){status.textContent='草稿工具加载失败，请刷新重试。原数据未更改。';button.disabled=true;return;}
  const error=drafts.error();
  status.textContent=error?error+' 可先下载原始备份留存。':'找到 '+drafts.state().items.length+' 篇旧草稿。';
  if(error)button.textContent='下载原始草稿数据 ↓';
  button.onclick=()=>{try{
    const data=error?JSON.stringify({rawStorage:Object.fromEntries(['mx-writing-drafts-v1','markdown-draft','mx-writing-meta'].map(k=>[k,localStorage.getItem(k)]))},null,2):drafts.backup();
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=error?'mx-drafts-raw-recovery.json':'mx-old-drafts-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent=error?'原始数据已备份，请保留文件以便修复；它不能直接作为标准备份导入。':'备份已下载，请回后台恢复。这里的草稿仍然保留。';
  }catch(e){status.textContent='下载失败，请重试。原有草稿未更改。';}};
})();
