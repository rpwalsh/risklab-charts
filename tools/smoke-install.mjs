import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const workspaceSpecs = [
  { name: '@risklab/charts', workspace: null },
  { name: '@risklab/charts-react', workspace: 'charts/react' },
  { name: '@risklab/charts-vanilla', workspace: 'charts/vanilla' },
  { name: '@risklab/charts-vue', workspace: 'charts/vue' },
  { name: '@risklab/charts-svelte', workspace: 'charts/svelte' },
  { name: '@risklab/charts-angular', workspace: 'charts/angular' },
  { name: '@risklab/charts-lit', workspace: 'charts/lit' },
  { name: '@risklab/charts-solid', workspace: 'charts/solid' },
];

const chartAdapterNames = workspaceSpecs
  .filter((spec) => spec.name.startsWith('@risklab/charts-'))
  .map((spec) => spec.name);

const scenarios = [
  {
    name: 'charts-core-only',
    install: ['@risklab/charts'],
    resolve: ['@risklab/charts', '@risklab/charts/react', '@risklab/charts/vanilla'],
    installed: ['@risklab/charts'],
    missing: ['react', 'react-dom', '@risklab/charts-react'],
  },
  {
    name: 'charts-adapters',
    install: ['@risklab/charts', ...chartAdapterNames],
    resolve: [
      '@risklab/charts',
      '@risklab/charts-react',
      '@risklab/charts-vanilla',
      '@risklab/charts-vue',
      '@risklab/charts-svelte',
      '@risklab/charts-angular',
      '@risklab/charts-lit',
      '@risklab/charts-solid',
    ],
    installed: [
      '@risklab/charts',
      ...chartAdapterNames,
      'react',
      'react-dom',
      'vue',
      'svelte',
      '@angular/core',
      'lit',
      'solid-js',
    ],
  },
];

async function run() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'risklab-install-smoke-'));
  const tarballDir = path.join(tempRoot, 'tarballs');
  await mkdir(tarballDir, { recursive: true });

  try {
    await assertNoInstallDependencies();

    const tarballs = new Map();

    for (const spec of workspaceSpecs) {
      tarballs.set(spec.name, await packWorkspace(spec, tarballDir));
    }

    for (const scenario of scenarios) {
      await runScenario({ scenario, tarballs, tempRoot });
    }

    console.log(`Smoke install checks passed (${scenarios.length} scenarios).`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function packWorkspace(spec, tarballDir) {
  const args = ['pack', '--pack-destination', tarballDir];
  if (spec.workspace) {
    args.push(`--workspace=${spec.workspace}`);
  }

  const { stdout } = await execNpm(args, repoRoot);
  const filename = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!filename) {
    throw new Error(`Unable to determine tarball filename for ${spec.name}.`);
  }

  return path.join(tarballDir, filename);
}

async function assertNoInstallDependencies() {
  for (const spec of workspaceSpecs) {
    const manifestPath = spec.workspace
      ? path.join(repoRoot, spec.workspace, 'package.json')
      : path.join(repoRoot, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    if (dependencyNames.length > 0) {
      throw new Error(`${spec.name} declares install dependencies: ${dependencyNames.join(', ')}`);
    }
  }
}

async function runScenario({ scenario, tarballs, tempRoot }) {
  const projectDir = path.join(tempRoot, scenario.name);
  await mkdir(projectDir, { recursive: true });

  await execNpm(['init', '-y'], projectDir);

  const installArgs = [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...scenario.install.map((name) => tarballs.get(name)),
  ];

  await execNpm(installArgs, projectDir);

  const projectRequire = createRequire(path.join(projectDir, 'package.json'));

  for (const specifier of scenario.resolve ?? []) {
    try {
      projectRequire.resolve(specifier);
    } catch (error) {
      throw new Error(`Scenario "${scenario.name}" could not resolve "${specifier}": ${formatError(error)}`);
    }
  }

  for (const packageName of scenario.installed ?? []) {
    const manifestPath = path.join(projectDir, 'node_modules', ...packageName.split('/'), 'package.json');
    try {
      await access(manifestPath);
    } catch {
      throw new Error(`Scenario "${scenario.name}" is missing installed package "${packageName}".`);
    }
  }

  for (const packageName of scenario.missing ?? []) {
    const manifestPath = path.join(projectDir, 'node_modules', ...packageName.split('/'), 'package.json');
    try {
      await access(manifestPath);
      throw new Error(`Scenario "${scenario.name}" unexpectedly installed "${packageName}".`);
    } catch (error) {
      if (isUnexpectedInstallError(error)) {
        throw error;
      }
    }
  }

  const manifest = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8'));
  if (scenario.name === 'charts-adapters') await executeEntrypoints(projectDir);
  console.log(`Verified ${scenario.name}: ${Object.keys(manifest.dependencies ?? {}).length} installed dependencies.`);
}

async function executeEntrypoints(projectDir) {
  const coreManifest = JSON.parse(await readFile(path.join(projectDir, 'node_modules', '@risklab', 'charts', 'package.json'), 'utf8'));
  const rootExports = Object.keys(coreManifest.exports).map((key) => key === '.' ? '@risklab/charts' : `@risklab/charts/${key.slice(2)}`);
  const specifiers = [...rootExports, ...chartAdapterNames];
  await writeFile(path.join(projectDir, 'verify-esm.mjs'), `
    const names = ${JSON.stringify(specifiers)};
    for (const name of names) {
      const value = await import(name);
      if (!value || typeof value !== 'object') throw new Error('Empty ESM entrypoint: ' + name);
    }
  `, 'utf8');
  await writeFile(path.join(projectDir, 'verify-cjs.cjs'), `
    const names = ${JSON.stringify(specifiers)};
    for (const name of names) {
      const value = require(name);
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) throw new Error('Empty CommonJS entrypoint: ' + name);
    }
  `, 'utf8');
  await execNode(['verify-esm.mjs'], projectDir);
  await execNode(['verify-cjs.cjs'], projectDir);
  console.log(`Executed ${specifiers.length} ESM and CommonJS entrypoints.`);
}

function isUnexpectedInstallError(error) {
  return !(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function execNpm(args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const stdoutText = stdout ? `\nSTDOUT:\n${stdout}` : '';
      const stderrText = stderr ? `\nSTDERR:\n${stderr}` : '';
      reject(new Error(`npm ${args.join(' ')} failed in ${cwd}.${stdoutText}${stderrText}`));
    });
  });
}

async function execNode(args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`node ${args.join(' ')} failed in ${cwd}.\n${stdout}\n${stderr}`)));
  });
}

await run();
