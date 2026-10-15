(() => {
  // Fixed interface copy is local. Visitor messages, replies and typed text stay untouched.
  const copy = {
    '给 Meow 的小纸条':'A little note for Meow','陪我聊聊？':'Come chat with me?','给 Meow 留言':'Leave Meow a message','Meow，想说两句？':'Meow, anything to share?',
    '留言板':'Guestbook','给 MX 留言。':'Leave MX a message.','留个脚印？':'Leave a little hello?',
    '← 回到工作室':'← Back to the studio','大家的留言':'Messages from everyone','我也来留言':'Leave a message',
    'Meow！快来陪我玩！':'Meow! Come say hello!','写留言':'Write a message','关闭留言框':'Close message box',
    '昵称':'Nickname','想说的话':'Your message','今天也来摸鱼啦？':'Taking a little break today?',
    '投进留言箱':'Send your message','无需登录，审核后公开。':'No login needed. Messages appear after review.',
    '看看大家的留言':'Read the guestbook','返回留言板':'Back to the guestbook','关于：':'About:',
    '重新加载验证':'Reload verification','验证暂不可用，请重试。':'Verification is unavailable. Please retry.',
    '验证加载失败，请重试。':'Could not load verification. Please retry.','留言暂未开放，可以稍后再来。':'The message box is unavailable. Please come back later.',
    '正在投递…':'Sending…','收到啦，审核后会出现喵！':'Got it! Your message will appear after review. Meow!',
    '先歇一会儿，稍后再投递吧。':'Take a little break, then try again.',
    '提交失败，内容已保留，请重新验证后重试。':'Could not send. Your text is safe; verify again to retry.',
    '网络中断，尚不能确认投递结果。内容已保留，请稍后检查，避免重复留言。':'The connection was interrupted, so delivery is uncertain. Your text is safe. Please check later before sending again.',
    '留言板暂未开放。':'The guestbook is not available yet.','更多留言':'More messages','还没有公开留言。':'No public messages yet.',
    '留言暂时没加载出来。':'Could not load messages. Please try again.','重新加载留言':'Reload messages',
    'MX 的回复':"MX's reply",'MX 回复':'MX replies'
  };
  const roots=[...document.querySelectorAll('#quick-guestbook,.guestbook-board,.shelf-guestbook,[data-mail-open]')];
  roots.forEach(root=>root.setAttribute('translate','no'));
  const originals=new Map(Object.entries(copy).map(([zh,en])=>[en,zh]));
  function translated(value){const trimmed=value.trim(),zh=Object.prototype.hasOwnProperty.call(copy,trimmed)?trimmed:originals.get(trimmed);return zh?value.replace(trimmed,document.documentElement.lang==='en'?copy[zh]:zh):value;}
  function refresh(){
    for(const root of roots){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const node=walker.currentNode,parent=node.parentElement;
        if(parent.closest('input,textarea,script,style')||parent.closest('[data-guestbook-list]')&&!parent.closest('[data-mail-ui]'))continue;
        const next=translated(node.textContent);if(next!==node.textContent)node.textContent=next;
      }
      for(const el of [root,...root.querySelectorAll('[aria-label],[placeholder]')])for(const attr of ['aria-label','placeholder']){
        const value=el.getAttribute(attr);if(value!==null){const next=translated(value);if(next!==value)el.setAttribute(attr,next);}
      }
      for(const time of root.querySelectorAll('time[datetime]')){
        const date=new Date(time.dateTime);if(Number.isNaN(date.getTime()))continue;
        const next=date.toLocaleDateString(document.documentElement.lang==='en'?'en-GB':'zh-CN');if(time.textContent!==next)time.textContent=next;
      }
    }
  }
  const observer=new MutationObserver(refresh);
  roots.forEach(root=>observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder']}));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});refresh();
})();
