export const STRATEGY='trend-pullback-v2';
export const BAR_MS=300000;
export type Candle={time:number;low:number;high:number;open:number;close:number;volume:number};
export type Analysis={targetR?:number;direction?:'long'|'short';demandCeiling?:number;barTime:number;eligible:boolean;reason:string;score:number;stopFraction:number;ema9?:number;ema21?:number;ema50?:number;rsi?:number;atr?:number;volumeRatio?:number;strategy?:string;stopPrice?:number;ema15?:number;ema200?:number;supplyFloor?:number;source?:string};
export function parseCandles(input:unknown,now:number,interval=BAR_MS,history=120):Candle[]{
 if(!Array.isArray(input))throw new Error('Invalid candle response');
 const unique=new Map<number,Candle>();
 for(const row of input){
  if(!Array.isArray(row)||row.length<6||row.slice(0,6).some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('Invalid candle');
  const [seconds,low,high,open,close,volume]=row,time=seconds*1000;
  if(time%interval!==0||low<=0||high<Math.max(open,close)||low>Math.min(open,close)||volume<0)throw new Error('Invalid candle range');
  if(time+interval<=now)unique.set(time,{time,low,high,open,close,volume});
 }
 return [...unique.values()].sort((a,b)=>a.time-b.time).slice(-history);
}
function ema(values:number[],period:number){const alpha=2/(period+1);let value=values[0];return values.map(v=>(value=alpha*v+(1-alpha)*value))}
export function analyze(input:Candle[],now:number):Analysis{
 const bars=input.filter(b=>b.time+BAR_MS<=now).slice(-120),last=bars.at(-1);
 const blocked=(reason:string):Analysis=>({barTime:last?.time??0,eligible:false,reason,score:0,stopFraction:.01});
 if(bars.length<80)return blocked('Waiting for 80 completed 5-minute candles');
 if(!last||now-last.time-BAR_MS>90000)return blocked('Waiting for a fresh completed candle');
 if(bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==BAR_MS))return blocked('Candle history has gaps; entries blocked');
 const closes=bars.map(b=>b.close),e9=ema(closes,9),e21=ema(closes,21),e50=ema(closes,50),n=bars.length-1;
 // Wilder smoothing, seeded from the first 14 changes / true ranges.
 const changes=closes.slice(1).map((c,i)=>c-closes[i]);
 const trs=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
 const wilder=(v:number[])=>{let a=v.slice(0,14).reduce((s,x)=>s+x,0)/14;for(const x of v.slice(14))a=(a*13+x)/14;return a};
 const gain=wilder(changes.map(x=>Math.max(0,x))),loss=wilder(changes.map(x=>Math.max(0,-x)));
 const rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss),atr=wilder(trs);
 const averageVolume=bars.slice(-21,-1).reduce((s,b)=>s+b.volume,0)/20,volumeRatio=averageVolume>0?last.volume/averageVolume:0;
 const stopFraction=Math.max(.004,atr/last.close*1.5);
 const trend=e9[n]>e21[n]&&e21[n]>e50[n]&&e21[n]>e21[n-3]&&last.close>e9[n];
 const pullback=bars.slice(-4,-1).some((b,i)=>b.low<=e9[n-3+i]);
 const reclaim=last.close>bars[n-1].high&&last.close>last.open;
 let reason='Qualified: trend + pullback breakout + RSI + volume';
 if(!trend)reason='No confirmed upward trend';
 else if(!pullback||!reclaim)reason='Waiting for pullback and bullish breakout';
 else if(rsi<50||rsi>68)reason='RSI outside 50–68 momentum band';
 else if(volumeRatio<.8)reason='Volume below 80% of its 20-bar average';
 else if(atr/last.close<.001||stopFraction>.015)reason='Volatility outside allowed range';
 return {barTime:last.time,eligible:reason.startsWith('Qualified'),reason,score:(e21[n]/e50[n]-1)*100+Math.min(volumeRatio,3),stopFraction,ema9:e9[n],ema21:e21[n],ema50:e50[n],rsi,atr,volumeRatio};
}
