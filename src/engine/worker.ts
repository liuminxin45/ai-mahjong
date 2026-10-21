import { analyze, type HandContext } from './index.js';
self.onmessage=(event:MessageEvent<{id:number;context:HandContext}>)=>{
  try { self.postMessage({id:event.data.id,result:analyze(event.data.context)}); }
  catch(error) { self.postMessage({id:event.data.id,error:error instanceof Error?error.message:'分析失败'}); }
};
