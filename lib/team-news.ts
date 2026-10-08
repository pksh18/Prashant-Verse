export type Headline={title:string;url:string;publishedAt:number};
export type NewsSnapshot={source:string;fetchedAt:number;headlines:Headline[];error?:string};
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();
export function parseNews(xml:string,now:number,provider:'crypto'|'commodities'|'global'='crypto'):NewsSnapshot{
 if(xml.length>1500000||!/<rss\b/i.test(xml))throw new Error('Invalid headline feed');
 const headlines=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(([,item])=>{const field=(tag:string)=>decode(item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]??'');const title=field('title').slice(0,250),url=field('link'),date=field('pubDate'),publishedAt=Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)?date.replace(' ','T')+'Z':date);return {title,url,publishedAt}}).filter(h=>h.title&&Number.isFinite(h.publishedAt)&&h.publishedAt<=now+60000&&(provider==='crypto'?/^https:\/\/(www\.)?coindesk\.com\//:/^https:\/\/(www\.)?investing\.com\/news\//).test(h.url)).sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,25);
 if(!headlines.length)throw new Error('No valid dated headlines');return {source:provider==='crypto'?'CoinDesk RSS':provider==='global'?'Investing.com stock markets RSS':'Investing.com commodities RSS',fetchedAt:now,headlines};
}
const EVENT=/\b(hack(?:ed|ing)?|exploit(?:ed)?|bankrupt(?:cy)?|insolven(?:t|cy)|withdrawals? (?:halt|suspend|pause)|trading halt|emergency|rate decision|interest rate|fomc|inflation|cpi|sec lawsuit|delist(?:ing|ed)?)\b/i;
export function newsGate(news:NewsSnapshot|undefined,now:number,symbol:string){
 if(symbol==='XAU'&&news?.source!=='Investing.com commodities RSS')return {approved:false,reason:'Crypto headlines do not cover gold sufficiently; gold entries wait for a macro-news source.',flags:[] as Headline[]};
 if(!news||news.error||now-news.fetchedAt>5*60000||news.fetchedAt>now+1000)return {approved:false,reason:news?.error??'News feed missing or older than five minutes',flags:[] as Headline[]};
 if(!news.headlines.some(h=>now-h.publishedAt<=24*3600000))return {approved:false,reason:'Latest news is over 24 hours old; coverage uncertain',flags:[] as Headline[]};
 const flags=news.headlines.filter(h=>now-h.publishedAt<=2*3600000&&EVENT.test(h.title));
 return {approved:!flags.length,reason:flags.length?'Event-risk headline in the last two hours; new entries wait':'No configured event keywords in recent headlines. Limited headline coverage; not a forecast.',flags};
}
