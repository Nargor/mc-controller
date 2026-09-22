export default defineEventHandler((event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'same-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')

  const proto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto === 'https' || event.node?.req?.socket?.encrypted)
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
})
