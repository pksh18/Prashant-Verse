import {test} from 'node:test';
import fs from 'node:fs';
import {analyzeStrategy} from './strategies.ts';
import type {Candle} from './strategy.ts';
import assert from 'node:assert/strict';
import {initial,advance,summary,type State} from './paper-engine.ts';
import {dashboardView} from './dashboard-view.ts';
import {checkLossReview} from './loss-review.ts';
import {CRYPTO_SYMBOLS,CAPITAL} from './market-config.ts';
import {STRATEGY} from './strategy.ts';
const now=Date.parse('2026-10-05T12:00:00Z');
const quotes=(time=now,price=100)=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price,fetchedAt:time}));
function started(){const s=initial();s.quotes=quotes();s.analysis={BTC:{strategy:STRATEGY,direction:'short',barTime:now-300000,eligible:true,reason:'Bearish setup',score:1,stopFraction:.005}};return advance(s,s.quotes,now,'start')}
test('SHORT reserves collateral; COVER releases it and reconciles net equity and $0 fees',()=>{
 const s=started(),p=s.positions[0];assert.equal(p.direction,'short');assert.equal(s.trades[0].side,'SHORT');assert.ok(p.entry<100);assert.ok(p.stop!>p.entry);assert.ok(p.target!<p.entry);assert.equal(s.cash,CAPITAL-5000);assert.ok(summary(s).unrealized<0);
 advance(s,quotes(now+15000,99.8),now+15000,'close');const exit=s.trades.at(-1)!;
 assert.equal(exit.side,'COVER');assert.ok(exit.price>99.8);assert.equal(s.fees,0);assert.equal(summary(s).closed,1);assert.equal(summary(s).wins,1);assert.ok(Math.abs(summary(s).totalPnl-summary(s).realized)<1e-8);
});
test('SHORT protects 1.5R through reload and covers a later upward reversal',()=>{
 let s=started();s.running=false;const p=s.positions[0],r=p.initialRisk!,lock=p.entry-1.5*r;
 advance(s,quotes(now+15000,lock),now+15000);assert.equal(p.profitLocked,true);assert.equal(p.stop,lock);assert.equal(p.target,p.entry-2*r);
 s=JSON.parse(JSON.stringify(s));advance(s,quotes(now+30000,lock-r*.1),now+30000);assert.equal(s.positions.length,1);
 advance(s,quotes(now+45000,lock),now+45000);assert.equal(s.trades.at(-1)?.reason,'1.5R protected stop');assert.equal(s.trades.at(-1)?.side,'COVER');assert.equal(s.positions.length,0);
});
test('SHORT exits at falling 2R target or rising stop with correctly signed results',()=>{
 for(const winning of [true,false]){const s=started(),p=s.positions[0];s.running=false;const mark=winning?p.entry-2*p.initialRisk!:p.stop!;
 advance(s,quotes(now+15000,mark),now+15000);assert.equal(s.positions.length,0);assert.equal(s.trades.at(-1)?.reason,winning?'2R profit target':'Strategy stop');assert.equal(s.trades.at(-1)!.net!>0,winning)}
});
test('SHORT unrealized losses trigger the same $500 daily stop',()=>{const s=started();advance(s,quotes(now+15000,130),now+15000);assert.equal(s.halted,true);assert.equal(s.positions.length,0);assert.ok(summary(s).dailyPnl<-500)});
test('SHORT preview matches execution; open P&L uses bearish direction',()=>{
 const s=started(),p=s.positions[0];const v=dashboardView(s,now);assert.equal(v.positions[0].net,summary(s).unrealized);assert.equal(v.positions[0].direction,'short');
 const preview=initial();preview.quotes=quotes();preview.analysis={BTC:{strategy:STRATEGY,direction:'short',barTime:now-300000,eligible:true,reason:'Bearish',score:1,stopFraction:.005}};
 assert.deepEqual(dashboardView(preview,now).markets[0].plan,{direction:'short',entry:p.entry,stop:p.stop,target:p.target});
});
test('loss review counts COVER and SELL while ignoring entry fills',()=>{
 const s=initial();s.trades=Array.from({length:5},(_,i)=>({id:String(i),time:now,side:i%2?'SELL':'COVER',symbol:'BTC',kind:'intraday',quantity:1,price:100,fee:2.5,reason:'close',net:i<3?-20:5})) as State['trades'];
 assert.equal(checkLossReview(s,now),true);assert.equal(s.lossReview?.losses,3);assert.equal(s.lossReview?.net,-50);
});

test('default V2 bearish fixture opens at most five shorts from fresh closed candles',()=>{
 const raw=JSON.parse(fs.readFileSync(new URL('./fixtures/qualified-btc.json',import.meta.url),'utf8')) as Candle[],axis=2*raw.at(-1)!.close;
 const b=raw.map(x=>({...x,time:now-(raw.at(-1)!.time-x.time)-300000,open:axis-x.open,close:axis-x.close,high:axis-x.low,low:axis-x.high}));
 const a=analyzeStrategy(STRATEGY,b,now);assert.equal(a.direction,'short');assert.equal(a.eligible,true);
 const s=advance(initial(),quotes(now,b.at(-1)!.close),now,'start',Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,b])));
 assert.equal(s.positions.length,5);assert.ok(s.positions.every(p=>p.direction==='short'));assert.ok(s.trades.every(t=>t.side==='SHORT'));
});
