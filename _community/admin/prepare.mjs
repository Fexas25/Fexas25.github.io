import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../../editor.html',import.meta.url),'utf8');
const body=source.replace(/^---[\s\S]*?\n---\s*/, '').replace(/{%[\s\S]*?%}/g,'').replace(/{{\s*'([^']+)'[^}]*}}/g,'$1').replace(/<p class="archive" id="admin-migration">[\s\S]*?<\/p>/,'');
writeFileSync(new URL('editor-body.mjs',import.meta.url),'export default '+JSON.stringify(body)+';\n');
