import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initial,advance,summary,FEE,MAX_POSITIONS,risk} from './paper-engine.ts';
import {SYMBOLS,CRYPTO_SYMBOLS,CAPITAL,LIMIT,type Symbol} from './market-config.ts';
import {analyze,parseCandles,BAR_MS,type Candle} from './strategy.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/qualified-btc.json',import.meta.url),'utf8')) as Candle[];
const time=fixture.at(-1)!.time+BAR_MS,reference=fixture.at(-1)!.close;
const prices:Record<Symbol,number>={BTC:85000,ETH:2700,SOL:120,XRP:1.5,ADA:.25,DOGE:.094,AVAX:11,LINK:14,LTC:69,BCH:308,XAU:4000};
const quotes=(t:number,multiplier=1,overrides:Partial<Record<Symbol,number>>={})=>SYMBOLS.map(symbol=>({symbol,price:overrides[symbol]??prices[symbol]*multiplier,fetchedAt:t}));
const candles=Object.fromEntries(SYMBOLS.map(sym=>[sym,fixture.map(b=>({...b,low:b.low*prices[sym]/reference,high:b.high*prices[sym]/reference,open:b.open*prices[sym]/reference,close:b.close*prices[sym]/reference}))]));
const started=()=>advance(initial(),quotes(time),time,'start',candles);
test('USD account has $100k capital, a fixed $100 daily trigger and eleven assets',()=>{assert.equal(CAPITAL,100000);assert.equal(LIMIT,100);assert.equal(SYMBOLS.length,11);assert.equal(FEE,0);assert.equal(MAX_POSITIONS,5)});
test('start without qualified candle data opens nothing',()=>{const s=advance(initial(),quotes(time),time,'start');assert.equal(s.positions.length,0);assert.equal(s.cash,CAPITAL);assert.equal(s.running,true)});
test('ten simultaneous qualifying markets open at most five positions',()=>{const s=started();assert.equal(s.positions.length,5);assert.equal(s.trades.length,5);assert.equal(s.fees,0);assert.equal(s.cash,75000);advance(s,quotes(time+15000),time+15000);assert.equal(s.positions.length,5);assert.equal(s.trades.length,5)});
test('$0 round-trip fees apply, including after price changes; P&L reconciles',()=>{const s=started();advance(s,quotes(time+15000,1.002),time+15000,'close');assert.equal(s.fees,0);assert.ok(s.trades.every(t=>t.fee===0));assert.equal(s.v2?.closed,5);assert.equal(s.positions.length,0);assert.ok(Math.abs(summary(s).realized-summary(s).totalPnl)<1e-8)});
test('$500 daily loss locks entries and includes unrealized losses',()=>{const s=started();advance(s,quotes(time+15000,.9),time+15000);assert.equal(s.halted,true);assert.equal(s.running,false);assert.equal(s.positions.length,0);assert.ok(summary(s).dailyPnl< -500);assert.throws(()=>advance(s,quotes(time+30000),time+30000,'start'));});
test('paused entries still monitor stops even when candle data is unavailable',()=>{const s=started();advance(s,quotes(time+15000),time+15000,'pause');advance(s,quotes(time+30000,.98),time+30000,'tick',{});assert.equal(s.running,false);assert.equal(s.positions.length,0);assert.equal(s.trades.filter(t=>t.side==='SELL').length,5)});
test('missing, duplicate, stale, invalid prices and invalid timestamps cannot trade',()=>{for(const q of [quotes(time).slice(1),Array(10).fill(quotes(time)[0]),quotes(time-60000),quotes(time,1,{ADA:NaN}),quotes(time).map(q=>({...q,fetchedAt:NaN}))]){const s=initial();assert.throws(()=>advance(s,q,time,'start',candles));assert.equal(s.trades.length,0);assert.equal(s.cash,CAPITAL)}});
test('new IST day closes overdue positions and preserves the offline loss',()=>{const s=started();advance(s,quotes(time+86400000,.98),time+86400000);assert.equal(s.positions.length,0);assert.equal(s.running,false);assert.equal(s.lossReview?.paused,true);assert.ok(summary(s).dailyPnl< -500)});
test('23:55 IST closes all; entries stop at 23:30',()=>{const s=started(),day=new Date(time).toISOString().slice(0,10),end=Date.parse(day+'T18:25:00Z');advance(s,quotes(end),end);assert.equal(s.positions.length,0);assert.equal(s.running,false);assert.throws(()=>advance(s,quotes(end),end,'start'))});
test('excess legacy positions close at fresh quotes without rewriting historical fees',()=>{const s=started();for(const sym of CRYPTO_SYMBOLS.filter(sym=>!s.positions.some(p=>p.symbol===sym))){const p={...s.positions[0],id:'legacy-'+sym,symbol:sym,entry:prices[sym],mark:prices[sym],quantity:5000/prices[sym],entryFee:5,strategy:undefined,stop:undefined,target:undefined};s.cash-=5005;s.fees+=5;s.positions.push(p)}const before=s.fees;advance(s,quotes(time+15000),time+15000);assert.equal(s.positions.length,5);assert.equal(s.fees-before,0);assert.equal(s.trades.filter(t=>t.reason==='Position limit reduced to five').length,5)});
test('legacy exits preserve their actual $5 entry fee; new exit costs $0',()=>{const s=started(),p=s.positions[0];p.strategy=undefined;p.entryFee=5;s.cash-=5;s.fees+=5;advance(s,quotes(time+15000),time+15000,'close');const trade=s.trades.find(t=>t.side==='SELL'&&t.symbol===p.symbol)!;assert.equal(trade.fee,0);assert.ok(Math.abs(trade.net!-((trade.price-p.entry)*p.quantity-5))<1e-8);assert.equal(s.v2?.closed,4)});
test('profit targets record wins only after both fees and slippage',()=>{const s=started();advance(s,quotes(time+15000,1.04),time+15000);assert.equal(s.positions.length,0);assert.equal(s.v2?.wins,5);assert.equal(s.v2?.closed,5);assert.ok(s.trades.filter(t=>t.side==='SELL').every(t=>t.net!>0))});
test('closed-candle analysis ignores the current unfinished candle',()=>{const normal=analyze(fixture,time),future={...fixture.at(-1)!,time,close:1e9,high:1e9};assert.equal(normal.eligible,true);assert.deepEqual(analyze([...fixture,future],time),normal);assert.equal(analyze(fixture,time+91000).eligible,false);assert.equal(analyze(fixture.filter((_,i)=>i!==80),time).eligible,false)});
test('validates candle ranges, deduplicates and excludes incomplete bars',()=>{const rows=fixture.map(b=>[b.time/1000,b.low,b.high,b.open,b.close,b.volume]);assert.equal(parseCandles([...rows,rows[0]],time).length,120);assert.equal(parseCandles(rows,time-1).length,119);assert.throws(()=>parseCandles([[time/1000,100,1,50,50,1]],time));assert.throws(()=>parseCandles({},time))});
test('cooldown prevents reopening after a stop and old signals cannot be recycled',()=>{const s=started();advance(s,quotes(time+15000,.99),time+15000);assert.equal(s.positions.length,0);advance(s,quotes(time+30000),time+30000,'tick',candles);assert.equal(s.positions.length,0);assert.equal(s.trades.filter(t=>t.side==='BUY').length,5)});
test('four-hour maximum duration closes V2 positions while entries are paused',()=>{const s=started();advance(s,quotes(time+4*3600000),time+4*3600000,'pause');assert.equal(s.positions.length,0);assert.ok(s.trades.filter(t=>t.side==='SELL').every(t=>t.reason==='Four-hour time exit'))});

test('1.5R arms once, persists through reload and exits on a later retrace',()=>{
 let s=started();s.running=false;const p=s.positions[0],r=p.entry-p.stop!,lock=p.entry+1.5*r;
 advance(s,quotes(time+15000,1,{[p.symbol]:lock}),time+15000);
 assert.ok(s.positions.includes(p));assert.equal(p.profitLocked,true);assert.equal(p.stop,lock);assert.equal(p.target,p.entry+2*r);
 s=JSON.parse(JSON.stringify(s));const restored=s.positions.find(x=>x.id===p.id)!;
 advance(s,quotes(time+30000,1,{[p.symbol]:lock+r*.2}),time+30000);assert.equal(restored.stop,lock);assert.equal(restored.target,p.entry+2*r);
 advance(s,quotes(time+45000,1,{[p.symbol]:lock}),time+45000);
 const exit=s.trades.find(t=>t.side==='SELL'&&t.symbol===p.symbol)!;assert.equal(exit.reason,'1.5R protected stop');assert.equal(exit.fee,0);assert.ok(exit.price<lock);
});
test('locked position exits at 2R and existing positions derive original risk',()=>{
 const s=started();s.running=false;const p=s.positions[0];delete p.initialRisk;const r=p.entry-p.stop!,lock=p.entry+1.5*r;
 advance(s,quotes(time+15000,1,{[p.symbol]:lock}),time+15000);assert.equal(p.initialRisk,r);
 advance(s,quotes(time+30000,1,{[p.symbol]:p.entry+2*r}),time+30000);
 assert.equal(s.trades.find(t=>t.side==='SELL'&&t.symbol===p.symbol)?.reason,'2R profit target');
});

test('daily trigger locks at exactly $100 but not just below it',()=>{
 const s=initial();s.startedAt=time;s.dayBase=CAPITAL;s.cash=CAPITAL-99.99;risk(s,time);assert.equal(s.halted,false);
 s.cash=CAPITAL-100;risk(s,time);assert.equal(s.halted,true);assert.equal(s.running,false);
});
