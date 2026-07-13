import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const packageRoot = resolve(process.argv[2] ?? '.');
const esmRoot = join(packageRoot, 'dist', 'esm');
const cjsRoot = join(packageRoot, 'dist', 'cjs');

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith('.js')) {
      const source = await readFile(path, 'utf8');
      const rewritten = source.replace(/(from\s+['"]|import\s*(?:\(\s*)?['"])(\.\.?\/[^'"\n]+?)(['"]\s*\)?)/g, (match, open, specifier, close) => {
        if (/\.(?:css|js|json|mjs|svg)$/.test(specifier)) return match;
        const base = resolve(dirname(path), specifier);
        if (existsSync(`${base}.js`)) return `${open}${specifier}.js${close}`;
        if (existsSync(join(base, 'index.js'))) return `${open}${specifier}/index.js${close}`;
        return match;
      });
      if (rewritten !== source) await writeFile(path, rewritten, 'utf8');
    }
  }
}

await visit(esmRoot);
await writeFile(join(cjsRoot, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
console.log(`Finalized module boundaries for ${packageRoot}`);
