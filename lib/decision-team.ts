import {freshFrame,volatilityAnalysis,type HigherFrame} from './macro-risk.ts';
import {sectorBoard} from './sector-news.ts';
import {refreshLearning,learningGate,LEARNING_VERSION} from './trade-learning.ts';
import {initial,advance,equity,summary,positionPnl,FEE,COOLDOWN,LIMIT,type State,type Quote} from './paper-engine.ts';
import {STRATEGIES,analyzeStrategy,strategyInfo,type StrategyId} from './strategies.ts';
import {entryPlan} from './entry-plan.ts';
import {dashboardView} from './dashboard-view.ts';
import {goldSession} from './gold.ts';
import {newsGate,type NewsSnapshot} from './team-news.ts';
import type {Analysis,Candle} from './strategy.ts';
import type {Symbol} from './market-config.ts';
export type Vote={role:'Research'|'News'|'Charts'|'Risk'|'Trader';status:'PASS'|'WAIT'|'BLOCK';reason:string};
export type Candidate={symbol:Symbol;strategy:StrategyId;analysis:Analysis;chart:{approved:boolean;reason:string};votes:Vote[];allocation:number;estimatedRisk:number;approved:boolean};
export type TeamState={version:1;macroPolicy?:boolean;btcHour?:HigherFrame;hour?:Record<string,HigherFrame>;atr15?:Record<string,HigherFrame>;spreads?:Record<string,{fraction:number;fetchedAt:number;error?:string}>;universe?:import('./crypto-universe.ts').CryptoUniverse;scanCursor?:number;scanUpdated?:Record<string,number>;news?:NewsSnapshot;macroNews?:NewsSnapshot;checkedAt:number;research:Partial<Record<StrategyId,Partial<Record<Symbol,{analysis:Analysis;chart:{approved:boolean;reason:string};candles?:Candle[]}>>>>;candidates:Candidate[];votes:Vote[];decision:string;archive?:{agents:State['agents'];curve:State['curve'];time:number};log:{time:number;decision:string;symbol?:Symbol;strategy?:StrategyId}[]};
export const TEAM_MAX_POSITIONS=10;
const timedExits=new Set(['23:55 IST intraday close','Missed session end: closed on reconnect','Gold pre-break intraday close','Four-hour time exit','Close legacy holding']);
function enablePriceExits(s:State){s.exitPolicy='price-only';s.strategyMode='price-exits';for(const p of s.positions)if(p.pendingExit&&timedExits.has(p.pendingExit))delete p.pendingExit}
export function ensureTeam(s:State){
 enablePriceExits(s);if(s.legacy)enablePriceExits(s.legacy);
 if(s.team){refreshLearning(s);s.dailyLimit=LIMIT;s.maxPositions=Math.max(TEAM_MAX_POSITIONS,s.positions.length);return s}
 if(s.agents){s.cash=s.agents.reduce((n,a)=>n+a.state.cash,0);s.dayBase=s.agents.reduce((n,a)=>n+a.state.dayBase,0);s.realized=s.agents.reduce((n,a)=>n+a.state.realized,0);s.fees=s.agents.reduce((n,a)=>n+a.state.fees,0);s.positions=s.agents.flatMap(a=>a.state.positions);s.trades=s.agents.flatMap(a=>a.state.trades).sort((a,b)=>a.time-b.time);s.startedAt=s.agents.map(a=>a.state.startedAt).find(Boolean)??s.startedAt}
 const archive=s.agents?{agents:structuredClone(s.agents),curve:structuredClone(s.curve),time:Date.now()}:undefined;
 s.team={version:1,checkedAt:0,research:{},candidates:[],votes:[],decision:'Team ready. Review and start scanning.',archive,log:[]};
 s.agents=undefined;s.running=false;s.sessionArmed=false;s.agentId='team';s.startingCapital=100000;s.dailyLimit=LIMIT;s.maxPositions=Math.max(TEAM_MAX_POSITIONS,s.positions.length);s.allocation=1000;s.lossReview=archive?.agents?.find(a=>a.state.lossReview?.paused)?.state.lossReview??s.lossReview;s.analysis={};s.lastDecision={};s.message=s.team.decision;
 refreshLearning(s);return s;
}
export function chartCheck(id:StrategyId,input:Candle[],now:number){
 const config=strategyInfo(id),bars=input.filter(b=>b.time+config.interval<=now),last=bars.at(-1),prev=bars.at(-2);
 if(bars.length<config.minBars||!last||!prev||now-last.time-config.interval>Math.min(90000,config.interval-1)||bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==config.interval))return {approved:false,reason:'Charts need fresh, continuous completed candles'};
 const a=analyzeStrategy(id,bars,now),sign=a.direction==='short'?-1:1;let e=bars[0].close;const emas=bars.map(b=>(e+=2/21*(b.close-e))),n=bars.length-1;
 const priceAction=sign*(last.close-last.open)>0&&sign*(last.close-(sign===1?prev.high:prev.low))>0;
 const momentum=sign*(last.close-bars[n-3].close)>0&&sign*(last.close-emas[n])>0;
 const approved=priceAction&&(id==='bollinger-reversion'||id==='liquidity-sweep'?true:momentum);
 return {approved,reason:approved?'Completed-candle price action confirmed'+(id==='bollinger-reversion'||id==='liquidity-sweep'?' for a reversal setup':' with aligned momentum'):'Chart confirmation or momentum disagrees with the proposed direction'};
}
export function reservedRisk(s:State){return s.positions.reduce((n,p)=>{const sign=p.direction==='short'?-1:1,stop=p.stop??p.entry*(1-sign*.01);return n+Math.max(0,sign*(p.mark-stop)*p.quantity)+stop*p.quantity*.0005+FEE},0)}
export function riskCheck(s:State,symbol:Symbol,a:Analysis,now=Date.now()){
 const learned=learningGate(s,a.strategy??s.selectedStrategy??'unknown',symbol,a.direction??'long');
 if(!learned.approved)return {approved:false,allocation:0,estimatedRisk:0,reason:learned.reason};
 if(s.team?.macroPolicy&&symbol!=='XAU'){const spread=s.team.spreads?.[symbol];if(!spread||spread.error||now-spread.fetchedAt>30000||spread.fraction<0||spread.fraction>.001)return {approved:false,allocation:0,estimatedRisk:0,reason:'Fresh spread must be at most 0.10%'};}
 if(symbol!=='XAU'&&s.positions.filter(p=>p.symbol!=='XAU'&&(p.direction??'long')===(a.direction??'long')).length>=2)return {approved:false,allocation:0,estimatedRisk:0,reason:'Concentration guard: maximum two crypto positions in the same direction (conservative cap, not measured correlation)'};
 if(symbol==='XAU'&&(!goldSession(now).entries))return {approved:false,allocation:0,estimatedRisk:0,reason:'Gold session is closed or past its entry cutoff'};
 if(s.team?.universe&&(s.team.universe.error||now-s.team.universe.fetchedAt>120000))return {approved:false,allocation:0,estimatedRisk:0,reason:'Liquid-pair ranking is stale or unavailable'};
 if(s.positions.some(p=>p.symbol!=='XAU'&&!s.quotes.some(q=>q.symbol===p.symbol&&now-q.fetchedAt<=30000)))return {approved:false,allocation:0,estimatedRisk:0,reason:'Open position has a missing or stale mark'};
 const q=s.quotes.find(q=>q.symbol===symbol),plan=q?entryPlan(q.price,a):null,remaining=LIMIT-Math.max(0,-summary(s).dailyPnl)-reservedRisk(s);
 if(s.halted||s.lossReview?.paused||s.positions.length>=TEAM_MAX_POSITIONS||s.positions.some(p=>p.symbol===symbol)||s.legacy?.positions.length||!plan||remaining<=2*FEE)return {approved:false,allocation:0,estimatedRisk:0,reason:s.halted?'Daily $100 risk lock':s.lossReview?.paused?'Loss-pattern review required':s.legacy?.positions.length?'Previous account exits pending':'Position, duplicate asset, stop or remaining-risk check blocked'};
 const rawFraction=Math.abs(plan.entry-plan.stop)/plan.entry,spreadCost=s.team?.macroPolicy&&symbol!=='XAU'?(s.team.spreads?.[symbol]?.fraction??0):0;
 if(s.team?.macroPolicy&&symbol!=='XAU'&&(3*rawFraction-.001-spreadCost)/(rawFraction+.001+spreadCost)<2.5)return {approved:false,allocation:0,estimatedRisk:0,reason:'Estimated reward/risk after spread and slippage is below 2.5R'};
 const fraction=rawFraction+.001+spreadCost,budget=Math.min(20,remaining),allocation=Math.max(0,Math.min(1000,s.cash-FEE,(budget-2*FEE)/fraction)),estimatedRisk=allocation*fraction+2*FEE;
 return {approved:allocation>=100,allocation,estimatedRisk,reason:allocation>=100?`Size $${allocation.toFixed(2)}; estimated stop-and-cost risk $${estimatedRisk.toFixed(2)}, capped at $20`:'Remaining risk budget is too small for a $100 minimum allocation'};
}
export function evaluateTeam(s:State,now:number){
 const team=s.team!;team.candidates=[];
 for(const config of STRATEGIES)for(const [symbol,v] of Object.entries(team.research[config.id]??{})){
  if(!v||!v.analysis.eligible||symbol!=='XAU'&&team.universe&&!team.universe.pairs.some(p=>p.symbol===symbol))continue;const age=now-v.analysis.barTime-config.interval;if(age<0||age>Math.min(90000,config.interval-1))continue;
  let analysis=v.analysis,macroReason='';
  if(team.macroPolicy&&symbol!=='XAU'){const direction=analysis.direction??'long',sector=sectorBoard(team.news?[team.news]:[],now).sectors.find(x=>x.id==='crypto')!,hour=team.hour?.[symbol];
   if(!freshFrame(team.btcHour,now,3600000))macroReason='BTC 1-hour trend unavailable';
   else if(direction==='long'&&(team.btcHour!.trend!=='BULLISH'||sector.tone!=='buy'))macroReason='Long blocked: BTC must be bullish and crypto news must be BUY WATCH';
   else if(direction==='short'&&sector.tone==='buy')macroReason='Short blocked: crypto news is BUY WATCH';
   else if(!freshFrame(hour,now,3600000)||hour!.trend!==(direction==='long'?'BULLISH':'BEARISH'))macroReason='Asset 1-hour trend does not confirm entry direction';
   else if((analysis.volumeRatio??0)<1.1)macroReason='Entry volume must exceed its prior 20-bar average by 10%';
   const quote=s.quotes.find(q=>q.symbol===symbol);analysis=volatilityAnalysis(analysis,team.atr15?.[symbol],quote?.price??0,now);if(!analysis.eligible)macroReason=macroReason||analysis.reason;
  }
  const news=newsGate(symbol==='XAU'?team.macroNews:team.news,now,symbol),risk=riskCheck(s,symbol as Symbol,analysis,now),approved=!macroReason&&news.approved&&v.chart.approved&&risk.approved;
  const votes:Vote[]=[{role:'Research',status:macroReason?'BLOCK':'PASS',reason:macroReason||`${config.name}: ${analysis.reason}`},{role:'News',status:news.approved?'PASS':'BLOCK',reason:news.reason},{role:'Charts',status:v.chart.approved?'PASS':'BLOCK',reason:v.chart.reason},{role:'Risk',status:risk.approved?'PASS':'BLOCK',reason:risk.reason},{role:'Trader',status:approved&&s.running?'PASS':'WAIT',reason:approved?s.running?'All required checks passed; order still subject to candle/cooldown and execution checks':'Team agrees; entries paused':'Waiting for unanimous approval'}];
  team.candidates.push({symbol:symbol as Symbol,strategy:config.id,analysis,chart:v.chart,votes,allocation:risk.allocation,estimatedRisk:risk.estimatedRisk,approved});
 }
 // Different strategy scores are not comparable: prefer unanimous setups, then fresher candles and stable asset/strategy order.
 team.candidates.sort((a,b)=>Number(b.approved)-Number(a.approved)||b.analysis.barTime-a.analysis.barTime||a.symbol.localeCompare(b.symbol)||a.strategy.localeCompare(b.strategy));
 const best=team.candidates[0];team.votes=best?.votes??([{role:'Research',status:'WAIT',reason:'No fresh qualified setup across the ten strategy presets'},{role:'News',status:newsGate(team.news,now,'BTC').approved?'PASS':'BLOCK',reason:newsGate(team.news,now,'BTC').reason},{role:'Charts',status:'WAIT',reason:'Waiting for a research candidate'},{role:'Risk',status:s.halted?'BLOCK':'WAIT',reason:s.halted?'Daily $100 risk lock':'Position sizing runs for each candidate'},{role:'Trader',status:'WAIT',reason:'No team-approved entry'}] as Vote[]);team.checkedAt=now;team.decision=best?`${best.approved?'Team agrees':'Team waits'}: ${best.analysis.direction==='short'?'SHORT':'BUY'} ${best.symbol} · ${strategyInfo(best.strategy).name}`:'WAIT · No qualified setup';return team;
}
export function teamAdvance(s:State,quotes:Quote[],now:number,action:string){
 ensureTeam(s);s.maxPositions=Math.max(TEAM_MAX_POSITIONS,s.positions.length);
 if(s.legacy){const legacyQuotes=quotes.filter(q=>s.legacy!.positions.some(p=>p.symbol===q.symbol));if(s.legacy.positions.length&&legacyQuotes.length)advance(s.legacy,legacyQuotes,now,action==='close'?'close':'tick',undefined,()=>false,true);s.legacy.running=false;s.legacy.sessionArmed=false}
 const previousDecisions={...s.lastDecision};advance(s,quotes,now,action,undefined,()=>false);s.lastDecision=previousDecisions;s.maxPositions=Math.max(TEAM_MAX_POSITIONS,s.positions.length);
 for(const config of STRATEGIES){const bars=s.gold?.frames[config.interval]?.closed??[];const analysis=analyzeStrategy(config.id,bars,now);analysis.source='Gold-API · observed candles';if(!goldSession(now).entries){analysis.eligible=false;analysis.reason=goldSession(now).reason}if(!s.quotes.some(q=>q.symbol==='XAU'&&now-q.fetchedAt<=90000)){analysis.eligible=false;analysis.reason=s.gold?.error??'Fresh gold quote required'}s.team!.research[config.id]??={};s.team!.research[config.id]!.XAU={analysis,chart:chartCheck(config.id,bars,now),candles:structuredClone(bars.slice(-5))}}
 refreshLearning(s);const team=evaluateTeam(s,now),best=team.candidates.find(c=>c.approved&&c.analysis.barTime>(s.lastDecision?.[c.symbol]??0)&&now-(s.lastExit[c.symbol]??0)>=COOLDOWN),before=new Set(s.trades.map(t=>t.id));
 if(best&&s.running&&action!=='close'&&action!=='pause'){
  team.votes=best.votes;team.decision=`Team agrees: ${best.analysis.direction==='short'?'SHORT':'BUY'} ${best.symbol} · ${strategyInfo(best.strategy).name}`;
  s.selectedStrategy=best.strategy;s.analysis={[best.symbol]:best.analysis};s.allocation=best.allocation;
  const executionQuote=quotes.find(q=>q.symbol===best.symbol)!,newsSnapshot=best.symbol==='XAU'?team.macroNews:team.news;
  s.pendingEntryAudit={version:team.macroPolicy&&best.symbol!=='XAU'?'macro-atr-3r-v1':LEARNING_VERSION,macro:team.macroPolicy&&best.symbol!=='XAU'?{btcHour:structuredClone(team.btcHour),assetHour:structuredClone(team.hour?.[best.symbol]),atr15:structuredClone(team.atr15?.[best.symbol]),spreadFraction:team.spreads?.[best.symbol]?.fraction,cryptoTone:sectorBoard(team.news?[team.news]:[],now).sectors.find(x=>x.id==='crypto')?.tone}:undefined,time:now,quote:{price:executionQuote.price,fetchedAt:executionQuote.fetchedAt},signal:{barTime:best.analysis.barTime,strategy:best.strategy,direction:best.analysis.direction??'long',reason:best.analysis.reason},indicators:structuredClone(best.analysis),recentCandles:structuredClone(team.research[best.strategy]?.[best.symbol]?.candles??[]),votes:structuredClone(best.votes),news:{source:newsSnapshot?.source,fetchedAt:newsSnapshot?.fetchedAt,flags:newsGate(newsSnapshot,now,best.symbol).flags.map(h=>h.title)},allocation:best.allocation,estimatedRisk:best.estimatedRisk,feePerSide:FEE,slippageFraction:.0005};
  try{advance(s,quotes,now,'tick',undefined,()=>riskCheck(s,best.symbol,best.analysis,now).approved&&newsGate(best.symbol==='XAU'?team.macroNews:team.news,now,best.symbol).approved&&best.chart.approved)}finally{delete s.pendingEntryAudit}
 }
 if(s.trades.some(t=>!before.has(t.id)&&(t.side==='BUY'||t.side==='SHORT'))){team.decision=`Executed ${best?.analysis.direction==='short'?'SHORT':'BUY'} ${best?.symbol} after all checks passed`;team.log.push({time:now,decision:team.decision,symbol:best?.symbol,strategy:best?.strategy})}
 else if(team.candidates.some(c=>c.approved)&&s.running){team.votes=team.votes.map(v=>v.role==='Trader'?{...v,status:'WAIT',reason:'Team checks passed; engine waits for cooldown, unused candle or entry session'}:v)}
 team.log=team.log.slice(-100);s.message=s.halted?'Daily $100 risk lock':team.decision;return s;
}
export function teamResponse(s:State,now=Date.now()){
 ensureTeam(s);const view=dashboardView(s,now);
 view.markets=view.markets.map(m=>{
  if(m.decision==='OPEN'||!m.quoteFresh)return m;
  const c=s.team!.candidates.find(c=>c.symbol===m.symbol&&now-c.analysis.barTime-strategyInfo(c.strategy).interval<=Math.min(90000,strategyInfo(c.strategy).interval-1));
  if(!c)return {...m,decision:m.decision==='CLOSED'?'CLOSED':'WAIT',plan:null,reason:m.symbol==='XAU'?(!newsGate(s.team!.macroNews,now,'XAU').approved?newsGate(s.team!.macroNews,now,'XAU').reason:s.analysis?.XAU?.reason??'Gold Research waits for complete observed candles'):'Research waits for a fresh qualified setup'};
  const q=s.quotes.find(q=>q.symbol===m.symbol),plan=q?entryPlan(q.price,c.analysis):null,news=newsGate(m.symbol==='XAU'?s.team!.macroNews:s.team!.news,now,m.symbol),risk=riskCheck(s,m.symbol,c.analysis,now),approved=c.chart.approved&&news.approved&&risk.approved;
  return {...m,decision:approved?'SIGNAL':'WAIT',plan,reason:!news.approved?news.reason:!c.chart.approved?c.chart.reason:!risk.approved?risk.reason:!s.running?'Team agrees; entries paused':'Team agrees; Trader checks candle and cooldown',strategy:strategyInfo(c.strategy).name,signalAt:c.analysis.barTime+strategyInfo(c.strategy).interval,source:c.analysis.source??m.source};
 });
 return {state:s,view,summary:summary(s)};
}
