import handler from 'vinext/server/fetch-handler';
import {browserIdentity,createBrowserSession,safeReturn,trustedHeaders} from '../lib/browser-session';

export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
    const url=new URL(request.url);
    if(!env.DB)return new Response('Portfolio database is not configured.',{status:503});
    if(url.pathname==='/signin-with-chatgpt'){
      if(request.method!=='GET')return new Response('Method not allowed',{status:405});
      const responseHeaders=new Headers({'Location':safeReturn(url.searchParams.get('return_to')),'Cache-Control':'private, no-store'});
      if(!await browserIdentity(request.headers,env.DB))responseHeaders.set('Set-Cookie',await createBrowserSession(env.DB));
      return new Response(null,{status:302,headers:responseHeaders});
    }
    // Sites authentication headers are never accepted from a public request.
    const id=await browserIdentity(request.headers,env.DB);
    const authenticated=new Request(request,{headers:trustedHeaders(request.headers,id)});
    return handler.fetch(authenticated,env,ctx);
  },
};
