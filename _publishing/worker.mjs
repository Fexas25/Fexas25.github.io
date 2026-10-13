// Deploy this file as a Cloudflare Worker. Secrets belong in Worker settings.
const SITE = 'https://fexas25.github.io';
const OWNER = 'Fexas25';
const REPO = 'Fexas25.github.io';
const COOKIE = '__Host-mx_oauth';
const cookieAttrs = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const bytes64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random = () => bytes64(crypto.getRandomValues(new Uint8Array(32)));
const headers = {'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function finish(channel, payload) {
  const nonce = random();
  const data = JSON.stringify({type:'mx-github-auth',channel,...payload}).replace(/</g,'\\u003c');
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GitHub 登录</title><p>登录处理完成，请返回写作页。若原页面已关闭，请重新发起登录。</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${data},${JSON.stringify(SITE)});}</script></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Set-Cookie':`${COOKIE}=; Max-Age=0; ${cookieAttrs}`,'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}});
}
export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return new Response('Method not allowed',{status:405,headers});
    if (url.pathname === '/health') return Response.json({configured:Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)},{headers:{...headers,'Access-Control-Allow-Origin':SITE,'Vary':'Origin'}});
    if (!['/login','/callback'].includes(url.pathname)) return new Response('Not found',{status:404,headers});
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return new Response('登录服务尚未配置完成，请站主设置 GitHub App 的 Client ID 和 Client Secret。',{status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
    if (url.pathname === '/login') {
      const channel = url.searchParams.get('channel');
      if (!/^[a-f0-9-]{36}$/.test(channel || '')) return new Response('Invalid login request',{status:400,headers});
      const state = random(), verifier = random();
      const challenge = bytes64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
      const target = new URL('https://github.com/login/oauth/authorize');
      target.search = new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:url.origin+'/callback',state,code_challenge:challenge,code_challenge_method:'S256',login:OWNER,allow_signup:'false'}).toString();
      const session = encodeURIComponent(JSON.stringify({state,verifier,channel,expires:Date.now()+600000}));
      return new Response(null,{status:302,headers:{...headers,Location:target.href,'Set-Cookie':`${COOKIE}=${session}; Max-Age=600; ${cookieAttrs}`}});
    }
    let session;
    try {
      const value = (request.headers.get('Cookie') || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE+'='));
      session = JSON.parse(decodeURIComponent(value.slice(COOKIE.length+1)));
      if (!session.state || session.state !== url.searchParams.get('state') || !Number.isFinite(session.expires) || session.expires < Date.now() || session.expires > Date.now()+600000 || !/^[a-f0-9-]{36}$/.test(session.channel) || !/^[A-Za-z0-9_-]{43}$/.test(session.verifier)) throw Error('Invalid state');
    } catch { return finish('',{error:'登录校验已失效，请关闭窗口并从写作页重新登录。'}); }
    if (url.searchParams.has('error') || !url.searchParams.get('code')) return finish(session.channel,{error:'GitHub 授权未完成，请重试。'});
    try {
      const response = await fetch('https://github.com/login/oauth/access_token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),code_verifier:session.verifier,redirect_uri:url.origin+'/callback'})});
      const auth = await response.json();
      if (!response.ok || !auth.access_token) return finish(session.channel,{error:'GitHub 登录交换失败，请检查应用配置或重新登录。'});
      const ghHeaders = {Authorization:`Bearer ${auth.access_token}`,Accept:'application/vnd.github+json','User-Agent':'MX-writing-auth','X-GitHub-Api-Version':'2022-11-28'};
      const userResponse = await fetch('https://api.github.com/user',{headers:ghHeaders,signal:AbortSignal.timeout(15000)});
      const user = await userResponse.json();
      if (!userResponse.ok || user.login?.toLowerCase() !== OWNER.toLowerCase()) return finish(session.channel,{error:'此写作页仅允许网站所有者 Fexas25 登录。'});
      const repoResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`,{headers:ghHeaders,signal:AbortSignal.timeout(15000)});
      const repo = await repoResponse.json();
      if (!repoResponse.ok || !repo.permissions?.push) return finish(session.channel,{error:'请将 GitHub App 安装到网站仓库，并授予 Contents 读写权限。'});
      // The access token is delivered only to the fixed site origin, never stored or logged.
      // Refresh tokens are intentionally discarded; logging in again renews the session.
      return finish(session.channel,{token:auth.access_token});
    } catch { return finish(session.channel,{error:'登录服务暂时无法连接 GitHub，请稍后重试。'}); }
  }
};
