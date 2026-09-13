import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
  console.error('Otomatik başlatma kurulumu şu anda yalnızca macOS içindir.');
  process.exit(1);
}

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const supportDirectory = join(homedir(), '.patentory');
const runtimeDirectory = join(supportDirectory, 'bridge-runtime');
const logsDirectory = join(supportDirectory, 'logs');
const launchAgentsDirectory = join(homedir(), 'Library', 'LaunchAgents');
const plistPath = join(launchAgentsDirectory, 'com.patentory.chatgpt-bridge.plist');
const label = 'com.patentory.chatgpt-bridge';
const uid = process.getuid();

await rm(runtimeDirectory, { recursive: true, force: true });
await mkdir(join(runtimeDirectory, 'node_modules'), { recursive: true, mode: 0o700 });
await cp(join(packageDirectory, 'src'), join(runtimeDirectory, 'src'), { recursive: true });
const playwrightDirectory = await realpath(join(packageDirectory, 'node_modules', 'playwright-core'));
await cp(playwrightDirectory, join(runtimeDirectory, 'node_modules', 'playwright-core'), { recursive: true });

const xml = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${join(runtimeDirectory, 'src', 'server.mjs')}</string>
  </array>
  <key>WorkingDirectory</key><string>${runtimeDirectory}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${join(logsDirectory, 'bridge.log')}</string>
  <key>StandardErrorPath</key><string>${join(logsDirectory, 'bridge-error.log')}</string>
</dict>
</plist>
`;

await mkdir(logsDirectory, { recursive: true, mode: 0o700 });
await mkdir(launchAgentsDirectory, { recursive: true });
await writeFile(plistPath, xml, { encoding: 'utf8', mode: 0o600 });
await chmod(plistPath, 0o600);
try {
  execFileSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
} catch {
  // It is normal for the service not to exist on first installation.
}
execFileSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
execFileSync('launchctl', ['enable', `gui/${uid}/${label}`]);
execFileSync('launchctl', ['kickstart', '-k', `gui/${uid}/${label}`]);
console.log(`Patentory ChatGPT köprüsü otomatik başlatıldı: ${plistPath}`);
