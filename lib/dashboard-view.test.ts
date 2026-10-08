import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,advance} from './paper-engine.ts';
import {dashboardView} from './dashboard-view.ts';
import {CRYPTO_SYMBOLS} from './market-config.ts';
import {STRATEGY} from './strategy.ts';
const now=Date.parse('2026-10-05T12:00:00Z');
function setup(){const s=initial();s.quotes=CRYPTO_SYMBOLS.map(symbol=>({symbol,price:100,fetchedAt:now}));s.analysis={BTC:{strategy:STRATEGY,barTime:now-300000,eligible:true,reason:'Qualified',score:1,stopFraction:.005}};return s}
test('signal preview matches the executed entry, stop and target',()=>{
 const s=setup(),plan=dashboardView(s,now).markets.find(m=>m.symbol==='BTC')!.plan!;
 assert.ok(plan);assert.equal(dashboardView(s,now).markets[0].reason,'Entries paused');
 advance(s,s.quotes,now,'start');const p=s.positions[0];assert.equal(p.entry,plan.entry);assert.equal(p.stop,plan.stop);assert.equal(p.target,plan.target);
 assert.equal(dashboardView(s,now).markets[0].decision,'OPEN');assert.equal(dashboardView(s,now).markets[0].plan,null);
});
test('expired windows and stale marks never expose actionable entry previews',()=>{
 assert.equal(dashboardView(setup(),now+91000).markets[0].plan,null);
 const s=setup();s.quotes=s.quotes.map(q=>({...q,fetchedAt:now-60000}));const v=dashboardView(s,now).markets[0];assert.equal(v.decision,'STALE');assert.equal(v.plan,null);
});
test('unloaded quotes remain empty and gold closure is explicit',()=>{
 const v=dashboardView(initial(),Date.parse('2026-10-03T12:00:00Z'));
 assert.equal(v.markets[0].price,null);assert.equal(v.markets.at(-1)!.decision,'CLOSED');assert.equal(v.markets.at(-1)!.reason,'Gold weekend closure');
});
