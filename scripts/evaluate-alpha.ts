// Replay fixed presets with the actual engine. No account writes or parameter fitting.
import fs from 'node:fs';
import {initial,advance,summary,istDay,type Quote} from '../lib/paper-engine.ts';
import {CRYPTO_SYMBOLS,type Symbol} from '../lib/market-config.ts';
import {STRATEGIES} from '../lib/strategies.ts';
import {type Candle} from '../lib/strategy.ts';
const BAR_MS=60000;
const input=process.argv[2];if(!input)throw new Error('Provide a saved Coinbase five-minute history JSON path');
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const data=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,raw.data[sym].map(([t,low,high,open,close,volume]:number[])=>({time:t*1000,low,high,open,close,volume}))])) as Record<Symbol,Candle[]>;
const maps=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,new Map(data[sym].map(b=>[b.time,b]))])) as Record<Symbol,Map<number,Candle>>;
function run(id:typeof STRATEGIES[number]['id'],start:number,end:number){
 const s=initial();s.selectedStrategy=id;let peak=100000,drawdown=0,maxPositions=0;const exits:{net:number}[]=[];
 function tick(q:Quote[],t:number,action='tick',bars?:Partial<Record<Symbol,Candle[]>>){const prior=s.trades.at(-1)?.id;advance(s,q,t,action,bars);const added=prior?s.trades.slice(s.trades.findIndex(x=>x.id===prior)+1):s.trades;for(const x of added)if(x.side==='SELL')exits.push({net:x.net??0});const e=summary(s).equity;peak=Math.max(peak,e);drawdown=Math.max(drawdown,peak-e);maxPositions=Math.max(maxPositions,s.positions.length)}
 for(let t=start;t<end;t+=BAR_MS){
  const current=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>[sym,maps[sym].get(t)])) as Record<Symbol,Candle>;
  if(CRYPTO_SYMBOLS.some(sym=>!current[sym]))throw new Error('Missing replay candle');
  const history=Object.fromEntries(CRYPTO_SYMBOLS.map(sym=>{const i=Math.round((t-raw.start*1000)/BAR_MS);return [sym,data[sym].slice(Math.max(0,i-300),i)]}));
  const quotes=(field:'open'|'close',at:number)=>CRYPTO_SYMBOLS.map(symbol=>({symbol,price:current[symbol][field],fetchedAt:at}));
  const minute=(t+19800000)%86400000/60000;
  tick(quotes('open',t),t,(!s.startedAt||s.day!==istDay(t))&&minute<1410?'start':'tick',history);
  // Stop-first ambiguity. Once a candle reaches 1.5R, revisit its low conservatively:
  // if it also contains the protected stop, exit there before crediting 2R.
  const level=(phase:'stop'|'lock'|'retrace'|'target',at:number)=>CRYPTO_SYMBOLS.map(symbol=>{const p=s.positions.find(x=>x.symbol===symbol),b=current[symbol];let price=b.open;
   if(p){const r=p.initialRisk??p.entry-p.stop!,lock=p.entry+1.5*r,target=p.entry+2*r;
    if((phase==='stop'||phase==='retrace')&&b.low<=p.stop!)price=Math.min(b.open,p.stop!);
    else if(phase==='lock'&&!p.profitLocked&&b.high>=lock)price=lock;
    else if(phase==='target'&&p.profitLocked&&b.high>=target)price=target;
    else price=p.mark;
   }return {symbol,price,fetchedAt:at}});
  tick(level('stop',t+12000),t+12000);tick(level('lock',t+24000),t+24000);tick(level('retrace',t+36000),t+36000);tick(level('target',t+48000),t+48000);tick(quotes('close',t+59000),t+59000);
 }
 const final=CRYPTO_SYMBOLS.map(symbol=>({symbol,price:maps[symbol].get(end-BAR_MS)!.close,fetchedAt:end-1}));tick(final,end-1,'close');
 const wins=exits.filter(x=>x.net>0).length,gains=exits.reduce((a,x)=>a+Math.max(0,x.net),0),losses=-exits.reduce((a,x)=>a+Math.min(0,x.net),0);
 return {closed:exits.length,wins,winRate:exits.length?wins/exits.length*100:null,net:summary(s).totalPnl,fees:s.fees,profitFactor:losses?gains/losses:null,maxObservedDrawdown:drawdown,maxPositions};
}
const split=Math.floor((raw.start+raw.end)/120)*60000,start=raw.start*1000+120*BAR_MS,end=raw.end*1000;
const results=STRATEGIES.filter(x=>x.id==='momentum-alpha').map(x=>({id:x.id,name:x.name,firstPeriod:run(x.id,start,split),secondPeriod:run(x.id,split,end)}));
const report={generatedAt:new Date().toISOString(),source:'Kraken public one-minute OHLCV: ten crypto USD pairs',start:new Date(start).toISOString(),split:new Date(split).toISOString(),end:new Date(end).toISOString(),assumptions:'Fixed existing presets, no tuning. $100,000 capital, $5,000 allocations, 5 positions, $1,000 daily equity loss trigger, $5 roundtrip fee, 0.05% adverse slippage each side. Actual engine with 1.5R protected stop and 2R target. Next-bar open entries, completed candles only, stop-first and conservative retrace ordering on ambiguous candles. Daily and time exits apply. Drawdown sampled at replay updates. No spread, liquidity, tax, latency or outages model. Approximately twelve hours of minute data; exploratory diagnostic only, not independent validation or evidence of a lasting edge.',excluded:['Gold and forex: no matching history'],results,meetsRequestedWinRate:results.some(x=>x.secondPeriod.closed>=30&&(x.secondPeriod.winRate??0)>=80&&x.secondPeriod.net>0)};
fs.writeFileSync('lib/momentum-alpha-evaluation.json',JSON.stringify(report,null,2));fs.writeFileSync('public/momentum-alpha-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
