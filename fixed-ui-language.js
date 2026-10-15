/* Fixed interface text only: never translate article text, inputs or keys. */
(() => {
 const labels={
 '收起来':'Lock again','打开作品 ↗':'Open project ↗','[外部图片未自动加载]':'[External image not loaded automatically]',
 '文章图片预览':'Article image preview','查看原尺寸':'View original size','适应屏幕':'Fit to screen','关闭图片 ×':'Close image ×',
 '图片暂时无法加载，可以关闭后重试。':'Image unavailable. Close and try again.','点击放大图片':'Enlarge image',
 '复制代码':'Copy code','已复制':'Copied','请复制已选中的代码':'Copy the selected code manually',
 '有人留了一份分享给你':'Someone shared something with you','访问密钥':'Access key','打开看看':'Open',
 '请检查分享链接和完整密钥。':'Check the shared link and the complete access key.','正在打开…':'Opening…',
 '服务暂时不可用，请稍后重试。':'Service unavailable. Please retry.','尝试较多，请稍等一分钟再试。':'Too many attempts. Please wait a minute.',
 '链接或密钥不正确，或分享已失效。':'Incorrect link or key, or the share has expired.','连接超时，请重试。':'Connection timed out. Please retry.',
 '正在准备搜索…':'Preparing search…','正在准备搜索。':'Preparing search…',
 '没有找到符合条件的内容，试试更短的关键词或清除筛选。':'No matches. Try fewer keywords or clear filters.',
 '搜索暂时没加载好，请稍后重试。':'Search unavailable. Please retry.',
 '重新加载搜索':'Reload search','再看 20 条':'Show 20 more'
 };
 Object.assign(labels,{"已生成备份，请妥善保存下载的 JSON 文件。": "Backup downloaded. Keep the JSON file safe.", "备份生成失败，请稍后重试。": "Backup failed. Please retry.", "文件过大，请选择小于 2 MB 的签到备份。": "Choose a check-in backup smaller than 2 MB.", "无法读取此文件，请选择导出的 JSON 备份。": "Cannot read this file. Choose an exported JSON backup.", "浏览器无法保存备份，原记录未更改。请检查存储设置后重试。": "Unable to save. Existing records are unchanged. Check browser storage and retry.", "这不是受支持的 MX 签到备份文件。": "This is not a supported MX check-in backup.", "备份记录列表不正确或过大。": "The backup record list is invalid or too large.", "备份的累计或连续签到天数不正确。": "The backup has invalid total or consecutive check-in days.", "备份的最近签到日期不正确，或晚于当前日期。": "The last check-in date is invalid or in the future.", "备份含无效、未来或重复的签到日期。": "The backup contains invalid, future or duplicate dates.", "备份的签文内容格式不正确。": "A fortune entry has an invalid format.", "备份中有记录缺少签文。": "A backup record is missing its fortune.", "备份中的图片路径不受支持。": "The backup contains an unsupported image path.", "备份中的最近签到日期与记录不一致。": "The last check-in date does not match the records.", "备份统计与签到记录不一致。": "Backup totals do not match the check-in records."});
 const patterns=[[/^导入完成，新增 (\d+) 条记录。同一天的原签文已保留。$/,n=>`Imported ${n} new records. Existing draws were kept.`],[/^显示 (\d+) 项$/,n=>`Showing ${n} items`],[/^· 已筛选 (\d+) 项$/,n=>`· ${n} filtered items`],
 [/^找到 (\d+) 项，显示 (\d+) 项$/, (n,m)=>`Found ${n} items, showing ${m}`],
 [/^复制第 (\d+) 段代码$/,n=>`Copy code block ${n}`],[/^放大图片：(.+)$/,alt=>`Enlarge image: ${alt}`]];
 const records=new WeakMap();
 function english(value){
  const suffix=' · 最新内容目录暂未加载，可重试';
  if(value.endsWith(suffix)){const base=english(value.slice(0,-suffix.length));return base===undefined?undefined:base+' · Latest content unavailable. Retry to load it.';}
  if(labels[value])return labels[value];
  for(const [pattern,format] of patterns){const match=value.match(pattern);if(match)return format(...match.slice(1));}
 }
 function convert(node){
  const previous=records.get(node),current=node.textContent;
  const source=previous&&current===previous.output?previous.source:current;
  const translated=english(source.trim());if(translated===undefined)return;
  const output=document.documentElement.lang==='en'?source.replace(source.trim(),translated):source;
  records.set(node,{source,output});if(current!==output)node.textContent=output;
 }
 function update(){
  for(const root of document.querySelectorAll('[data-fixed-ui],#backup-status,[data-result-status],[data-filter-summary],[data-search-status],.search-retry,.search-more')){
   root.setAttribute('translate','no');
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())convert(walker.currentNode);
   for(const el of [root,...root.querySelectorAll('[aria-label],[title]')])for(const name of ['aria-label','title']){const node=el.getAttributeNode(name);if(node)convert(node);}
  }
  for(const el of document.querySelectorAll('[data-fixed-ui-attributes]')){
   el.setAttribute('translate','no');for(const name of ['aria-label','title']){const node=el.getAttributeNode(name);if(node)convert(node);}
  }
 }
 let pending=false;
 const schedule=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;update();});};
 // Observe text changes, not our own translate attribute writes.
 new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update();
})();
