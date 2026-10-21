import {expect,it} from 'vitest';
import {parseHand,type HandContext} from '../src/engine/index.js';
import {availableTiles,changeVisible,checkedEdit,fixSet,handLimit,parseEditorHand,unfixSet} from '../src/hand-editor.js';
it('图片选牌同时计入手牌、固定牌与其他可见牌，不能添加第五张',()=>{
 const context:HandContext={hand:['1p'],fixedSets:[{kind:'triplet',tile:'1s'}],visible:{'1p':3}};
 expect(availableTiles(context).slice(0,1)).toEqual([0]);expect(availableTiles(context)[9]).toBe(1);
 expect(()=>checkedEdit({...context,hand:['1p','1p']})).toThrow('四张');
 expect(()=>changeVisible(context,'1s',2)).toThrow('四张');
});
it('固定组合逐张移走已有手牌，缺少的牌只从未知牌补入',()=>{
 const fixed=fixSet({hand:parseHand('123p22s')},{kind:'sequence',tile:'1p'});
 expect(fixed.hand).toEqual(parseHand('22s'));expect(handLimit(fixed)).toBe(11);
 const partial=fixSet({hand:parseHand('12p22s')},{kind:'sequence',tile:'1p'});
 expect(partial.hand).toEqual(parseHand('22s'));expect(availableTiles(partial)[0]).toBe(3);
 expect(unfixSet(fixed,0,true).hand).toEqual(parseHand('123p22s'));
});
it('固定组合和杠子还原不能造成超长手牌，仍可移除组合',()=>{
 const context:HandContext={hand:parseHand('123456789p22s'),fixedSets:[{kind:'quad',tile:'1s'}]};
 expect(()=>unfixSet(context,0,true)).toThrow('最多14张');
 expect(unfixSet(context,0,false).fixedSets).toEqual([]);
 expect(()=>fixSet({hand:parseHand('123456789p12459s')},{kind:'triplet',tile:'9s'})).toThrow('最多11张');
});
it('中文牌谱与旧格式得到相同手牌，可见牌点按增减保持物理数量',()=>{
 expect(parseEditorHand('123筒 456条')).toEqual(parseHand('123p456s'));
 expect(parseEditorHand('123p456s')).toEqual(parseHand('123p456s'));
 expect(()=>parseEditorHand('123万')).toThrow('123筒456条');
 const first=changeVisible({hand:[]},'2p',1);expect(first.visible?.['2p']).toBe(1);
 expect(changeVisible(first,'2p',-1).visible?.['2p']).toBe(0);
 expect(()=>changeVisible(first,'2p',-2)).toThrow();
});
