'use client';
import {LIMIT} from '@/lib/market-config';
import {useEffect,useRef,useState} from 'react';
import type {State} from '@/lib/paper-engine';
import type {DashboardView} from '@/lib/dashboard-view';
const usd=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
function Trace({values,color,label}:{values:number[];color:string;label:string}){
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,.01),points=values.map((v,i)=>`${i*300/Math.max(1,values.length-1)},${64-(v-lo)/span*50}`).join(' ');
 return values.length>1?<svg viewBox="0 0 300 80" role="img" aria-label={label} preserveAspectRatio="none"><path d="M0 20H300M0 45H300M0 70H300" stroke="#203344" strokeWidth=".5"/><polygon points={`0,80 ${points} 300,80`} fill={color} opacity=".08"/><polyline points={points} fill="none" stroke={color} strokeWidth="1.7" vectorEffect="non-scaling-stroke"/></svg>:<p className="core-empty">Waiting for saved history</p>
}
export default function MarketCore({state,view,fresh}:{state:State;view:DashboardView;fresh:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),rotation=useRef(0),pointer=useRef<number|null>(null),[motion,setMotion]=useState(true),[zoom,setZoom]=useState(1);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
  let frame=0,width=0,height=0,active=true,visible=true,last=0,turn=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),resize=new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;const dpr=Math.min(devicePixelRatio||1,2);el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw(0)});
  const dots=Array.from({length:1600},(_,i)=>{const theta=i*2.3999632297,y=1-2*(i+.5)/1600,r=Math.sqrt(1-y*y);return {x:r*Math.cos(theta),y,z:r*Math.sin(theta)}});
  function draw(ms:number){if(!ctx||!width)return;ctx.clearRect(0,0,width,height);const cx=width*.5,cy=height*.53,scale=Math.min(width*.32,height*.36)*zoom,spin=turn+rotation.current;
   const glow=ctx.createRadialGradient(cx,cy,1,cx,cy,scale*1.9);glow.addColorStop(0,'#1b335c55');glow.addColorStop(.6,'#24224722');glow.addColorStop(1,'#05091300');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
   ctx.strokeStyle='#1a304255';ctx.lineWidth=.6;for(let x=0;x<width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}for(let y=0;y<height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
   function project(x:number,y:number,z:number){const xx=x*Math.cos(spin)-z*Math.sin(spin),zz=x*Math.sin(spin)+z*Math.cos(spin),yy=y*Math.cos(.32)-zz*Math.sin(.32),depth=y*Math.sin(.32)+zz*Math.cos(.32),p=3.7/(3.7+depth);return {x:cx+xx*scale*p,y:cy+yy*scale*p,z:depth}}
   for(let ribbon=0;ribbon<3;ribbon++){ctx.beginPath();for(let i=0;i<=160;i++){const a=i/160*Math.PI*2,p=project(1.38*Math.cos(a),.38*Math.sin(a*2+ribbon*1.5+spin),.72*Math.sin(a));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.strokeStyle=['#42e5f4aa','#a38bff88','#ff71ce66'][ribbon];ctx.lineWidth=.9;ctx.stroke()}
   const rendered=dots.map((d,i)=>{const warp=1+.10*Math.sin(d.y*7+spin*2),p=project(d.x*warp,d.y*.88,d.z*warp);return {...p,i}}).sort((a,b)=>b.z-a.z);
   for(const p of rendered){ctx.globalAlpha=.25+.65*(1-p.z/1.5)/2;ctx.fillStyle=p.i%7===0?'#fa85e4':p.z<0?'#60eaf2':'#8a9aff';ctx.beginPath();ctx.arc(p.x,p.y,p.z<0?1.1:.7,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
   for(let j=0;j<5;j++){const a=spin*.7+j*Math.PI*2/5,p=project(1.38*Math.cos(a),.35*Math.sin(a*2),.72*Math.sin(a));ctx.shadowBlur=12;ctx.shadowColor='#67edf8';ctx.fillStyle='#b4faff';ctx.beginPath();ctx.arc(p.x,p.y,2.3,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
  }
  function loop(ms:number){if(active&&visible&&!document.hidden){if(motion&&!reduced.matches)turn+=Math.min(ms-last,50)*.00016;if(ms-last>=33){draw(ms);last=ms}}frame=requestAnimationFrame(loop)}
  const observer=new IntersectionObserver(e=>{visible=e[0].isIntersecting});observer.observe(el);resize.observe(el);frame=requestAnimationFrame(loop);
  return()=>{active=false;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect()};
 },[motion,zoom]);
 const equity=state.curve.slice(-90).map(p=>p.equity),fills=view.recentTrades.filter(t=>(t.side==='SELL'||t.side==='COVER')).slice(0,20).reverse().map(t=>t.net??0),qualified=view.markets.filter(m=>m.decision==='SIGNAL').length;
 return <div className="holo-terminal"><aside className="core-rail"><article><div className="telemetry-head">EQUITY TRACE <span>USD</span></div><strong>{usd(view.stats.equity)}</strong><Trace values={equity} color="#5ee5ee" label="Saved account equity history"/><small>Saved snapshots · relative scale</small></article><article><div className="telemetry-head">CLOSED TRADE RESULTS</div><strong className={view.stats.realized<0?'negative':'positive'}>{usd(view.stats.realized)}</strong><Trace values={fills} color="#b39bff" label="Recent closed trade net results"/><small>Last {fills.length} exits · after costs</small></article></aside>
 <div className="core-stage"><div className="core-topline"><span><i/>PRASHANTVERSE / MARKET CORE</span><span>01 — ORBIT</span></div><canvas ref={canvas} aria-label="Decorative 3D particle sphere. Drag horizontally to rotate." onPointerDown={e=>{pointer.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(pointer.current!==null){rotation.current+=(e.clientX-pointer.current)*.008;pointer.current=e.clientX}}} onPointerUp={()=>{pointer.current=null}} onPointerCancel={()=>{pointer.current=null}}/>
 <div className="core-overlay"><span>ACCOUNT STATUS</span><b>{view.status}</b><small>{fresh?'Server updates connected':'Saved data · updates unavailable'}</small></div><div className="core-bottomline"><span>Decorative visual · drag to orbit</span><button aria-pressed={motion} onClick={()=>setMotion(v=>!v)}>{motion?'Pause motion':'Resume motion'}</button><label>Zoom<input aria-label="Visual zoom" type="range" min=".65" max="1.2" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label></div></div>
 <aside className="core-rail right"><article><div className="telemetry-head">EXECUTION STATUS</div><div className="core-readout"><span>Open positions</span><b>{view.positions.length}<small> / 10</small></b></div><div className="core-readout"><span>Qualified setups</span><b>{fresh?qualified:'—'}</b></div><div className="core-readout"><span>Fresh quotes</span><b>{fresh?view.markets.filter(m=>m.quoteFresh).length:'0'}<small> / {view.markets.length}</small></b></div></article><article><div className="telemetry-head">RISK GUARD</div><strong>{usd(view.stats.remainingLoss)}</strong><small>Daily loss budget remaining</small><div className="risk-track"><i style={{width:`${Math.min(100,Math.max(0,view.stats.remainingLoss/LIMIT*100))}%`}}/></div><div className="core-readout"><span>Protected stop</span><b>1.5R</b></div><div className="core-readout"><span>Final target</span><b>3R / 2R</b></div></article></aside>
 </div>
}
