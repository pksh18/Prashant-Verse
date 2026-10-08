import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionToken,safeReturn,trustedHeaders,browserIdentity,createBrowserSession,hashToken,SESSION_COOKIE} from './browser-session.ts';
test('public headers cannot impersonate another portfolio',()=>{
 const h=trustedHeaders(new Headers({'oai-authenticated-user-id':'victim','oai-authenticated-user-email':'victim@example.com','oai-authenticated-user-full-name':'Victim'}),null);
 assert.equal(h.get('oai-authenticated-user-id'),null);
 assert.equal(h.get('oai-authenticated-user-full-name'),null);
 const own=trustedHeaders(h,'browser_own');assert.equal(own.get('oai-authenticated-user-id'),'browser_own');
});
test('malformed and duplicate cookies are rejected',()=>{
 assert.equal(sessionToken(new Headers({cookie:SESSION_COOKIE+'=guess'})),null);
 const c=SESSION_COOKIE+'='+'a'.repeat(64);
 assert.equal(sessionToken(new Headers({cookie:c+'; '+c})),null);
 assert.equal(sessionToken(new Headers({cookie:c})),'a'.repeat(64));
});
test('return URL cannot leave the app or loop through authentication',()=>{
 for(const path of ['//evil.com','/\\evil.com','https://evil.com','/signin-with-chatgpt'])assert.equal(safeReturn(path),'/');
 assert.equal(safeReturn('/?view=journal'),'/?view=journal');
});
test('sessions store only hashed tokens and isolate browser identities',async()=>{
 const records=new Map<string,{user_id:string,expires_at:number}>();
 const db={prepare(sql:string){let args:unknown[]=[];return {bind(...v:unknown[]){args=v;return this},async run(){records.set(args[0] as string,{user_id:args[1] as string,expires_at:args[2] as number})},async first(){const row=records.get(args[0] as string);return row&&row.expires_at>(args[1] as number)?row:null}}}} as unknown as D1Database;
 const first=await createBrowserSession(db),second=await createBrowserSession(db);
 const one=new Headers({cookie:first.split(';')[0]}),two=new Headers({cookie:second.split(';')[0]});
 const id=await browserIdentity(one,db);assert.ok(id);assert.notEqual(id,await browserIdentity(two,db));
 assert.ok(records.has(await hashToken(sessionToken(one)!)));assert.ok(!records.has(sessionToken(one)!));
 assert.equal(await browserIdentity(one,db,Date.now()+366*86400000),null);
 assert.match(first,/HttpOnly; Secure; SameSite=Lax/);
});
