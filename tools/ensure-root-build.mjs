import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const output = path.join(repoRoot, 'dist', 'types', 'index.d.ts');
const inputs = [
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'tsconfig.build.json'),
  path.join(repoRoot, 'tsconfig.cjs.json'),
  path.join(repoRoot, 'src'),
];

const needsBuild = await shouldBuild(output, inputs);

if (needsBuild) {
  await runBuild();
}

async function shouldBuild(target, sources) {
  const targetStat = await fs.stat(target).catch(() => null);
  if (!targetStat) return true;

  const newestSource = await newestMtime(sources);
  return newestSource > targetStat.mtimeMs;
}

async function newestMtime(entries) {
  let newest = 0;

  for (const entry of entries) {
    const stat = await fs.stat(entry);
    if (stat.isDirectory()) {
      const children = await fs.readdir(entry);
      const childPaths = children.map((child) => path.join(entry, child));
      newest = Math.max(newest, await newestMtime(childPaths));
      continue;
    }

    newest = Math.max(newest, stat.mtimeMs);
  }

  return newest;
}

async function runBuild() {
  await new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, ['run', 'build'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Root build failed with exit code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}
