import {nav,navStyle} from './navigation.mjs';
export function client() {
  const $=s=>document.querySelector(s), list=$('#messages'), status=$('#status'), selectAll=$('#select-all');
  let state='pending',next='',busy=false,rows=[],selected=new Set();
  const drafts=new Map(),opened=new Set();
  window.addEventListener('beforeunload',event=>{if(drafts.size){event.preventDefault();event.returnValue='';}});
  const labels={pending:'待审核',published:'已公开',trash:'回收站'};
  const actions={publish:'通过',hide:'隐藏',trash:'移入回收站',restore:'恢复待审核'};
  const allowed=()=>state==='trash'?['restore']:state==='published'?['hide','trash']:['publish','trash'];
  function message(text){status.textContent=text;}
  function controls(){
    document.querySelectorAll('button,input[type=checkbox]').forEach(el=>el.disabled=busy);
    document.querySelectorAll('textarea').forEach(el=>el.readOnly=busy);
    document.querySelectorAll('[data-batch]').forEach(el=>{el.hidden=!allowed().includes(el.dataset.batch);el.disabled=busy||!selected.size;});
    $('#selected').textContent=selected.size?'已选 '+selected.size+' 条':'';
    selectAll.checked=!!rows.length&&selected.size===rows.length;
    selectAll.indeterminate=selected.size>0&&selected.size<rows.length;
    selectAll.disabled=busy||!rows.length;
    $('#more').hidden=!next;
  }
  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(15000),...options});
    if(response.status===401||response.status===403){$('#login').hidden=false;throw Error('登录已过期，请重新登录。');}
    if(!response.headers.get('Content-Type')?.includes('application/json')){ $('#login').hidden=false;throw Error('请重新登录。'); }
    const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败，请重试。');return data;
  }
  function render(){
    list.replaceChildren();
    for(const row of rows){
      const card=document.createElement('article');card.className='card';
      const header=document.createElement('header'),label=document.createElement('label'),check=document.createElement('input');
      check.type='checkbox';check.checked=selected.has(row.id);check.setAttribute('aria-label','选择留言 '+row.id);
      check.addEventListener('change',()=>{check.checked?selected.add(row.id):selected.delete(row.id);controls();});
      const name=document.createElement('strong');name.textContent=row.name;label.append(check,name);
      const time=document.createElement('time');time.dateTime=new Date(row.created*1000).toISOString();time.textContent=new Date(row.created*1000).toLocaleString('zh-CN',{dateStyle:'medium',timeStyle:'short'});
      header.append(label,time);const text=document.createElement('p');text.className='body';text.textContent=row.message;
      const bar=document.createElement('div');bar.className='actions';
      for(const action of allowed()) {const button=document.createElement('button');button.textContent=actions[action];button.className=action==='publish'?'primary':'';button.addEventListener('click',()=>moderate(action,[row.id]));bar.append(button);}
      card.append(header,text,bar);
      if(state!=='trash'){
        const details=document.createElement('details'),summary=document.createElement('summary'),form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('textarea'),help=document.createElement('p'),buttons=document.createElement('div');
        details.className='reply-editor';details.dataset.replyId=row.id;details.open=opened.has(row.id);summary.textContent=row.reply?'修改回复':'回复';
        details.addEventListener('toggle',()=>details.open?opened.add(row.id):opened.delete(row.id));
        label.textContent='MX 的回复';input.id='reply-'+row.id;input.maxLength=1000;input.rows=3;input.value=drafts.get(row.id)?.text??row.reply??'';label.htmlFor=input.id;
        input.addEventListener('input',()=>{if(input.value===(row.reply||''))drafts.delete(row.id);else drafts.set(row.id,{...(drafts.get(row.id)||{revision:row.reply_revision||0,from:state}),text:input.value});});
        help.className='reply-help';help.textContent=state==='pending'?'审核通过后，与留言一起公开。':'保存后显示在这条留言下方。';
        buttons.className='actions';const save=document.createElement('button'),reload=document.createElement('button');save.type='submit';save.className='primary';save.textContent='保存回复';reload.type='button';reload.textContent='载入最新回复';
        reload.addEventListener('click',async()=>{if(busy||!confirm('载入最新回复？此条未保存的修改会被替换。'))return;await refresh(false,row.id);});buttons.append(save,reload);
        if(row.reply){const remove=document.createElement('button');remove.type='button';remove.textContent='撤回回复';remove.addEventListener('click',()=>{if(!busy&&confirm('撤回这条回复？原留言会保留。'))saveReply(row,'');});buttons.append(remove);}
        form.addEventListener('submit',event=>{event.preventDefault();if(!input.value.trim()){message('请填写回复，已有回复可用“撤回回复”移除。');return;}saveReply(row,input.value);});
        form.append(label,input,help,buttons);details.append(summary,form);card.append(details);
      }else if(row.reply){const answer=document.createElement('p');answer.className='body';answer.textContent='MX 回复：'+row.reply;card.append(answer);}
      list.append(card);
    }
    $('#empty').hidden=!!rows.length;
    $('#empty').textContent=state==='pending'?'没有待审核留言。':state==='published'?'还没有公开留言。':'回收站是空的。';
    controls();
  }
  async function saveReply(row,text){
    if(busy)return;const draft=drafts.get(row.id)||{revision:row.reply_revision||0,from:state};
    busy=true;controls();message('保存回复中…');
    try{
      const data=await api('/api/reply',{method:'POST',headers:{'Content-Type':'application/json','X-MX-Admin':'1'},body:JSON.stringify({id:row.id,reply:text,revision:draft.revision,from:draft.from})});
      Object.assign(row,data);drafts.delete(row.id);opened.add(row.id);render();message(text.trim()?'回复已保存。':'回复已撤回，原留言保留。');
    }catch(error){message('回复尚未确认保存，输入已保留。'+error.message);}
    finally{busy=false;controls();}
  }
  async function load(append=false,discardId=null){
    const data=await api('/api/messages?state='+state+(append&&next?'&before='+encodeURIComponent(next):''));
    if(discardId!==null)drafts.delete(discardId);
    rows=append?[...rows,...data.messages]:data.messages;next=data.next;selected.clear();
    for(const key of Object.keys(labels))document.querySelector('[data-state="'+key+'"]').textContent=labels[key]+' '+data.counts[key];
    render();
  }
  async function refresh(append=false,discardId=null){if(busy)return;busy=true;controls();message('加载中…');try{await load(append,discardId);message('');}catch(e){message(e.message==='Failed to fetch'?'连接失败，请重试或重新登录。':e.message);$('#login').hidden=false;}finally{busy=false;controls();}}
  async function moderate(action,ids){
    if(busy)return;
    if(action==='trash'&&!confirm('将 '+ids.length+' 条留言移入回收站？之后可以恢复。'))return;
    busy=true;controls();message('保存中…');
    try {
      // The API caps each batch at 30. Loaded pages may contain more selections.
      let changed=0;
      for(let i=0;i<ids.length;i+=30){const data=await api('/api/moderate',{method:'POST',headers:{'Content-Type':'application/json','X-MX-Admin':'1'},body:JSON.stringify({action,from:state,ids:ids.slice(i,i+30)})});changed+=data.changed;}
      await load();message(changed===ids.length?'已'+actions[action]+' '+changed+' 条。':'已更新 '+changed+' 条；其他留言的状态已变化，请查看最新列表。');
    }catch(e){message('操作未全部完成，请刷新确认。'+e.message);$('#login').hidden=false;}
    finally{busy=false;controls();}
  }
  document.querySelectorAll('[data-state]').forEach(button=>button.addEventListener('click',()=>{
    if(busy||state===button.dataset.state)return;state=button.dataset.state;next='';rows=[];selected.clear();render();
    document.querySelectorAll('[data-state]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));refresh();
  }));
  document.querySelectorAll('[data-batch]').forEach(button=>button.addEventListener('click',()=>moderate(button.dataset.batch,[...selected])));
  selectAll.addEventListener('change',()=>{selected=selectAll.checked?new Set(rows.map(r=>r.id)):new Set();render();});
  $('#refresh').addEventListener('click',()=>refresh());$('#more').addEventListener('click',()=>refresh(true));refresh();
}

export function page(nonce) {return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>留言管理 · MX</title>
<style nonce="${nonce}">${navStyle}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 90% 0,#deedf1aa,transparent 45%),#fffaf6;color:#37414f;font:16px/1.6 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:36px 20px 70px}a{color:#596978;text-underline-offset:4px}h1{font-size:clamp(28px,6vw,38px);margin:18px 0 24px}h1 span{color:#ec9aa5}button,a,input{touch-action:manipulation}button{font:inherit;cursor:pointer;border:1px solid #e8dfd9;border-radius:18px;background:#fffaf8;color:inherit;min-height:44px;padding:8px 16px}button:hover{background:#fae8e3}button:disabled{opacity:.55;cursor:default}button[aria-pressed=true],.primary{background:#f5cec9;border-color:#efb4b8}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #5696aa;outline-offset:3px}.top,.tabs,.toolbar,.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.top{justify-content:space-between;font-size:14px}.tabs{margin-bottom:18px}.toolbar{margin:12px 0}.toolbar label{display:flex;align-items:center;gap:6px;min-height:44px}input[type=checkbox]{width:20px;height:20px;accent-color:#c97785;flex-shrink:0}.card{padding:22px;border:1px solid #ece5df;background:#ffffffed;border-radius:22px;margin:16px 0;box-shadow:0 8px 24px #7e696307}.card header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.card label{display:flex;gap:8px;align-items:center;min-width:0}.card strong,.body{overflow-wrap:anywhere;word-break:break-word}.card time{font-size:13px;color:#73777d}.body{white-space:pre-wrap;margin:18px 0}.actions{justify-content:flex-end}#status{min-height:26px;color:#845661}#selected{font-size:14px}#empty{text-align:center;color:#73777d;padding:38px 0}[hidden]{display:none!important}#more{display:block;margin:22px auto}#login{display:inline-block;padding:8px 0}@media(max-width:420px){main{padding:22px 14px 50px}.card{padding:16px}.tabs{gap:6px}.tabs button{padding:8px 11px;font-size:14px}.toolbar button,.actions button{font-size:14px;padding:8px 12px}}@media(prefers-reduced-motion:no-preference){button{transition:background .16s}}
.reply-editor{border-top:1px dashed #e8dfd9;margin-top:18px;padding-top:8px}.reply-editor summary{cursor:pointer;min-height:44px;padding:10px 0;color:#946f81}.reply-editor label{display:block;font-size:13px;margin:6px 0}.reply-editor textarea{box-sizing:border-box;width:100%;min-height:108px;resize:vertical;font-family:inherit;font-size:16px;line-height:1.7;color:inherit;background:#fffaf8;border:1px solid #e8dfd9;border-radius:12px;padding:12px}.reply-editor textarea:focus-visible{outline:2px solid #5696aa;outline-offset:2px}.reply-help{font-size:12px;color:#73777d;margin:8px 0 12px}.reply-editor .actions{justify-content:flex-start}.reply-editor summary:focus-visible{outline:2px solid #5696aa;outline-offset:2px}
</style></head><body><main>${nav}<p><a href="https://fexas25.github.io/guestbook/" target="_blank" rel="noopener noreferrer">查看线上留言板 ↗</a></p><h1>留言管理<span>。</span></h1><nav class="tabs" aria-label="留言状态"><button data-state="pending" aria-pressed="true">待审核</button><button data-state="published" aria-pressed="false">已公开</button><button data-state="trash" aria-pressed="false">回收站</button></nav><div class="toolbar"><label><input type="checkbox" id="select-all">全选已加载</label><span id="selected"></span><button id="refresh">刷新</button></div><div class="toolbar" aria-label="批量操作"><button data-batch="publish" class="primary" disabled>通过选中</button><button data-batch="hide" disabled hidden>隐藏选中</button><button data-batch="trash" disabled>移入回收站</button><button data-batch="restore" disabled hidden>恢复选中</button></div><p id="status" role="status" aria-live="polite"></p><a id="login" href="/" target="_blank" rel="noopener noreferrer" hidden>重新登录</a><section id="messages" aria-label="留言列表"></section><p id="empty" hidden></p><button id="more" hidden>加载更多</button></main><script nonce="${nonce}">(${client.toString()})();</script></body></html>`;}
