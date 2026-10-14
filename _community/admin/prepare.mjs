import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const result=buildSync({entryPoints:[fileURLToPath(new URL('project-ui.js',import.meta.url))],bundle:true,write:false,format:'iife',minify:true,platform:'browser'});
writeFileSync(new URL('project-client.mjs',import.meta.url),'export default '+JSON.stringify('/* fflate\n'+readFileSync(new URL('node_modules/fflate/LICENSE',import.meta.url),'utf8')+'*/\n'+result.outputFiles[0].text)+';\n');

const coreFiles=['vendor-js/marked.js','vendor-js/purify.js','vendor-js/js-yaml.js','editor-content.js','editor-drafts.js'];
const core=coreFiles.map(p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8')).join('\n;\n').replace(/<\/script/gi,'<\\/script');
writeFileSync(new URL('core-client.mjs',import.meta.url),'export default '+JSON.stringify(core)+';\n');
