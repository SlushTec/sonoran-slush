import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const next=fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url));
const cleanup=fileURLToPath(new URL('./next-cleanup-retry.cjs',import.meta.url));
const child=spawn(process.execPath,['--require',cleanup,next,'build'],{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',err=>{console.error(err.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
