export function sidebarHeight(contentHeight:number,maxHeight:number,screenHeight:number):number{
 if(![contentHeight,maxHeight,screenHeight].every(Number.isFinite)||contentHeight<=0)return 0;
 return Math.min(Math.max(100,Math.ceil(contentHeight)),maxHeight,screenHeight);
}
