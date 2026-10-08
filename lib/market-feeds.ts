import {FeedRateLimit,retryAfterMs} from './feed-retry';
import {sharedFeed} from './market-cache';
import {parseKraken,parseGold} from './feed-parsers';
import {parseCandles} from './strategy';
import type {Symbol} from './market-config';
const headers={Accept:'application/json','User-Agent':'PrashantVerse/3.0'};
async function request(url:string){const r=await fetch(url,{headers,signal:AbortSignal.timeout(4000),cache:'no-store'});if(r.status===429)throw new FeedRateLimit(retryAfterMs(r.headers.get('retry-after'),Date.now()));if(!r.ok)throw new Error(`Feed HTTP ${r.status}`);return r.json()}
export async function cryptoCandles(symbol:Symbol,interval:number,history:number){
 return sharedFeed(`candles:${symbol}:${interval}:${history}`,async()=>{
  const now=Date.now(),end=Math.floor(now/interval)*interval,expected=end-interval;
  let bars,source='Coinbase';
  try{
   const url=new URL(`https://api.exchange.coinbase.com/products/${symbol}-USD/candles`);url.searchParams.set('granularity',String(interval/1000));url.searchParams.set('start',new Date(end-history*interval).toISOString());url.searchParams.set('end',new Date(end).toISOString());
   bars=parseCandles(await request(url.toString()),Date.now(),interval,history);
   if((bars.at(-1)?.time??0)<expected||bars.length<Math.min(80,history))throw new Error('Incomplete Coinbase candles');
  }catch{
   source='Kraken';const pair=symbol==='BTC'?'XBTUSD':symbol==='DOGE'?'XDGUSD':`${symbol}USD`;
   try{bars=parseKraken(await request(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval/60000}`),Date.now(),interval,history)}catch{throw new Error('Coinbase and Kraken candle feeds unavailable; retrying after cooldown')}
  }
  const current=(bars.at(-1)?.time??0)>=expected;
  return {value:{bars,source},expiresAt:current?end+interval+2000:now+60000};
 });
}
export async function goldQuote(){return sharedFeed('quote:XAU',async()=>({value:parseGold(await request('https://api.gold-api.com/price/XAU/USD'),Date.now()),expiresAt:Date.now()+5000}),60000)}

export async function marketNews(){return sharedFeed('news:coindesk:v1',async()=>{const r=await fetch('https://www.coindesk.com/arc/outboundfeeds/rss/',{headers:{Accept:'application/rss+xml,application/xml,text/xml','User-Agent':'PrashantVerse/4.0'},signal:AbortSignal.timeout(4000),cache:'no-store'});if(!r.ok)throw new Error(`News feed HTTP ${r.status}`);const xml=await r.text();const {parseNews}=await import('./team-news');return {value:parseNews(xml,Date.now()),expiresAt:Date.now()+60000}},60000)}

export async function macroNews(){return sharedFeed('news:commodities:v1',async()=>{const r=await fetch('https://www.investing.com/rss/news_11.rss',{headers:{Accept:'application/rss+xml,application/xml,text/xml','User-Agent':'PrashantVerse/4.0'},signal:AbortSignal.timeout(4000),cache:'no-store'});if(!r.ok)throw new Error(`Commodities news HTTP ${r.status}`);const {parseNews}=await import('./team-news');return {value:parseNews(await r.text(),Date.now(),'commodities'),expiresAt:Date.now()+60000}},60000)}
export async function liquidUniverse(){return sharedFeed('universe:usd50:filtered-v2',async()=>{
 const products:unknown[]=[];let offset=0;
 for(let page=0;page<12;page++){
  const data=await request(`https://api.coinbase.com/api/v3/brokerage/market/products?limit=250&offset=${offset}&product_type=SPOT&get_all_products=true`) as {products?:unknown[];num_products?:number};
  if(!Array.isArray(data.products))throw new Error('Product list unavailable');products.push(...data.products);
  if(data.products.length<250||data.num_products!==undefined&&products.length>=data.num_products)break;offset+=250;if(page===11)throw new Error('Product universe exceeded pagination limit');
 }
 const {rankLiquidPairs}=await import('./crypto-universe');return {value:rankLiquidPairs({products},Date.now(),true),expiresAt:Date.now()+60000};
},120000,60000)}

export async function globalSectorNews(){return sharedFeed('news:global-sectors:v1',async()=>{const r=await fetch('https://www.investing.com/rss/news_25.rss',{headers:{Accept:'application/rss+xml,application/xml,text/xml','User-Agent':'PrashantVerse/4.0'},signal:AbortSignal.timeout(4000),cache:'no-store'});if(!r.ok)throw new Error(`Global news HTTP ${r.status}`);const {parseNews}=await import('./team-news');return {value:parseNews(await r.text(),Date.now(),'global'),expiresAt:Date.now()+60000}},60000)}
