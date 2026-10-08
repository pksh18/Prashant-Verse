import {test} from 'node:test';
import assert from 'node:assert/strict';
import {headlineTone,sectorBoard} from './sector-news.ts';
import {parseNews,type NewsSnapshot} from './team-news.ts';
const now=1791300000000;
const feed=(titles:string[],at=now):NewsSnapshot=>({source:'Investing.com stock markets RSS',fetchedAt:at,headlines:titles.map((title,i)=>({title,url:`https://www.investing.com/news/article-${i}`,publishedAt:now-1000}))});
test('explicit direction, uncertainty and cross-sector effects remain distinct',()=>{
 assert.equal(headlineTone('Gold rises to record high'),'buy');
 assert.equal(headlineTone('Bank stocks plunge after earnings miss'),'short');
 assert.equal(headlineTone('Gold may rise next week'),'neutral');
 assert.equal(headlineTone('Gold rises but downside risks remain'),'neutral');
 assert.equal(headlineTone('Tech rallies while banks fall'),'neutral');
 assert.equal(headlineTone('Oil falls, airlines gain'),'neutral');
});
test('conflicting, unavailable and stale coverage never yields a directional sector watch',()=>{
 const get=(f:NewsSnapshot[])=>sectorBoard(f,now).sectors.find(s=>s.id==='gold')!;
 assert.equal(get([feed(['Gold rises','Gold falls'])]).tone,'neutral');
 assert.equal(get([feed(['Gold rises'],now-6*60000)]).tone,'neutral');
 assert.equal(get([{...feed(['Gold rises']),error:'HTTP 429'}]).tone,'neutral');
 assert.equal(get([{...feed(['Gold rises']),headlines:feed(['Gold rises']).headlines.map(h=>({...h,publishedAt:now-25*3600000}))}]).tone,'neutral');
 assert.equal(get([feed(['Gold rises'])]).tone,'buy');
});
test('deduplicates syndicated stories and keeps source evidence',()=>{
 const board=sectorBoard([feed(['Gold falls']),feed(['Gold falls'])],now);
 const gold=board.sectors.find(s=>s.id==='gold')!;
 assert.equal(gold.headlines.length,1);assert.equal(gold.headlines[0].source,'Investing.com stock markets RSS');assert.equal(gold.tone,'short');
});
test('global RSS parser rejects unsafe links and preserves source identity',()=>{
 const xml=`<rss><channel><item><title>Technology stocks rise</title><link>https://www.investing.com/news/stock-market-news/test</link><pubDate>${new Date(now).toUTCString()}</pubDate></item><item><title>Gold rises</title><link>javascript:alert(1)</link><pubDate>${new Date(now).toUTCString()}</pubDate></item></channel></rss>`;
 const parsed=parseNews(xml,now,'global');assert.equal(parsed.source,'Investing.com stock markets RSS');assert.equal(parsed.headlines.length,1);
});
