
'use client';
import type {State} from '@/lib/paper-engine';
import type {DashboardView} from '@/lib/dashboard-view';
import {accountDay,dailyPerformance} from '@/lib/daily-performance';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
const usd=(n:number)=>(n>0?'+':'')+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function DailyStatus({state,view,fresh}:{state:State;view:DashboardView;fresh:boolean}){
 const today=accountDay(view.generatedAt),cutoff=accountDay(view.generatedAt-9*86400000),rows=dailyPerformance(state.trades,view.generatedAt).filter(r=>r.day>=cutoff&&r.day<=today);
 return <section className="panel daily-status"><div className="section-top"><h2>Day-wise performance</h2><span className="muted">Last 10 days · USD · IST</span></div><div className="daily-live"><span>{fresh?'Today’s live net P/L':'Today’s saved net P/L'}</span><strong className={view.stats.dailyPnl<0?'negative':'positive'}>{usd(view.stats.dailyPnl)}</strong><span>{state.halted?'Daily risk lock':state.lossReview?.paused?'Review required':state.running?'Scanning markets':'Entries paused'} · {view.positions.length} open positions</span></div>
 <Table><TableHeader><TableRow>{['Day · IST','Status','Entries','Closed','Wins / losses / flat','Win %','Closed net P/L'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.day}><TableCell><b>{r.day}</b>{r.day===today&&<small className="block">Today · in progress</small>}</TableCell><TableCell className={r.status==='Profit'?'positive':r.status==='Loss'?'negative':'muted'}>{r.status}</TableCell><TableCell>{r.entries}</TableCell><TableCell>{r.closed}</TableCell><TableCell>{r.wins} / {r.losses} / {r.breakeven}</TableCell><TableCell>{r.winRate===null?'—':r.winRate.toFixed(1)+'%'}</TableCell><TableCell className={r.net<0?'negative':r.net>0?'positive':'muted'}>{usd(r.net)}</TableCell></TableRow>)}</TableBody></Table>
 <p className="fine">Closed net P/L is assigned to the exit day and already includes each trade’s recorded fees. Today’s live P/L also includes open-price changes and uses the account’s daily equity baseline, so it can differ from closed results. Only the last 10 calendar days are shown, including today; days without retained activity are omitted. Up to 1,000 retained fills from the current account; archived accounts are excluded and older days may be incomplete. No historical live P/L or equity is reconstructed.</p></section>
}
