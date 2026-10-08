import {getChatGPTUser} from '@/app/chatgpt-auth';
import {CRYPTO_SYMBOLS} from '@/lib/market-config';
import {liquidUniverse} from '@/lib/market-feeds';
import {sharedFeed} from '@/lib/market-cache';
import {parseStats} from '@/lib/research';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  if(!await getChatGPTUser())return Response.json({error:'Sign in to load research.'},{status:401});
  const universe=await liquidUniverse();if(!universe.value||universe.error)return Response.json({error:universe.error??'Liquidity ranking unavailable'},{status:503});
  const symbols=universe.value.pairs.map(p=>p.symbol),markets=[];
  for(let i=0;i<symbols.length;i+=5){const batch=await Promise.all(symbols.slice(i,i+5).map(async symbol=>{
   try{const result=await sharedFeed('research-stats:'+symbol,async()=>{
    const r=await fetch(`https://api.exchange.coinbase.com/products/${symbol}-USD/stats`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000),cache:'no-store'});
    if(!r.ok)throw new Error('Exchange stats unavailable');return {value:parseStats(await r.json(),Date.now()),expiresAt:Date.now()+60000};
   },60000);return {symbol,stats:result.value??null,error:result.error??null};}catch{return {symbol,stats:null,error:'Research feed unavailable'}}
  }));markets.push(...batch)}
  return Response.json({markets,generatedAt:Date.now(),source:'Coinbase Exchange · top 50 USD-volume universe',universe:universe.value},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Research is unavailable. Try again later.'},{status:503})}
}
