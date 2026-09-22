export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server || server.status !== 'running')
    throw createError({ statusCode: 400, statusMessage: 'Server is not running' })

  const { command } = await readBody(event)
  if (typeof command !== 'string' || !command.trim() || command.length > 2_048 || /[\0\r\n]/.test(command))
    throw createError({ statusCode: 400, statusMessage: 'Command must be a single line of at most 2,048 characters' })

  if (useNativeRuntime()) {
    sendNativeCommand(id, command)
    return { success: true, command: command.trim(), output: '' }
  }
  if (!server.container_id) throw createError({ statusCode: 400, statusMessage: 'Server container not found' })

  const exec = await getDocker().getContainer(server.container_id).exec({
    AttachStdout: true, AttachStderr: true, Tty: false,
    Cmd: ['rcon-cli', command.trim()],
  })
  const stream = await exec.start({ Detach: false, Tty: false })

  const output = await new Promise<string>((resolve) => {
    let out = ''
    stream.on('data', (chunk: Buffer) => {
      let offset = 0
      while (offset < chunk.length) {
        if (chunk.length < offset + 8) { out += chunk.slice(offset).toString('utf8'); break }
        const size = chunk.readUInt32BE(offset + 4)
        out += chunk.slice(offset + 8, offset + 8 + size).toString('utf8')
        offset += 8 + size
      }
    })
    stream.on('end', () => resolve(out))
    setTimeout(() => resolve(out), 5000)
  })

  return { success: true, command: command.trim(), output: output.replace(/[\x00-\x08\x0B-\x1F]/g, '').trim() }
})
