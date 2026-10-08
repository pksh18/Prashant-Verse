import type {Trade} from './paper-engine';
export const accountDay=(time:number)=>new Date(time+330*60000).toISOString().slice(0,10);
export type DailyPerformance={day:string;entries:number;closed:number;wins:number;losses:number;breakeven:number;net:number;fees:number;winRate:number|null;status:'Profit'|'Loss'|'Breakeven'|'No closes'};
export function dailyPerformance(trades:Trade[],now:number):DailyPerformance[]{
 const rows=new Map<string,DailyPerformance>();
 const row=(day:string)=>{if(!rows.has(day))rows.set(day,{day,entries:0,closed:0,wins:0,losses:0,breakeven:0,net:0,fees:0,winRate:null,status:'No closes'});return rows.get(day)!};
 row(accountDay(now));const seen=new Set<string>();
 for(const t of trades){if(seen.has(t.id)||!Number.isFinite(t.time))continue;seen.add(t.id);const r=row(accountDay(t.time));if(Number.isFinite(t.fee))r.fees+=t.fee;
  if(t.side==='BUY'||t.side==='SHORT')r.entries++;
  else if((t.side==='SELL'||t.side==='COVER')&&t.net!==null&&Number.isFinite(t.net)){r.closed++;r.net+=t.net;if(t.net>0)r.wins++;else if(t.net<0)r.losses++;else r.breakeven++}
 }
 return [...rows.values()].sort((a,b)=>b.day.localeCompare(a.day)).map(r=>({...r,winRate:r.closed?r.wins/r.closed*100:null,status:!r.closed?'No closes':r.net>0?'Profit':r.net<0?'Loss':'Breakeven'}));
}
