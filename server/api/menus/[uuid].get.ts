import { loadMenuDto } from '../../utils/menu'

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) throw createError({ statusCode: 400, statusMessage: 'uuid required' })
  const menu = await loadMenuDto(uuid)
  if (!menu) throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  return menu
})
