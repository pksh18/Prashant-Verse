'use client';
import {useState} from 'react';
import MarketCore from './market-core';
import type {State} from '@/lib/paper-engine';
import type {DashboardView} from '@/lib/dashboard-view';
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function TradeScene({state,view,fresh}:{state:State;view:DashboardView;fresh:boolean}){
 const [mode,setMode]=useState<'account'|'whatif'>('account'),[angle,setAngle]=useState(28),[entry,setEntry]=useState(100),[stop,setStop]=useState(90),[quantity,setQuantity]=useState(50),[step,setStep]=useState(0),[path,setPath]=useState<'target'|'retrace'>('target');
 const valid=Number.isFinite(entry)&&Number.isFinite(stop)&&Number.isFinite(quantity)&&entry>0&&stop>0&&stop<entry&&quantity>0;
 const risk=entry-stop,lock=entry+1.5*risk,target=entry+2*risk;
 const route=path==='target'?[entry,entry+.5*risk,entry+risk,lock,entry+1.8*risk,target]:[entry,entry+.5*risk,entry+risk,lock,entry+1.8*risk,lock];
 const current=route[step],closed=step===5,locked=step>=3,activeStop=locked?lock:stop;
 const values=mode==='account'?state.curve.slice(-24).map(p=>p.equity):valid?route.slice(0,step+1):[];
 const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):0,range=Math.max(high-low,mode==='account'?1:risk);
 const heights=values.map(v=>18+105*(v-low)/range);
 const net=valid?((closed?current*.9995:current)-entry)*quantity:0;
 function reset(){setStep(0)}
 return <section className="panel trade-lab"><div className="section-top"><h2>Market core <small className="core-subtitle">/ INTERACTIVE TERMINAL</small></h2><div className="lab-switch"><button aria-pressed={mode==='account'} onClick={()=>setMode('account')}>Account view</button><button aria-pressed={mode==='whatif'} onClick={()=>setMode('whatif')}>What-if tool</button></div></div>
 {mode==='account'?<MarketCore state={state} view={view} fresh={fresh}/>:<div className="lab-layout"><div className="scene-wrap"><div className="scene-caption"><span>WHAT-IF · NO ORDERS</span><b>{valid?usd(current):'Enter valid values'}</b><small>{!valid?'Stop must be below entry':closed?(path==='target'?'Exit at 2R':'Exit at protected 1.5R stop'):locked?'1.5R reached · protected stop active':'Position open · original stop'}</small></div>
 <div className="scene-camera"><div className="scene-plane" style={{transform:`rotateX(58deg) rotateZ(${-angle}deg)`}}><div className="scene-grid"/>{heights.map((height,i)=><div className="scene-bar" key={i} style={{left:`${10+i*78/Math.max(1,heights.length-1)}%`,height,transform:`translateZ(${height/2}px) rotateX(-90deg)`,background:values[i]>=(values[i-1]??values[i])?'#b5f572':'#f48783'}} title={usd(values[i])}><span/></div>)}<div className="scene-axis">ENTRY → EXIT</div></div></div>
 {!values.length&&<p className="scene-empty">Set valid entry, stop and quantity.</p>}
 <label className="orbit-control">Rotate view<input type="range" min="0" max="60" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
 <p className="fine">Illustrative price path. Advance each step to see the exit rule; this does not change your account.</p></div>
 <div className="scene-info"><><h3>Test the profit lock</h3><div className="scenario-inputs">{[['Entry price',entry,setEntry],['Initial stop',stop,setStop],['Quantity',quantity,setQuantity]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<input type="number" min="0.000001" step="any" value={value as number} onChange={e=>{(setter as (v:number)=>void)(Number(e.target.value));reset()}}/></label>)}</div><label className="scenario-path">Price path<select value={path} onChange={e=>{setPath(e.target.value as 'target'|'retrace');reset()}}><option value="target">Rise to 2R target</option><option value="retrace">Rise past 1.5R, then fall back</option></select></label>
 <dl className="scenario-levels"><div><dt>1.5R trigger</dt><dd>{valid?usd(lock):'—'}</dd></div><div><dt>Active stop</dt><dd>{valid?usd(activeStop):'—'}</dd></div><div><dt>Target</dt><dd>{valid?usd(locked?target:lock):'—'}</dd></div><div><dt>{closed?'Exit net result':'Open net result'}</dt><dd className={net<0?'negative':'positive'}>{valid?usd(net):'—'}</dd></div></dl>
 <div className="scenario-actions"><button disabled={!valid||closed} onClick={()=>setStep(n=>Math.min(5,n+1))}>{closed?'Scenario complete':'Next price step'}</button><button onClick={reset}>Reset</button></div><p className="fine">Step {step+1}/6 · Entry is assumed already filled. Entry and exit fees are $0; closed results include 0.05% exit slippage. Gaps, spread and taxes are excluded. Examples allow wider stops than the bot’s 0.4–1.5% entry limits.</p></></div></div>}</section>
}
