import {strategyName} from './strategies.ts';
import type {State} from './paper-engine.ts';
export const LEARNING_VERSION='review-guards-v1';
export type EntryAudit={macro?:{btcHour?:import('./macro-risk.ts').HigherFrame;assetHour?:import('./macro-risk.ts').HigherFrame;atr15?:import('./macro-risk.ts').HigherFrame;spreadFraction?:number;cryptoTone?:string};version:string;time:number;quote:{price:number;fetchedAt:number};signal:{barTime:number;strategy:string;direction:string;reason:string};indicators?:import('./strategy.ts').Analysis;recentCandles?:import('./strategy.ts').Candle[];votes:{role:string;status:string;reason:string}[];news:{source?:string;fetchedAt?:number;flags:string[]};allocation:number;estimatedRisk:number;feePerSide?:number;slippageFraction?:number;plan?:{entry:number;stop:number;target:number}};
export type Performance={closed:number;wins:number;losses:number;net:number;positive:number;negative:number};
export type Scope={label:string;kind:'strategy'|'asset'|'setup';performance:Performance;recent:{id:string;time:number;net:number}[];blocked:boolean;reason?:string;triggeredAt?:number;review?:{time:number;note:string};};
export type Learning={version:1;scopes:Record<string,Scope>;cohorts:Record<string,Performance>;events:{time:number;key:string;event:string}[];};
const empty=():Performance=>({closed:0,wins:0,losses:0,net:0,positive:0,negative:0});
const add=(p:Performance,n:number)=>{p.closed++;p.net+=n;if(n>0){p.wins++;p.positive+=n}else if(n<0){p.losses++;p.negative+=-n}};
function scopeKeys(strategy:string,symbol:string,direction:string){return [{key:JSON.stringify(['strategy',strategy,direction]),label:`${strategyName(strategy)} · ${direction}`,kind:'strategy' as const},{key:JSON.stringify(['asset',symbol,direction]),label:`${symbol} · ${direction}`,kind:'asset' as const},{key:JSON.stringify(['setup',strategy,symbol,direction]),label:`${strategyName(strategy)} · ${symbol} · ${direction}`,kind:'setup' as const}]}
export function refreshLearning(s:State){
 const l=s.learning??={version:1,scopes:{},cohorts:{},events:[]};const seen=new Set(s.trades.filter(t=>t.learningReviewed).map(t=>t.id));
 for(const t of [...s.trades].sort((a,b)=>a.time-b.time)){
  if(t.learningReviewed||(t.side!=='SELL'&&t.side!=='COVER')||!Number.isFinite(t.net)||t.net===null)continue;
  if(seen.has(t.id)){t.learningReviewed=true;continue}seen.add(t.id);t.learningReviewed=true;const direction=t.direction??(t.side==='COVER'?'short':'long'),cohort=t.entryAudit?.version==='macro-atr-3r-v1'?'Macro + ATR + 3R':t.entryAudit?.version===LEARNING_VERSION?'New safeguards':t.id.includes('team-')?'Team before safeguards':'Previous agents';
  add(l.cohorts[cohort]??=empty(),t.net);
  if(!t.strategy)continue;
  for(const k of scopeKeys(t.strategy,t.symbol,direction)){
   const v=l.scopes[k.key]??={label:k.label,kind:k.kind,performance:empty(),recent:[],blocked:false};add(v.performance,t.net);v.recent.push({id:t.id,time:t.time,net:t.net});v.recent=v.recent.slice(-5);
   const window=k.kind==='setup'?v.recent.slice(-3):v.recent,min=k.kind==='setup'?3:5,losses=window.filter(x=>x.net<0).length,net=window.reduce((n,x)=>n+x.net,0);
   if(!v.blocked&&window.length>=min&&losses>=3&&net<0){v.blocked=true;v.triggeredAt=t.time;v.reason=`${losses}/${window.length} losing closes; net $${net.toFixed(2)}. New entries quarantined until reviewed.`;l.events.push({time:t.time,key:k.key,event:'Quarantined: '+v.reason})}
  }
 }
 l.events=l.events.slice(-200);return l;
}
export function learningGate(s:State,strategy:string,symbol:string,direction:string){const l=refreshLearning(s),blocked=scopeKeys(strategy,symbol,direction).map(k=>l.scopes[k.key]).find(v=>v?.blocked);return {approved:!blocked,reason:blocked?`${blocked.label}: ${blocked.reason}`:'No repeated-loss quarantine for this setup'};}
export function reviewScope(s:State,key:string,note:string,now:number){refreshLearning(s);const v=s.learning!.scopes[key];if(!v?.blocked)throw new Error('Select an active quarantine');if(typeof note!=='string'||note.trim().length<12||note.length>500)throw new Error('Describe your review in 12–500 characters');v.blocked=false;v.recent=[];v.review={time:now,note:note.trim()};s.learning!.events.push({time:now,key,event:'Reviewed and re-enabled: '+note.trim()});s.learning!.events=s.learning!.events.slice(-200);s.running=false;s.sessionArmed=false;s.message='Review saved. Entries remain paused; resume when ready.';}
export function performanceView(p:Performance){return {...p,winRate:p.closed?p.wins/p.closed*100:null,averageWin:p.wins?p.positive/p.wins:null,averageLoss:p.losses?p.negative/p.losses:null,expectancy:p.closed?p.net/p.closed:null,profitFactor:p.negative?p.positive/p.negative:null};}
