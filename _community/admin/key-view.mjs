export function keyView(get){
 const $=id=>document.getElementById(id);let generation=0,timer;
 function hide(){generation++;clearTimeout(timer);$('share-key').value='';$('key-password').value='';$('key-label').hidden=true;$('key-password-form').hidden=true;$('key-view-status').textContent='';$('key-submit').disabled=false;}
 function update(){hide();const item=get();$('key-vault').hidden=!item?.id||item.visibility!=='private';}
 $('view-key').onclick=()=>{hide();$('key-password-form').hidden=false;$('key-password').focus();};
 $('hide-key').onclick=hide;
 $('key-password-form').onsubmit=async e=>{e.preventDefault();const item=get();if(!item||$('key-submit').disabled)return;const request=++generation,password=$('key-password').value;$('key-password').value='';$('key-submit').disabled=true;$('key-view-status').textContent='正在验证…';try{const r=await window.MXAdminApi('keys',{...item,password});if(request!==generation)return;$('share-key').value=r.key;$('key-label').hidden=false;$('key-password-form').hidden=true;$('key-view-status').textContent='30 秒后自动隐藏。';timer=setTimeout(hide,30000);}catch(e){if(request===generation)$('key-view-status').textContent=e.message;}finally{if(request===generation)$('key-submit').disabled=false;}};
 $('copy-key').onclick=async()=>{const field=$('share-key');if($('key-label').hidden||!field.value)return;try{await navigator.clipboard.writeText(field.value);$('key-view-status').textContent='已复制，密钥将自动隐藏。';}catch{field.focus();field.select();$('key-view-status').textContent='请长按复制。';}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});window.addEventListener('pagehide',hide);
 for(const form of document.querySelectorAll('#writing-form,#project-form'))form.addEventListener('input',hide);
 return {hide,update};
}
