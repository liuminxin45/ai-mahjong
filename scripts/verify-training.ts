import {analyze,validateContext} from '../src/engine/index.js';
import {trainingQuestions,structure} from '../src/training/questions.js';
import {topics} from '../src/training/topics.js';
const seen=new Set<string>();for(const q of trainingQuestions){validateContext(q.context);const r=analyze(q.context);if(r.shanten<0||seen.has(q.family)||q.family!==structure(q.context)||JSON.stringify(r.discards.filter(d=>d.best).map(d=>d.tile))!==JSON.stringify(q.accepted))throw Error(`Invalid teaching question: ${q.id}`);seen.add(q.family);}
for(const t of topics)if(trainingQuestions.filter(q=>q.topic===t.id).length<11)throw Error('Incomplete topic coverage');
console.log(`Verified ${trainingQuestions.length} teaching structures: 8 worked examples + 88 practice questions. Independent target enumeration runs in training.test.ts.`);
