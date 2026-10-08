export const SESSION_COOKIE='__Host-pv-session';
const lifetime=365*24*60*60;

export function sessionToken(headers:Headers):string|null{
  const values=(headers.get('cookie')??'').split(';').map(v=>v.trim())
    .filter(v=>v.startsWith(SESSION_COOKIE+'='));
  if(values.length!==1)return null;
  const token=values[0].slice(SESSION_COOKIE.length+1);
  return /^[a-f0-9]{64}$/.test(token)?token:null;
}
export async function hashToken(token:string){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))))
    .map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function safeReturn(value:string|null){
  if(!value?.startsWith('/')||value.startsWith('//'))return '/';
  const url=new URL(value,'https://app.local');
  if(url.origin!=='https://app.local'||['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname))return '/';
  return url.pathname+url.search+url.hash;
}
export async function browserIdentity(headers:Headers,db:D1Database,now=Date.now()){
  const token=sessionToken(headers);if(!token)return null;
  const row=await db.prepare('SELECT user_id FROM browser_sessions WHERE token_hash=? AND expires_at>?')
    .bind(await hashToken(token),now).first<{user_id:string}>();
  return row?.user_id??null;
}
export async function createBrowserSession(db:D1Database){
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const id='browser_'+crypto.randomUUID();
  await db.prepare('INSERT INTO browser_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(await hashToken(token),id,Date.now()+lifetime*1000).run();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${lifetime}`;
}
export function trustedHeaders(headers:Headers,id:string|null){
  const result=new Headers(headers);
  for(const key of [...result.keys()])if(key.startsWith('oai-authenticated-user-'))result.delete(key);
  if(id){result.set('oai-authenticated-user-id',id);result.set('oai-authenticated-user-email','Private browser portfolio');}
  return result;
}
