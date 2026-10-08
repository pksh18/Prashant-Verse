import type {Candle} from './strategy.ts';
export type GoldQuote={symbol:'XAU';price:number;fetchedAt:number};
type Observed=Candle&{first:number;last:number;maxGap:number;count:number};
export type GoldState={quote?:GoldQuote;lastObserved?:number;frames:Record<string,{current?:Observed;closed:Candle[]}>;error?:string};
export function goldSession(now:number){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),get=(t:string)=>parts.find(p=>p.type===t)!.value;
 const day=get('weekday'),minute=Number(get('hour'))*60+Number(get('minute'));
 const weekend=day==='Sat'||day==='Sun'&&minute<1085||day==='Fri'&&minute>=1019;
 const open=!weekend&&(minute<1019||minute>=1085);
 return {open,entries:open&&(minute<1015||minute>=1085),closeSoon:open&&minute>=1015&&minute<1019,reason:weekend?'Gold weekend closure':!open?'Gold daily market break':'Gold session open'};
}
export function observeGold(state:GoldState,q:GoldQuote,now:number){
 state.quote=q;
 if(!goldSession(now).open||now-q.fetchedAt>90000||q.fetchedAt<=(state.lastObserved??0))return;
 state.lastObserved=q.fetchedAt;
 for(const interval of [60000,300000]){
  const frame=state.frames[interval]??={closed:[]},time=Math.floor(q.fetchedAt/interval)*interval;
  if(frame.current&&frame.current.time!==time){
   const c=frame.current;
   // Only publish adequately observed bars. Never fill gaps with invented prices.
   if(c.count>=2&&c.first-c.time<=35000&&c.time+interval-c.last<=35000&&c.maxGap<=45000)frame.closed.push({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close,volume:0});
   frame.closed=frame.closed.slice(-300);frame.current=undefined;
  }
  if(!frame.current)frame.current={time,open:q.price,high:q.price,low:q.price,close:q.price,volume:0,first:q.fetchedAt,last:q.fetchedAt,maxGap:0,count:1};
  else{const c=frame.current;c.high=Math.max(c.high,q.price);c.low=Math.min(c.low,q.price);c.close=q.price;c.maxGap=Math.max(c.maxGap,q.fetchedAt-c.last);c.last=q.fetchedAt;c.count++}
 }
}
