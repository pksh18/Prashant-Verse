import type {State} from './paper-engine.ts';
// Feedback guard, not a predictive model: stop adding exposure after a losing batch.
export function lossWindow(s:State){
 const closed=s.trades.filter(t=>(t.side==='SELL'||t.side==='COVER')&&typeof t.net==='number'&&Number.isFinite(t.net));
 const reviewed=s.lossReview?.reviewedThrough,index=reviewed?closed.findIndex(t=>t.id===reviewed):-1;
 const recent=(index>=0?closed.slice(index+1):closed).slice(-5);
 return {trades:recent,losses:recent.filter(t=>t.net!<0).length,net:recent.reduce((n,t)=>n+t.net!,0)};
}
export function checkLossReview(s:State,now:number){
 if(s.lossReview?.paused){s.running=false;s.sessionArmed=false;return false}
 const w=lossWindow(s);
 if(w.trades.length<5||w.losses<3||w.net>=0)return false;
 s.lossReview={...s.lossReview,paused:true,triggeredAt:now,tradeIds:w.trades.map(t=>t.id),losses:w.losses,net:w.net};
 s.running=false;s.sessionArmed=false;s.message=`Review required: ${w.losses} losses in the latest five closes; combined net $${w.net.toFixed(2)}. New entries paused; open-position exits remain monitored.`;
 return true;
}
export function acknowledgeLossReview(s:State){
 if(!s.lossReview?.paused)return;
 s.lossReview={...s.lossReview,paused:false,reviewedThrough:s.trades.filter(t=>(t.side==='SELL'||t.side==='COVER')).at(-1)?.id};
}
