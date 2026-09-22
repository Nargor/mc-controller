export default defineEventHandler(async () =>
  dbQuery('SELECT * FROM servers ORDER BY created_at DESC')
)
