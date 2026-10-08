import {parseCandles} from './strategy.ts';
export const FOREX_PAIRS=['EUR/USD','GBP/USD','AUD/USD','NZD/USD'] as const;
export type ForexPair=typeof FOREX_PAIRS[number];
export function forexSession(now:number){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),get=(t:string)=>parts.find(p=>p.type===t)!.value;
 const day=get('weekday'),m=Number(get('hour'))*60+Number(get('minute'));
 const weekend=day==='Sat'||day==='Sun'&&m<1025||day==='Fri'&&m>=1019;
 const open=!weekend&&(m<1019||m>=1025);
 return {open,entries:open&&(m<1015||m>=1025),closeSoon:open&&m>=1015&&m<1019,reason:weekend?'Forex weekend closure':!open?'Forex daily break':'Forex session open'};
}
// Prepared provider contract. No execution or requests are enabled without a feed connection.
export function parseForexCandles(input:unknown,pair:ForexPair,now:number,interval=300000,history=120){
 const v=input as {meta?:{symbol?:string;interval?:string};values?:{datetime:string;open:string;high:string;low:string;close:string}[];status?:string};
 if(v?.status==='error'||v?.meta?.symbol!==pair||v.meta.interval!==`${interval/60000}min`||!Array.isArray(v.values))throw new Error('Invalid forex candle response');
 return parseCandles(v.values.map(c=>[Date.parse(c.datetime.replace(' ','T')+'Z')/1000,Number(c.low),Number(c.high),Number(c.open),Number(c.close),0]),now,interval,history);
}
