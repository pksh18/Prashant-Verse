import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,advance,istDay,type State} from './paper-engine.ts';
import {checkLossReview,acknowledgeLossReview,lossWindow} from './loss-review.ts';
import {CRYPTO_SYMBOLS} from './market-config.ts';
const now=Date.parse('2026-10-05T10:00:00Z');
function seed(net:number[]){const s=initial();s.day=istDay(now);s.running=true;s.sessionArmed=true;s.trades=net.map((n,i)=>({id:'exit-'+i,time:now+i,side:'SELL',symbol:'BTC',kind:'intraday',quantity:1,price:100,fee:2.5,reason:'Strategy stop',net:n}));return s}
const q=(t:number,price=100)=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price,fetchedAt:t}));
test('three losing closes out of five and negative net pauses entries and disarms tomorrow',()=>{const s=seed([-30,20,-30,20,-30]);assert.equal(checkLossReview(s,now),true);assert.equal(s.running,false);assert.equal(s.sessionArmed,false);assert.equal(s.lossReview?.net,-50);const restored=JSON.parse(JSON.stringify(s)) as State;advance(restored,q(now+86400000),now+86400000);assert.equal(restored.running,false);assert.equal(restored.lossReview?.paused,true)});
test('does not react to fewer than five closes or a profitable five-trade batch',()=>{for(const net of [[-10,-10,-10],[-10,-10,-10,50,50],[-20,-20,10,10,30]])assert.equal(checkLossReview(seed(net),now),false)});
test('review acknowledges old closes; a new bad batch can pause again',()=>{const s=seed([-30,20,-30,20,-30]);checkLossReview(s,now);acknowledgeLossReview(s);assert.equal(lossWindow(s).trades.length,0);s.running=true;assert.equal(checkLossReview(s,now),false);s.trades.push(...seed([-30,20,-30,20,-30]).trades.map(t=>({...t,id:t.id+'new'})));assert.equal(checkLossReview(s,now),true)});
test('review pause still executes stops without candle data',()=>{const s=seed([-30,20,-30,20,-30]);checkLossReview(s,now);s.positions.push({id:'open',symbol:'ETH',kind:'intraday',entry:100,mark:100,quantity:1,entryFee:2.5,openedAt:now,stop:99,target:101.5});advance(s,q(now+30000,98),now+30000);assert.equal(s.positions.length,0);assert.equal(s.trades.at(-1)?.side,'SELL');assert.equal(s.lossReview?.paused,true)});
test('manual start can acknowledge review; daily risk lock remains authoritative',()=>{const s=seed([-30,20,-30,20,-30]);checkLossReview(s,now);advance(s,q(now),now,'start');assert.equal(s.running,true);assert.equal(s.lossReview?.paused,false);s.halted=true;assert.throws(()=>advance(s,q(now+30000),now+30000,'start'));assert.equal(s.halted,true)});
