import {SYMBOLS,CRYPTO_SYMBOLS,CAPITAL,LIMIT,ALLOCATION,type Symbol} from './market-config.ts';
import {STRATEGY,type Candle,type Analysis} from './strategy.ts';
import {analyzeStrategy,isStrategyId,strategyInfo,type StrategyId} from './strategies.ts';
import {goldSession,observeGold,type GoldState} from './gold.ts';
import {entryPlan,ADVERSE_SLIPPAGE} from './entry-plan.ts';
import {checkLossReview,acknowledgeLossReview} from './loss-review.ts';
export {CAPITAL,LIMIT};
export type {Symbol};
export type Quote = {symbol:Symbol; price:number; fetchedAt:number};
export type Position = {targetR?:number;entryAudit?:import('./trade-learning.ts').EntryAudit;direction?:'long'|'short';id:string;symbol:Symbol;kind:'intraday'|'holding';quantity:number;entry:number;mark:number;entryFee:number;openedAt:number;strategy?:string;stop?:number;target?:number;pendingExit?:string;initialRisk?:number;profitLocked?:boolean};
export type Trade = {learningReviewed?:boolean;entryAudit?:import('./trade-learning.ts').EntryAudit;exitAudit?:{time:number;mark:number;quoteAt?:number;stop?:number;target?:number;profitLocked:boolean;reason:string};id:string;time:number;side:'BUY'|'SHORT'|'SELL'|'COVER';direction?:'long'|'short';symbol:Symbol;kind:string;quantity:number;price:number;fee:number;reason:string;net:number|null;strategy?:string};
export type State = {learning?:import('./trade-learning.ts').Learning;pendingEntryAudit?:import('./trade-learning.ts').EntryAudit;team?:import('./decision-team.ts').TeamState;fleetVersion?:number;agents?:{id:string;name:string;state:State;entryDecisions?:Partial<Record<Symbol,number>>}[];legacy?:State;startingCapital?:number;allocation?:number;maxPositions?:number;dailyLimit?:number;agentId?:string;lossReview?:{paused:boolean;reviewedThrough?:string;triggeredAt?:number;tradeIds?:string[];losses?:number;net?:number};continuous?:boolean;sessionArmed?:boolean;currency:'USD';exitPolicy?:'price-only';strategyMode:'intraday-only'|'price-exits';cash:number;startedAt:number|null;running:boolean;halted:boolean;day:string;dayBase:number;realized:number;fees:number;positions:Position[];trades:Trade[];samples:({time:number}&Record<Symbol,number>)[];curve:{time:number;equity:number}[];lastTick:number;quotes:Quote[];message:string;lastExit:Partial<Record<Symbol,number>>;analysis?:Partial<Record<Symbol,Analysis>>;analysisUpdatedAt?:number;analysisError?:string;lastDecision?:Partial<Record<Symbol,number>>;v2?:{closed:number;wins:number;net:number};gold?:GoldState;feedErrors?:Partial<Record<Symbol,string>>;candleSources?:Partial<Record<Symbol,string>>;selectedStrategy?:StrategyId;strategyStats?:Partial<Record<StrategyId,{closed:number;wins:number;net:number}>>};
export const FEE=0, SLIP=ADVERSE_SLIPPAGE, MAX_POSITIONS=5, COOLDOWN=30*60000;
export const istDay=(t:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
export function initial():State{return {currency:'USD',strategyMode:'intraday-only',cash:CAPITAL,startedAt:null,running:false,halted:false,day:'',dayBase:CAPITAL,realized:0,fees:0,positions:[],trades:[],samples:[],curve:[],lastTick:0,quotes:[],message:'Ready. Start enables signals; it does not force a trade.',lastExit:{},analysis:{},lastDecision:{},v2:{closed:0,wins:0,net:0},selectedStrategy:STRATEGY,strategyStats:{}}}
export const directionSign=(p:{direction?:'long'|'short'})=>p.direction==='short'?-1:1;
export const closedTrade=(t:Trade)=>t.side==='SELL'||t.side==='COVER';
export const positionPnl=(p:Position)=>directionSign(p)*(p.mark-p.entry)*p.quantity-p.entryFee;
export function equity(s:State){return s.cash+s.positions.reduce((a,p)=>a+(p.direction==='short'?p.quantity*p.entry+directionSign(p)*(p.mark-p.entry)*p.quantity:p.quantity*p.mark),0)}
export function summary(s:State){const e=equity(s);return {equity:e,totalPnl:e-(s.startingCapital??CAPITAL),dailyPnl:e-s.dayBase,unrealized:s.positions.reduce((a,p)=>a+positionPnl(p),0),realized:s.realized,closed:s.trades.filter(closedTrade).length,wins:s.trades.filter(t=>closedTrade(t)&&(t.net??0)>0).length}}
function buy(s:State,symbol:Symbol,now:number,a:Analysis){
 const q=s.quotes.find(q=>q.symbol===symbol);if(!q||s.halted||s.positions.length>=(s.maxPositions??MAX_POSITIONS)||s.cash<(s.allocation??ALLOCATION)+FEE||s.positions.some(p=>p.symbol===symbol))return;
 const plan=entryPlan(q.price,a);if(!plan)return;const price=plan.entry;
 const selected=symbol==='XAU'&&(s.selectedStrategy??STRATEGY)===STRATEGY?'ema-9-15':s.selectedStrategy??STRATEGY;
 if(symbol==='XAU'&&(!goldSession(now).entries||now-q.fetchedAt>90000))return;
 if(a.strategy!==selected)return;
 const quantity=(s.allocation??ALLOCATION)/price,fee=FEE,id=`${s.agentId??'account'}-${now}-${symbol}-intraday`;
 const entryAudit=s.pendingEntryAudit?{...structuredClone(s.pendingEntryAudit),plan:{entry:price,stop:plan.stop,target:plan.target}}:undefined;
 s.cash-=(s.allocation??ALLOCATION)+fee;s.fees+=fee;
 s.positions.push({targetR:a.targetR??2,entryAudit,id,symbol,direction:plan.direction,kind:'intraday',quantity,entry:price,mark:q.price,entryFee:fee,openedAt:now,strategy:selected,stop:plan.stop,target:plan.target,initialRisk:Math.abs(price-plan.stop)});
 s.trades.push({entryAudit:entryAudit?structuredClone(entryAudit):undefined,id,time:now,side:plan.direction==='short'?'SHORT':'BUY',direction:plan.direction,symbol,kind:'intraday',quantity,price,fee,reason:a.reason,net:null,strategy:selected});
}
function sell(s:State,p:Position,now:number,reason:string){
 const sign=directionSign(p),price=p.mark*(1-sign*SLIP),gross=p.direction==='short'?p.quantity*p.entry+(p.entry-price)*p.quantity:p.quantity*price,fee=FEE,net=sign*(price-p.entry)*p.quantity-p.entryFee-fee;
 s.cash+=gross-fee;s.fees+=fee;s.realized+=net;s.positions=s.positions.filter(x=>x.id!==p.id);s.lastExit[p.symbol]=now;
 if(p.strategy===STRATEGY){s.v2??={closed:0,wins:0,net:0};s.v2.closed++;if(net>0)s.v2.wins++;s.v2.net+=net}
 if(isStrategyId(p.strategy)){s.strategyStats??={};const stats=s.strategyStats[p.strategy]??{closed:0,wins:0,net:0};stats.closed++;if(net>0)stats.wins++;stats.net+=net;s.strategyStats[p.strategy]=stats}
 s.trades.push({entryAudit:p.entryAudit?structuredClone(p.entryAudit):undefined,exitAudit:{time:now,mark:p.mark,quoteAt:s.quotes.find(q=>q.symbol===p.symbol)?.fetchedAt,stop:p.stop,target:p.target,profitLocked:!!p.profitLocked,reason},id:`${now}-${p.id}-exit`,time:now,side:p.direction==='short'?'COVER':'SELL',direction:p.direction??'long',symbol:p.symbol,kind:p.kind,quantity:p.quantity,price,fee,reason,net,strategy:p.strategy});
}
function canExit(s:State,p:Position,now:number){return p.symbol!=='XAU'?s.quotes.some(q=>q.symbol===p.symbol&&now-q.fetchedAt<=30000):goldSession(now).open&&s.quotes.some(q=>q.symbol==='XAU'&&now-q.fetchedAt<=90000)}
export function closeDay(s:State,now:number,reason:string){for(const p of [...s.positions]){if(canExit(s,p,now))sell(s,p,now,reason);else p.pendingExit=reason}}
export function risk(s:State,now:number){if(equity(s)-s.dayBase<=-(s.dailyLimit??LIMIT)){s.halted=true;s.running=false;s.message='Daily loss stop reached. All positions closed; entries locked for the day.'}if(s.halted)closeDay(s,now,`Daily $${s.dailyLimit??LIMIT} loss stop`)}
export function selectStrategy(s:State,id:unknown){
 if(!isStrategyId(id))throw new Error('Unknown strategy');
 if(id===(s.selectedStrategy??STRATEGY))return s;
 s.selectedStrategy=id;s.running=false;s.sessionArmed=false;s.analysis={};s.analysisUpdatedAt=0;s.analysisError='';
 s.message=`${strategyInfo(id).name} selected. Entries paused; resume when ready. Existing positions keep their exit rules.`;
 return s;
}
export function advance(s:State,quotes:Quote[],now:number,action='tick',candles?:Partial<Record<Symbol,Candle[]>>,allowEntry:()=>boolean=()=>true,allowPartialQuotes=false){
 if(!['tick','start','pause','close'].includes(action))throw new Error('Unknown action');
 const knownQuote=(q:Quote)=>SYMBOLS.includes(q.symbol)||s.positions.some(p=>p.symbol===q.symbol)||!!s.team&&(!!s.team.universe?.pairs.some(p=>p.symbol===q.symbol)||!!s.legacy?.positions.some(p=>p.symbol===q.symbol));
 if(((s.team||allowPartialQuotes)?quotes.length===0:!CRYPTO_SYMBOLS.every(sym=>quotes.some(q=>q.symbol===sym)))||quotes.some(q=>!knownQuote(q)||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.fetchedAt)||now-q.fetchedAt>(q.symbol==='XAU'?90000:30000)||q.fetchedAt>now+1000)||new Set(quotes.map(q=>q.symbol)).size!==quotes.length)throw new Error('Fresh quotes are required');
 quotes=quotes.filter(q=>q.symbol!=='XAU'||goldSession(now).open);
 if(s.continuous===undefined){s.continuous=true;s.sessionArmed=s.running}
 const config=strategyInfo(s.selectedStrategy);
 const priceOnly=s.exitPolicy==='price-only';
 const priorEquity=equity(s),today=istDay(now),rolled=!!s.day&&today!==s.day;
 s.quotes=quotes;for(const p of s.positions){const quote=quotes.find(q=>q.symbol===p.symbol);if(quote)p.mark=quote.price}
 s.gold??={frames:{}};const gold=quotes.find(q=>q.symbol==='XAU');if(gold)observeGold(s.gold,{...gold,symbol:'XAU'},now);
 for(const p of [...s.positions])if(!priceOnly&&p.kind!=='intraday'){if(canExit(s,p,now))sell(s,p,now,'Closed legacy position: intraday-only account');else p.pendingExit='Close legacy holding'}
 // Keep oldest positions; close excess legacy exposure with a visible audit trail.
 for(const p of [...s.positions].sort((a,b)=>a.openedAt-b.openedAt).slice(s.maxPositions??MAX_POSITIONS)){if(canExit(s,p,now))sell(s,p,now,'Position limit reduced to five');else p.pendingExit='Position limit reduced to five'}
 s.strategyMode=priceOnly?'price-exits':'intraday-only';s.lastDecision??={};s.v2??={closed:0,wins:0,net:0};
 if(rolled){if(!priceOnly)closeDay(s,now,'Missed session end: closed on reconnect');s.dayBase=priorEquity;s.halted=false;s.running=!!s.continuous&&!!s.sessionArmed;s.samples=[];s.message=s.running?'New IST session. Continuous entries resumed; daily risk budget reset.':'New IST session. Review results and resume when ready.'}
 s.day=today;
 const time=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(':',''));
 const cutoff=!priceOnly&&time>=2355,entryCutoff=!priceOnly&&time>=2330;
 if(s.startedAt)risk(s,now);
 if(cutoff){closeDay(s,now,'23:55 IST intraday close');s.running=false;s.message='Intraday session ended. All positions closed.'}
 if(action==='pause'){s.running=false;s.sessionArmed=false;s.message='Entries paused. Open positions and risk exits still monitored while this page is open.'}
 if(action==='close'){closeDay(s,now,'Manual close');s.running=false;s.sessionArmed=false;s.message='Manual close requested.'}
 if(action==='start'){
  if(s.halted)throw new Error('The daily stop stays locked until the next IST day.');
  if(entryCutoff)throw new Error('New entries stop at 23:30 IST. Resume next IST day.');
  acknowledgeLossReview(s);s.running=true;s.sessionArmed=true;
  if(!s.startedAt){s.startedAt=now;s.dayBase=s.startingCapital??CAPITAL;s.curve.push({time:now-1,equity:s.startingCapital??CAPITAL})}
  s.message=`${config.name} active. Waiting for qualified signals; maximum ${s.maxPositions??MAX_POSITIONS} positions.`;
 }
 if(candles){s.analysis??={};for(const sym of CRYPTO_SYMBOLS){const a=analyzeStrategy(config.id,candles[sym]??[],now);a.source=s.candleSources?.[sym];if(s.feedErrors?.[sym]){a.eligible=false;a.reason=s.feedErrors[sym]!}s.analysis[sym]=a}s.analysisUpdatedAt=now;s.analysisError=''}
 const goldConfig=strategyInfo(config.id===STRATEGY?'ema-9-15':config.id),goldBars=s.gold.frames[goldConfig.interval]?.closed??[],goldAnalysis=analyzeStrategy(goldConfig.id,goldBars,now),session=goldSession(now);
 goldAnalysis.source='Gold-API · observed samples';
 if(!session.entries){goldAnalysis.eligible=false;goldAnalysis.reason=session.reason==='Gold session open'?'Gold pre-break entry cutoff':session.reason}
 else if(!gold){goldAnalysis.eligible=false;goldAnalysis.reason=s.gold.error??'Gold quote stale or unavailable'}
 else if(goldBars.length<goldConfig.minBars)goldAnalysis.reason=`Gold warm-up: ${goldBars.length}/${goldConfig.minBars} observed ${goldConfig.interval/60000}-minute candles`;
 s.analysis??={};s.analysis.XAU=goldAnalysis;
 if(now-s.lastTick>=4000){s.samples.push({time:now,...Object.fromEntries(quotes.map(q=>[q.symbol,q.price]))} as {time:number}&Record<Symbol,number>);s.samples=s.samples.slice(-80);s.lastTick=now}
 // Risk exits run on every fresh update, even with paused entries or failed candle data.
 for(const p of [...s.positions]){
  if(!canExit(s,p,now))continue;
  if(p.pendingExit){sell(s,p,now,p.pendingExit);continue}
  if(!priceOnly&&p.symbol==='XAU'&&session.closeSoon){sell(s,p,now,'Gold pre-break intraday close');continue}
  // Persist original risk before raising the stop; existing trades inherit their entry stop.
  const sign=directionSign(p);
  p.initialRisk??=Math.abs(p.entry-(p.stop??p.entry*(1-sign*.01)));
  const lock=p.entry+sign*1.5*p.initialRisk,finalTarget=p.entry+sign*(p.targetR??2)*p.initialRisk;
  if(sign*(p.mark-(p.stop??p.entry*(1-sign*.01)))<=0)sell(s,p,now,p.profitLocked?'1.5R protected stop':p.strategy?'Strategy stop':'Legacy 1% stop');
  else if(sign*(p.mark-finalTarget)>=0)sell(s,p,now,`${p.targetR??2}R profit target`);
  else if(!priceOnly&&p.strategy&&now-p.openedAt>=4*3600000)sell(s,p,now,'Four-hour time exit');
  else if(!p.profitLocked&&sign*(p.mark-lock)>=0){p.profitLocked=true;p.stop=lock;p.target=finalTarget}
 }
 checkLossReview(s,now);
 // Exit costs can cross the daily threshold, so check before considering entries.
 if(s.startedAt)risk(s,now);
 if(s.running&&!s.halted&&!entryCutoff&&!s.analysisError&&!s.positions.some(p=>p.pendingExit)){
  const entrySymbols=s.team?.universe?[...s.team.universe.pairs.map(p=>p.symbol),'XAU']:SYMBOLS;
  const ranked=entrySymbols.map(sym=>({sym,a:s.analysis?.[sym]})).filter((x):x is {sym:Symbol;a:Analysis}=>!!x.a).sort((x,y)=>y.a.score-x.a.score);
  for(const {sym,a} of ranked){
   const marketConfig=sym==='XAU'?goldConfig:config;
   if(a.strategy!==marketConfig.id||a.barTime<= (s.lastDecision[sym]??0))continue;
   const age=now-(a.barTime+marketConfig.interval);if(age<0||age>Math.min(90000,marketConfig.interval-1))continue;
   s.lastDecision[sym]=a.barTime;
   if(a.eligible&&now-(s.lastExit[sym]??0)>=COOLDOWN) {if(allowEntry())buy(s,sym,now,a);}
  }
  s.message=s.positions.length>=(s.maxPositions??MAX_POSITIONS)?'Position limit reached. Monitoring exits.':`${config.name}: ${s.positions.length}/${s.maxPositions??MAX_POSITIONS} positions. Waiting for qualified signals.`;
 }
 if(s.startedAt){risk(s,now);s.curve.push({time:now,equity:equity(s)});s.curve=s.curve.slice(-600)}
 if(s.positions.some(p=>p.pendingExit)){s.running=false;s.message='Exit pending: waiting for fresh tradable gold prices. New entries paused.'}
 s.trades=s.trades.slice(-1000);return s;
}
