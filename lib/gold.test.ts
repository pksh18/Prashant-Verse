import {test} from 'node:test';
import assert from 'node:assert/strict';
import {goldSession,observeGold,type GoldState} from './gold.ts';
import {parseGold,parseKraken} from './feed-parsers.ts';
import {advance,initial,type Quote} from './paper-engine.ts';
import {CRYPTO_SYMBOLS} from './market-config.ts';
const monday=Date.parse('2026-10-05T12:00:00Z');
test('Gold calendar handles weekend, daily close and New York DST',()=>{
 assert.equal(goldSession(Date.parse('2026-10-03T12:00:00Z')).open,false);
 assert.equal(goldSession(Date.parse('2026-10-04T22:04:00Z')).open,false);
 assert.equal(goldSession(Date.parse('2026-10-04T22:05:00Z')).entries,true);
 assert.equal(goldSession(Date.parse('2026-10-05T20:55:00Z')).closeSoon,true);
 assert.equal(goldSession(Date.parse('2026-10-05T20:59:00Z')).open,false);
 assert.equal(goldSession(Date.parse('2026-12-06T23:05:00Z')).open,true);
});
test('Gold only completes adequately sampled bars and ignores duplicate quotes',()=>{
 const s:GoldState={frames:{}};
 for(let i=0;i<=10;i++)observeGold(s,{symbol:'XAU',price:4000+i,fetchedAt:monday+i*30000},monday+i*30000);
 assert.equal(s.frames[300000].closed.length,1);
 assert.deepEqual(s.frames[300000].closed[0],{time:monday,open:4000,low:4000,high:4009,close:4009,volume:0});
 observeGold(s,{symbol:'XAU',price:9999,fetchedAt:monday+300000},monday+300000);
 assert.equal(s.frames[300000].current!.high,4010);
});
test('Gold never fills missing observations or collects closed-session candles',()=>{
 const s:GoldState={frames:{}};
 for(const i of [0,1,9,10])observeGold(s,{symbol:'XAU',price:4000,fetchedAt:monday+i*30000},monday+i*30000);
 assert.equal(s.frames[300000].closed.length,0);
 const weekend=Date.parse('2026-10-03T12:00:00Z'),closed:GoldState={frames:{}};
 observeGold(closed,{symbol:'XAU',price:4000,fetchedAt:weekend},weekend);
 assert.deepEqual(closed.frames,{});
});
test('Gold parser rejects invalid pair, nonpositive prices and future timestamps',()=>{
 const q={symbol:'XAU',currency:'USD',price:4000,updatedAt:new Date(monday).toISOString()};
 assert.equal(parseGold(q,monday).price,4000);
 for(const bad of [{...q,currency:'INR'},{...q,price:0},{...q,updatedAt:new Date(monday+2000).toISOString()}])assert.throws(()=>parseGold(bad,monday));
});
test('Kraken parser uses correct OHLC columns and excludes unfinished candles',()=>{
 const rows=[monday-60000,monday].map(t=>[t/1000,'100','105','99','102','101','42',3]);
 const bars=parseKraken({error:[],result:{XXBTZUSD:rows,last:123}},monday+30000,60000,80);
 assert.deepEqual(bars,[{time:monday-60000,open:100,high:105,low:99,close:102,volume:42}]);
 assert.throws(()=>parseKraken({error:['rate limit'],result:{}},monday,60000,80));
});
test('Gold close waits for tradable fresh mark and preserves pending exit',()=>{
 const s=initial(),weekend=Date.parse('2026-10-03T12:00:00Z');
 s.positions=[{id:'gold',symbol:'XAU',kind:'intraday',quantity:1,entry:4000,mark:4000,entryFee:2.5,openedAt:weekend}];
 const quotes=(t:number):Quote[]=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price:100,fetchedAt:t}));
 advance(s,[...quotes(weekend),{symbol:'XAU',price:4500,fetchedAt:weekend}],weekend,'close');
 assert.equal(s.positions.length,1);assert.equal(s.positions[0].mark,4000);assert.ok(s.positions[0].pendingExit);assert.equal(s.trades.length,0);
 advance(s,[...quotes(monday),{symbol:'XAU',price:4100,fetchedAt:monday}],monday);
 assert.equal(s.positions.length,0);assert.equal(s.trades.length,1);assert.equal(s.trades[0].price,4100*.9995);
});
test('Gold qualified EMA pattern opens under shared limits with V2 fallback attribution',()=>{
 const s=initial(),bars=Array.from({length:120},(_,i)=>({time:monday-(120-i)*300000,open:100,close:100,low:99.7,high:100.3,volume:0}));
 Object.assign(bars.at(-1)!,{open:100,close:100.6,low:99.9,high:100.7});
 s.gold={frames:{300000:{closed:bars}}};
 advance(s,[...CRYPTO_SYMBOLS.map(symbol=>({symbol,price:100,fetchedAt:monday})),{symbol:'XAU',price:100.6,fetchedAt:monday}],monday,'start');
 assert.equal(s.positions.length,1);assert.equal(s.positions[0].symbol,'XAU');assert.equal(s.positions[0].strategy,'ema-9-15');assert.equal(s.fees,0);
});
