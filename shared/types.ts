export type MenuStatus = 'scanning' | 'review' | 'done'

export type MenuItemDto = {
  id: number
  originalName: string
  translatedName: string
  originalDescription: string | null
  translatedDescription: string | null
  originalSection: string
  translatedSection: string
  price: number | null
  priceLabel: string | null
  page: number | null
}

export type OrderLineDto = {
  menuItemId: number
  quantity: number
}

export type MenuDto = {
  uuid: string
  sourceLocale: string
  targetLocale: string
  currency: string
  status: MenuStatus
  items: MenuItemDto[]
  orderLines: OrderLineDto[]
}

export type ExtractPatch = {
  originalName: string
  originalDescription?: string | null
  originalSection: string
  price?: number | null
  priceLabel?: string | null
  page?: number
}

export type MockFrame = {
  index: number
  src: string
  objectPosition: string
  scale: number
  hint: string
  page: number
}
