import { v4 as uuidv4 } from 'uuid'
import { SERVER_TYPES, validMinecraftVersion, validServerPort, validText } from '../../utils/server-input'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name?.trim())  throw createError({ statusCode: 400, statusMessage: 'Server name is required' })
  if (!body.type)          throw createError({ statusCode: 400, statusMessage: 'Server type is required' })
  if (!body.mc_version)   throw createError({ statusCode: 400, statusMessage: 'Minecraft version is required' })

  if (!SERVER_TYPES.includes(body.type))
    throw createError({ statusCode: 400, statusMessage: `Invalid server type: ${body.type}` })

  const port = body.port ? Number(body.port) : await getNextAvailablePort()
  validServerPort(port)
  if (await dbQueryOne('SELECT id FROM servers WHERE port = ?', [port]))
    throw createError({ statusCode: 409, statusMessage: `Port ${port} is already in use` })

  const id = uuidv4()
  await dbExec(
    `INSERT INTO servers
       (id,name,type,mc_version,loader_version,modpack_id,modpack_name,port,
        max_players,memory_mb,motd,difficulty,gamemode,whitelist,online_mode)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, validText(body.name, '', 100, 'Server name'), body.type, validMinecraftVersion(body.mc_version),
      body.loader_version || null, body.modpack_id || null, body.modpack_name || null,
      port,
      positiveInteger(body.max_players, 20, 'Maximum players'), positiveInteger(body.memory_mb, 1024, 'Memory'),
      validText(body.motd, 'A Minecraft Server', 256, 'Message of the day'),
      body.difficulty || 'normal', body.gamemode || 'survival',
      body.whitelist ? 1 : 0, body.online_mode !== false ? 1 : 0,
    ]
  )
  return dbQueryOne('SELECT * FROM servers WHERE id = ?', [id])
})

function positiveInteger(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === '') return fallback
  const result = Number(value)
  if (!Number.isInteger(result) || result < 1)
    throw createError({ statusCode: 400, statusMessage: `${label} must be a positive whole number` })
  return result
}
