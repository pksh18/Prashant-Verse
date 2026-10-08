import {env} from 'cloudflare:workers';
import {initial,type State} from './paper-engine';
function db(){if(!env.DB)throw new Error('Portfolio storage is unavailable');return env.DB}
export async function readPortfolio(id:string){await db().prepare('INSERT OR IGNORE INTO portfolios_usd(user_id,state,revision) VALUES(?,?,0)').bind(id,JSON.stringify(initial())).run();const row=await db().prepare('SELECT state,revision FROM portfolios_usd WHERE user_id=?').bind(id).first<{state:string;revision:number}>();if(!row)throw new Error('Portfolio unavailable');return {state:JSON.parse(row.state) as State,revision:row.revision}}
export async function savePortfolio(id:string,state:State,revision:number){const r=await db().prepare('UPDATE portfolios_usd SET state=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(JSON.stringify(state),id,revision).run();if(r.meta.changes!==1)throw new Error('Another tab updated the portfolio. Refresh and try again.');}
