(() => {
 const fields=['post-title','post-category','post-date','post-tags','post-topic','work-type','work-url','work-description','work-cover','post-visibility'];
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const stamp=(meta,body)=>JSON.stringify([fields.map(k=>meta[k]||''),body]);
 function exported(meta,body,record,imported,id){
  const content=window.MXContent,category=meta['post-category'],folder=content.folders[category],title=meta['post-title'].trim();if(!title)throw Error('请填写标题。');
  const value={...imported,title,date:meta['post-date'],tags:content.tags(meta['post-tags'])};
  if(meta['post-visibility']==='private')value.private=true;else delete value.private;
  if(record&&String(imported.date||'').slice(0,10)===value.date)value.date=imported.date;
  if(category==='competitive-programming')value.topic=meta['post-topic'];
  if(['projects','game-jam','art'].includes(category)){value.type=meta['work-type'];value.external_url=meta['work-url'];value.description=meta['work-description'];value.cover=meta['work-cover'];}
  const filename=record?.path?.split('/').pop()||(meta['post-date']+'-'+id+'.md');
  return {title,folder,filename,text:'---\n'+window.jsyaml.dump(value)+'---\n\n'+body,meta:value};
 }
 function equalDocument(file,visibility,row){
  if(row.deletedAt||row.visibility!==visibility||file.title!==row.document.title||file.folder!==row.document.folder||file.filename!==row.document.filename)return false;
  const parse=f=>window.MXContent.parse(f.text,f.folder+'/'+f.filename,'compare');
  const a=parse(file),b=parse(row.document);delete a.metadata.private;delete b.metadata.private;return a.body===b.body&&JSON.stringify(canonical(a.metadata))===JSON.stringify(canonical(b.metadata));
 }
 function equalDraft(d,row){try{return equalDocument(exported(d.meta,d.body,d.meta.__record,d.meta.__imported||{},d.meta.__publishId||row.id),d.meta['post-visibility']||'public',row);}catch{return false;}}
 function preview(target,markdown,base,privateMode){
  const fragment=window.DOMPurify.sanitize(window.marked.parse(markdown),{RETURN_DOM_FRAGMENT:true});
  for(const el of fragment.querySelectorAll('[src],[srcset],a[href]')){
   if(el.hasAttribute('srcset'))el.removeAttribute('srcset');
   if(el.hasAttribute('src')){const src=el.getAttribute('src');if(privateMode&&!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)){el.replaceWith(document.createTextNode('〔外部素材已隐藏〕'));continue;}try{const url=new URL(src,base);if(!['http:','https:','data:'].includes(url.protocol))el.removeAttribute('src');else el.setAttribute('src',url.href);}catch{el.removeAttribute('src');}}
   if(el.matches('a[href]')){try{const url=new URL(el.getAttribute('href'),base);if(!['http:','https:','mailto:'].includes(url.protocol)){el.removeAttribute('href');continue;}el.href=url.href;el.target='_blank';el.rel='noopener noreferrer';el.referrerPolicy='no-referrer';}catch{el.removeAttribute('href');}}
  }
  target.replaceChildren(fragment);
 }
 window.MXWriting={fields,stamp,exported,equalDocument,equalDraft,preview};
})();
