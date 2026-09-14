import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const nodeVersion = '24.21.0';
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distributionDirectory = join(packageDirectory, 'dist');
const stagingDirectory = join(distributionDirectory, 'windows-runtime');
const downloadDirectory = join(distributionDirectory, '.downloads');
const nodeArchiveName = `node-v${nodeVersion}-win-x64.zip`;
const nodeArchive = join(downloadDirectory, nodeArchiveName);
const outputFile = join(distributionDirectory, 'Patentory-Bridge-Setup-0.1.0-x64.exe');

await rm(stagingDirectory, { force: true, recursive: true });
await mkdir(join(stagingDirectory, 'src'), { recursive: true });
await mkdir(join(stagingDirectory, 'node_modules'), { recursive: true });
await mkdir(downloadDirectory, { recursive: true });

if (!await fileExists(nodeArchive)) {
  const response = await fetch(`https://nodejs.org/dist/v${nodeVersion}/${nodeArchiveName}`);
  if (!response.ok) throw new Error(`Node.js çalışma zamanı indirilemedi: ${response.status}`);
  await writeFile(nodeArchive, Buffer.from(await response.arrayBuffer()));
}
await verifyNodeArchive(nodeArchive, nodeArchiveName);

const extractedDirectory = join(downloadDirectory, `node-v${nodeVersion}-win-x64`);
await rm(extractedDirectory, { force: true, recursive: true });
execFileSync('ditto', ['-x', '-k', nodeArchive, downloadDirectory], { stdio: 'inherit' });

await cp(join(packageDirectory, 'src', 'lib.mjs'), join(stagingDirectory, 'src', 'lib.mjs'));
await cp(join(packageDirectory, 'src', 'server.mjs'), join(stagingDirectory, 'src', 'server.mjs'));
await cp(join(extractedDirectory, 'node.exe'), join(stagingDirectory, 'node.exe'));
await cp(join(extractedDirectory, 'LICENSE'), join(stagingDirectory, 'NODE-LICENSE.txt'));
await cp(resolvePlaywrightCore(), join(stagingDirectory, 'node_modules', 'playwright-core'), { recursive: true });
await cp(join(packageDirectory, 'build', 'icon.ico'), join(stagingDirectory, 'patentory.ico'));
await writeFile(join(stagingDirectory, 'package.json'), '{"private":true,"type":"module"}\n');
await writeFile(join(stagingDirectory, 'start-hidden.vbs'), hiddenLauncher());

const makensis = await findMakensis();
execFileSync(makensis.executable, [
  `-DAPP_VERSION=0.1.0`,
  `-DOUT_FILE=${outputFile}`,
  `-DSTAGING_DIR=${stagingDirectory}`,
  `-DICON_FILE=${join(packageDirectory, 'build', 'icon.ico')}`,
  join(packageDirectory, 'build', 'windows-installer.nsi'),
], { env: { ...process.env, NSISDIR: makensis.root }, stdio: 'inherit' });

console.log(`Windows kurucusu hazır: ${outputFile}`);

async function verifyNodeArchive(archivePath, archiveName) {
  const response = await fetch(`https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`);
  if (!response.ok) throw new Error(`Node.js sağlama toplamı indirilemedi: ${response.status}`);
  const expectedLine = (await response.text()).split('\n').find((line) => line.endsWith(`  ${archiveName}`));
  if (!expectedLine) throw new Error('Node.js sağlama toplamı bulunamadı.');
  const expected = expectedLine.split(/\s+/)[0];
  const actual = createHash('sha256').update(await readFile(archivePath)).digest('hex');
  if (actual !== expected) throw new Error('Node.js çalışma zamanı sağlama toplamı geçersiz.');
}

function resolvePlaywrightCore() {
  const packageJson = import.meta.resolve('playwright-core/package.json');
  return dirname(fileURLToPath(packageJson));
}

async function findMakensis() {
  const override = process.env.PATENTORY_MAKENSIS;
  if (override && await fileExists(override)) {
    return { executable: override, root: resolve(dirname(override), '..') };
  }
  const cacheRoot = join(homedir(), 'Library', 'Caches', 'electron-builder');
  const candidates = (await readdir(cacheRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('nsis-3.'))
    .map((entry) => join(cacheRoot, entry.name));
  for (const candidate of candidates) {
    for (const nested of await readdir(candidate, { withFileTypes: true })) {
      const executable = join(candidate, nested.name, 'mac', 'makensis');
      if (nested.isDirectory() && await fileExists(executable)) return { executable, root: join(candidate, nested.name) };
    }
  }
  throw new Error('makensis bulunamadı. PATENTORY_MAKENSIS yolunu tanımlayın.');
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function hiddenLauncher() {
  return [
    'Set shell = CreateObject("WScript.Shell")',
    'Set files = CreateObject("Scripting.FileSystemObject")',
    'folder = files.GetParentFolderName(WScript.ScriptFullName)',
    'command = Chr(34) & folder & "\\node.exe" & Chr(34) & " " & Chr(34) & folder & "\\src\\server.mjs" & Chr(34)',
    'shell.Run command, 0, False',
    '',
  ].join('\r\n');
}
