export interface Bounds {x:number;y:number;width:number;height:number}
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
