export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })
  if (server.status !== 'stopped')
    throw createError({ statusCode: 400, statusMessage: 'Stop the server before editing' })

  const body = await readBody(event)
  const validTypes = ['vanilla','fabric','forge','neoforge','paper','spigot','bukkit','curseforge']
  const type = body.type ?? server.type
  if (!validTypes.includes(type)) throw createError({ statusCode: 400, statusMessage: 'Invalid server type' })
  const mcVersion = String(body.mc_version ?? server.mc_version).trim()
  if (!mcVersion) throw createError({ statusCode: 400, statusMessage: 'Minecraft version is required' })
  const port = Number(body.port ?? server.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw createError({ statusCode: 400, statusMessage: 'Port must be between 1 and 65535' })
  const portOwner = await dbQueryOne<any>('SELECT id FROM servers WHERE port = ? AND id != ?', [port, id])
  if (portOwner) throw createError({ statusCode: 409, statusMessage: `Port ${port} is already in use` })
  const viewDistance = rangedInteger(body.view_distance ?? server.view_distance, 2, 32, 'View distance')
  const simulationDistance = rangedInteger(body.simulation_distance ?? server.simulation_distance, 2, 32, 'Simulation distance')
  const idleTimeout = rangedInteger(body.player_idle_timeout ?? server.player_idle_timeout, 0, 2_147_483_647, 'Player idle timeout')
  const opLevel = rangedInteger(body.op_permission_level ?? server.op_permission_level, 1, 4, 'OP permission level')
  const worldTypes = ['normal', 'flat', 'largeBiomes', 'amplified', 'single_biome_surface']
  const worldType = body.world_type ?? server.world_type
  if (!worldTypes.includes(worldType)) throw createError({ statusCode: 400, statusMessage: 'Invalid world type' })
  const initialMemory = rangedInteger(body.initial_memory_mb ?? server.initial_memory_mb, 256, 1_048_576, 'Initial memory')
  const maxMemory = positiveInteger(body.memory_mb ?? server.memory_mb, 'Maximum memory')
  if (initialMemory > maxMemory) throw createError({ statusCode: 400, statusMessage: 'Initial memory cannot exceed maximum memory' })
  const cpuLimit = nonNegativeNumber(body.cpu_limit ?? server.cpu_limit, 'CPU limit')
  const cpuReservation = nonNegativeNumber(body.cpu_reservation ?? server.cpu_reservation, 'CPU reservation')
  const memoryReservation = rangedInteger(body.memory_reservation_mb ?? server.memory_reservation_mb, 0, 1_048_576, 'Memory reservation')
  if (memoryReservation > maxMemory) throw createError({ statusCode: 400, statusMessage: 'Memory reservation cannot exceed maximum memory' })
  const uid = rangedInteger(body.linux_uid ?? server.linux_uid, 0, 2_147_483_647, 'Linux UID')
  const gid = rangedInteger(body.linux_gid ?? server.linux_gid, 0, 2_147_483_647, 'Linux GID')
  const initialTimeout = rangedInteger(body.initial_timeout_seconds ?? server.initial_timeout_seconds, 0, 2_147_483_647, 'Initial timeout')
  const establishedTimeout = rangedInteger(body.established_timeout_seconds ?? server.established_timeout_seconds, 0, 2_147_483_647, 'Established timeout')
  const dependencyMode = body.modrinth_download_dependencies ?? server.modrinth_download_dependencies
  if (!['none', 'required', 'optional'].includes(dependencyMode))
    throw createError({ statusCode: 400, statusMessage: 'Invalid Modrinth dependency mode' })
  const releaseType = body.modrinth_default_version_type ?? server.modrinth_default_version_type
  if (!['release', 'beta', 'alpha'].includes(releaseType))
    throw createError({ statusCode: 400, statusMessage: 'Invalid Modrinth default version type' })

  await dbExec(
    `UPDATE servers SET name=?,type=?,mc_version=?,loader_version=?,fabric_launcher_version=?,modpack_id=?,modpack_name=?,port=?,
     max_players=?,memory_mb=?,motd=?,difficulty=?,gamemode=?,whitelist=?,online_mode=?,pvp=?,world_seed=?,world_type=?,
     view_distance=?,simulation_distance=?,enable_command_blocks=?,player_idle_timeout=?,prevent_proxy_connections=?,op_names=?,
     op_permission_level=?,allow_flight=?,initial_memory_mb=?,cpu_limit=?,cpu_reservation=?,memory_reservation_mb=?,linux_uid=?,linux_gid=?,
     aikar_flags=?,jmx_enabled=?,jvm_options=?,jvm_xx_options=?,system_properties=?,additional_arguments=?,timezone=?,auto_stop_enabled=?,
     auto_pause_enabled=?,initial_timeout_seconds=?,established_timeout_seconds=?,reconnect_interface=?,rolling_logs=?,show_log_timestamps=?,
     curseforge_files=?,modrinth_projects=?,modrinth_download_dependencies=?,modrinth_default_version_type=?,
     updated_at=datetime('now') WHERE id=?`,
    [
      String(body.name ?? server.name).trim(), type, mcVersion,
      body.loader_version ?? server.loader_version, String(body.fabric_launcher_version ?? server.fabric_launcher_version ?? '').trim(),
      body.modpack_id ?? server.modpack_id, body.modpack_name ?? server.modpack_name, port,
      positiveInteger(body.max_players ?? server.max_players, 'Maximum players'),
      maxMemory,
      body.motd ?? server.motd,
      body.difficulty ?? server.difficulty,
      body.gamemode ?? server.gamemode,
      body.whitelist != null ? (body.whitelist ? 1 : 0) : server.whitelist,
      body.online_mode != null ? (body.online_mode ? 1 : 0) : server.online_mode,
      body.pvp != null ? (body.pvp ? 1 : 0) : server.pvp,
      String(body.world_seed ?? server.world_seed ?? '').trim(), worldType,
      viewDistance, simulationDistance,
      body.enable_command_blocks != null ? (body.enable_command_blocks ? 1 : 0) : server.enable_command_blocks,
      idleTimeout,
      body.prevent_proxy_connections != null ? (body.prevent_proxy_connections ? 1 : 0) : server.prevent_proxy_connections,
      String(body.op_names ?? server.op_names ?? '').trim(), opLevel,
      body.allow_flight != null ? (body.allow_flight ? 1 : 0) : server.allow_flight,
      initialMemory, cpuLimit, cpuReservation, memoryReservation, uid, gid,
      body.aikar_flags != null ? (body.aikar_flags ? 1 : 0) : server.aikar_flags,
      body.jmx_enabled != null ? (body.jmx_enabled ? 1 : 0) : server.jmx_enabled,
      String(body.jvm_options ?? server.jvm_options ?? '').trim(), String(body.jvm_xx_options ?? server.jvm_xx_options ?? '').trim(),
      String(body.system_properties ?? server.system_properties ?? '').trim(), String(body.additional_arguments ?? server.additional_arguments ?? '').trim(),
      String(body.timezone ?? server.timezone ?? 'UTC').trim() || 'UTC',
      body.auto_stop_enabled != null ? (body.auto_stop_enabled ? 1 : 0) : server.auto_stop_enabled,
      body.auto_pause_enabled != null ? (body.auto_pause_enabled ? 1 : 0) : server.auto_pause_enabled,
      initialTimeout, establishedTimeout, String(body.reconnect_interface ?? server.reconnect_interface ?? 'eth0').trim() || 'eth0',
      body.rolling_logs != null ? (body.rolling_logs ? 1 : 0) : server.rolling_logs,
      body.show_log_timestamps != null ? (body.show_log_timestamps ? 1 : 0) : server.show_log_timestamps,
      String(body.curseforge_files ?? server.curseforge_files ?? '').trim(), String(body.modrinth_projects ?? server.modrinth_projects ?? '').trim(),
      dependencyMode, releaseType,
      id,
    ]
  )
  return dbQueryOne('SELECT * FROM servers WHERE id = ?', [id])
})

function positiveInteger(value: unknown, label: string): number {
  const result = Number(value)
  if (!Number.isInteger(result) || result < 1)
    throw createError({ statusCode: 400, statusMessage: `${label} must be a positive whole number` })
  return result
}

function rangedInteger(value: unknown, min: number, max: number, label: string): number {
  const result = Number(value)
  if (!Number.isInteger(result) || result < min || result > max)
    throw createError({ statusCode: 400, statusMessage: `${label} must be a whole number between ${min} and ${max}` })
  return result
}

function nonNegativeNumber(value: unknown, label: string): number {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0 || result > 1_000_000)
    throw createError({ statusCode: 400, statusMessage: `${label} must be a non-negative number` })
  return result
}
