// Run before migration; output stays outside the repository and contains the original bodies.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('../vendor-js/js-yaml.js');
const root=path.resolve(__dirname,'..'),out=process.argv[2];if(!out)throw Error('Explicit backup path required');
const index=JSON.parse(fs.readFileSync(path.join(root,'_site/search-index.json'),'utf8'));
const rows=[];
for(const folder of ['_posts','_cp','_projects','_gamejam','_art'])for(const filename of fs.readdirSync(path.join(root,folder)).filter(f=>f.endsWith('.md'))){
 const text=fs.readFileSync(path.join(root,folder,filename),'utf8'),match=text.match(/^---\r?\n([\s\S]*?)\r?\n---/),meta=yaml.load(match[1],{schema:yaml.JSON_SCHEMA});if(meta.backend_id)throw Error('Already migrated');
 const matches=index.filter(x=>x.title===meta.title);if(matches.length!==1)throw Error('Cannot determine original URL: '+filename);
 const id=crypto.randomUUID(),document=JSON.stringify({title:meta.title,folder,filename,text}),metadata=JSON.stringify({folder,date:String(meta.date).slice(0,10),tags:meta.tags||[],topic:meta.topic||'notes',type:meta.type||'creative'});
 rows.push({id,title:meta.title,document,metadata,visibility:'public',key_hash:'',revision:crypto.randomUUID(),updated:Math.floor(Date.now()/1000),public_url:matches[0].url,source_path:folder+'/'+filename,sha256:crypto.createHash('sha256').update(text).digest('hex')});
}
if(fs.existsSync(out))throw Error('Backup already exists; never overwrite');fs.writeFileSync(out,JSON.stringify(rows,null,2));console.log('Prepared '+rows.length+' records; originals unchanged.');
