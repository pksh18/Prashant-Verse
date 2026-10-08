export type CryptoStats={price:number;change:number;high:number;low:number;volume:number;relativeVolume:number|null;fetchedAt:number};
export function parseStats(input:unknown,now:number):CryptoStats{
 const d=input as Record<string,unknown>;if(!d||typeof d!=='object')throw new Error('Invalid stats');
 const num=(key:string)=>{if(typeof d[key]!=='string'||!String(d[key]).trim())throw new Error('Invalid '+key);const v=Number(d[key]);if(!Number.isFinite(v))throw new Error('Invalid '+key);return v};
 const open=num('open'),price=num('last'),high=num('high'),low=num('low'),volume=num('volume'),monthly=d.volume_30day===undefined?0:num('volume_30day');
 if(open<=0||price<=0||low<=0||high<low||volume<0||monthly<0)throw new Error('Invalid stats range');
 return {price,change:(price/open-1)*100,high,low,volume,relativeVolume:monthly>0?volume/(monthly/30):null,fetchedAt:now};
}
export function parseResearchCsv(text:string){
 if(text.length>2000000)throw new Error('CSV must be smaller than 2 MB');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c;}
 if(quoted)throw new Error('CSV has an unfinished quoted field');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim());if(!headers?.length||headers.length>80||!headers.some(x=>/^(name|company|company name)$/i.test(x)))throw new Error('Import a Screener screen CSV with a Name or Company column');
 if(rows.length>1000)throw new Error('Import up to 1,000 companies at a time');if(rows.some(r=>r.length!==headers.length))throw new Error('CSV rows have inconsistent columns');
 return {headers,rows};
}
export function companyUrl(symbol:string){return /^[A-Z0-9&_.-]{1,30}$/.test(symbol.trim().toUpperCase())?'https://www.screener.in/company/'+encodeURIComponent(symbol.trim().toUpperCase())+'/consolidated/':null}
