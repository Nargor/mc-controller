export async function getNextAvailablePort(): Promise<number> {
  const config = useRuntimeConfig()
  const start = config.portRangeStart || 25565
  const end   = config.portRangeEnd   || 25600
  const rows  = await dbQuery<any>('SELECT port FROM servers')
  const used  = rows.map((r: any) => Number(r.port))

  for (let port = start; port <= end; port++) {
    if (!used.includes(port)) return port
  }
  throw new Error(`No available ports in range ${start}-${end}`)
}
