import { afterEach, beforeEach } from 'vitest';
import { setImmediate } from 'node:timers';

// Exact enumerators can occupy a worker for a long time. Let IPC acknowledgements
// run between cases so Vitest's reporting deadline never becomes a math timeout.
const nextTurn=setImmediate;
const yieldTurn=()=>new Promise<void>(resolve=>nextTurn(resolve));
beforeEach(yieldTurn);
afterEach(yieldTurn);
