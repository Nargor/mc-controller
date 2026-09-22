export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'mc_session')
  if (token) await deleteSession(token)
  deleteCookie(event, 'mc_session')
  return { success: true }
})
