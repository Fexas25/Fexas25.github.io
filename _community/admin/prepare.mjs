import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const result=buildSync({entryPoints:[fileURLToPath(new URL('project-ui.js',import.meta.url))],bundle:true,write:false,format:'iife',minify:true,platform:'browser'});
writeFileSync(new URL('project-client.mjs',import.meta.url),'export default '+JSON.stringify('/* fflate\n'+readFileSync(new URL('node_modules/fflate/LICENSE',import.meta.url),'utf8')+'*/\n'+result.outputFiles[0].text)+';\n');
