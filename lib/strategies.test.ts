import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStrategy,STRATEGIES} from './strategies.ts';
import {initial,advance,selectStrategy,summary} from './paper-engine.ts';
import {parseCandles,STRATEGY,type Candle} from './strategy.ts';
import {SYMBOLS} from './market-config.ts';
const now=Date.parse('2026-10-02T10:00:00Z');
const bars=(count=120,interval=300000):Candle[]=>Array.from({length:count},(_,i)=>({time:now-(count-i)*interval,open:100,close:100,low:99.7,high:100.3,volume:100}));
const modify=(b:Candle[],index:number,v:Partial<Candle>)=>Object.assign(b.at(index)!,v);
function fixture(id:string){
 const b=bars(id==='golden-trio'?300:120,['supply-demand','momentum-alpha','rolling-vwap'].includes(id)?60000:300000);
 if(id==='momentum-alpha'){
  b.forEach((v,i)=>{const c=100+i*.015+(i%2?-.1:.1);Object.assign(v,{open:c-.02,close:c,low:c-.3,high:c+.2})});
  modify(b,-1,{open:101.65,close:102.15,low:101.6,high:102.2});
 }
 if(id==='ema-9-15'){modify(b,-1,{open:100,close:100.6,low:99.9,high:100.7})}
 if(id==='liquidity-sweep'){modify(b,-2,{open:99.9,low:99.5,high:100.2,close:100});modify(b,-1,{open:100,low:99.9,high:100.5,close:100.4})}
 if(id==='golden-trio'){
  b.forEach((v,i)=>Object.assign(v,{open:100+i*.015,close:100+i*.015,low:99.8+i*.015,high:100.2+i*.015}));
  modify(b,-2,{low:103.95,high:104.55});modify(b,-1,{open:104.45,close:104.9,high:105,low:104.3});
 }
 if(id==='fibonacci'){
  modify(b,-15,{low:99.5});modify(b,-8,{open:101,close:101.2,high:101.5,low:100.7});
  modify(b,-2,{open:100.6,close:100.5,low:100.35,high:100.65});modify(b,-1,{open:100.5,close:100.8,low:100.4,high:100.9});
 }
 if(id==='supply-demand'){
  b.forEach(v=>Object.assign(v,{low:99.95,high:100.05}));
  modify(b,-8,{open:100,close:100.01,low:99.95,high:100.05});
  modify(b,-7,{open:100.05,close:100.55,low:100.03,high:100.6});
  for(let i=-6;i<=-3;i++)modify(b,i,{open:100.4,close:100.4,low:100.3,high:100.5});
  modify(b,-2,{open:100.3,close:100.15,low:100,high:100.35});
  modify(b,-1,{open:100.2,close:100.45,low:100.1,high:100.55});
 }
 if(id==='donchian-breakout'){modify(b,-1,{open:100,close:100.8,low:99.95,high:100.9,volume:200})}
 if(id==='rolling-vwap'){modify(b,-2,{open:100,close:99.95,low:99.7,high:100.1});modify(b,-1,{open:100,close:100.4,low:99.9,high:100.5,volume:150})}
 if(id==='bollinger-reversion'){modify(b,-2,{open:100,close:99,low:98.9,high:99.1});modify(b,-1,{open:99.1,close:99.8,low:99.05,high:99.9})}
 return b;
}
for(const config of STRATEGIES.slice(1)){
 test(`${config.name}: qualifies a matching completed pattern and never uses unfinished bars`,()=>{
  const b=fixture(config.id),a=analyzeStrategy(config.id,b,now);assert.equal(a.eligible,true,JSON.stringify(a));assert.equal(a.strategy,config.id);
  assert.deepEqual(analyzeStrategy(config.id,[...b,{...b.at(-1)!,time:now,high:1e6,close:1e6}],now),a);
  assert.equal(analyzeStrategy(config.id,b,now+Math.min(90000,config.interval-1)+1).eligible,false);
  assert.equal(analyzeStrategy(config.id,b.filter((_,i)=>i!==60),now).eligible,false);
 });
 test(`${config.name}: no entries from flat prices`,()=>assert.equal(analyzeStrategy(config.id,bars(config.history,config.interval),now).eligible,false));
}
test('EMA 9/15 does not buy repeatedly after the crossover',()=>{const b=fixture('ema-9-15');b.push({...b.at(-1)!,time:now,close:100.8,high:101});assert.equal(analyzeStrategy('ema-9-15',b,now+300000).eligible,false)});
test('Golden Trio refuses an insufficient EMA 200 warmup',()=>assert.equal(analyzeStrategy('golden-trio',fixture('golden-trio').slice(-120),now).eligible,false));
test('a failed liquidity reclaim is not a sweep signal',()=>{const b=fixture('liquidity-sweep');modify(b,-2,{close:99.6});assert.equal(analyzeStrategy('liquidity-sweep',b,now).eligible,false)});
test('Fibonacci rejects a broken swing low',()=>{const b=fixture('fibonacci');modify(b,-4,{low:99.4});assert.equal(analyzeStrategy('fibonacci',b,now).eligible,false)});
test('demand zone cannot be reused after an earlier retest',()=>{const b=fixture('supply-demand');modify(b,-4,{low:100});assert.equal(analyzeStrategy('supply-demand',b,now).eligible,false)});
test('opposing supply before the target rejects a demand entry',()=>{const b=fixture('supply-demand');modify(b,-20,{open:100.7,close:100.71,low:100.65,high:100.8});modify(b,-19,{open:100.7,close:100,low:99.95,high:100.72});assert.equal(analyzeStrategy('supply-demand',b,now).eligible,false)});
test('one-minute parsing and 300-bar history preserve their intended intervals',()=>{const b=fixture('golden-trio'),row=(x:Candle)=>[x.time/1000,x.low,x.high,x.open,x.close,x.volume];assert.equal(parseCandles(b.map(row),now,300000,300).length,300);assert.equal(parseCandles(fixture('supply-demand').map(row),now,60000).length,120)});
test('switching strategies pauses entries, clears cached signals and preserves exits, cash and history',()=>{
 const s=initial();selectStrategy(s,'ema-9-15');const b=fixture('ema-9-15'),quotes=SYMBOLS.map(symbol=>({symbol,price:b.at(-1)!.close,fetchedAt:now})),candles=Object.fromEntries(SYMBOLS.map(sym=>[sym,b]));advance(s,quotes,now,'start',candles);
 assert.equal(s.positions.length,5);assert.ok(s.positions.every(p=>p.strategy==='ema-9-15'));const before=structuredClone(s);
 selectStrategy(s,'liquidity-sweep');assert.equal(s.running,false);assert.deepEqual(s.positions,before.positions);assert.equal(s.cash,before.cash);assert.deepEqual(s.trades,before.trades);assert.deepEqual(s.analysis,{});
 advance(s,quotes.map(q=>({...q,price:q.price*1.03,fetchedAt:now+15000})),now+15000);assert.equal(s.positions.length,0);assert.equal(s.strategyStats?.['ema-9-15']?.closed,5);assert.equal(s.strategyStats?.['liquidity-sweep'],undefined);assert.equal(s.fees,0);assert.ok(summary(s).realized>0);
});
test('unknown selections cannot mutate the portfolio',()=>{const s=initial(),before=structuredClone(s);assert.throws(()=>selectStrategy(s,'made-up'));assert.deepEqual(s,before)});
test('selected strategy cannot execute cached signals belonging to another strategy',()=>{const s=initial();s.selectedStrategy='ema-9-15';s.analysis={BTC:{strategy:STRATEGY,barTime:now-300000,eligible:true,reason:'old',score:1,stopFraction:.01}};advance(s,SYMBOLS.map(symbol=>({symbol,price:100,fetchedAt:now})),now,'start');assert.equal(s.positions.length,0)});

test('Momentum Alpha rejects weak breakout bodies, high RSI and history gaps',()=>{
 const b=fixture('momentum-alpha');assert.equal(analyzeStrategy('momentum-alpha',b,now).eligible,true);
 const weak=structuredClone(b);modify(weak,-1,{open:102.1});assert.equal(analyzeStrategy('momentum-alpha',weak,now).eligible,false);
 const gaps=b.filter((_,i)=>i!==50);assert.equal(analyzeStrategy('momentum-alpha',gaps,now).eligible,false);
 const up=bars(120,60000);up.forEach((v,i)=>{const c=100+i*.05;Object.assign(v,{open:c-.02,close:c,low:c-.3,high:c+.2})});modify(up,-1,{open:105.7,close:106.2,high:106.25,low:105.6});assert.equal(analyzeStrategy('momentum-alpha',up,now).eligible,false);
});

for(const config of STRATEGIES.slice(1))test(`${config.name}: mirrored bearish pattern opens a SHORT signal`,()=>{
 const b=fixture(config.id),axis=2*b.at(-1)!.close;
 const down=b.map(x=>({...x,open:axis-x.open,close:axis-x.close,high:axis-x.low,low:axis-x.high}));
 const a=analyzeStrategy(config.id,down,now);
 assert.equal(a.eligible,true,JSON.stringify(a));assert.equal(a.direction,'short');assert.ok(a.stopPrice!>down.at(-1)!.close);
 assert.deepEqual(analyzeStrategy(config.id,[...down,{...down.at(-1)!,time:now,close:1,low:1}],now),a);
});

test('new volume strategies block missing volume and weak volume confirmation',()=>{for(const id of ['donchian-breakout','rolling-vwap'] as const){const b=fixture(id);b.forEach(v=>v.volume=0);assert.equal(analyzeStrategy(id,b,now).eligible,false);const weak=fixture(id);weak.at(-1)!.volume=10;assert.equal(analyzeStrategy(id,weak,now).eligible,false)}});
