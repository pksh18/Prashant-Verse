import type {NewsSnapshot,Headline} from './team-news.ts';
export const SECTORS=[
 {id:'technology',name:'Technology & AI',match:/\b(tech(?:nology)?|AI|artificial intelligence|software|semiconductors?|chips?|Nvidia|Microsoft|Apple|Samsung|data cent(?:er|re)s?)\b/i},
 {id:'financials',name:'Banks & financials',match:/\b(banks?|banking|financials?|lenders?|insurance|JPMorgan|Goldman Sachs)\b/i},
 {id:'energy',name:'Energy',match:/\b(energy|oil|crude|gas|petroleum|OPEC|Brent)\b/i},
 {id:'healthcare',name:'Healthcare & pharma',match:/\b(healthcare|pharma(?:ceutical)?|biotech|drugmakers?|Pfizer|hospitals?)\b/i},
 {id:'consumer',name:'Consumer & retail',match:/\b(consumer|retail|retailers?|FMCG|Walmart|Amazon|luxury)\b/i},
 {id:'industrials',name:'Industrials & defence',match:/\b(industrials?|manufacturing|aerospace|defen[cs]e|Boeing|machinery)\b/i},
 {id:'materials',name:'Metals & materials',match:/\b(metals?|steel|copper|aluminium|aluminum|mining|miners?|materials)\b/i},
 {id:'utilities',name:'Utilities & clean energy',match:/\b(utilities|renewables?|solar|wind power|electricity|power grid)\b/i},
 {id:'real-estate',name:'Real estate',match:/\b(real estate|property|REITs?|homebuilders?)\b/i},
 {id:'gold',name:'Gold',match:/\b(gold|bullion|XAU)\b/i},
 {id:'crypto',name:'Crypto',match:/\b(crypto(?:currency)?|bitcoin|ethereum|altcoins?|blockchain|BTC|ETH|Solana)\b/i},
] as const;
export type SectorTone='buy'|'short'|'neutral';
export type SectorEvidence=Headline&{source:string;tone:SectorTone};
export type SectorCard={id:string;name:string;tone:SectorTone;reason:string;headlines:SectorEvidence[]};
export type SectorBoard={generatedAt:number;sectors:SectorCard[];sources:{name:string;fetchedAt:number;error?:string}[]};
const UP=/\b(ris(?:e|es|ing)|rose|rall(?:y|ies|ied)|gain(?:s|ed)?|surge[sd]?|jump[sed]*|climb[sed]*|rebound[sed]*|advance[sd]?|beat[sn]?|upgrade[sd]?|record high|firms?|higher)\b/i;
const DOWN=/\b(fall(?:s|ing)?|fell|slump[sed]*|declin(?:e|es|ed)|drop[sped]*|slide[sd]?|slid|lower|plung(?:e|es|ed)|downgrade[sd]?|miss(?:es|ed)?|loss(?:es)?|selloff|sell-off|bankrupt(?:cy)?|hack(?:ed)?|exploit(?:ed)?)\b/i;
// A headline is directional only when it mentions one covered sector and has
// unambiguous direction language. Cross-sector effects need further research.
export function headlineTone(title:string):SectorTone{
 if(SECTORS.filter(s=>s.match.test(title)).length!==1||/\b(not|no|could|may|might|if|despite|but|while|forecast|predict|target|expected|expects|outlook)\b/i.test(title))return 'neutral';
 const up=UP.test(title),down=DOWN.test(title);return up&&!down?'buy':down&&!up?'short':'neutral';
}
export function sectorBoard(feeds:NewsSnapshot[],now:number):SectorBoard{
 const sources=feeds.map(f=>({name:f.source,fetchedAt:f.fetchedAt,error:f.error||(now-f.fetchedAt>5*60000?'Feed is stale':undefined)}));
 const seen=new Set<string>(),headlines:SectorEvidence[]=[];
 for(const feed of feeds){if(feed.error||now-feed.fetchedAt>5*60000||feed.fetchedAt>now+1000)continue;
  for(const h of feed.headlines){if(now-h.publishedAt>24*3600000||h.publishedAt>now+60000||seen.has(h.url))continue;seen.add(h.url);headlines.push({...h,source:feed.source,tone:headlineTone(h.title)})}}
 headlines.sort((a,b)=>b.publishedAt-a.publishedAt);
 return {generatedAt:now,sources,sectors:SECTORS.map(s=>{const related=headlines.filter(h=>s.match.test(h.title)).slice(0,4),positive=related.some(h=>h.tone==='buy'),negative=related.some(h=>h.tone==='short'),tone:SectorTone=positive&&!negative?'buy':negative&&!positive?'short':'neutral';return {id:s.id,name:s.name,tone,reason:!related.length?'No fresh sector-specific coverage':positive&&negative?'Conflicting directional headlines':tone==='neutral'?'Context only; no clear directional evidence':tone==='buy'?'Positive headline direction; confirm price and valuation':'Negative headline direction; confirm price and short availability',headlines:related}})};
}
