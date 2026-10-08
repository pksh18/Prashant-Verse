import {retryDelay} from './feed-retry';
import {env} from 'cloudflare:workers';
export async function sharedFeed<T>(key:string,load:()=>Promise<{value:T;expiresAt:number}>,failureDelay=120000,leaseDuration=15000):Promise<{value?:T;error?:string}>{
 const db=env.DB;if(!db)throw new Error('Market cache unavailable');const now=Date.now(),owner=crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO market_cache(key) VALUES(?)').bind(key).run();
 const row=await db.prepare('SELECT payload,expires_at,lease_until,error FROM market_cache WHERE key=?').bind(key).first<{payload:string|null;expires_at:number;lease_until:number;error:string|null}>();
 const prior=()=>({value:row?.payload?JSON.parse(row.payload) as T:undefined,error:row?.error??undefined});
 if(row&&row.expires_at>now)return prior();
 const claim=await db.prepare('UPDATE market_cache SET lease_until=?,lease_owner=? WHERE key=? AND expires_at<=? AND lease_until<=?').bind(now+leaseDuration,owner,key,now,now).run();
 if(claim.meta.changes!==1)return {...prior(),error:row?.error??(row?.payload?undefined:'Signal feed refresh in progress')};
 try{
  const {value,expiresAt}=await load();
  await db.prepare('UPDATE market_cache SET payload=?,expires_at=?,lease_until=0,lease_owner=NULL,error=NULL WHERE key=? AND lease_owner=?').bind(JSON.stringify(value),expiresAt,key,owner).run();
  return {value};
 }catch(e){
  const retry=retryDelay(e,row?.error??null,failureDelay),error=retry.message;
  await db.prepare('UPDATE market_cache SET expires_at=?,lease_until=0,lease_owner=NULL,error=? WHERE key=? AND lease_owner=?').bind(Date.now()+retry.delay,error,key,owner).run();
  return {...prior(),error};
 }
}
