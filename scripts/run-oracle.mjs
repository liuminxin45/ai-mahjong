import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/oracle.test.ts'],{stdio:'inherit',env:{...process.env,MAHJONG_ORACLE_SAMPLES:process.env.MAHJONG_ORACLE_SAMPLES||'10000'}});
process.exit(result.status??1);
