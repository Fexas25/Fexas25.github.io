import MarkdownIt from 'markdown-it';
const markdown=new MarkdownIt({html:false,linkify:false,typographer:false});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export const readingOrigin='https://mx-community.liuwanting830.workers.dev';
export const readingUrl=id=>readingOrigin+'/read/'+id;
const headers={'Cache-Control':'no-store','CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Type':'text/html; charset=utf-8'};
export function pageModel(row,origin){
 const meta=JSON.parse(row.metadata),isPublic=row.visibility==='public';
 // Do not even parse private document JSON on the public HTML path.
 const body=isPublic?JSON.parse(row.document).text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,''):'';
 const description=isPublic?body.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/<[^>]*>/g,'').replace(/data:image\/[^\s)]+/g,'').replace(/[#*`_>]/g,'').replace(/\s+/g,' ').trim().slice(0,160):'这篇内容需要密钥。';
 return {meta,isPublic,description,html:isPublic?markdown.render(body):'',canonical:origin+'/read/'+row.id,title:row.title+' · MX的摸鱼生活'};
}
async function shellResponse(site){
 const response=await fetch(site+'/document/',{signal:AbortSignal.timeout(8000)});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('shell unavailable');
 // Bound the trusted shell as well as its fetch. Never cache document HTML.
 const reader=response.body.getReader();let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();throw Error('shell too large');}chunks.push(value);}
 return new Response(new Blob(chunks),{headers:{'Content-Type':'text/html; charset=utf-8'}});
}
export async function publicPage(request,env){
 const url=new URL(request.url),site=env.SITE_ORIGIN||'https://fexas25.github.io';
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD','X-Robots-Tag':'noindex'}});
 if(url.pathname==='/robots.txt')return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /documents\nDisallow: /messages\nDisallow: /translate\nDisallow: /private\nSitemap: '+url.origin+'/sitemap.xml\n',{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 if(url.pathname==='/sitemap.xml'){
  const {results}=await env.DB.prepare("SELECT id,updated FROM documents WHERE visibility='public' AND deleted_at=0 ORDER BY updated DESC LIMIT 50000").all();
  const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+results.map(row=>'<url><loc>'+escape(url.origin+'/read/'+row.id)+'</loc><lastmod>'+new Date(row.updated*1000).toISOString()+'</lastmod></url>').join('')+'</urlset>';
  return new Response(request.method==='HEAD'?null:xml,{headers:{...headers,'Content-Type':'application/xml; charset=utf-8'}});
 }
 const id=url.pathname.slice('/read/'.length);
 const row=uuid.test(id)?await env.DB.prepare('SELECT * FROM documents WHERE id=? AND deleted_at=0').bind(id).first():null;
 if(!row)return new Response(request.method==='HEAD'?null:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>内容暂不可用</title><p>内容已移除或暂不可用。</p><a href="'+site+'/">回到首页</a>',{status:404,headers:{...headers,'X-Robots-Tag':'noindex, nofollow'}});
 const section={_posts:['/blog/','碎碎念'],_cp:['/competitive-programming/','博客'],_projects:['/projects/','作品'],_gamejam:['/game-jam/','游戏开发'],_art:['/art/','绘画创作']}[JSON.parse(row.metadata).folder]||['/blog/','碎碎念'];
 const model=pageModel(row,url.origin),robots=model.isPublic?'index, follow, max-image-preview:large':'noindex, nofollow';
 if(request.method==='HEAD')return new Response(null,{headers:{...headers,'X-Robots-Tag':robots}});
 const rewriter=new HTMLRewriter().on('title',{element(e){e.setInnerContent(model.title);}})
  .on('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]',{element(e){e.setAttribute('content',model.description);}})
  .on('meta[property="og:title"],meta[name="twitter:title"]',{element(e){e.setAttribute('content',model.title);}})
  .on('link[rel="canonical"]',{element(e){e.setAttribute('href',model.canonical);}})
  .on('meta[property="og:url"]',{element(e){e.setAttribute('content',model.canonical);}})
  .on('meta[property="og:type"]',{element(e){e.setAttribute('content',model.isPublic?'article':'website');}})
  .on('meta[name="robots"]',{element(e){e.setAttribute('content',robots);}})
  .on('script[type="application/ld+json"]',{element(e){e.remove();}})
  .on('noscript',{element(e){if(model.isPublic)e.remove();}})
  .on('head',{element(e){e.prepend('<script>window.MX_SITE_ORIGIN='+json(site)+';</script>',{html:true});if(model.isPublic)e.append('<script type="application/ld+json">'+json({'@context':'https://schema.org','@type':'BlogPosting',headline:row.title,description:model.description,url:model.canonical,mainEntityOfPage:model.canonical,datePublished:model.meta.date,dateModified:new Date(row.updated*1000).toISOString(),author:{'@type':'Person',name:'MX',url:site+'/about/'},image:site+'/assets/optimized/studio-room-share.jpg',inLanguage:'zh-CN'})+'</script>',{html:true});}})
  .on('[data-backend-id]',{element(e){e.setAttribute('data-backend-id',id);if(model.isPublic){e.removeAttribute('data-private-content');e.removeAttribute('translate');}}})
  .on('.crumb,.reading-end .quiet-link',{element(e){e.setAttribute('href',site+section[0]);e.setInnerContent('← 返回'+section[1]);}})
  .on('.reading-header .shelf-eyebrow',{element(e){e.setInnerContent('MX / '+section[1]);}})
  .on('.year-link',{element(e){e.setAttribute('href',site+'/search/?year='+model.meta.date.slice(0,4));e.setInnerContent('查看 '+model.meta.date.slice(0,4)+' 年归档 →');}})
  .on('.reading-header h1',{element(e){e.setInnerContent(row.title);}})
  .on('.reading-header time',{element(e){e.setAttribute('datetime',model.meta.date);e.setInnerContent(model.meta.date.replaceAll('-','.'));}})
  .on('[data-document-body]',{element(e){if(model.isPublic){e.removeAttribute('hidden');e.setAttribute('data-reading-content','');e.setInnerContent(model.html,{html:true});}}})
  .on('[data-document-unlock]',{element(e){if(model.isPublic)e.setAttribute('hidden','');}})
  .on('[href],[src]',{element(e){for(const attr of ['href','src']){const value=e.getAttribute(attr);if(value?.startsWith('/')&&!value.startsWith('//'))e.setAttribute(attr,site+value);}}});
 const response=rewriter.transform(await shellResponse(site));
 // Inserted Markdown is intentionally rendered with raw HTML disabled. Resolve its
 // relative URLs separately, including legacy article-relative image locations.
 const assets=new HTMLRewriter().on('[data-document-body] [href],[data-document-body] [src]',{element(e){for(const attr of ['href','src']){const value=e.getAttribute(attr);if(value&&!value.startsWith('#')){try{e.setAttribute(attr,new URL(value,new URL(row.public_url,site)).href);}catch{e.removeAttribute(attr);}}}}}).transform(response);
 return new Response(assets.body,{headers:{...headers,'X-Robots-Tag':robots}});
}

