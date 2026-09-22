import { ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import AdmZip from 'adm-zip'

type NativeInstance = { process: ChildProcess; output: EventEmitter }
const instances = new Map<string, NativeInstance>()
const portableJava = new Map<number, Promise<string>>()

export function useNativeRuntime(): boolean {
  return useRuntimeConfig().mcRuntime === 'native'
}

export function isNativeRunning(id: string): boolean {
  const instance = instances.get(id)
  return Boolean(instance?.process.pid && instance.process.exitCode === null && !instance.process.killed)
}

export function subscribeNativeLogs(id: string, listener: (line: string) => void): (() => void) | null {
  const instance = instances.get(id)
  if (!instance) return null
  instance.output.on('line', listener)
  return () => instance.output.off('line', listener)
}

export async function startNativeServer(server: any): Promise<number | undefined> {
  if (isNativeRunning(server.id)) return instances.get(server.id)?.process.pid
  const dataPath = getServerDataPath(server.id)
  writeServerProperties(dataPath, server)
  const requiredJava = await detectRequiredJava(server.mc_version, dataPath)
  const java = await getJavaExecutable(requiredJava)
  const launcher = await getNativeLauncher(server, dataPath, java)
  const output = new EventEmitter()
  const child = spawn(launcher.command, launcher.args, {
    cwd: dataPath, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    // Forge/NeoForge run.bat invokes `java`; make the portable JRE visible to it.
    env: { ...process.env, Path: `${dirname(java)};${process.env.Path || ''}` },
  })
  instances.set(server.id, { process: child, output })

  const emit = (chunk: Buffer) => chunk.toString('utf8').split(/\r?\n/).filter(Boolean).forEach(line => output.emit('line', line))
  child.stdout?.on('data', emit)
  child.stderr?.on('data', emit)
  child.once('error', error => output.emit('line', `Unable to start Java: ${error.message}`))
  child.once('exit', (code) => {
    output.emit('line', `Process exited${code === null ? '' : ` with code ${code}`}`)
    instances.delete(server.id)
  })
  return child.pid
}

export async function stopNativeServer(id: string): Promise<void> {
  const instance = instances.get(id)
  if (!instance) return
  instance.process.stdin?.write('stop\n')
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { instance.process.kill(); resolve() }, 30_000)
    instance.process.once('exit', () => { clearTimeout(timer); resolve() })
  })
}

export function sendNativeCommand(id: string, command: string): void {
  const instance = instances.get(id)
  if (!instance || !isNativeRunning(id)) throw createError({ statusCode: 400, statusMessage: 'Server is not running' })
  instance.process.stdin?.write(`${command.trim()}\n`)
}

async function getJavaExecutable(major: number): Promise<string> {
  // Development on Windows needs no machine-wide Java installation. The exact
  // JRE major is detected from the selected Minecraft server file, then cached.
  if (process.platform !== 'win32') {
    if (process.env.JAVA_PATH) return process.env.JAVA_PATH
    throw createError({ statusCode: 500, statusMessage: 'Native Java auto-download is currently available on Windows. Set JAVA_PATH on this host.' })
  }
  if (!portableJava.has(major)) portableJava.set(major, downloadPortableJava(major))
  return portableJava.get(major)!
}

async function downloadPortableJava(major: number): Promise<string> {
  const config = useRuntimeConfig()
  const root = resolve(config.mcDataPath || './data/servers', '..', 'bin', `temurin-jre-${major}`)
  const existing = findJavaExecutable(root)
  if (existing) return existing

  mkdirSync(root, { recursive: true })
  const response = await fetch(`https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse`)
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Unable to download portable Java (${response.status})` })
  try {
    new AdmZip(Buffer.from(await response.arrayBuffer())).extractAllTo(root, true)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Downloaded portable Java archive could not be extracted' })
  }
  const executable = findJavaExecutable(root)
  if (!executable) throw createError({ statusCode: 502, statusMessage: 'Portable Java archive does not contain java.exe' })
  return executable
}

/** Determine the Java major from the server's actual class file (major - 44). */
async function detectRequiredJava(version: string, dataPath: string): Promise<number> {
  const cacheDir = resolve(dataPath, '..', '..', 'bin', 'java-detection')
  const target = join(cacheDir, `minecraft-${version}.jar`)
  if (!existsSync(target)) {
    const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    const record = manifest.versions?.find((item: any) => item.id === version)
    if (!record) throw createError({ statusCode: 400, statusMessage: `Minecraft version ${version} was not found` })
    const details = await fetchJson(record.url)
    await download(details.downloads.server.url, target)
  }
  try {
    const archive = new AdmZip(target)
    const classFile = archive.getEntry('net/minecraft/bundler/Main.class') || archive.getEntry('net/minecraft/server/Main.class')
    if (classFile) {
      const bytes = classFile.getData()
      if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0xcafebabe) return Math.max(8, bytes.readUInt16BE(6) - 44)
    }
  } catch { /* Fall through to known Minecraft requirements. */ }
  const [major, minor = 0] = version.replace(/^1\./, '').split('.').map(Number)
  if (major > 21 || (major === 21 && minor >= 5)) return 21
  if (major >= 18) return 17
  return 8
}

function findJavaExecutable(directory: string): string | null {
  if (!existsSync(directory)) return null
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === 'java.exe') return target
    if (entry.isDirectory()) {
      const found = findJavaExecutable(target)
      if (found) return found
    }
  }
  return null
}

function writeServerProperties(dataPath: string, server: any): void {
  writeFileSync(join(dataPath, 'eula.txt'), 'eula=true\n')
  const properties = [
    `server-port=${server.port}`, `max-players=${server.max_players}`, `motd=${server.motd}`,
    `difficulty=${server.difficulty}`, `gamemode=${server.gamemode}`,
    `white-list=${server.whitelist ? 'true' : 'false'}`, `online-mode=${server.online_mode ? 'true' : 'false'}`,
  ].join('\n') + '\n'
  writeFileSync(join(dataPath, 'server.properties'), properties)
}

async function getNativeLauncher(server: any, dataPath: string, java: string): Promise<{ command: string; args: string[] }> {
  const memory = `${Math.max(256, Number(server.memory_mb) || 1024)}M`
  const javaArgs = [`-Xms${memory}`, `-Xmx${memory}`]
  let jar: string
  switch (server.type) {
    case 'vanilla': jar = await downloadVanilla(server.mc_version, dataPath); break
    case 'paper': jar = await downloadPaper(server.mc_version, dataPath); break
    case 'fabric': jar = await downloadFabric(server.mc_version, server.loader_version, dataPath); break
    case 'spigot': jar = await downloadBukkit('spigot', server.mc_version, dataPath); break
    case 'bukkit': jar = await downloadBukkit('craftbukkit', server.mc_version, dataPath); break
    case 'forge':
    case 'neoforge': return installAndLaunchModLoader(server, dataPath, java)
    case 'curseforge': return downloadCurseForgeServerPack(server, dataPath, java)
    default: throw createError({ statusCode: 400, statusMessage: 'Unsupported server type' })
  }
  return { command: java, args: [...javaArgs, '-jar', jar, 'nogui'] }
}

async function downloadVanilla(version: string, dir: string): Promise<string> {
  const target = join(dir, `vanilla-${version}.jar`)
  if (existsSync(target)) return target
  const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
  const record = manifest.versions?.find((item: any) => item.id === version)
  if (!record) throw createError({ statusCode: 400, statusMessage: `Minecraft version ${version} was not found` })
  const details = await fetchJson(record.url)
  await download(details.downloads.server.url, target)
  return target
}

async function downloadPaper(version: string, dir: string): Promise<string> {
  const target = join(dir, `paper-${version}.jar`)
  if (existsSync(target)) return target
  const details = await fetchJson(`https://api.papermc.io/v2/projects/paper/versions/${version}`)
  const build = details.builds?.at(-1)
  if (!build) throw createError({ statusCode: 400, statusMessage: `Paper does not provide Minecraft ${version}` })
  await download(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar`, target)
  return target
}

async function downloadFabric(version: string, requestedLoader: string | null, dir: string): Promise<string> {
  const loader = requestedLoader || (await fetchJson('https://meta.fabricmc.net/v2/versions/loader')).find((item: any) => item.stable)?.version
  if (!loader) throw createError({ statusCode: 502, statusMessage: 'Could not find a Fabric loader version' })
  const target = join(dir, `fabric-${version}-${loader}.jar`)
  if (!existsSync(target)) await download(`https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/1.0.1/server/jar`, target)
  return target
}

async function downloadBukkit(kind: 'spigot' | 'craftbukkit', version: string, dir: string): Promise<string> {
  const target = join(dir, `${kind}-${version}.jar`)
  if (!existsSync(target)) await download(`https://download.getbukkit.org/${kind}/${kind}-${version}.jar`, target)
  return target
}

async function downloadCurseForgeServerPack(server: any, dir: string, java: string): Promise<{ command: string; args: string[] }> {
  const apiKey = useRuntimeConfig().curseforgeApiKey
  if (!apiKey) throw createError({ statusCode: 400, statusMessage: 'Set CURSEFORGE_API_KEY before starting a CurseForge modpack' })
  if (!server.modpack_id) throw createError({ statusCode: 400, statusMessage: 'Choose a CurseForge modpack before starting' })
  const marker = join(dir, '.curseforge-serverpack-ready')
  if (!existsSync(marker)) {
    const headers = { 'x-api-key': apiKey }
    const search = await fetchJson(`https://api.curseforge.com/v1/mods/search?gameId=432&classId=4471&slug=${encodeURIComponent(server.modpack_id)}`, headers)
    const mod = search.data?.[0]
    if (!mod) throw createError({ statusCode: 404, statusMessage: 'CurseForge modpack was not found' })
    const candidates = (mod.latestFilesIndexes || []).filter((item: any) => !server.mc_version || item.gameVersion === server.mc_version)
    const fileId = candidates[0]?.fileId || mod.latestFilesIndexes?.[0]?.fileId
    if (!fileId) throw createError({ statusCode: 404, statusMessage: 'No CurseForge file is available for this modpack' })
    const fileResponse = await fetchJson(`https://api.curseforge.com/v1/mods/${mod.id}/files/${fileId}`, headers)
    const serverPackId = fileResponse.data?.serverPackFileId
    if (!serverPackId) throw createError({ statusCode: 400, statusMessage: 'This CurseForge modpack does not publish a server pack' })
    const serverPack = await fetchJson(`https://api.curseforge.com/v1/mods/${mod.id}/files/${serverPackId}`, headers)
    const url = serverPack.data?.downloadUrl
    if (!url) throw createError({ statusCode: 502, statusMessage: 'CurseForge did not provide a download URL for this server pack' })
    const archive = join(dir, 'curseforge-serverpack.zip')
    await download(url, archive, headers)
    try { new AdmZip(archive).extractAllTo(dir, true) }
    catch { throw createError({ statusCode: 502, statusMessage: 'CurseForge server pack could not be extracted' }) }
    writeFileSync(marker, '')
  }
  const runBat = findNamedFile(dir, 'run.bat')
  if (runBat) return { command: 'cmd.exe', args: ['/d', '/s', '/c', `"${runBat}" nogui`] }
  const runSh = findNamedFile(dir, 'run.sh')
  if (runSh) return { command: 'bash', args: [runSh, 'nogui'] }
  const serverJar = findNamedFile(dir, 'server.jar')
  if (serverJar) return { command: java, args: ['-Xms1G', '-Xmx2G', '-jar', serverJar, 'nogui'] }
  throw createError({ statusCode: 400, statusMessage: 'The CurseForge server pack has no supported start script. Upload its server files and run.bat/run.sh.' })
}

async function installAndLaunchModLoader(server: any, dir: string, java: string): Promise<{ command: string; args: string[] }> {
  const isNeoForge = server.type === 'neoforge'
  const rawVersion = String(server.loader_version || '').trim()
  if (!rawVersion) throw createError({ statusCode: 400, statusMessage: `Select a ${isNeoForge ? 'NeoForge' : 'Forge'} version before starting` })
  const loaderVersion = isNeoForge ? rawVersion : (rawVersion.includes(server.mc_version) ? rawVersion : `${server.mc_version}-${rawVersion}`)
  const group = isNeoForge ? 'net/neoforged/neoforge' : 'net/minecraftforge/forge'
  const artifact = isNeoForge ? 'neoforge' : 'forge'
  const marker = join(dir, `.installed-${artifact}-${loaderVersion}`)
  if (!existsSync(marker)) {
    const installer = join(dir, `${artifact}-${loaderVersion}-installer.jar`)
    await download(`https://maven.minecraftforge.net/${group}/${loaderVersion}/${artifact}-${loaderVersion}-installer.jar`, installer)
    await runJava(java, ['-jar', installer, '--installServer'], dir)
    writeFileSync(marker, '')
  }
  return process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'run.bat nogui'] }
    : { command: 'bash', args: ['run.sh', 'nogui'] }
}

function runJava(java: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { cwd, windowsHide: true })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolve() : reject(createError({ statusCode: 500, statusMessage: `Mod loader installation failed (exit ${code})` })))
  })
}

function findNamedFile(directory: string, name: string): string | null {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === name) return target
    if (entry.isDirectory()) { const found = findNamedFile(target, name); if (found) return found }
  }
  return null
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<any> {
  const response = await fetch(url, { headers })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Unable to download server metadata (${response.status})` })
  return response.json()
}

async function download(url: string, target: string, headers?: HeadersInit): Promise<void> {
  mkdirSync(join(target, '..'), { recursive: true })
  const response = await fetch(url, { headers })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Unable to download server file (${response.status})` })
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
}
