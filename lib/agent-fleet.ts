import {initial,equity,summary,advance,closeDay,istDay,type State,type Quote} from './paper-engine.ts';
import type {Candle} from './strategy.ts';
import type {Symbol} from './market-config.ts';
import {dashboardView} from './dashboard-view.ts';
import {strategyInfo,type StrategyId} from './strategies.ts';
export const AGENT_PRESETS:StrategyId[]=['trend-pullback-v2','momentum-alpha','ema-9-15','liquidity-sweep','supply-demand','golden-trio','fibonacci','donchian-breakout','rolling-vwap','bollinger-reversion'];
const makeAgent=(strategy:StrategyId,i:number)=>({id:`agent-${i+1}`,name:`Agent ${i+1}`,state:{...initial(),startingCapital:10000,cash:10000,dayBase:10000,allocation:1000,maxPositions:2,dailyLimit:100,agentId:`agent-${i+1}`,selectedStrategy:strategy}});
export function ensureFleet(s:State){
 if(s.agents){
  const added=Math.max(0,10-s.agents.length);
  if(s.fleetVersion!==2){
   for(let i=0;i<10;i++){
    const existing=s.agents[i];if(!existing){const a=makeAgent(AGENT_PRESETS[i],i);a.state.day=s.day;a.state.halted=s.halted;s.agents.push(a)}
    else if(existing.state.selectedStrategy!==AGENT_PRESETS[i]){existing.state.selectedStrategy=AGENT_PRESETS[i];existing.state.running=false;existing.state.sessionArmed=false;existing.state.analysis={};existing.entryDecisions={}}
   }
   s.curve=s.curve.map(p=>({...p,equity:p.equity+added*10000}));s.fleetVersion=2;
  }
  s.startingCapital=100000;s.dailyLimit=100;s.maxPositions=20;for(const a of s.agents){a.state.maxPositions=2;a.state.dailyLimit=100}return s;
 }
 const legacy=structuredClone(s);legacy.running=false;legacy.sessionArmed=false;
 Object.assign(s,initial(),{fleetVersion:2,dailyLimit:100,startingCapital:100000,cash:100000,dayBase:100000,allocation:1000,maxPositions:20,legacy,agents:AGENT_PRESETS.map(makeAgent)});
 return s;
}
export function syncFleet(s:State){
 const agents=s.agents!;s.cash=agents.reduce((n,a)=>n+a.state.cash,0);s.realized=agents.reduce((n,a)=>n+a.state.realized,0);s.fees=agents.reduce((n,a)=>n+a.state.fees,0);s.positions=agents.flatMap(a=>a.state.positions);s.trades=agents.flatMap(a=>a.state.trades).sort((a,b)=>a.time-b.time);s.running=agents.some(a=>a.state.running);s.sessionArmed=agents.some(a=>a.state.sessionArmed);s.startedAt=agents.map(a=>a.state.startedAt).find(Boolean)??null;
 s.dayBase=agents.reduce((n,a)=>n+a.state.dayBase,0);s.quotes=agents[0].state.quotes;s.lastTick=Math.min(...agents.map(a=>a.state.lastTick));s.gold=agents[0].state.gold;s.analysis=agents[0].state.analysis;s.selectedStrategy=agents[0].state.selectedStrategy;
 s.message=s.halted?'Shared $100 daily risk lock':s.legacy?.positions.length?'Previous account exits monitored; new agents wait until it is flat.':'Ten independent strategy accounts · $100,000 combined allocation';
 return s;
}
export function enforceFleetRisk(s:State,now:number){
 syncFleet(s);if(summary(s).dailyPnl<=-100)s.halted=true;
 if(s.halted)for(const a of s.agents!){a.state.halted=true;a.state.running=false;closeDay(a.state,now,'Shared $100 fleet daily loss trigger')}
 syncFleet(s);return !s.halted;
}
export function fleetAdvance(s:State,quotes:Quote[],now:number,action:string,bars:Partial<Record<StrategyId,Partial<Record<Symbol,Candle[]>>>>,agentId?:string){
 ensureFleet(s);
 if(agentId&&!s.agents!.some(a=>a.id===agentId))throw new Error('Unknown agent');
 if(action==='start'&&s.legacy?.positions.length)throw new Error('Close previous account positions before starting the new agents.');
 const rolled=!!s.day&&s.day!==istDay(now);if(rolled)s.halted=false;s.day=istDay(now);
 // Mark every ledger before checking aggregate exposure. Run all exits before any new entry.
 if(s.legacy){advance(s.legacy,quotes,now,action==='close'?'close':'tick',undefined,()=>false);s.legacy.running=false;s.legacy.sessionArmed=false}
 for(const a of s.agents!){const selected=!agentId||agentId===a.id;advance(a.state,quotes,now,selected?action:'tick',bars[a.state.selectedStrategy!],()=>false)}
 enforceFleetRisk(s,now);
 // The exit pass consumes candle decisions. Restore decision cursors only for a second, entry-only consideration.
 for(const a of s.agents!){if(!a.state.running||s.halted||s.legacy?.positions.length)continue;
  const decisions=a.state.lastDecision;a.state.lastDecision={};
  // Preserve already-used bars across updates through a separate persisted cursor.
  a.state.lastDecision=a.entryDecisions??{};
  advance(a.state,quotes,now,'tick',undefined,()=>enforceFleetRisk(s,now)&&s.positions.length<20);
  a.entryDecisions={...a.state.lastDecision};a.state.lastDecision=decisions;
 }
 enforceFleetRisk(s,now);s.curve.push({time:now,equity:equity(s)});s.curve=s.curve.slice(-600);return syncFleet(s);
}
export function fleetResponse(s:State,now=Date.now(),agentId?:string){ensureFleet(s);syncFleet(s);const selected=s.agents!.find(a=>a.id===agentId)??s.agents![0];const view=dashboardView(s,now);view.markets=dashboardView(selected.state,now).markets;view.selected=dashboardView(selected.state,now).selected;view.message=s.message;return {state:s,view,summary:summary(s),agents:s.agents!.map(a=>({id:a.id,name:a.name,strategy:strategyInfo(a.state.selectedStrategy).name,view:dashboardView(a.state,now)}))}}
