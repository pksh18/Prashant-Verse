import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountDay,dailyPerformance} from './daily-performance.ts';
import type {Trade} from './paper-engine';
const now=Date.parse('2026-10-07T04:00:00Z');
const fill=(id:string,side:Trade['side'],time:string,net:number|null,fee=0)=>({id,side,time:Date.parse(time),net,fee} as Trade);
test('IST boundary assigns overnight closes to their exit day and does not deduct fees twice',()=>{
 assert.equal(accountDay(Date.parse('2026-10-06T18:29:59Z')),'2026-10-06');
 assert.equal(accountDay(Date.parse('2026-10-06T18:30:00Z')),'2026-10-07');
 const rows=dailyPerformance([fill('entry','BUY','2026-10-06T18:00:00Z',null,1),fill('exit','SELL','2026-10-06T18:31:00Z',9,1)],now);
 assert.equal(rows[0].day,'2026-10-07');assert.equal(rows[0].closed,1);assert.equal(rows[0].net,9);assert.equal(rows[0].fees,1);assert.equal(rows[0].status,'Profit');assert.equal(rows[1].entries,1);assert.equal(rows[1].status,'No closes');
});
test('shorts, losses, flat trades, duplicate IDs and empty current day are handled',()=>{
 const loss=fill('loss','COVER','2026-10-06T10:00:00Z',-5);
 const rows=dailyPerformance([loss,loss,fill('flat','SELL','2026-10-06T11:00:00Z',0),fill('win','COVER','2026-10-06T12:00:00Z',2)],now);
 assert.equal(rows[0].closed,0);assert.equal(rows[0].winRate,null);assert.equal(rows[1].closed,3);assert.equal(rows[1].wins,1);assert.equal(rows[1].losses,1);assert.equal(rows[1].breakeven,1);assert.equal(rows[1].net,-3);assert.equal(rows[1].status,'Loss');assert.ok(Math.abs(rows[1].winRate!-100/3)<1e-10);
});
