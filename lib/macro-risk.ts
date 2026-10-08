import type {Candle,Analysis} from './strategy.ts';
export type HigherFrame={fetchedAt:number;barTime:number;trend:'BULLISH'|'BEARISH'|'NEUTRAL';atr:number;close:number;error?:string};
export function higherFrame(input:Candle[],now:number,interval:number):HigherFrame{
 const bars=input.filter(b=>b.time+interval<=now),last=bars.at(-1);const fail=(error:string):HigherFrame=>({fetchedAt:now,barTime:last?.time??0,trend:'NEUTRAL',atr:0,close:last?.close??0,error});
 if(bars.length<50||!last||last.time!==Math.floor(now/interval)*interval-interval||bars.some((b,i)=>i>0&&b.time-bars[i-1].time!==interval))return fail('Higher-timeframe candles missing, stale or gapped');
 let ema=bars[0].close;const e=bars.map(b=>ema+=2/21*(b.close-ema));let atr=0;const ranges=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));atr=ranges.slice(0,14).reduce((a,b)=>a+b,0)/14;for(const x of ranges.slice(14))atr=(atr*13+x)/14;
 return {fetchedAt:now,barTime:last.time,close:last.close,atr,trend:last.close>e.at(-1)!&&e.at(-1)!>e.at(-4)!?'BULLISH':last.close<e.at(-1)!&&e.at(-1)!<e.at(-4)!?'BEARISH':'NEUTRAL'};
}
export function freshFrame(f:HigherFrame|undefined,now:number,interval:number){return !!f&&!f.error&&now-f.fetchedAt<=120000&&f.barTime===Math.floor(now/interval)*interval-interval&&f.atr>0}
export function volatilityAnalysis(a:Analysis,f:HigherFrame|undefined,quote:number,now:number):Analysis{
 if(!freshFrame(f,now,900000)||!Number.isFinite(quote)||quote<=0)return {...a,eligible:false,reason:'Risk needs fresh 15-minute ATR14'};
 if(a.stopPrice&&((a.direction==='short'?-1:1)*(quote*(1+(a.direction==='short'?-1:1)*.0005)-a.stopPrice)<=0))return {...a,eligible:false,reason:'Strategy stop is on the wrong side of entry'};
 const sign=a.direction==='short'?-1:1,entry=quote*(1+sign*.0005),structural=a.stopPrice?sign*(entry-a.stopPrice):entry*a.stopFraction,distance=Math.max(entry*.004,structural,1.5*f!.atr);
 if(!Number.isFinite(distance)||distance<=0||distance/entry>.015)return {...a,eligible:false,reason:'ATR/structure stop exceeds the 1.5% safety ceiling; wait'};
 return {...a,stopPrice:entry-sign*distance,stopFraction:distance/entry,targetR:3};
}
