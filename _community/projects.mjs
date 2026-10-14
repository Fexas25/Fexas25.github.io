import {verifyKey} from './private.mjs';
export const PROJECT_ORIGIN='https://mx-projects.liuwanting830.workers.dev';
export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function filePath(path){return typeof path==='string'&&path.length<=220&&!/[\\\x00-\x20?#%:]/.test(path)&&!path.startsWith('/')&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.'));}
export const mimeFor=path=>({html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',ico:'image/x-icon',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',wasm:'application/wasm',pdf:'application/pdf',txt:'text/plain; charset=utf-8'})[path.split('.').pop().toLowerCase()]||'application/octet-stream';
export const projectSummary=r=>({id:r.id,slug:r.slug,title:r.title,description:r.visibility==='public'?r.description:'',category:r.category,kind:r.kind,visibility:r.visibility,state:r.state,revision:r.revision,updated:r.updated,deletedAt:r.deleted_at,url:PROJECT_ORIGIN+'/p/'+r.slug+'/'});
export async function projectCatalog(db){const {results}=await db.prepare("SELECT * FROM projects WHERE state='published' AND deleted_at=0 ORDER BY updated DESC").all();return results.map(r=>({...projectSummary(r),folder:'_projects',type:r.category,date:new Date(r.updated*1000).toISOString().slice(0,10),tags:[],content:r.visibility==='public'?r.description:'',readingUrl:PROJECT_ORIGIN+'/p/'+r.slug+'/'}));}
// Caller must authenticate the admin and enforce same-origin CSRF before calling.
export async function manageProjects(data,env,reply,commit=statement=>statement.run()){
 const db=env.DB,now=Math.floor(Date.now()/1000);
 if(data?.action==='list'){const {results}=await db.prepare('SELECT * FROM projects WHERE '+(data.trash?'deleted_at>0':'deleted_at=0')+(data.trash?"":data.state==="draft"?" AND state='draft'":" AND state='published'")+' ORDER BY updated DESC').all();return reply({projects:results.map(projectSummary)});}
 if(!uuid.test(data?.id||''))return reply({error:'项目编号无效。'},400);
 const row=await db.prepare('SELECT * FROM projects WHERE id=?').bind(data.id).first();
 if(data.action==='check-key')return reply({matches:Boolean(row&&await verifyKey(row.id,data.key,row.key_hash))});
 if(data.action==='read')return row?reply({...projectSummary(row),description:row.description,externalUrl:row.external_url,version:row.version,entry:row.entry}):reply({error:'项目不存在。'},404);
 if(data.action==='preview'){
  if(!row||row.deleted_at||row.kind==='static'&&!row.version)return reply({error:'请先保存完整项目草稿。'},400);
  const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('INSERT INTO project_sessions(token_hash,project_id,key_hash,expires) VALUES(?,?,?,?)').bind(await hash(token),row.id,'preview:'+row.revision,now+600).run();
  return reply({url:PROJECT_ORIGIN+'/p/'+row.slug+'/_preview?token='+encodeURIComponent(token)});
 }
 if(['trash','restore'].includes(data.action)){
  if(!row||row.revision!==data.revision)return reply({error:'项目已变化，请刷新。'},409);
  const revision=crypto.randomUUID(),deleted=data.action==='trash'?now:0;
  const result=await db.prepare('UPDATE projects SET deleted_at=?,revision=? WHERE id=? AND revision=?').bind(deleted,revision,row.id,row.revision).run();return result.meta.changes?reply({id:row.id,revision}):reply({error:'项目已变化，请刷新。'},409);
 }
 if(row?.deleted_at)return reply({error:'请先从回收站恢复项目。'},409);
 if(data.action==='upload-start'){
  if(!env.PROJECT_FILES)return reply({error:'文件服务未配置。'},503);
  const upload=crypto.randomUUID();await db.prepare('INSERT INTO project_uploads(id,project_id,created) VALUES(?,?,?)').bind(upload,data.id,now).run();return reply({upload});
 }
 if(data.action==='upload-file'){
  if(!env.PROJECT_FILES||!uuid.test(data.upload||'')||!filePath(data.path)||!(data.bytes instanceof Uint8Array))return reply({error:'文件格式无效，单文件最多 5 MB。'},400);
  const upload=await db.prepare('SELECT * FROM project_uploads WHERE id=? AND project_id=?').bind(data.upload,data.id).first();
  if(!upload||upload.created<now-86400||upload.sealed)return reply({error:'上传已结束，请重新选择文件。'},409);
  const files=(await db.prepare('SELECT path,size FROM project_files WHERE upload_id=?').bind(data.upload).all()).results;
  if(files.some(f=>f.path===data.path))return reply({error:'文件已上传，请勿重复上传。'},409);
  const bytes=data.bytes;
  if(bytes.length>5*1024*1024||files.length>=100||files.reduce((n,f)=>n+f.size,0)+bytes.length>20*1024*1024)return reply({error:'每个版本最多 100 个文件、合计 20 MB，单文件最多 5 MB。'},400);
  const mime=mimeFor(data.path);
  const reserved=await db.prepare('INSERT OR IGNORE INTO project_files(upload_id,path,size,mime) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM project_uploads WHERE id=? AND sealed=0) AND (SELECT COUNT(*) FROM project_files WHERE upload_id=?)<100 AND COALESCE((SELECT SUM(size) FROM project_files WHERE upload_id=?),0)+?<=20971520').bind(data.upload,data.path,bytes.length,mime,data.upload,data.upload,data.upload,bytes.length).run();
  if(!reserved.meta.changes)return reply({error:'上传已结束或超出文件限制，请重新上传。'},409);
  await env.PROJECT_FILES.put(data.upload+'/'+data.path,bytes);
  await db.prepare('UPDATE project_files SET ready=1 WHERE upload_id=? AND path=?').bind(data.upload,data.path).run();return reply({ok:true});
 }
 if(data.action!=='save')return reply({error:'操作无效。'},400);
 const {title,slug,description='',category,kind,externalUrl='',visibility,state,version='',entry='index.html'}=data;
 if(typeof title!=='string'||!title.trim()||title.length>200||typeof slug!=='string'||! /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)||typeof description!=='string'||description.length>5000||!['creative','game','ai'].includes(category)||!['static','link'].includes(kind)||!['public','private'].includes(visibility)||!['draft','published'].includes(state)||!filePath(entry))return reply({error:'请检查名称、网址和项目类型。'},400);
 if(row&&slug!==row.slug)return reply({error:'项目网址建立后保持不变。'},400);

 if(data.key!==undefined&&!/^[A-Za-z0-9_-]{43}$/.test(data.key))return reply({error:'密钥格式无效。'},400);
 if(visibility==='private'&&!row?.key_hash&&!data.key)return reply({error:'需要生成密钥。'},400);
 if(kind==='link'){try{const u=new URL(externalUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{return reply({error:'请输入有效的 HTTPS 项目链接。'},400);}}
 const keyHash=data.key?await hash(data.id+':'+data.key):row?.key_hash||'';
 // A lost success response may be retried with the old revision. Only an exact
 // match is acknowledged; a different payload still requires the current revision.
 if(row&&row.title===title.trim()&&row.description===description&&row.category===category&&row.kind===kind&&row.external_url===externalUrl&&row.visibility===visibility&&row.key_hash===keyHash&&row.state===state&&row.version===version&&row.entry===entry)return reply({id:row.id,revision:row.revision,url:PROJECT_ORIGIN+'/p/'+row.slug+'/'});
 if(row&&row.revision!==data.revision)return reply({error:'项目已在其他页面更新，请刷新后重试。'},409);
 if(kind==='static'&&version){
  const u=await db.prepare('SELECT * FROM project_uploads WHERE id=? AND project_id=?').bind(version,data.id).first();
  const f=await db.prepare('SELECT * FROM project_files WHERE upload_id=? AND path=?').bind(version,entry).first();
  if(!u||!f||!f.ready||!entry.endsWith('.html'))return reply({error:'项目包缺少入口 HTML。'},400);
  if(!u.sealed){const seal=await db.prepare('UPDATE project_uploads SET sealed=1 WHERE id=? AND NOT EXISTS(SELECT 1 FROM project_files WHERE upload_id=? AND ready=0)').bind(version,version).run();if(!seal.meta.changes)return reply({error:'文件尚未全部上传，请稍后重试。'},409);}
 }
 if(kind==='static'&&state==='published'&&!version)return reply({error:'请先上传项目文件。'},400);
 const duplicate=await db.prepare('SELECT id FROM projects WHERE slug=? AND id<>?').bind(slug,data.id).first();if(duplicate)return reply({error:'这个网址已被占用，请换一个。'},409);
 const revision=crypto.randomUUID();
 const args=[title.trim(),description,category,kind,externalUrl,visibility,keyHash,state,version,entry,revision,now];
 const statement=row?db.prepare('UPDATE projects SET title=?,description=?,category=?,kind=?,external_url=?,visibility=?,key_hash=?,state=?,version=?,entry=?,revision=?,updated=? WHERE id=? AND revision=?').bind(...args,data.id,row.revision):db.prepare('INSERT OR IGNORE INTO projects(title,description,category,kind,external_url,visibility,key_hash,state,version,entry,revision,updated,id,slug) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...args,data.id,slug);
 const result=await commit(statement);
 return result.meta.changes?reply({id:data.id,revision,url:PROJECT_ORIGIN+'/p/'+slug+'/'},row?200:201):reply({error:'项目已变化，请刷新后重试。'},409);
}
