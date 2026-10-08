import {higherFrame} from '@/lib/macro-risk';
import {reviewScope} from '@/lib/trade-learning';
import {ensureTeam,teamAdvance,teamResponse,chartCheck} from '@/lib/decision-team';
import {dashboardView} from '@/lib/dashboard-view';
import {CRYPTO_SYMBOLS} from '@/lib/market-config';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readPortfolio,savePortfolio} from '@/lib/portfolio-store';
import {STRATEGIES,analyzeStrategy} from '@/lib/strategies';
import {cryptoCandles,goldQuote,marketNews,macroNews,liquidUniverse} from '@/lib/market-feeds';
import {goldSession} from '@/lib/gold';
import type {Symbol} from '@/lib/market-config';
import {summary,type Quote} from '@/lib/paper-engine';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const u=await getChatGPTUser();if(!u)return json({error:'Sign in to open your private portfolio.',signin:true},401);const {state}=await readPortfolio(u.userId);return json(teamResponse(state))}catch(e){console.error(e);return json({error:'Portfolio storage is unavailable. Your existing trades have not been changed.'},503)}}
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
  const u=await getChatGPTUser();if(!u)return json({error:'Sign in to start your trading session.',signin:true},401);
  const {action,reviewKey,reviewNote}=await req.json() as {action:string;reviewKey?:string;reviewNote?:string};if(!['tick','start','pause','close','strategy','review'].includes(action))return json({error:'Unknown action'},400);
  const {state,revision}=await readPortfolio(u.userId);
  ensureTeam(state);state.team!.macroPolicy=true;
  if(action==='review'){try{reviewScope(state,reviewKey??'',reviewNote??'',Date.now())}catch(e){return json({error:e instanceof Error?e.message:'Review rejected'},400)}await savePortfolio(u.userId,state,revision);return json(teamResponse(state))}
  if(action==='strategy')return json({error:'Research evaluates all ten presets; Trader selects only a team-approved setup.'},400);
  if(action==='pause'){state.running=false;state.sessionArmed=false;state.message='Team entries paused. Risk exits remain monitored.';await savePortfolio(u.userId,state,revision);return json(teamResponse(state))}
  if(action==='tick'&&Date.now()-state.lastTick<4000)return json(teamResponse(state));
  try{const result=await liquidUniverse();state.team!.universe=result.value?{...result.value,error:result.error}:{pairs:[],fetchedAt:0,source:'Coinbase Advanced',error:result.error??'Liquidity ranking unavailable'}}catch{state.team!.universe={...(state.team!.universe??{pairs:[],fetchedAt:0,source:'Coinbase Advanced'}),error:'Liquidity ranking unavailable'}}
  const symbols=state.team!.universe.pairs.map(p=>p.symbol),cursor=(state.team!.scanCursor??0)%Math.max(1,symbols.length),scanSymbols=Array.from({length:Math.min(5,symbols.length)},(_,i)=>symbols[(cursor+i)%symbols.length]);
  state.team!.hour??={};state.team!.atr15??={};
  const higherSymbols=[...new Set(['BTC',...scanSymbols])];
  await Promise.all(higherSymbols.map(async symbol=>{for(const interval of [3600000,900000]){if(symbol==='BTC'&&interval===900000&&!scanSymbols.includes('BTC'))continue;const result=await cryptoCandles(symbol,interval,80),frame=higherFrame(result.value?.bars??[],Date.now(),interval);if(result.error)frame.error=result.error;if(interval===3600000){state.team!.hour![symbol]=frame;if(symbol==='BTC')state.team!.btcHour=frame}else state.team!.atr15![symbol]=frame}}));
  const cache=new Map<string,Awaited<ReturnType<typeof cryptoCandles>>>();
  for(const config of STRATEGIES){const now=Date.now(),expectedBar=Math.floor(now/config.interval)*config.interval-config.interval;
   if(action==='close'||!scanSymbols.some(sym=>(state.team!.research[config.id]?.[sym]?.analysis.barTime??0)<expectedBar))continue;
   state.team!.research[config.id]??={};
   for(let i=0;i<scanSymbols.length;i+=2)await Promise.all(scanSymbols.slice(i,i+2).map(async symbol=>{const key=`${symbol}:${config.interval}:${config.history}`;let result=cache.get(key);if(!result){result=await cryptoCandles(symbol,config.interval,config.history);cache.set(key,result)}const bars=result.value?.bars??[],analysis=analyzeStrategy(config.id,bars,Date.now());const average=bars.slice(-21,-1).reduce((n,b)=>n+b.volume,0)/20;analysis.volumeRatio=average>0?(bars.at(-1)?.volume??0)/average:0;analysis.source=result.value?.source;if(result.error){analysis.eligible=false;analysis.reason=result.error}state.team!.research[config.id]![symbol]={analysis,chart:chartCheck(config.id,bars,Date.now()),candles:bars.slice(-5)}}));
  }
  if(action!=='close'){state.team!.scanCursor=(cursor+scanSymbols.length)%Math.max(1,symbols.length);state.team!.scanUpdated??={};for(const symbol of scanSymbols)state.team!.scanUpdated[symbol]=Date.now()}
  try{const result=await marketNews();state.team!.news=result.value?{...result.value,error:result.error}:{source:'CoinDesk RSS',fetchedAt:0,headlines:[],error:result.error??'News unavailable'}}catch{state.team!.news={source:'CoinDesk RSS',fetchedAt:0,headlines:[],error:'News feed unavailable'}}
  try{const result=await macroNews();state.team!.macroNews=result.value?{...result.value,error:result.error}:{source:'Investing.com commodities RSS',fetchedAt:0,headlines:[],error:result.error??'Commodities news unavailable'}}catch{state.team!.macroNews={source:'Investing.com commodities RSS',fetchedAt:0,headlines:[],error:'Commodities news unavailable'}}
  state.gold??={frames:{}};
  try{
   const result=await goldQuote(),q=result.value;state.gold.error=result.error;
   if(q)state.gold.quote=q;

  }catch{state.gold.error='Gold price source unavailable'}
  // Fetch marks after slow candle refreshes so stops never use expired pre-refresh quotes.
  const now=Date.now(),candidateSymbols=symbols.filter(symbol=>!state.positions.some(p=>p.symbol===symbol)&&Object.entries(state.team!.research).some(([id,analyses])=>{const a=analyses?.[symbol]?.analysis,config=STRATEGIES.find(c=>c.id===id);return a?.eligible&&config&&a.barTime>(state.lastDecision?.[symbol]??0)&&now-a.barTime-config.interval<=Math.min(90000,config.interval-1)})).slice(0,10);
  const marks=[...new Set([...state.positions.map(p=>p.symbol),...(state.legacy?.positions.map(p=>p.symbol)??[]),...scanSymbols,...candidateSymbols])].filter(sym=>sym!=='XAU');
  state.team!.spreads??={};await Promise.all(candidateSymbols.map(async symbol=>{try{const r=await fetch(`https://api.exchange.coinbase.com/products/${encodeURIComponent(symbol)}-USD/ticker`,{signal:AbortSignal.timeout(4000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Spread unavailable');const data=await r.json() as {bid:string;ask:string;time:string},stamp=Date.parse(data.time),bid=Number(data.bid),ask=Number(data.ask);if(!(bid>0&&ask>=bid)||!Number.isFinite(stamp)||Date.now()-stamp>30000||stamp>Date.now()+1000)throw new Error('Invalid or stale spread');state.team!.spreads![symbol]={fraction:(ask-bid)/((ask+bid)/2),fetchedAt:Date.now()}}catch{state.team!.spreads![symbol]={fraction:0,fetchedAt:Date.now(),error:'Spread feed unavailable'}}}));
  const quotes:Quote[]=[];state.feedErrors={};
  for(let i=0;i<marks.length;i+=5)await Promise.all(marks.slice(i,i+5).map(async symbol=>{try{
   const r=await fetch(`https://api.coinbase.com/v2/prices/${encodeURIComponent(symbol)}-USD/spot`,{headers:{Accept:'application/json','User-Agent':'PrashantVerse/5.0'},signal:AbortSignal.timeout(4000),cache:'no-store'});
   if(!r.ok)throw new Error('Fresh price unavailable');const v=await r.json() as {data:{amount:string;base:string;currency:string}};
   if(v.data.base!==symbol||v.data.currency!=='USD')throw new Error('Invalid pair');const price=Number(v.data.amount);if(!Number.isFinite(price)||price<=0)throw new Error('Invalid price');quotes.push({symbol,price,fetchedAt:Date.now()});
  }catch{state.feedErrors![symbol]='Fresh execution price unavailable; new entries blocked for this pair'}}));
  const gold=state.gold.quote;if(gold&&!state.gold.error&&Date.now()-gold.fetchedAt<=90000&&goldSession(Date.now()).open)quotes.push(gold);
  if(!quotes.length){await savePortfolio(u.userId,state,revision);return json({...teamResponse(state),error:'No fresh execution prices. Entries wait; cached scanner prices remain visible.'},503)}
  teamAdvance(state,quotes,Date.now(),action);try{await savePortfolio(u.userId,state,revision)}catch(e){
   if(action==='tick'&&e instanceof Error&&e.message.startsWith('Another tab')){const latest=await readPortfolio(u.userId);return json(teamResponse(latest.state,Date.now()))}
   throw e;
  }
  return json(teamResponse(state));
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Unable to update portfolio'},409)}
}
