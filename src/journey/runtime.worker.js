import {automaticStep} from './round.js';
self.onmessage=({data})=>{
 try{let state=data.state;const frames=[];for(let n=0;n<12&&state.phase!=='player'&&state.phase!=='over';n++){state=automaticStep(state);frames.push(state);}self.postMessage({id:data.id,seq:data.seq,state,frames});}
 catch(e){self.postMessage({id:data.id,seq:data.seq,error:e.message});}
};
