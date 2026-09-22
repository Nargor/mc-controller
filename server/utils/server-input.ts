export const SERVER_TYPES = ['vanilla', 'fabric', 'forge', 'neoforge', 'paper', 'spigot', 'bukkit', 'curseforge'] as const

export function validMinecraftVersion(value: unknown): string {
  const version = String(value ?? '').trim()
  // Supports releases, snapshots and pre/rc names while rejecting path and
  // control-character injection into native download filenames and Docker env.
  if (!/^[A-Za-z0-9._+-]{1,64}$/.test(version))
    throw createError({ statusCode: 400, statusMessage: 'Invalid Minecraft version' })
  return version
}

export function validServerPort(value: unknown): number {
  const port = Number(value)
  const config = useRuntimeConfig()
  const start = Number(config.portRangeStart)
  const end = Number(config.portRangeEnd)
  if (!Number.isInteger(port) || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 65535 || start > end || port < start || port > end)
    throw createError({ statusCode: 400, statusMessage: `Port must be within the configured range (${start}-${end})` })
  return port
}

export function validText(value: unknown, fallback: string, maxLength: number, label: string): string {
  const text = value === undefined || value === null ? fallback : String(value).trim()
  if (!text || text.length > maxLength || /[\0\r\n]/.test(text))
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid` })
  return text
}
