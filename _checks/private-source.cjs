// Refuse accidentally exported private Markdown before creating the public site.
const fs=require('node:fs'),path=require('node:path'),yaml=require('../vendor-js/js-yaml.js');
const root=path.join(__dirname,'..');
for(const folder of ['_posts','_cp','_projects','_gamejam','_art','_pages']){
 if(!fs.existsSync(path.join(root,folder)))continue;
 for(const file of fs.readdirSync(path.join(root,folder),{recursive:true}).filter(x=>/\.(md|html)$/i.test(x))){
  const text=fs.readFileSync(path.join(root,folder,file),'utf8').replace(/^\uFEFF/,'');
  const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---/);if(!match)continue;
  const meta=yaml.load(match[1],{schema:yaml.JSON_SCHEMA});
  if(['_posts','_cp','_projects','_gamejam','_art'].includes(folder)&&!meta?.backend_id)throw Error('Publish document bodies through the management site, not the public repository: '+folder+'/'+file);
  if(meta?.backend_id){
   const remaining=text.slice(match[0].length).trim();
   if(remaining)throw Error('Backend route stub must never contain a body: '+folder+'/'+file);
   for(const key of Object.keys(meta))if(!['layout','title','date','permalink','topic','tags','backend_id','scripts','script'].includes(key))throw Error('Unexpected backend stub metadata: '+key);
  }
  if(meta?.private===true||meta?.visibility==='private')throw Error('Private content must not enter the public repository: '+folder+'/'+file);
 }
}
console.log('PASS: public content contains no private exports.');
