export class FeedRateLimit extends Error{retryAfterMs:number;constructor(retryAfterMs=120000){super('Rate limited (429)');this.retryAfterMs=retryAfterMs;}}
export function retryDelay(error:unknown,previousError:string|null,base:number){
 if(!(error instanceof FeedRateLimit))return {delay:base,message:error instanceof Error?error.message:'Signal feed unavailable'};
 const previous=Number(previousError?.match(/retry delay (\d+)ms/)?.[1]??0),delay=Math.max(error.retryAfterMs,Math.min(900000,Math.max(120000,previous*2)));
 return {delay,message:`Rate limited (429); retry delay ${delay}ms. New entries wait for a successful fresh refresh.`};
}
export function retryAfterMs(value:string|null,now:number){if(!value)return 120000;const seconds=Number(value);return Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,(Date.parse(value)||now)-now);}
