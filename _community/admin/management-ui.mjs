export async function api(path,data){
 let r;
 try{r=await fetch('/api/'+path,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json','X-MX-Admin':'1'},body:JSON.stringify(data),signal:AbortSignal.timeout(45000)});}
 catch{const help=document.getElementById('session-help');if(help)help.hidden=false;throw Error('连接中断或登录已过期。当前输入保留，请检查网络或重新登录后重试。');}
 if(r.status===401||r.status===403||!r.headers.get('Content-Type')?.includes('application/json')){const help=document.getElementById('session-help');if(help)help.hidden=false;throw Error('请重新登录后重试。当前输入仍保留。');}
 const value=await r.json();if(!r.ok){const error=Error(value.error||'操作失败，请重试。');error.status=r.status;throw error;}const help=document.getElementById('session-help');if(help)help.hidden=true;return value;
}
export function managementClient(){
 const $=id=>document.getElementById(id),mode=document.body.dataset.mode,projects=mode==='projects';let rows=[],trash=false,busy=false,loading=false,requestId=0;
 const status=text=>$('status').textContent=text;
 const api=window.MXAdminApi;
 function render(){const q=$('search').value.trim().toLocaleLowerCase();$('items').replaceChildren();if(loading)return;const viewTrash=trash;for(const r of rows.filter(r=>r.title.toLocaleLowerCase().includes(q))){const card=document.createElement('article');card.className='hub-card';const title=document.createElement('h2');title.textContent=r.title;const info=document.createElement('p');info.textContent=(projects?(r.source==='legacy'?'作品介绍':r.kind==='link'?'外部链接':'网页项目')+(r.state==='draft'?'草稿':'')+' · ':'')+(r.visibility==='private'?'🔑 密钥访问':'公开')+' · '+new Date(r.updated*1000).toLocaleString('zh-CN');card.append(title,info);const actions=document.createElement('div');actions.className='hub-actions';if(!trash){const a=document.createElement('a');a.className='hub-button';a.textContent='编辑';a.href=(r.source==='runtime'?'/projects/edit':r.source==='legacy'?'/projects/article':'/articles/edit')+'?id='+encodeURIComponent(r.id);actions.append(a);const view=document.createElement('a');view.textContent='查看线上效果 ↗';view.href=r.readingUrl||r.url;view.target='_blank';view.rel='noopener';actions.append(view);}const button=document.createElement('button');button.type='button';button.textContent=trash?'恢复':'移入回收站';button.addEventListener('click',async()=>{if(busy||loading||!viewTrash&&!confirm('将「'+r.title+'」移入回收站？可以恢复。'))return;busy=true;$('trash').disabled=true;$('refresh').disabled=true;button.disabled=true;try{await api(r.source==='runtime'?'projects':'documents',{action:viewTrash?'restore':'trash',id:r.id,revision:r.revision});const message=viewTrash?(r.source==='runtime'&&r.state==='draft'?'已恢复到草稿管理，尚未发布。':'已恢复到已发布列表，原链接和密钥不变。'):'已移入回收站。';if(await load())status(message);else status(message+' 列表更新失败，请刷新重试。');}catch(e){status(e.message);}finally{busy=false;$('trash').disabled=false;$('refresh').disabled=false;button.disabled=false;}});actions.append(button);card.append(actions);$('items').append(card);}if(!$('items').children.length){const p=document.createElement('p');p.textContent='这里暂时没有内容。';$('items').append(p);}}
 async function load(){
  const request=++requestId,requestedTrash=trash;loading=true;rows=[];render();status('正在加载…');
  try{
   const docs=(await api('documents',{action:'list',trash:requestedTrash})).documents.filter(r=>projects?!['_posts','_cp'].includes(r.folder):['_posts','_cp'].includes(r.folder)).map(r=>({...r,source:projects?'legacy':'article'}));
   const result=projects?[...docs,...(await api('projects',{action:'list',trash:requestedTrash})).projects.map(r=>({...r,source:'runtime'}))]:docs;
   if(request!==requestId)return false;
   rows=result.sort((a,b)=>b.updated-a.updated);loading=false;render();status('共 '+rows.length+' 项');return true;
  }catch(e){if(request===requestId){loading=false;rows=[];$('items').replaceChildren();status(e.message+' 请点击刷新重试。');}return false;}
 }
 $('search').addEventListener('input',render);$('refresh').onclick=()=>{if(!busy)load();};$('trash').onclick=()=>{if(busy)return;trash=!trash;$('trash').textContent=trash?'返回已发布':'回收站';$('trash').setAttribute('aria-pressed',String(trash));load();};load();
}
export function draftsClient(){
 const $=id=>document.getElementById(id);let projects=[],refreshId=0,deleting=false;const drafts=window.MXDrafts;const status=t=>$('status').textContent=t;
 function render(){const q=$('search').value.trim().toLowerCase(),filter=$('filter').value;$('items').replaceChildren();const articles=drafts.state().items.map(x=>({id:x.id,title:x.meta['post-title']||'未命名草稿',updatedAt:x.updatedAt,kind:['projects','game-jam','art'].includes(x.meta['post-category'])?'legacy':'article',source:x}));for(const x of [...articles,...projects.map(x=>({...x,kind:'project',updatedAt:new Date(x.updated*1000).toISOString()}))].filter(x=>x.title.toLowerCase().includes(q)&&(!filter||(filter==='articles'?x.kind==='article':x.kind!=='article'))).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))){const card=document.createElement('article');card.className='hub-card';const h=document.createElement('h2');h.textContent=x.title;const p=document.createElement('p');p.textContent=(x.kind==='article'?'文章':'项目')+' · '+(x.updatedAt?new Date(x.updatedAt).toLocaleString('zh-CN'):'');const a=document.createElement('a');a.className='hub-button';a.textContent='继续编辑';a.href=x.kind==='project'?'/projects/new?id='+x.id:(x.kind==='legacy'?'/projects/article':'/write')+'?draft='+encodeURIComponent(x.id);const b=document.createElement('button');b.textContent=x.kind==='project'?'移入回收站':'删除草稿';b.disabled=deleting;b.onclick=async()=>{if(deleting)return;const message=x.kind==='project'?'将「'+x.title+'」项目草稿移入回收站？可在已发布项目的回收站恢复。':'删除「'+x.title+'」本机草稿？无法从回收站恢复，建议先备份。已发布内容不受影响。';if(!confirm(message))return;deleting=true;refreshId++;$('refresh').disabled=true;$('restore').disabled=true;render();try{if(x.kind==='project'){await window.MXAdminApi('projects',{action:'trash',id:x.id,revision:x.revision});projects=projects.filter(r=>r.id!==x.id);status('项目草稿已移入回收站，可恢复。');}else{drafts.remove(x.id);status('已删除本机草稿，已发布内容不受影响。');}}catch(e){status(e.message);}finally{deleting=false;$('refresh').disabled=false;$('restore').disabled=false;render();}};card.append(h,p,a,b);$('items').append(card);}if(!$('items').children.length)$('items').textContent='还没有符合条件的草稿。';}
 $('search').oninput=render;$('filter').onchange=render;
 $('backup').onclick=()=>{try{const blob=new Blob([drafts.backup()],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='mx-writing-drafts-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);status('已备份本机文章草稿；项目草稿保存在后台。');}catch(e){status(e.message);}};
 $('restore').onclick=()=>$('backup-file').click();$('backup-file').onchange=async()=>{if(deleting){$('backup-file').value='';return;}try{const f=$('backup-file').files[0];if(!f)return;if(f.size>30*1024*1024)throw Error('备份文件过大。');drafts.restore(drafts.validateBackup(JSON.parse(await f.text())));render();refresh('已恢复，原有草稿保留。');}catch(e){status(e.message);}finally{$('backup-file').value='';}};
 async function reconcile(request){
  let removed=0,unverified=0;
  for(const d of [...drafts.state().items]){
   const documentId=d.meta.__record?.documentId||d.meta.__publishId;if(!documentId)continue;
   try{const row=await window.MXAdminApi('documents',{action:'read',id:documentId});if(request!==refreshId)return;if(window.MXWriting.equalDraft(d,row)&&JSON.stringify(drafts.state().items.find(x=>x.id===d.id))===JSON.stringify(d)){drafts.remove(d.id);removed++;}}
   catch{unverified++;}
  }
  if(request===refreshId&&removed){render();status('已清理 '+removed+' 篇与线上内容完全一致的草稿。'+(unverified?'未能核对的草稿已保留。':''));}
 }
 async function refresh(message=''){
  if(deleting)return;
  const request=++refreshId;
  if(!drafts.reload()){status(drafts.error());return;}
  projects=[];render();status('正在加载…');
  try{const r=await window.MXAdminApi('projects',{action:'list',state:'draft'});if(request!==refreshId)return;projects=r.projects;render();status(message);await reconcile(request);}
  catch(e){if(request===refreshId)status(e.message);}
 }
 $('refresh').onclick=()=>refresh();render();refresh();
}
