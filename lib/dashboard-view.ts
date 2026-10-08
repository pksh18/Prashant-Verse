import {summary,positionPnl,COOLDOWN,FEE,type State} from './paper-engine.ts';
import {MARKETS,LIMIT,ALLOCATION} from './market-config.ts';
import {STRATEGY} from './strategy.ts';
import {strategyInfo} from './strategies.ts';
import {goldSession} from './gold.ts';
import {entryPlan} from './entry-plan.ts';
export function dashboardView(s:State,now=Date.now()){
 const selected=strategyInfo(s.selectedStrategy),stats=summary(s),time=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(':',''));
 const listed=s.team?.universe?.pairs.map(p=>({symbol:p.symbol,name:p.name,icon:p.symbol.slice(0,1),color:'#77b6ff'}));
 const displayMarkets=listed?[...listed,...MARKETS.filter(m=>m.symbol==='XAU'),...s.positions.filter(p=>p.symbol!=='XAU'&&!listed.some(m=>m.symbol===p.symbol)).map(p=>({symbol:p.symbol,name:p.symbol+' · monitoring existing position',icon:p.symbol.slice(0,1),color:'#77b6ff'}))]:MARKETS;
 const markets=displayMarkets.map(m=>{
  const q=m.symbol==='XAU'?s.gold?.quote:s.quotes.find(q=>q.symbol===m.symbol)??(s.team?.universe?.pairs.find(p=>p.symbol===m.symbol)?{symbol:m.symbol,price:s.team.universe.pairs.find(p=>p.symbol===m.symbol)!.price,fetchedAt:s.team.universe.fetchedAt}:undefined),a=s.analysis?.[m.symbol],config=m.symbol==='XAU'&&selected.id===STRATEGY?strategyInfo('ema-9-15'):selected;
  const quoteFresh=!!q&&now-q.fetchedAt<=(m.symbol==='XAU'?90000:35000)&&q.fetchedAt<=now+1000,session=m.symbol==='XAU'?goldSession(now):null;
  const age=a?now-a.barTime-config.interval:Infinity,validSignal=!!a&&a.strategy===config.id&&a.eligible&&age>=0&&age<=Math.min(90000,config.interval-1)&&!s.feedErrors?.[m.symbol];
  const plan=validSignal&&quoteFresh&&(!session||session.entries)?entryPlan(q!.price,a!):null;
  let decision='WAIT',reason=a?.reason??'Waiting for candle data';
  if(session&&!session.entries){decision='CLOSED';reason=session.reason}
  else if(!quoteFresh){decision='STALE';reason='Fresh price required'}
  else if(s.feedErrors?.[m.symbol])reason=s.feedErrors[m.symbol]!;
  else if(plan){decision='SIGNAL';reason=plan.direction==='short'?'Qualified SHORT entry':'Qualified BUY entry';}
  const open=s.positions.find(p=>p.symbol===m.symbol);
  if(open){decision='OPEN';reason=open.pendingExit?'Exit pending':'Monitoring stop and target'}
  else if(plan){
   if(s.halted)reason='Daily risk lock';
   else if(s.lossReview?.paused)reason='Loss review required';
   else if(!s.running)reason='Entries paused';
   else if(time>=2330)reason='Daily entry cutoff';
   else if(s.positions.some(p=>p.pendingExit))reason='Waiting for pending exit';
   else if(s.positions.length>=(s.maxPositions??5))reason=`${s.maxPositions??5}-position limit`;
   else if(now-(s.lastExit[m.symbol]??0)<COOLDOWN)reason='30-minute cooldown';
   else if(s.cash<(s.allocation??ALLOCATION)+FEE)reason='Insufficient cash';
  }else if(decision==='WAIT'&&a&&age>Math.min(90000,config.interval-1))reason='Signal window expired; waiting for next candle';
  return {...m,price:q?.price??null,quoteAt:q?.fetchedAt??null,quoteFresh,decision,reason,plan:open?null:plan,signalAt:a?.barTime?a.barTime+config.interval:null,source:a?.source??s.candleSources?.[m.symbol]??(m.symbol==='XAU'?'Gold-API':'Coinbase'),strategy:config.name};
 });
 return {generatedAt:now,stats:{...stats,fees:s.fees,cash:s.cash,remainingLoss:Math.max(0,(s.dailyLimit??LIMIT)-Math.max(0,-stats.dailyPnl)),winRate:stats.closed?stats.wins/stats.closed*100:null},markets,positions:s.positions.map(p=>({...p,net:positionPnl(p)})),recentTrades:s.trades.slice(-30).reverse(),status:s.halted?'Daily risk lock':s.lossReview?.paused?'Loss review required':s.positions.some(p=>p.pendingExit)?'Exit pending':s.running?'Scanning markets':s.sessionArmed?'Waiting for next day':'Entries paused',selected:{id:selected.id,name:selected.name},message:s.message,monitoring:'browser' as const};
}
export type DashboardView=ReturnType<typeof dashboardView>;
