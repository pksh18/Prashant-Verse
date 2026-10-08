import type {Analysis} from './strategy.ts';
export const ADVERSE_SLIPPAGE=.0005;
export function entryPlan(quote:number,a:Analysis){
 const targetR=a.targetR??2;if(![2,3].includes(targetR))return null;
 const direction=a.direction??'long',sign=direction==='short'?-1:1;
 const entry=quote*(1+sign*ADVERSE_SLIPPAGE),fraction=a.stopPrice?Math.max(.004,sign*(entry-a.stopPrice)/entry):a.stopFraction;
 if(!Number.isFinite(entry)||entry<=0||!Number.isFinite(fraction)||fraction<.004||fraction>.015||a.stopPrice&&sign*(entry-a.stopPrice)<=0)return null;
 if(sign===1&&a.supplyFloor&&a.supplyFloor<=entry*(1+fraction*targetR)||sign===-1&&a.demandCeiling&&a.demandCeiling>=entry*(1-fraction*targetR))return null;
 return {direction,entry,stop:entry*(1-sign*fraction),target:entry*(1+sign*fraction*targetR)};
}
