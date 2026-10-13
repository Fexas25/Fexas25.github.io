(() => {
  const $=id=>document.getElementById(id),form=$('private-unlock'),article=$('private-document');let controller;
  function lock(){controller?.abort();$('access-key').value='';$('private-title').textContent='';$('private-body').replaceChildren();$('private-project').removeAttribute('href');$('private-project').hidden=true;article.hidden=true;form.hidden=false;form.querySelector('button').disabled=false;$('private-status').textContent='';}
  $('private-lock').addEventListener('click',()=>{lock();$('access-key').focus();});window.addEventListener('pagehide',lock);window.addEventListener('hashchange',lock);
  form.addEventListener('submit',async event=>{
    event.preventDefault();const id=location.hash.slice(1),key=$('access-key').value.trim();
    if(!/^[a-f0-9-]{36}$/.test(id)||!/^[A-Za-z0-9_-]{43}$/.test(key)){$('private-status').textContent='请检查分享链接和完整密钥。';return;}
    controller?.abort();controller=new AbortController();const current=controller;
    form.querySelector('button').disabled=true;$('private-status').textContent='正在打开…';
    try {
      const origin=window.MX_COMMUNITY?.origin;if(!origin)throw Error('服务暂时不可用，请稍后重试。');
      const response=await fetch(origin+'/private/read',{method:'POST',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,key}),signal:AbortSignal.any([current.signal,AbortSignal.timeout(20000)])});
      if(!response.ok)throw Error(response.status===429?'尝试较多，请稍等一分钟再试。':response.status===403?'链接或密钥不正确，或分享已失效。':'服务暂时不可用，请稍后重试。');
      const {document:doc}=await response.json();if(current.signal.aborted)return;
      const record=window.MXContent.parse(doc.text,doc.folder+'/'+doc.filename,'');
      $('private-title').textContent=doc.title;
      $('private-body').innerHTML=DOMPurify.sanitize(marked.parse(record.body),{ALLOWED_TAGS:['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','pre','code','ul','ol','li','a','img','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['href','src','alt','title','class','start','colspan','rowspan']});
      // Do not let embedded remote resources automatically disclose that a private page was opened.
      for(const img of $('private-body').querySelectorAll('img')){
        if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(img.getAttribute('src')||'')){
          const note=document.createElement('span');note.textContent='[外部图片未自动加载]';img.replaceWith(note);
        }
      }
      for(const a of $('private-body').querySelectorAll('a')){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
      const external=record.metadata.external_url;
      if(typeof external==='string'&&/^https?:\/\//i.test(external)){const link=$('private-project');link.href=external;link.referrerPolicy='no-referrer';link.hidden=false;}
      $('access-key').value='';form.hidden=true;article.hidden=false;$('private-lock').focus();
    }catch(error){if(!current.signal.aborted)$('private-status').textContent=error.name==='TimeoutError'?'连接超时，请重试。':error.message;}
    finally{if(current===controller)form.querySelector('button').disabled=false;}
  });
})();
