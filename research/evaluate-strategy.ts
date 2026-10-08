import fs from 'node:fs';
import {initial,advance,summary,istDay} from '../lib/paper-engine.ts';
import {CRYPTO_SYMBOLS} from '../lib/market-config.ts';
import {BAR_MS,type Candle} from '../lib/strategy.ts';
const raw=JSON.parse(fs.readFileSync(new URL('./history.json',import.meta.url),'utf8'));
const data=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,raw.data[sym].map(([t,low,high,open,close,volume]:number[])=>({time:t*1000,low,high,open,close,volume}))])) as Record<string,Candle[]>;
function run(start:number,end:number){
 const s=initial();let peak=100000,drawdown=0,maxPositions=0;
 for(let t=start;t<end;t+=BAR_MS){
  const current=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,data[sym].find(b=>b.time===t)!]));
  if(CRYPTO_SYMBOLS.some(sym=>!current[sym]))throw new Error('Missing candle in evaluation');
  const history=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,data[sym].filter(b=>b.time<t).slice(-120)]));
  const quotes=(field:'open'|'low'|'high'|'close',now:number)=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price:current[symbol][field],fetchedAt:now}));
  const day=istDay(t),minute=(t+19800000)%86400000/60000;
  advance(s,quotes('open',t),t,(!s.startedAt||s.day!==day)&&minute<1410?'start':'tick',history);
  maxPositions=Math.max(maxPositions,s.positions.length);
  // Conservative candle replay: gaps fill at the open; if both levels touch, stop wins.
  // Use each reached exit threshold rather than fill every stop at the candle low.
  const stops=CRYPTO_SYMBOLS.map(symbol=>{const p=s.positions.find(p=>p.symbol===symbol),bar=current[symbol];return {symbol,price:p&&bar.low<=(p.stop??0)?Math.min(bar.open,p.stop!):bar.open,fetchedAt:t+60000}});
  advance(s,stops,t+60000);
  const targets=CRYPTO_SYMBOLS.map(symbol=>{const p=s.positions.find(p=>p.symbol===symbol),bar=current[symbol];return {symbol,price:p&&bar.high>=(p.target??Infinity)?Math.max(bar.open,p.target!):bar.open,fetchedAt:t+120000}});
  advance(s,targets,t+120000);advance(s,quotes('close',t+299000),t+299000);
  const e=summary(s).equity;peak=Math.max(peak,e);drawdown=Math.max(drawdown,peak-e);
 }
 const last=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,data[sym].filter(b=>b.time<end).at(-1)!.close]));
 advance(s,CRYPTO_SYMBOLS.map(symbol=>({symbol,price:last[symbol],fetchedAt:end-1})),end-1,'close');
 const finalEquity=summary(s).equity;peak=Math.max(peak,finalEquity);drawdown=Math.max(drawdown,peak-finalEquity);
 const sells=s.trades.filter(t=>t.side==='SELL'),gains=sells.reduce((a,t)=>a+Math.max(t.net??0,0),0),losses=-sells.reduce((a,t)=>a+Math.min(t.net??0,0),0);
 return {start:new Date(start).toISOString(),end:new Date(end).toISOString(),closed:s.v2?.closed,wins:s.v2?.wins,winRate:s.v2?.closed?s.v2.wins/s.v2.closed*100:null,net:summary(s).totalPnl,fees:s.fees,profitFactor:losses?gains/losses:null,maxObservedDrawdown:drawdown,maxPositions};
}
const result={generatedAt:new Date().toISOString(),source:'Coinbase Exchange 5-minute OHLCV, 10 USD pairs',assumptions:'Fixed untuned V2 parameters; $100,000 initial capital, $5,000 allocations, maximum 5 positions, $2,000 daily loss trigger, $2.50 per fill, 0.05% adverse slippage each side. Next-bar open entries; stop-first when both levels touched. Intraday IST cutoff and four-hour exit. Candle approximation, not tick execution. No liquidity, taxes or live latency model. Drawdown observed at candle closes; may understate intrabar drawdown.',firstFourDays:run(raw.start*1000+120*BAR_MS,(raw.start+4*86400)*1000),lastThreeDays:run((raw.start+4*86400)*1000,raw.end*1000)};
fs.writeFileSync(new URL('../lib/strategy-evaluation.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
