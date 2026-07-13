import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
const decoder = new TextDecoder('utf-8', { fatal: true });
const suspicious = new RegExp('[\\u00C3\\u00C2]|\\u00E2[\\u0080-\\u00BF]');
const failures = [];
for (const file of tracked.filter((name) => /\.(?:css|html|js|json|md|mjs|svg|ts|tsx|txt|ya?ml)$/i.test(name))) {
  try {
    const value = decoder.decode(await readFile(file));
    if (value.includes('\uFFFD') || suspicious.test(value)) failures.push(`${file}: corrupted Unicode sequence`);
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    failures.push(`${file}: ${error.message}`);
  }
}
if (failures.length) throw new Error(`Source validation failed:\n${failures.join('\n')}`);
console.log(`Source validation passed for ${tracked.length} tracked files.`);
