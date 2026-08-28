import type { MenuItemDto } from '../../shared/types'

export function groupBySection(items: MenuItemDto[]) {
  const order: string[] = []
  const groups = new Map<string, MenuItemDto[]>()
  for (const item of items) {
    const key = item.translatedSection || item.originalSection
    if (!groups.has(key)) {
      order.push(key)
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }
  return order.map(title => ({
    title,
    original: groups.get(title)![0]?.originalSection ?? title,
    items: groups.get(title)!,
  }))
}
