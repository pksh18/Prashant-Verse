import {analyze,STRATEGY,type Analysis,type Candle} from './strategy.ts';
export const STRATEGIES=[
 {id:STRATEGY,name:'Trend & pullback V2',interval:300000,history:120,minBars:80,description:'Original experimental multi-filter strategy.',rules:['EMA 9 > EMA 21 > EMA 50; EMA 21 rising over three bars.','A pullback to EMA 9 in the preceding three bars, followed by a bullish close above the previous high.','RSI 14 between 50–68 and volume at least 80% of its preceding 20-bar average.','Stop: 1.5 × ATR 14, subject to the shared 0.4–1.5% distance limits.']},
 {id:'momentum-alpha',name:'Momentum Alpha · experimental',interval:60000,history:120,minBars:80,description:'Original transparent price-momentum preset; not GainzAlgo or a replica.',rules:['Completed one-minute candles only; EMA 9 > EMA 21 > EMA 50, with EMA 21 rising over three candles.','The prior candle touches EMA 9. Enter after a bullish close above the prior high; body must occupy at least 55% of its range and close in the top quarter.','Wilder RSI 14 between 52 and 70; ATR 14 / close between 0.1% and 1%. No volume requirement.','Initial stop: 1.2 × ATR 14, with shared 0.4–1.5% entry limits. At 1.5R protect the stop; final target 2R.','No verified edge or win-rate claim. BUY and mirrored bearish SHORT entries; SELL closes a long and COVER closes a short.']},
 {id:'ema-9-15',name:'9/15 EMA crossover',interval:300000,history:120,minBars:80,description:'Standard crossover interpretation of the first poster.',rules:['Use completed five-minute candles and EMA 9 / EMA 15.','Enter only on a new upward crossover: previous EMA 9 ≤ EMA 15; current EMA 9 > EMA 15.','The signal candle must be bullish and close above EMA 9.','Stop: 1.5 × ATR 14, subject to the shared distance limits. No repeated entries just because EMA 9 remains above EMA 15.']},
 {id:'liquidity-sweep',name:'Liquidity sweep',interval:300000,history:120,minBars:80,description:'A price-pattern proxy for a sweep; it cannot observe hidden orders.',rules:['Mark the lowest low of the 20 bars preceding the sweep candle.','The previous candle must trade below that low and close back above it.','Enter after a bullish confirmation candle closes above the sweep candle’s high.','Stop below the sweep wick by 0.1 × ATR 14. Reject stops beyond the shared maximum.']},
 {id:'golden-trio',name:'Golden Trio · EMA 50/200',interval:300000,history:300,minBars:250,description:'EMA 50, EMA 200 and a defined price-action confirmation.',rules:['Require at least 250 completed five-minute candles; calculate EMA 50 and EMA 200 on up to 300.','EMA 50 must be above EMA 200 and rising over five bars.','The previous candle touches EMA 50; the next bullish candle closes above its high and EMA 50.','Stop below the pullback candle’s low by 0.1 × ATR 14.']},
 {id:'fibonacci',name:'Fibonacci retracement',interval:300000,history:120,minBars:80,description:'A defined bullish swing-and-retracement setup.',rules:['Find a confirmed swing low followed by a confirmed swing high within 60 prior bars. Each pivot needs two bars on either side; no future bars are used.','The upswing must be at least 2 × ATR 14. The previous candle must overlap its 50–61.8% retracement zone.','Enter when the next bullish candle closes above the previous high, provided the swing low has not been broken.','Stop below the swing low by 0.1 × ATR 14; oversized stops are rejected.']},
 {id:'supply-demand',name:'Supply & demand zones',interval:60000,history:120,minBars:80,description:'One-minute demand retest with an opposing supply-zone filter.',rules:['Use completed one-minute candles. A small-body base followed by a bullish body ≥ 1.5 × ATR creates a demand zone from the base low to its body high.','Wait for the first later retest: previous candle overlaps that unbroken demand zone; a bullish confirmation candle closes above the previous high.','Reject a setup if an unbroken opposing supply zone lies before the 1.5R target. Supply zones use the mirrored bearish displacement pattern.','Stop below the demand zone by 0.1 × ATR. Shorts mirror these rules: first supply retest, bearish confirmation and opposing demand filter.']},
 {id:'donchian-breakout',name:'Donchian volume breakout',interval:300000,history:120,minBars:80,description:'Trend-confirmed 20-bar channel breakout.',rules:['Completed five-minute candles; EMA 21 above EMA 50 and rising over three candles.','Previous close must be inside the prior 20-bar high; current bullish close breaks that high.','Current volume must be at least 1.5 times the preceding 20-bar mean, with candle body at least 50% of its range.','Initial stop 1.2 ATR, bounded by shared 0.4–1.5% limits. Shorts mirror the channel breakdown.']},
 {id:'rolling-vwap',name:'Rolling VWAP reclaim',interval:60000,history:120,minBars:80,description:'Volume-weighted reclaim using a rolling 30-bar window, not exchange session VWAP.',rules:['Completed one-minute candles with positive real candle volume. Compute rolling 30-bar typical-price VWAP.','Previous close at or below its VWAP; current bullish close above current VWAP and previous high.','Current close above EMA 50, EMA 21 rising, and volume at least 1.2 times the preceding 20-bar mean.','Initial stop 1.2 ATR, bounded by shared 0.4–1.5% limits. Shorts use the mirrored VWAP rejection.']},
 {id:'bollinger-reversion',name:'Bollinger range reversion',interval:300000,history:120,minBars:80,description:'Band rejection restricted to a relatively flat moving-average regime.',rules:['Completed five-minute candles; Bollinger bands use 20 closes and two population standard deviations.','EMA 50 change over five candles must be at most 0.5 ATR; reject strongly trending regimes.','Previous close below its lower band; current bullish close re-enters the lower band, remains below the middle band and exceeds previous high.','Current body at least 40% of its range. Initial stop 1.2 ATR with shared 0.4–1.5% limits. Shorts mirror an upper-band rejection.']}

] as const;
export type StrategyId=typeof STRATEGIES[number]['id'];
export function isStrategyId(value:unknown):value is StrategyId{return typeof value==='string'&&STRATEGIES.some(s=>s.id===value)}
export function strategyInfo(id?:string){return STRATEGIES.find(s=>s.id===id)??STRATEGIES[0]}
export function strategyName(id?:string){return id?strategyInfo(id).name:'Legacy intraday'}
function ema(values:number[],period:number){let value=values[0];return values.map(v=>(value+=2/(period+1)*(v-value)))}
function analyzeLong(id:StrategyId,input:Candle[],now:number):Analysis{
 if(id===STRATEGY)return {...analyze(input,now),strategy:id};
 const config=strategyInfo(id),bars=input.filter(b=>b.time+config.interval<=now).slice(-config.history),last=bars.at(-1);
 const blocked=(reason:string):Analysis=>({strategy:id,barTime:last?.time??0,eligible:false,reason,score:0,stopFraction:.01});
 if(bars.length<config.minBars)return blocked(`Waiting for ${config.minBars} completed ${config.interval/60000}-minute candles`);
 if(!last||now-last.time-config.interval>Math.min(90000,config.interval-1))return blocked('Waiting for a fresh completed candle');
 if(bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==config.interval))return blocked('Candle history has gaps; entries blocked');
 const n=bars.length-1,prev=bars[n-1],closes=bars.map(b=>b.close),e9=ema(closes,9),e15=ema(closes,15),e21=ema(closes,21),e50=ema(closes,50),e200=ema(closes,200);
 const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
 let atr=tr.slice(0,14).reduce((a,b)=>a+b,0)/14;for(const t of tr.slice(14))atr=(atr*13+t)/14;
 if(atr/last.close<.001)return blocked('Volatility below 0.1%; costs can dominate');
 const bullish=last.close>last.open,confirmation=bullish&&last.close>prev.high;
 let eligible=false,reason='',stopPrice=last.close-1.5*atr,supplyFloor=Infinity;
 if(id==='momentum-alpha'){
  const changes=closes.slice(1).map((c,i)=>c-closes[i]);
  const smooth=(v:number[])=>{let a=v.slice(0,14).reduce((n,x)=>n+x,0)/14;for(const x of v.slice(14))a=(a*13+x)/14;return a};
  const gain=smooth(changes.map(v=>Math.max(0,v))),loss=smooth(changes.map(v=>Math.max(0,-v))),rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
  const range=last.high-last.low,body=range>0?(last.close-last.open)/range:0;
  const trend=e9[n]>e21[n]&&e21[n]>e50[n]&&e21[n]>e21[n-3],retest=prev.low<=e9[n-1]&&prev.high>=e9[n-1];
  reason=!trend?'Alpha: waiting for rising EMA 9/21/50 trend':!retest?'Alpha: waiting for EMA 9 retest':!confirmation?'Alpha: waiting for bullish prior-high breakout':rsi<52||rsi>70?'Alpha: RSI outside 52–70':body<.55||last.close<last.high-range*.25?'Alpha: signal candle lacks bullish conviction':atr/last.close>.01?'Alpha: volatility above 1%':'Alpha qualified: trend + retest + momentum breakout';
  eligible=reason.startsWith('Alpha qualified');stopPrice=last.close-1.2*atr;
  const stopFraction=Math.max(.004,(last.close-stopPrice)/last.close);
  if(stopFraction>.015)return blocked('Alpha: stop exceeds 1.5% limit');
  return {strategy:id,barTime:last.time,eligible,reason,score:eligible?(e21[n]-e50[n])/atr+body:0,stopFraction,stopPrice,atr,rsi,ema9:e9[n],ema21:e21[n],ema50:e50[n]};
 }else if(id==='donchian-breakout'){
  const level=Math.max(...bars.slice(n-20,n).map(b=>b.high)),avgVolume=bars.slice(n-20,n).reduce((sum,b)=>sum+b.volume,0)/20;
  eligible=e21[n]>e50[n]&&e21[n]>e21[n-3]&&prev.close<=level&&bullish&&last.close>level&&avgVolume>0&&last.volume>=1.5*avgVolume&&(last.close-last.open)/(last.high-last.low)>=.5;
  stopPrice=last.close-1.2*atr;reason=eligible?'Trend + fresh 20-bar channel breakout + volume confirmation':'Waiting for a trend-aligned 20-bar breakout with strong volume';
 }else if(id==='rolling-vwap'){
  const vwap=(end:number)=>{const window=bars.slice(end-29,end+1),volume=window.reduce((sum,b)=>sum+b.volume,0);return volume>0?window.reduce((sum,b)=>sum+(b.high+b.low+b.close)/3*b.volume,0)/volume:NaN};
  const current=vwap(n),previous=vwap(n-1),avgVolume=bars.slice(n-20,n).reduce((sum,b)=>sum+b.volume,0)/20;
  eligible=Number.isFinite(current)&&Number.isFinite(previous)&&prev.close<=previous&&last.close>current&&confirmation&&last.close>e50[n]&&e21[n]>e21[n-3]&&avgVolume>0&&last.volume>=1.2*avgVolume;
  stopPrice=last.close-1.2*atr;reason=eligible?'Rolling 30-bar VWAP reclaimed with trend and volume confirmation':'Waiting for rolling VWAP reclaim, rising trend and volume';
 }else if(id==='bollinger-reversion'){
  const bands=(end:number)=>{const values=closes.slice(end-19,end+1),mean=values.reduce((sum,v)=>sum+v,0)/20,sd=Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/20);return {mean,lower:mean-2*sd}};
  const current=bands(n),previous=bands(n-1),range=last.high-last.low;
  eligible=Math.abs(e50[n]-e50[n-5])<=.5*atr&&prev.close<previous.lower&&last.close>current.lower&&last.close<current.mean&&confirmation&&range>0&&(last.close-last.open)/range>=.4;
  stopPrice=last.close-1.2*atr;reason=eligible?'Lower-band rejection and bullish re-entry in flat regime':'Waiting for a confirmed band rejection in a flat regime';
 }else if(id==='ema-9-15'){
  eligible=e9[n-1]<=e15[n-1]&&e9[n]>e15[n]&&bullish&&last.close>e9[n];
  reason=eligible?'New bullish EMA 9/15 crossover':'Waiting for a new bullish EMA 9/15 crossover';
 }else if(id==='liquidity-sweep'){
  const level=Math.min(...bars.slice(-22,-2).map(b=>b.low));
  eligible=prev.low<level&&prev.close>level&&confirmation;stopPrice=prev.low-.1*atr;
  reason=eligible?'Prior 20-bar low swept and reclaimed; bullish confirmation':'Waiting for a 20-bar low sweep, reclaim and confirmation';
 }else if(id==='golden-trio'){
  eligible=e50[n]>e200[n]&&e50[n]>e50[n-5]&&prev.low<=e50[n-1]&&prev.high>=e50[n-1]&&confirmation&&last.close>e50[n];
  stopPrice=prev.low-.1*atr;reason=eligible?'EMA 50 above 200; confirmed bullish pullback':'Waiting for EMA 50/200 trend and confirmed EMA 50 pullback';
 }else if(id==='fibonacci'){
  // Pivots are confirmed entirely before the trigger candle.
  const pivots=(high:boolean)=>bars.map((b,i)=>({b,i})).filter(({b,i})=>i>=Math.max(2,n-60)&&i<=n-3&&[-2,-1,1,2].every(d=>high?b.high>bars[i+d].high:b.low<bars[i+d].low));
  const high=pivots(true).at(-1),low=high?pivots(false).filter(p=>p.i<high.i).at(-1):undefined;
  if(!high||!low)return blocked('Waiting for confirmed low-to-high swing pivots');
  const range=high.b.high-low.b.low,upper=high.b.high-.5*range,lower=high.b.high-.618*range;
  const intact=bars.slice(high.i+1).every(b=>b.low>low.b.low);
  eligible=range>=2*atr&&intact&&prev.low<=upper&&prev.high>=lower&&confirmation;
  stopPrice=low.b.low-.1*atr;reason=eligible?'50–61.8% retracement with bullish confirmation':'Waiting for an intact swing, 50–61.8% retest and confirmation';
 }else{
  type Zone={low:number;high:number;departure:number};const demand:Zone[]=[],supply:Zone[]=[];
  for(let i=Math.max(1,n-40);i<n-2;i++){
   const base=bars[i],move=bars[i+1],range=base.high-base.low;
   if(range<=0||Math.abs(base.close-base.open)>range*.5)continue;
   if(move.close-move.open>=1.5*atr&&move.close>base.high)demand.push({low:base.low,high:Math.max(base.open,base.close),departure:i+1});
   if(move.open-move.close>=1.5*atr&&move.close<base.low)supply.push({low:Math.min(base.open,base.close),high:base.high,departure:i+1});
  }
  const zone=demand.filter(z=>bars.slice(z.departure+1,n-1).every(b=>b.low>z.high)&&prev.low>=z.low&&prev.low<=z.high&&prev.high>=z.low&&last.low>=z.low).at(-1);
  if(!zone)return blocked('Waiting for the first retest of an unbroken demand zone');
  eligible=confirmation;stopPrice=zone.low-.1*atr;
  supplyFloor=Math.min(...supply.filter(z=>z.low>last.close&&bars.slice(z.departure+1).every(b=>b.high<z.high)).map(z=>z.low));
  reason=eligible?'First demand-zone retest with bullish 1-minute confirmation':'Demand retest found; waiting for bullish confirmation';
 }
 const stopFraction=Math.max(.004,(last.close-stopPrice)/last.close);
 if(stopPrice>=last.close||stopFraction>.015)return blocked('Structural stop outside the allowed 0.4–1.5% range');
 if(id==='supply-demand'&&supplyFloor<=last.close*(1+1.5*stopFraction)){eligible=false;reason='Opposing supply zone is inside the planned profit target'}
 return {strategy:id,barTime:last.time,eligible,reason,score:eligible?1:0,stopFraction,stopPrice,atr,ema9:e9[n],ema15:e15[n],ema50:e50[n],ema200:e200[n],supplyFloor:Number.isFinite(supplyFloor)?supplyFloor:undefined};
}

// Reflect price around the latest closed price: EMA, RSI, candle patterns and
// structural zones become their bearish equivalents without future data.
export function analyzeStrategy(id:StrategyId,input:Candle[],now:number):Analysis{
 const long={...analyzeLong(id,input,now),direction:'long' as const};
 if(long.eligible)return long;
 const config=strategyInfo(id),bars=input.filter(b=>b.time+config.interval<=now).slice(-config.history),last=bars.at(-1);
 if(!last)return long;
 const axis=2*last.close;
 if(bars.some(b=>axis-b.high<=0))return long;
 const mirrored=bars.map(b=>({...b,open:axis-b.open,close:axis-b.close,high:axis-b.low,low:axis-b.high}));
 const a=analyzeLong(id,mirrored,now);
 if(!a.eligible)return {...long,reason:`BUY: ${long.reason} · SHORT: ${a.reason}`};
 const reflect=(v:number|undefined)=>v===undefined?undefined:axis-v;
 return {...a,direction:'short',reason:'Bearish mirrored setup: '+a.reason,stopPrice:reflect(a.stopPrice),supplyFloor:undefined,demandCeiling:reflect(a.supplyFloor),ema9:reflect(a.ema9),ema15:reflect(a.ema15),ema21:reflect(a.ema21),ema50:reflect(a.ema50),ema200:reflect(a.ema200),rsi:a.rsi===undefined?undefined:100-a.rsi};
}
