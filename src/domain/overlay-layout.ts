export interface Bounds {x:number;y:number;width:number;height:number}
/** Inventory labels occupy the leftmost hand positions, not hidden card identities.
 * Spacing and the raised outer card bottoms follow the supplied 1–6 card crops.
 * Crops do not establish absolute screen coordinates; viewport centering remains
 * an estimate. More than six cards use a bounded fallback. */
export function handOverlayBounds(client:Bounds,index:number,count:number):Bounds|null {
 if(!Object.values(client).every(Number.isFinite)||client.width<480||client.height<270||!Number.isInteger(count)||count<1||count>100||!Number.isInteger(index)||index<0||index>=count)return null;
 const width=Math.min(client.width,client.height*16/9),height=width*9/16;
 const left=client.x+(client.width-width)/2,top=client.y+(client.height-height)/2;
 const step=Math.min(80,550/Math.max(1,count-1)),w=Math.min(46,step-4);
 const lifts:Record<number,number[]>={1:[0],2:[0,0],3:[3,0,3],4:[5,0,0,5],5:[9,3,0,3,9],6:[12,4,0,0,4,12]};
 const lift=lifts[count]?.[index]??0;
 return {x:Math.round(left+width*(683+(index-(count-1)/2)*step-w/2)/1366),y:Math.round(top+height*(44-lift)/768),width:Math.max(1,Math.round(width*w/1366)),height:Math.max(1,Math.round(height*22/768))};
}
/** Reference card bottoms from the approved real 16:9 screenshot. All units
 * here are physical pixels; the desktop adapter converts each result to DIP. */
export function overlayBounds(client:Bounds,slot:number,offsetX=0,offsetY=0):Bounds|null {
 if(!Object.values(client).every(Number.isFinite)||client.width<480||client.height<270||slot<7||slot>11)return null;
 const width=Math.min(client.width,client.height*16/9),height=width*9/16;
 const left=client.x+(client.width-width)/2,top=client.y+(client.height-height)/2;
 const index=11-slot;
 const w=width*48/1360,h=height*20/765;
 return {x:Math.round(left+width*(.3265+index*.084+offsetX/100)-w/2),y:Math.round(top+height*(129/765+offsetY/100)),width:Math.max(1,Math.round(w)),height:Math.max(1,Math.round(h))};
}
/** Match the native left card report in the user's 1366x768 game screenshot. */
export function overlayDetailBounds(client:Bounds):Bounds {
 const width=Math.min(client.width,client.height*16/9),height=width*9/16;
 const left=client.x+(client.width-width)/2,top=client.y+(client.height-height)/2;
 return {x:Math.round(left+width*18/1366),y:Math.round(top+height*100/768),width:Math.round(width*280/1366),height:Math.round(height*512/768)};
}
