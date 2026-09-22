export default defineWebSocketHandler({
  async open(peer) {
    const url = peer.request?.url || ''
    const match = url.match(/\/api\/servers\/([^/]+)\/console/)
    const id = match?.[1]
    if (!id) { peer.close(1008, 'Invalid ID'); return }

    if (useNativeRuntime()) {
      for (const line of getNativeLogHistory(id)) peer.send(JSON.stringify({ type: 'log', data: line }))
      const cleanup = subscribeNativeLogs(id, (line) => peer.send(JSON.stringify({ type: 'log', data: line })))
      if (!cleanup) { peer.send(JSON.stringify({ type: 'error', data: 'Server is not running' })); peer.close(); return }
      ;(peer as any)._cleanup = cleanup
      return
    }

    const server = await dbQueryOne<any>('SELECT container_id, show_log_timestamps FROM servers WHERE id = ?', [id])
    if (!server?.container_id) {
      peer.send(JSON.stringify({ type: 'error', data: 'Server not started' }))
      peer.close(); return
    }

    let closed = false
    try {
      const logStream = await getDocker().getContainer(server.container_id).logs({
        follow: true, stdout: true, stderr: true, tail: 150,
        timestamps: Boolean(server.show_log_timestamps),
      })

      logStream.on('data', (chunk: Buffer) => {
        if (closed) return
        let offset = 0
        while (offset < chunk.length) {
          if (chunk.length < offset + 8) {
            const raw = chunk.slice(offset).toString('utf8').trim()
            if (raw) peer.send(JSON.stringify({ type: 'log', data: raw }))
            break
          }
          const size = chunk.readUInt32BE(offset + 4)
          if (size > 0) {
            const line = chunk.slice(offset + 8, offset + 8 + size).toString('utf8')
            if (line.trim()) peer.send(JSON.stringify({ type: 'log', data: line }))
          }
          offset += 8 + size
        }
      })
      logStream.on('end', () => { if (!closed) peer.send(JSON.stringify({ type: 'end', data: 'Stream ended' })) })
      logStream.on('error', (e: Error) => { if (!closed) peer.send(JSON.stringify({ type: 'error', data: e.message })) })
      ;(peer as any)._cleanup = () => { closed = true; try { logStream.destroy() } catch {} }
    } catch (e: any) {
      peer.send(JSON.stringify({ type: 'error', data: e.message }))
    }
  },
  message() {},
  close(peer) { ;(peer as any)._cleanup?.() },
  error(peer) { ;(peer as any)._cleanup?.() },
})
