export const nav='<details class="hub-navigation" open><summary>管理导航</summary><nav class="hub-nav" aria-label="管理导航"><a href="/">管理中心</a><a href="/write">写新文章</a><a href="/projects/new">发布新项目</a><a href="/drafts">草稿管理</a><a href="/articles">已发布文章</a><a href="/projects">已发布项目</a><a href="/messages">留言管理</a><a href="https://fexas25.github.io/" target="_blank" rel="noopener noreferrer">查看线上效果 ↗</a><a href="/help">使用帮助</a><a href="/cdn-cgi/access/logout">退出</a></nav></details>';
export const navStyle='.hub-nav{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:24px}.hub-nav a{display:inline-block;min-height:44px;padding:10px 16px;border:1px solid #e8dcd6;border-radius:18px;background:#fff1eb;color:inherit;text-decoration:none;font:14px/1.65 system-ui,sans-serif;touch-action:manipulation}';

export const compactNavStyle=`.hub-navigation>summary{display:none}.hub-navigation{margin-bottom:24px}.hub-navigation .hub-nav{margin-bottom:0}@media(max-width:600px){.hub-navigation>summary{display:list-item;min-height:44px;padding:10px 14px;border:1px solid #e8dcd6;border-radius:16px;background:#fff1eb;cursor:pointer;font-size:14px;overflow-wrap:anywhere}.hub-navigation[open] .hub-nav{margin-top:10px}.hub-navigation{margin-bottom:16px}.hub-navigation>summary:focus-visible{outline:3px solid #6b9aab;outline-offset:3px}}`;
export function navClient(){
 const menu=document.querySelector('.hub-navigation');if(!menu)return;
 const media=matchMedia('(max-width:600px)');
 menu.querySelector('summary').textContent='管理导航 · '+document.title.split(' · ')[0];
 const update=()=>{menu.open=!media.matches;};update();
 if(media.addEventListener)media.addEventListener('change',update);else media.addListener(update);
}
