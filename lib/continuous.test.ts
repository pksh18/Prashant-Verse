import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,advance,istDay,selectStrategy} from './paper-engine.ts';
import {CRYPTO_SYMBOLS} from './market-config.ts';
import {forexSession,parseForexCandles} from './forex.ts';
const before=Date.parse('2026-10-05T18:24:00Z'),cutoff=before+60000,next=Date.parse('2026-10-05T18:30:00Z');
const quotes=(t:number)=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price:100,fetchedAt:t}));
const active=()=>{const s=initial();s.running=true;s.startedAt=before-3600000;s.day=istDay(before);return advance(s,quotes(before),before)};
test('armed continuous session closes daily and resumes next day',()=>{
 const s=active();assert.equal(s.sessionArmed,true);advance(s,quotes(cutoff),cutoff);assert.equal(s.running,false);assert.equal(s.sessionArmed,true);advance(s,quotes(next),next);assert.equal(s.running,true);
});
test('manual pause, close and strategy changes disarm next-day resumption',()=>{
 for(const action of ['pause','close','strategy']){const s=active();if(action==='strategy')selectStrategy(s,'ema-9-15');else advance(s,quotes(before+15000),before+15000,action);advance(s,quotes(next),next);assert.equal(s.running,false);assert.equal(s.sessionArmed,false)}
});
test('existing paused accounts do not become armed on migration',()=>{const s=initial();s.day=istDay(before);advance(s,quotes(next),next);assert.equal(s.sessionArmed,false);assert.equal(s.running,false)});
test('daily risk lock cannot restart the same day but armed session resumes next day',()=>{
 const s=active();s.cash=97900;advance(s,quotes(before+15000),before+15000);assert.equal(s.halted,true);assert.throws(()=>advance(s,quotes(before+30000),before+30000,'start'));advance(s,quotes(next),next);assert.equal(s.halted,false);assert.equal(s.running,true);assert.equal(s.dayBase,97900);
});
test('forex calendar closes weekends and daily break, including DST',()=>{
 assert.equal(forexSession(Date.parse('2026-10-03T12:00:00Z')).open,false);
 assert.equal(forexSession(Date.parse('2026-10-04T21:05:00Z')).open,true);
 assert.equal(forexSession(Date.parse('2026-12-06T22:05:00Z')).open,true);
 assert.equal(forexSession(Date.parse('2026-10-05T20:59:00Z')).open,false);
});
test('forex parser requires expected pair and interval, excludes current bar',()=>{
 const now=Date.parse('2026-10-05T12:00:00Z'),v={meta:{symbol:'EUR/USD',interval:'5min'},values:[{datetime:'2026-10-05 11:55:00',open:'1.1',high:'1.2',low:'1.0',close:'1.15'},{datetime:'2026-10-05 12:00:00',open:'1.1',high:'1.2',low:'1.0',close:'1.15'}]};
 assert.equal(parseForexCandles(v,'EUR/USD',now).length,1);assert.throws(()=>parseForexCandles(v,'GBP/USD',now));assert.throws(()=>parseForexCandles(v,'EUR/USD',now,60000));
});
