import {getChatGPTUser} from '@/app/chatgpt-auth';
import {globalSectorNews,macroNews,marketNews} from '@/lib/market-feeds';
import {sectorBoard} from '@/lib/sector-news';
import type {NewsSnapshot} from '@/lib/team-news';
export const dynamic='force-dynamic';
export async function GET(){
 if(!await getChatGPTUser())return Response.json({error:'Sign in to view sector research.'},{status:401});
 const names=['Investing.com stock markets RSS','Investing.com commodities RSS','CoinDesk RSS'];
 const results=await Promise.allSettled([globalSectorNews(),macroNews(),marketNews()]);
 const feeds:NewsSnapshot[]=results.map((r,i)=>r.status==='fulfilled'&&r.value.value?{...r.value.value,error:r.value.error}:{source:names[i],fetchedAt:0,headlines:[],error:r.status==='fulfilled'?r.value.error??'Feed unavailable':'Feed unavailable'});
 return Response.json(sectorBoard(feeds,Date.now()),{headers:{'Cache-Control':'no-store'}});
}
