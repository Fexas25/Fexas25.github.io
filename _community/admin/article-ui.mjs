export function articleClient(){
 const $=id=>document.getElementById(id),api=window.MXAdminApi,drafts=window.MXDrafts,content=window.MXContent,project=document.body.dataset.mode==='legacy-project';
 const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
 let id=null,record=null,imported={},busy=false,dirty=false,pendingKey='',newId=crypto.randomUUID(),baseline=null,readingBase='https://fexas25.github.io/',candidate=null,needsLink=false;
 const model=window.MXWriting;
 const fields=['post-title','post-category','post-date','post-tags','post-topic','work-type','work-url','work-description','work-cover','post-visibility'];
 const status=t=>$('status').textContent=t;
 function metadata(){return Object.fromEntries(fields.map(k=>[k,$(k).value]));}
 function snapshot(){return model.stamp(metadata(),$('markdown-input').value);}
 function saveDraft(){if(!dirty)return true;try{
  if(baseline!==null&&snapshot()===baseline){if(id)drafts.remove(id);id=null;dirty=false;if(record?.documentId)history.replaceState(null,'',(project?'/projects/article':'/articles/edit')+'?id='+encodeURIComponent(record.documentId));$('draft-status').textContent='与已发布版本一致。';return true;}
  if(!id&&!record&&!$('post-title').value.trim()&&!$('markdown-input').value.trim()){dirty=false;return true;}
  id=id||drafts.id();drafts.save({id,body:$('markdown-input').value,meta:{...metadata(),__record:record,__imported:imported,__publishId:newId}});if(!record)history.replaceState(null,'',(project?'/projects/article':'/write')+'?draft='+encodeURIComponent(id));dirty=false;$('draft-status').textContent='未发布的改动已暂存 · '+new Date().toLocaleTimeString('zh-CN');return true;
 }catch(e){status(e.message);return false;}}
 function lock(value){for(const el of document.querySelectorAll('#writing-form input,#writing-form select,#writing-form textarea,#writing-form button'))el.disabled=value;if(!value)$('post-category').disabled=Boolean(record);}
 function refresh(){const work=['projects','game-jam','art'].includes($('post-category').value);$('work-fields').hidden=!work;$('blog-topic-field').hidden=$('post-category').value!=='competitive-programming';$('rotate-label').hidden=$('post-visibility').value!=='private'||!record;model.preview($('preview-content'),$('markdown-input').value,readingBase,$('post-visibility').value==='private');$('word-count').textContent=$('markdown-input').value.length+' 字';$('publish').textContent=record?'保存修改':'发布文章';}
 function change(){dirty=true;const saved=saveDraft();refresh();return saved;}
 function fill(meta,body){for(const k of fields)if(typeof meta[k]==='string')$(k).value=meta[k];$('markdown-input').value=body;refresh();}
 function exported(){return model.exported(metadata(),$('markdown-input').value,record,imported,newId);}
 function loadRecord(row){const doc=row.document,r=content.parse(doc.text,doc.folder+'/'+doc.filename,row.revision);r.documentId=row.id;r.visibility=row.visibility;record=r;newId=row.id;readingBase=new URL(row.url||'/', 'https://fexas25.github.io/').href;imported=r.metadata;const m=r.metadata;fill({'post-title':doc.title,'post-category':r.category,'post-date':String(m.date||'').slice(0,10)||today(),'post-tags':content.tags(m.tags).join(', '),'post-topic':content.topic(m),'post-visibility':row.visibility,'work-type':m.type||'creative','work-url':m.external_url||'','work-description':m.description||'','work-cover':m.cover||''},r.body);baseline=snapshot();$('post-category').disabled=true;}
 $('post-date').value=today();$('post-category').value=project?'projects':'blog';
 for(const k of fields)$(k).addEventListener('input',change);$('markdown-input').addEventListener('input',change);
 document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{const input=$('markdown-input'),start=input.selectionStart,end=input.selectionEnd,v=input.value.slice(start,end)||'文字',pair={bold:['**','**'],italic:['*','*'],heading:['\n## ',''],list:['\n- ',''],code:['`','`'],link:['[','](https://)'],image:['![','](https://)']}[b.dataset.format];input.setRangeText(pair[0]+v+pair[1],start,end,'end');input.focus();change();});
 $('save-draft').onclick=()=>{dirty=true;saveDraft();};
 $('export').onclick=()=>{try{const f=exported(),u=URL.createObjectURL(new Blob([f.text],{type:'text/markdown'})),a=document.createElement('a');a.href=u;a.download=f.filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(e){status(e.message);}};
 $('markdown-import').onclick=()=>$('markdown-file').click();$('markdown-file').onchange=async()=>{try{const f=$('markdown-file').files[0];if(!f)return;if(f.size>1800000)throw Error('Markdown 最多 1.8 MB。');if(!saveDraft())return;const r=content.importMarkdown(await f.text(),f.name,$('post-category').value);if(project!==['projects','game-jam','art'].includes(r.category))throw Error('请在对应的文章或作品编辑页导入。');id=null;record=null;baseline=null;needsLink=false;$('link-panel').hidden=true;newId=crypto.randomUUID();pendingKey='';readingBase='https://fexas25.github.io/';$('share').hidden=true;$('share-link').value='';$('share-key').value='';$('rotate').checked=false;status('');imported=r.metadata;$('post-category').disabled=false;fill({'post-title':r.title,'post-category':r.category,'post-date':r.date||today(),'post-tags':content.tags(r.metadata.tags).join(', '),'post-topic':content.topic(r.metadata),'post-visibility':r.metadata.private===true?'private':'public','work-type':r.metadata.type||'creative','work-url':r.metadata.external_url||'','work-description':r.metadata.description||'','work-cover':r.metadata.cover||''},r.body);if(change()&&id){history.replaceState(null,'',(project?'/projects/article':'/write')+'?draft='+encodeURIComponent(id));document.querySelector('h1').textContent=project?'编辑作品介绍':'写新文章';}}catch(e){status(e.message);}finally{$('markdown-file').value='';}};
 $('image-upload').onclick=()=>$('image-file').click();$('image-file').onchange=async()=>{const input=$('markdown-input'),start=input.selectionStart,end=input.selectionEnd,old=input.value;try{let file=$('image-file').files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024)throw Error('请选择 5 MB 以内的 JPG、PNG、WebP 或 GIF。');if(file.size>512*1024){if(file.type==='image/gif')throw Error('GIF 最多 512 KB。');const u=URL.createObjectURL(file);try{const image=new Image();image.src=u;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);for(const q of [.85,.65,.45,.3]){file=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',q));if(file?.size<=512*1024)break;}}finally{URL.revokeObjectURL(u);}}if(!file||file.size>512*1024)throw Error('请缩小图片后再试。');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});if(old!==input.value)throw Error('正文已变化，请重新选择图片。');input.setRangeText('\n\n![图片]('+src+')\n\n',start,end,'end');change();status('已插入图片，发布后生效。');}catch(e){status(e.message);}finally{$('image-file').value='';}};
 $('publish').onclick=async()=>{
  if(busy||needsLink||!$('writing-form').reportValidity())return;
  busy=true;status('正在保存，请等待结果后再离开。');$('publish').disabled=true;$('markdown-import').disabled=true;
  try{
   if(!saveDraft())throw Error('本机暂存失败，请先导出备份再重试。');
   const f=exported(),visibility=$('post-visibility').value,sentStamp=snapshot(),sentDraft=id;
   if(record&&!record.documentId)throw Error('请先确认草稿关联。');
   if(visibility==='private'&&(!record||record.visibility!=='private'||$('rotate').checked)&&!pendingKey)pendingKey=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const saved=await api('documents',{action:'save',id:record?.documentId||newId,revision:record?.sha,visibility,...(pendingKey&&visibility==='private'?{key:pendingKey}:{}),document:f,metadata:{date:f.meta.date.slice(0,10),tags:content.tags(f.meta.tags),topic:f.meta.topic,type:f.meta.type}});
   record=content.parse(f.text,f.folder+'/'+f.filename,saved.revision);record.documentId=saved.id;record.visibility=visibility;newId=saved.id;imported=f.meta;baseline=sentStamp;readingBase=new URL(saved.url||'/', 'https://fexas25.github.io/').href;$('post-category').disabled=true;
   let cleanup='';try{if(snapshot()===sentStamp){if(sentDraft)drafts.remove(sentDraft);id=null;dirty=false;$('draft-status').textContent='已发布，没有待保存的改动。';}else{dirty=true;if(!saveDraft())cleanup=' 后续改动尚未成功暂存，请导出备份。';}}catch(e){cleanup=' 已发布，但本机草稿未清理：'+e.message;}
   history.replaceState(null,'',(project?'/projects/article':'/articles/edit')+(id?'?draft='+encodeURIComponent(id):'?id='+saved.id));
   $('share').hidden=false;$('share-link').value=saved.readingUrl||'https://mx-community.liuwanting830.workers.dev/read/'+saved.id;$('share-key').value=visibility==='private'?(pendingKey||$('share-key').value):'';$('key-label').hidden=!$('share-key').value;$('rotate').checked=false;pendingKey='';status('已保存到网站。'+cleanup);refresh();
  }catch(e){status(e.message||'连接中断，请重试。');}finally{busy=false;$('publish').disabled=needsLink;$('markdown-import').disabled=false;}
 };
 for(const name of ['link','key'])$('copy-'+name).onclick=async()=>{const f=$('share-'+name);try{await navigator.clipboard.writeText(f.value);status('已复制。');}catch{f.focus();f.select();status('请长按复制。');}};
 window.addEventListener('pagehide',()=>{pendingKey='';$('share-key').value='';$('key-label').hidden=true;});
 window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
 async function linkedRecord(row){
  if(row.deletedAt)throw Error('内容已在回收站，请先恢复。');
  const parsed=content.parse(row.document.text,row.document.folder+'/'+row.document.filename,row.revision);
  if(project!==['projects','game-jam','art'].includes(parsed.category))throw Error('文章与作品不能交叉关联。');
  candidate={row,parsed};$('link-latest').value=parsed.body;$('link-confirm').disabled=false;
 }
 async function offerLink(preferred){
  needsLink=true;$('publish').disabled=true;$('link-panel').hidden=false;$('link-panel').open=true;
  const rows=(await api('documents',{action:'list'})).documents.filter(r=>project?!['_posts','_cp'].includes(r.folder):['_posts','_cp'].includes(r.folder));
  $('link-choice').replaceChildren(...rows.map(r=>new Option(r.title,r.id)));
  if(preferred&&rows.some(r=>r.id===preferred.id)){$('link-choice').value=preferred.id;await linkedRecord(preferred);}
  status('请核对关联文章。当前草稿和线上内容都保留。');
 }
 $('link-choice').onchange=()=>{candidate=null;$('link-confirm').disabled=true;$('link-latest').value='';};
 $('link-load').onclick=async()=>{try{candidate=null;$('link-confirm').disabled=true;await linkedRecord(await api('documents',{action:'read',id:$('link-choice').value}));}catch(e){status(e.message);}};
 $('link-confirm').onclick=()=>{if(!candidate)return;const {row,parsed}=candidate;if(!confirm('将当前草稿关联到「'+row.title+'」？线上版本保持不变，之后点击保存修改才会更新。'))return;record={...parsed,documentId:row.id,visibility:row.visibility};newId=row.id;readingBase=new URL(row.url||'/', 'https://fexas25.github.io/').href;baseline=null;imported={...parsed.metadata,...imported};$('post-category').value=parsed.category;$('post-category').disabled=true;needsLink=false;$('publish').disabled=false;$('link-panel').hidden=true;change();status('已关联，草稿内容保留。尚未更新线上文章。');};
 const params=new URLSearchParams(location.search);
 async function load(){
  $('load-retry').hidden=true;$('load-state').hidden=false;$('load-state').textContent='正在读取…';lock(true);
  try{
   if(params.has('draft')){
    const d=drafts.state().items.find(d=>d.id===params.get('draft'));if(!d)throw Error('未找到草稿。原数据没有更改。');
    id=d.id;record=d.meta.__record||null;imported=d.meta.__imported||{};newId=record?.documentId||d.meta.__publishId||crypto.randomUUID();fill(d.meta,d.body);
    if(record){let row;try{row=await api('documents',record.documentId?{action:'read',id:record.documentId}:{action:'resolve',path:record.path});}catch(e){if(/未找到|无法唯一/.test(e.message)){await offerLink();lock(false);$('publish').disabled=true;$('load-state').hidden=true;refresh();return;}throw e;}
     if(row.deletedAt){needsLink=true;candidate=null;$('link-panel').hidden=true;lock(false);$('publish').disabled=true;$('load-state').hidden=true;refresh();status('原文章已在回收站，当前草稿保留，可继续编辑或导出。请先在已发布列表的回收站恢复原文章，再重新打开此草稿。');return;}
     readingBase=new URL(row.url||'/', 'https://fexas25.github.io/').href;
     const original=record.documentId&&record.sha===row.revision;
     if(original){record.documentId=row.id;newId=row.id;}else{await offerLink(row);}
    }
   }else if(params.has('id')){
    const row=await api('documents',{action:'read',id:params.get('id')});if(row.deletedAt)throw Error('请先从回收站恢复。');if(project!==!['_posts','_cp'].includes(row.document.folder))throw Error('请从对应的已发布列表打开。');const related=drafts.state().items.filter(d=>(d.meta.__record?.documentId===row.id||d.meta.__publishId===row.id)&&!model.equalDraft(d,row)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if(related.length&&confirm('这篇内容有 '+related.length+' 份未发布改动。继续最近编辑的草稿？\n确定：继续草稿；取消：编辑线上版本。其他草稿都会保留。')){location.replace((project?'/projects/article':'/write')+'?draft='+encodeURIComponent(related[0].id));return;}
    loadRecord(row);
   }
   lock(false);$('publish').disabled=needsLink;$('load-state').hidden=true;refresh();
  }catch(e){$('load-state').textContent=e.message;$('load-retry').hidden=false;}
 }
 $('load-retry').onclick=load;
 if(params.has('id')||params.has('draft'))load();else{if(['blog','competitive-programming'].includes(params.get('category')))$('post-category').value=params.get('category');refresh();}
}
