import {projectCatalog} from './projects.mjs';
const readingUrl=id=>'https://mx-community.liuwanting830.workers.dev/read/'+id;
import {verifyKey} from './private.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const keyPattern=/^[A-Za-z0-9_-]{43}$/;
const folders=['_posts','_cp','_projects','_gamejam','_art'];
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function summary(row){return {id:row.id,title:row.title,...JSON.parse(row.metadata),visibility:row.visibility,url:row.public_url,readingUrl:readingUrl(row.id),updated:row.updated};}
export async function catalog(db){
 const {results}=await db.prepare("SELECT id,title,metadata,visibility,public_url,updated,CASE WHEN visibility='public' THEN json_extract(document,'$.text') ELSE '' END AS public_text FROM documents WHERE deleted_at=0 ORDER BY updated DESC").all();
 return results.map(row=>({...summary(row),content:row.public_text.replace(/^---[\s\S]*?\n---\s*/,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/<[^>]*>/g,'').replace(/data:image\/[^\s)]+/g,'').replace(/\s+/g,' ').trim()}));
}
export async function publicDocuments(request,env,{reply,body,path,now}){
 if(path==='/documents'&&request.method==='GET')return reply({documents:[...await catalog(env.DB),...await projectCatalog(env.DB)]});
 if(path!=='/documents/read'||request.method!=='POST')return reply({error:'not found'},404);
 const data=await body(request);
 if(!uuid.test(data?.id||''))return reply({error:'unavailable'},404);
 const row=await env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(data.id).first();
 if(!row||row.deleted_at)return reply({error:'not found'},404);
 if(row.visibility==='private'){
  if(!data.key)return reply({locked:true,title:row.title},403);
  const ip=request.headers.get('CF-Connecting-IP');if(!ip||!env.RATE_SECRET)return reply({error:'unavailable'},503);
  const bucket='doc:'+Math.floor(now/60)+':'+await hash(env.RATE_SECRET+':'+ip);
  const rate=await env.DB.prepare('INSERT INTO private_attempts(bucket,used,expires) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<20').bind(bucket,now+120).run();
  if(!rate.meta.changes)return reply({error:'rate limit'},429);
  await env.DB.prepare('DELETE FROM private_attempts WHERE expires<?').bind(now).run();
  if(!await verifyKey(row.id,data.key,row.key_hash))return reply({error:'unavailable'},403);
 }
 return reply({document:JSON.parse(row.document),...summary(row)});
}
// Only called after the management site's signed Access assertion and CSRF checks.
export async function manageDocuments(data,db,reply){
 if(data?.action==='list'){
  const {results}=await db.prepare('SELECT id,title,metadata,visibility,public_url,updated,revision,deleted_at FROM documents WHERE '+(data.trash?'deleted_at>0':'deleted_at=0')+' ORDER BY '+(data.trash?'deleted_at':'updated')+' DESC').all();
  return reply({documents:results.map(row=>({...summary(row),revision:row.revision,deletedAt:row.deleted_at}))});
 }
 if(data?.action==='resolve'){
  if(typeof data.path!=='string'||!/^_(posts|cp|projects|gamejam|art)\/[-\p{L}\p{N}_.]+\.md$/u.test(data.path))return reply({error:'旧文章路径无效。'},400);
  const [folder,filename]=data.path.split('/');const {results}=await db.prepare("SELECT * FROM documents WHERE deleted_at=0 AND json_extract(document,'$.folder')=? AND json_extract(document,'$.filename')=? LIMIT 2").bind(folder,filename).all();
  if(results.length!==1)return reply({error:'无法唯一匹配旧文章，请选择对应内容。'},404);
  const row=results[0];return reply({...summary(row),document:JSON.parse(row.document),revision:row.revision,deletedAt:row.deleted_at});
 }
 if(!uuid.test(data?.id||''))return reply({error:'参数无效。'},400);
 const row=await db.prepare('SELECT * FROM documents WHERE id=?').bind(data.id).first();
 if(data.action==='read')return row?reply({...summary(row),document:JSON.parse(row.document),revision:row.revision,deletedAt:row.deleted_at}):reply({error:'未找到内容。'},404);
 if(['trash','restore'].includes(data.action)){
  if(!row)return reply({error:'未找到内容。'},404);
  if(row.revision!==data.revision)return reply({error:'内容已变化，请刷新列表后重试。'},409);
  const deletedAt=data.action==='trash'?Math.floor(Date.now()/1000):0,revision=crypto.randomUUID();
  const result=await db.prepare('UPDATE documents SET deleted_at=?,revision=? WHERE id=? AND revision=?').bind(deletedAt,revision,data.id,data.revision).run();
  return result.meta.changes?reply({id:data.id,revision,deletedAt,url:row.public_url}):reply({error:'内容已变化，请刷新列表后重试。'},409);
 }
 if(row?.deleted_at)return reply({error:'这篇内容已在回收站，请先恢复并重新打开。当前草稿仍保留。'},409);
 if(data.action!=='save')return reply({error:'操作无效。'},400);
 const doc=data.document,meta=data.metadata;
 if(!doc||typeof doc.title!=='string'||!doc.title.trim()||doc.title.length>200||typeof doc.text!=='string'||new TextEncoder().encode(doc.text).length>1800000||!folders.includes(doc.folder)||typeof doc.filename!=='string'||!/^[-\p{L}\p{N}_.]+\.md$/u.test(doc.filename)||!['public','private'].includes(data.visibility)||!meta||typeof meta.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)||!Array.isArray(meta.tags)||meta.tags.length>40||meta.tags.some(t=>typeof t!=='string'||t.length>80))return reply({error:'内容格式无效，正文最多 1.8 MB。'},400);
 if(data.key!==undefined&&!keyPattern.test(data.key))return reply({error:'密钥格式无效。'},400);
 if(data.visibility==='private'&&!row?.key_hash&&!data.key)return reply({error:'请生成访问密钥。'},400);
 const document=JSON.stringify({title:doc.title.trim(),folder:doc.folder,filename:doc.filename,text:doc.text});
 const metadata=JSON.stringify({folder:doc.folder,date:meta.date,tags:meta.tags,topic:['notes','leetcode','atcoder','algorithm','game-dev','ai'].includes(meta.topic)?meta.topic:'notes',type:['game','ai','creative'].includes(meta.type)?meta.type:'creative'});
 const keyHash=data.key?await hash(data.id+':'+data.key):row?.key_hash||'';
 if(row&&row.document===document&&row.metadata===metadata&&row.visibility===data.visibility&&row.key_hash===keyHash)return reply({...summary(row),revision:row.revision});
 if(row&&row.revision!==data.revision)return reply({error:'内容已在其他页面更新，请备份当前草稿，再重新载入最新内容。'},409);
 const revision=crypto.randomUUID(),now=Math.floor(Date.now()/1000),url=row?.public_url||'/document/?id='+data.id;
 const result=row?await db.prepare('UPDATE documents SET title=?,document=?,metadata=?,visibility=?,key_hash=?,revision=?,updated=? WHERE id=? AND revision=? AND deleted_at=0').bind(doc.title.trim(),document,metadata,data.visibility,keyHash,revision,now,data.id,data.revision).run():await db.prepare('INSERT OR IGNORE INTO documents(id,title,document,metadata,visibility,key_hash,revision,updated,public_url) VALUES(?,?,?,?,?,?,?,?,?)').bind(data.id,doc.title.trim(),document,metadata,data.visibility,keyHash,revision,now,url).run();
 return result.meta.changes?reply({id:data.id,revision,url,readingUrl:readingUrl(data.id)},row?200:201):reply({error:'内容已变化，请重新载入。'},409);
}
