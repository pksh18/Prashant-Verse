import {parseCandles,type Candle} from './strategy.ts';
export function parseKraken(input:unknown,now:number,interval:number,history:number):Candle[]{
 const v=input as {error?:unknown;result?:Record<string,unknown>};
 if(!v||!Array.isArray(v.error)||v.error.length||!v.result)throw new Error('Kraken candle source unavailable');
 const series=Object.entries(v.result).filter(([key])=>key!=='last');
 if(series.length!==1||!Array.isArray(series[0][1]))throw new Error('Invalid Kraken candle series');
 return parseCandles(series[0][1].map((r:unknown)=>{if(!Array.isArray(r)||r.length<8)throw new Error('Invalid Kraken candle');return [r[0],r[3],r[2],r[1],r[4],r[6]].map(Number)}),now,interval,history);
}
export function parseGold(input:unknown,now:number){
 const q=input as {symbol?:string;currency?:string;price?:number;updatedAt?:string};
 const fetchedAt=Date.parse(q?.updatedAt??'');
 if(q?.symbol!=='XAU'||q.currency!=='USD'||!Number.isFinite(q.price)||q.price!<=0||!Number.isFinite(fetchedAt)||fetchedAt>now+1000)throw new Error('Invalid XAU/USD quote');
 return {symbol:'XAU' as const,price:q.price!,fetchedAt};
}
