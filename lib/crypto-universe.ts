export type LiquidPair={symbol:string;name:string;productId:string;price:number;usdVolume:number;change:number|null;volume:number};
export type CryptoUniverse={pairs:LiquidPair[];fetchedAt:number;source:string;error?:string};
const STABLE=new Set(['USDC','USDT','DAI','USDP','TUSD','GUSD','PYUSD','USDE','USD1','FDUSD','RLUSD','EURC','EURCV','PAXG','XAUT']);
export const EXCLUDED_TOKENS=new Set(['PENGU','TRUMP']);
export const MIN_USD_VOLUME=1000000;
export function rankLiquidPairs(input:unknown,now:number,strict=false):CryptoUniverse{
 const data=input as {products?:unknown[]};if(!Array.isArray(data?.products))throw new Error('Invalid products feed');
 const seen=new Set<string>(),pairs:LiquidPair[]=[];
 for(const row of data.products){const p=row as Record<string,unknown>;if(!p||typeof p!=='object')continue;
  const symbol=String(p.base_currency_id??''),id=String(p.product_id??''),price=Number(p.price),volume=Number(p.volume_24h),reported=Number(p.approximate_quote_24h_volume),usdVolume=Number.isFinite(reported)&&reported>0?reported:price*volume;
  if(p.quote_currency_id!=='USD'||p.product_type!=='SPOT'||p.is_disabled===true||p.trading_disabled===true||p.cancel_only===true||p.view_only===true||p.auction_mode===true||!['online','ONLINE'].includes(String(p.status))||!/^[-A-Za-z0-9]{1,20}$/.test(symbol)||id!==`${symbol}-USD`||STABLE.has(symbol.toUpperCase())||(strict&&(EXCLUDED_TOKENS.has(symbol.toUpperCase())||usdVolume<MIN_USD_VOLUME))||!Number.isFinite(price)||price<=0||!Number.isFinite(volume)||volume<=0||!Number.isFinite(usdVolume)||usdVolume<=0||seen.has(symbol))continue;
  const rawMove=String(p.price_percentage_change_24h??'').replace('%','').trim(),move=rawMove?Number(rawMove):NaN;pairs.push({symbol,name:String(p.base_name??symbol).slice(0,80),productId:id,price,volume,usdVolume,change:Number.isFinite(move)?move:null});seen.add(symbol);
 }
 pairs.sort((a,b)=>b.usdVolume-a.usdVolume||a.symbol.localeCompare(b.symbol));if(!pairs.length)throw new Error('No active USD spot markets');return {pairs:pairs.slice(0,50),fetchedAt:now,source:'Coinbase Advanced · 24h USD volume'};
}
