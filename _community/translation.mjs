// Keep emoji graphemes and line breaks out of the translation model.
// Return a complete translation only; callers must not cache partial results.
export async function translateText(text, run) {
 const pieces=[];let pending='';
 const flush=()=>{if(pending){pieces.push({text:pending,translate:true});pending='';}};
 for(const {segment} of new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(text)){
  if(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3\r\n]/u.test(segment)){flush();pieces.push({text:segment,translate:false});}
  else pending+=segment;
 }
 flush();
 const fragments=pieces.filter(p=>p.translate&&/[\u3400-\u9fff]/.test(p.text));
 if(fragments.length>16)throw Object.assign(Error('translation failed'),{status:502});
 for(const part of fragments){
  const source=part.text.trim(),result=await run(source);
  if(typeof result!=='string'||!result.trim())throw Object.assign(Error('translation failed'),{status:502});
  part.text=part.text.replace(source,result.trim());
 }
 return pieces.map(p=>p.text).join('');
}
