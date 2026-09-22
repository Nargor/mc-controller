import { ChildProcess, execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import AdmZip from 'adm-zip'

type NativeInstance = { process: ChildProcess; output: EventEmitter; timestamps: boolean }
const instances = new Map<string, NativeInstance>()
const portableJava = new Map<number, Promise<string>>()
const logHistory = new Map<string, string[]>()

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

export function getNativeLogHistory(id: string): string[] {
  return logHistory.get(id) || []
}

function emitNativeLog(id: string, output: EventEmitter, line: string, timestamps = false): void {
  if (timestamps && !/^\[\d{2}:\d{2}:\d{2}\]/.test(line)) {
    line = `[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] ${line}`
  }
  const history = logHistory.get(id) || []
  history.push(line)
  if (history.length > 1_000) history.splice(0, history.length - 1_000)
  logHistory.set(id, history)
  output.emit('line', line)
}

export async function startNativeServer(server: any): Promise<number | undefined> {
  if (isNativeRunning(server.id)) return instances.get(server.id)?.process.pid
  const dataPath = getServerDataPath(server.id)
  await writeServerProperties(dataPath, server)
  await installNativeManagedMods(server, dataPath)
  const requiredJava = await detectRequiredJava(server.mc_version, dataPath)
  const java = await getJavaExecutable(requiredJava)
  const launcher = await getNativeLauncher(server, dataPath, java)
  const output = new EventEmitter()
  const child = spawn(launcher.command, launcher.args, {
    cwd: dataPath, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    // Forge/NeoForge run.bat invokes `java`; make the portable JRE visible to it.
    env: { ...process.env, Path: `${dirname(java)};${process.env.Path || ''}` },
  })
  const timestamps = Boolean(server.show_log_timestamps)
  instances.set(server.id, { process: child, output, timestamps })

  logHistory.set(server.id, [])
  const emit = (chunk: Buffer) => chunk.toString('utf8').split(/\r?\n/).filter(Boolean).forEach(line => emitNativeLog(server.id, output, line, timestamps))
  child.stdout?.on('data', emit)
  child.stderr?.on('data', emit)
  child.once('error', error => emitNativeLog(server.id, output, `Unable to start Java: ${error.message}`, timestamps))
  child.once('exit', (code) => {
    emitNativeLog(server.id, output, `Process exited${code === null ? '' : ` with code ${code}`}`, timestamps)
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
  emitNativeLog(id, instance.output, `> ${command.trim()}`, instance.timestamps)
}

/** Read actual Java process usage for the local Windows runner. */
export async function getNativeStats(id: string): Promise<{ cpuPercent: number; memoryMB: number }> {
  const pid = instances.get(id)?.process.pid
  if (!pid || !isNativeRunning(id)) return { cpuPercent: 0, memoryMB: 0 }
  if (process.platform !== 'win32') return { cpuPercent: 0, memoryMB: 0 }

  // Forge/NeoForge starts through cmd/run.bat, so include every descendant of
  // the launcher process rather than reporting the tiny cmd.exe wrapper only.
  const script = [
    `$ids = [System.Collections.Generic.List[int]]::new(); $ids.Add(${Number(pid)})`,
    '$changed = $true',
    'while ($changed) { $changed = $false; Get-CimInstance Win32_Process | Where-Object { $ids -contains [int]$_.ParentProcessId } | ForEach-Object { if (-not ($ids -contains [int]$_.ProcessId)) { $ids.Add([int]$_.ProcessId); $changed = $true } } }',
    '$items = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $ids -contains [int]$_.IDProcess }',
    '$cpu = [double](($items | Measure-Object -Property PercentProcessorTime -Sum).Sum); $memory = [double](($items | Measure-Object -Property WorkingSet -Sum).Sum)',
    '[PSCustomObject]@{ cpu = $cpu; memory = $memory } | ConvertTo-Json -Compress',
  ].join('; ')

  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5_000 }, (error, stdout) => error ? reject(error) : resolve(stdout))
    })
    const stats = JSON.parse(output.trim() || '{}')
    return {
      cpuPercent: Math.round((Number(stats.cpu) || 0) * 10) / 10,
      memoryMB: Math.round((Number(stats.memory) || 0) / (1024 * 1024)),
    }
  } catch {
    return { cpuPercent: 0, memoryMB: 0 }
  }
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

async function writeServerProperties(dataPath: string, server: any): Promise<void> {
  writeFileSync(join(dataPath, 'eula.txt'), 'eula=true\n')
  const properties = [
    `server-port=${server.port}`, `max-players=${server.max_players}`, `motd=${server.motd}`,
    `difficulty=${server.difficulty}`, `gamemode=${server.gamemode}`,
    `white-list=${server.whitelist ? 'true' : 'false'}`, `online-mode=${server.online_mode ? 'true' : 'false'}`,
    `pvp=${server.pvp ? 'true' : 'false'}`, `level-seed=${server.world_seed || ''}`, `level-type=${server.world_type || 'normal'}`,
    `view-distance=${server.view_distance || 10}`, `simulation-distance=${server.simulation_distance || 10}`,
    `enable-command-block=${server.enable_command_blocks ? 'true' : 'false'}`,
    `player-idle-timeout=${server.player_idle_timeout || 0}`,
    `prevent-proxy-connections=${server.prevent_proxy_connections ? 'true' : 'false'}`,
    `op-permission-level=${server.op_permission_level || 4}`, `allow-flight=${server.allow_flight ? 'true' : 'false'}`,
  ].join('\n') + '\n'
  writeFileSync(join(dataPath, 'server.properties'), properties)
  await writeOpsFile(dataPath, server)
}

async function writeOpsFile(dataPath: string, server: any): Promise<void> {
  const names = [...new Set(String(server.op_names || '').split(',').map(name => name.trim()).filter(Boolean))]
  const ops = await Promise.all(names.map(async name => ({
    uuid: await resolvePlayerUuid(name, Boolean(server.online_mode)),
    name,
    level: Number(server.op_permission_level) || 4,
    bypassesPlayerLimit: false,
  })))
  writeFileSync(join(dataPath, 'ops.json'), JSON.stringify(ops, null, 2))
}

async function resolvePlayerUuid(name: string, onlineMode: boolean): Promise<string> {
  if (onlineMode) {
    try {
      const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`)
      if (response.ok) {
        const profile = await response.json() as { id?: string }
        if (profile.id && /^[0-9a-f]{32}$/i.test(profile.id)) {
          return profile.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
        }
      }
    } catch { /* Use offline UUID below when profile lookup is unreachable. */ }
  }
  const hex = createHash('md5').update(`OfflinePlayer:${name}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-3${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function getNativeLauncher(server: any, dataPath: string, java: string): Promise<{ command: string; args: string[] }> {
  const initialMemory = `${Math.max(256, Number(server.initial_memory_mb) || 1024)}M`
  const maximumMemory = `${Math.max(256, Number(server.memory_mb) || 1024)}M`
  const javaArgs = [`-Xms${initialMemory}`, `-Xmx${maximumMemory}`, ...getNativeJvmOptions(server)]
  let jar: string
  switch (server.type) {
    case 'vanilla': jar = await downloadVanilla(server.mc_version, dataPath); break
    case 'paper': jar = await downloadPaper(server.mc_version, dataPath); break
    case 'fabric': jar = await downloadFabric(server.mc_version, server.loader_version, dataPath, server.fabric_launcher_version); break
    case 'spigot': jar = await downloadBukkit('spigot', server.mc_version, dataPath); break
    case 'bukkit': jar = await downloadBukkit('craftbukkit', server.mc_version, dataPath); break
    case 'forge':
    case 'neoforge': return installAndLaunchModLoader(server, dataPath, java)
    case 'curseforge': return downloadCurseForgeServerPack(server, dataPath, java)
    default: throw createError({ statusCode: 400, statusMessage: 'Unsupported server type' })
  }
  return { command: java, args: [...javaArgs, '-jar', jar, 'nogui', ...splitArguments(server.additional_arguments)] }
}

function getNativeJvmOptions(server: any): string[] {
  const options = [
    ...splitArguments(server.jvm_options),
    ...splitArguments(server.jvm_xx_options).map((option) => option.startsWith('-XX:') ? option : `-XX:${option}`),
    ...String(server.system_properties || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(value => value.startsWith('-D') ? value : `-D${value}`),
    `-Duser.timezone=${server.timezone || 'UTC'}`,
  ]
  if (server.aikar_flags) {
    options.push(
      '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC', '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M',
      '-XX:G1ReservePercent=20', '-XX:G1HeapWastePercent=5', '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15', '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5', '-XX:SurvivorRatio=32', '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
    )
  }
  if (server.jmx_enabled) options.push('-Dcom.sun.management.jmxremote')
  return [...new Set(options)]
}

/** Supports one option per line as well as simple quoted values. */
function splitArguments(value: unknown): string[] {
  const input = String(value || '').trim()
  if (!input) return []
  return input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(item => item.replace(/^(?:"|')|(?:"|')$/g, '')) || []
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

async function downloadFabric(version: string, requestedLoader: string | null, dir: string, requestedLauncher?: string | null): Promise<string> {
  const loader = requestedLoader || (await fetchJson('https://meta.fabricmc.net/v2/versions/loader')).find((item: any) => item.stable)?.version
  if (!loader) throw createError({ statusCode: 502, statusMessage: 'Could not find a Fabric loader version' })
  const launcher = requestedLauncher || '1.0.1'
  const target = join(dir, `fabric-${version}-${loader}-${launcher}.jar`)
  if (!existsSync(target)) await download(`https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${launcher}/server/jar`, target)
  return target
}

/** Native development uses the same Modrinth/CurseForge declarations as Docker. */
async function installNativeManagedMods(server: any, dataPath: string): Promise<void> {
  const modrinth = splitList(server.modrinth_projects)
  const curseforge = splitList(server.curseforge_files)
  if (!modrinth.length && !curseforge.length) return
  const destination = join(dataPath, ['fabric', 'forge', 'neoforge', 'curseforge'].includes(server.type) ? 'mods' : 'plugins')
  mkdirSync(destination, { recursive: true })
  const installed = new Set<string>()
  for (const entry of modrinth) await downloadModrinthProject(entry, server, destination, installed)
  if (curseforge.length) await downloadCurseForgeFiles(curseforge, server, destination)
}

function splitList(value: unknown): string[] {
  return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(item => item && !item.startsWith('#'))
}

async function downloadModrinthProject(entry: string, server: any, destination: string, installed: Set<string>): Promise<void> {
  const optionalProject = entry.endsWith('?')
  const raw = entry.replace(/\?$/, '')
  const parts = raw.split(':')
  const prefixes = ['fabric', 'forge', 'neoforge', 'paper', 'spigot', 'bukkit', 'datapack', 'resourcepack']
  const project = prefixes.includes(parts[0].toLowerCase()) ? parts[1] : parts[0]
  if (!project || installed.has(project)) return
  installed.add(project)
  const loader = prefixes.includes(parts[0].toLowerCase()) ? parts[0] : nativeModrinthLoader(server.type)
  const params = new URLSearchParams({ game_versions: JSON.stringify([server.mc_version]) })
  if (loader) params.set('loaders', JSON.stringify([loader]))
  const versions = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(project)}/version?${params}`) as any[]
  const permitted = server.modrinth_default_version_type === 'alpha' ? ['release', 'beta', 'alpha']
    : server.modrinth_default_version_type === 'beta' ? ['release', 'beta'] : ['release']
  const version = versions.find(item => permitted.includes(item.version_type))
  if (!version) {
    if (optionalProject) return
    throw createError({ statusCode: 400, statusMessage: `Modrinth project ${project} has no compatible version` })
  }
  const file = version.files?.find((item: any) => item.primary) || version.files?.[0]
  if (!file?.url) throw createError({ statusCode: 400, statusMessage: `Modrinth project ${project} has no downloadable file` })
  await download(file.url, join(destination, file.filename || `${project}.jar`))

  const mode = server.modrinth_download_dependencies || 'none'
  if (mode !== 'none') {
    const allowed = mode === 'optional' ? ['required', 'optional'] : ['required']
    for (const dependency of version.dependencies || []) {
      if (dependency.project_id && allowed.includes(dependency.dependency_type)) {
        await downloadModrinthProject(dependency.project_id, server, destination, installed)
      }
    }
  }
}

function nativeModrinthLoader(type: string): string | null {
  if (type === 'neoforge') return 'neoforge'
  if (['fabric', 'forge', 'paper', 'spigot', 'bukkit'].includes(type)) return type
  return null
}

async function downloadCurseForgeFiles(entries: string[], server: any, destination: string): Promise<void> {
  const apiKey = useRuntimeConfig().curseforgeApiKey
  if (!apiKey) throw createError({ statusCode: 400, statusMessage: 'Set CURSEFORGE_API_KEY before downloading CurseForge files' })
  const headers = { 'x-api-key': apiKey }
  for (const entry of entries) {
    const urlProject = entry.match(/curseforge\.com\/minecraft\/mc-mods\/([^/]+)/i)?.[1]
    const urlFile = entry.match(/\/files\/(\d+)$/)?.[1]
    const pair = entry.match(/^(.+):(\d+)$/)
    const project = urlProject || pair?.[1] || entry
    const pinnedFileId = urlFile || pair?.[2]
    let mod: any
    if (/^\d+$/.test(project)) mod = await fetchJson(`https://api.curseforge.com/v1/mods/${project}`, headers).then((result: any) => result.data)
    else mod = (await fetchJson(`https://api.curseforge.com/v1/mods/search?gameId=432&slug=${encodeURIComponent(project)}`, headers)).data?.[0]
    if (!mod) throw createError({ statusCode: 404, statusMessage: `CurseForge project ${project} was not found` })
    const fileId = pinnedFileId || mod.latestFilesIndexes?.find((item: any) => item.gameVersion === server.mc_version)?.fileId || mod.latestFilesIndexes?.[0]?.fileId
    if (!fileId) throw createError({ statusCode: 400, statusMessage: `CurseForge project ${project} has no compatible file` })
    const file = (await fetchJson(`https://api.curseforge.com/v1/mods/${mod.id}/files/${fileId}`, headers)).data
    if (!file?.downloadUrl) throw createError({ statusCode: 502, statusMessage: `CurseForge did not provide a download for ${project}` })
    await download(file.downloadUrl, join(destination, file.fileName || `${mod.id}-${fileId}.jar`), headers)
  }
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
