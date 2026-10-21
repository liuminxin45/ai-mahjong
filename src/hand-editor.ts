import { countsOf, parseHand, setTiles, sorted, TILES, validateContext, type FixedSet, type HandContext, type TileId } from './engine/index.js';
export const handLimit=(context:HandContext)=>14-(context.fixedSets?.length??0)*3;
export function availableTiles(context:HandContext):number[]{
  const known=countsOf([...context.hand,...(context.fixedSets??[]).flatMap(setTiles)]);
  return known.map((count,i)=>4-count-(context.visible?.[TILES[i]]??0));
}
export function checkedEdit(context:HandContext):HandContext{
  validateContext(context,false);
  if(context.hand.length>handLimit(context))throw new Error(`当前固定组合下，手牌最多${handLimit(context)}张，请先移除多余的手牌。`);
  return {...context,hand:sorted(context.hand)};
}
export function fixSet(context:HandContext,set:FixedSet):HandContext{
  const hand=[...context.hand];
  for(const tile of setTiles(set)){const index=hand.indexOf(tile);if(index>=0)hand.splice(index,1);}
  return checkedEdit({...context,hand,fixedSets:[...(context.fixedSets??[]),set]});
}
export function unfixSet(context:HandContext,index:number,restore:boolean):HandContext{
  const sets=context.fixedSets??[],set=sets[index];if(!set)throw new Error('这组牌已经移除。');
  return checkedEdit({...context,hand:restore?[...context.hand,...setTiles(set)]:context.hand,fixedSets:sets.filter((_,i)=>i!==index)});
}
export function changeVisible(context:HandContext,tile:TileId,delta:number):HandContext{
  return checkedEdit({...context,visible:{...context.visible,[tile]:(context.visible?.[tile]??0)+delta}});
}
export function parseEditorHand(text:string):TileId[]{
  try{return sorted(parseHand(text.replaceAll('筒','p').replaceAll('条','s')));}
  catch{throw new Error('请按「123筒456条」输入；也兼容123p456s牌谱。');}
}
