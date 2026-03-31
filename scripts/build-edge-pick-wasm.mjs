import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import wabtInit from 'wabt';

const root = process.cwd();
const watPath = path.join(root, 'src/workers/wasm/edgePickKernel.wat');
const outDir = path.join(root, 'public/wasm');
const outPath = path.join(outDir, 'edgePickKernel.wasm');

const wabt = await wabtInit();
const wat = await readFile(watPath, 'utf8');
const mod = wabt.parseWat(watPath, wat);
const { buffer } = mod.toBinary({
  log: false,
  write_debug_names: true,
});
await mkdir(outDir, { recursive: true });
await writeFile(outPath, Buffer.from(buffer));
console.info(`[edge-pick-wasm] wrote ${path.relative(root, outPath)}`);
