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

  await dbExec(
    `UPDATE servers SET name=?,type=?,mc_version=?,loader_version=?,modpack_id=?,modpack_name=?,port=?,
     max_players=?,memory_mb=?,motd=?,difficulty=?,gamemode=?,whitelist=?,online_mode=?,updated_at=datetime('now') WHERE id=?`,
    [
      String(body.name ?? server.name).trim(), type, mcVersion,
      body.loader_version ?? server.loader_version, body.modpack_id ?? server.modpack_id, body.modpack_name ?? server.modpack_name, port,
      positiveInteger(body.max_players ?? server.max_players, 'Maximum players'),
      positiveInteger(body.memory_mb ?? server.memory_mb, 'Memory'),
      body.motd ?? server.motd,
      body.difficulty ?? server.difficulty,
      body.gamemode ?? server.gamemode,
      body.whitelist != null ? (body.whitelist ? 1 : 0) : server.whitelist,
      body.online_mode != null ? (body.online_mode ? 1 : 0) : server.online_mode,
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
