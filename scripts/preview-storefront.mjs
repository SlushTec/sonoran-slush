import { cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';

const { values } = parseArgs({ options: { port: { type: 'string', default: '3000' }, hostname: { type: 'string', default: '127.0.0.1' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port from 1024 through 65535.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'apps/storefront');
const runtime = path.join(app, '.next/standalone/apps/storefront');
try { await access(path.join(runtime, 'server.js')); }
catch { throw new Error('Run npm run build before starting the standalone preview.'); }
await cp(path.join(app, '.next/static'), path.join(runtime, '.next/static'), { recursive: true });
const child = spawn(process.execPath, [path.join(runtime, 'server.js')], {
  cwd: runtime, stdio: 'inherit',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SONORAN_STAGE: 'scaffold', PORT: String(port), HOSTNAME: values.hostname },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
