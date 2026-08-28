<template>
  <div class="stage">
    <div class="phone scan-phone">
      <p v-if="pending && !menu" class="boot">Opening scan…</p>
      <p v-else-if="loadError" class="boot">{{ loadError }}</p>

      <template v-else-if="menu">
        <section v-if="mode === 'scan'" class="scan">
          <div class="viewfinder">
            <img
              class="frame"
              :src="frame.src"
              :alt="`Mock camera, booklet page ${frame.page}`"
              :style="{ objectPosition: frame.objectPosition, transform: `scale(${frame.scale})` }"
            >
            <div class="vignette" />
            <div class="scanline" :class="{ paused: !looping }" />
            <div class="corners" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <div class="topbar">
              <span class="pill mock-pill">Mock camera</span>
              <span class="pill">Page {{ frame.page }} · {{ menu.items.length }} items</span>
            </div>
            <p class="hint">{{ pausedReason || frame.hint }}</p>
          </div>

          <div class="sheet" :class="{ tall: sheetTall }">
            <button class="grab" type="button" @click="sheetTall = !sheetTall">
              <span />
            </button>
            <header class="sheet-head">
              <div>
                <p class="kicker">Live extract</p>
                <h2 class="serif">{{ menu.items.length ? 'Dishes as we see them' : 'Aim at the booklet' }}</h2>
              </div>
              <select v-model="locale" class="locale" @change="changeLocale">
                <option v-for="opt in locales" :key="opt.code" :value="opt.code">{{ opt.label }}</option>
              </select>
            </header>

            <div class="sheet-body">
              <p v-if="!sections.length" class="empty">Keep the card in frame. Items will land here.</p>
              <section v-for="group in sections" :key="group.title" class="group">
                <h3>
                  <span class="serif">{{ group.title }}</span>
                  <small v-if="group.original !== group.title">{{ group.original }}</small>
                </h3>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="dish"
                  :class="{ on: quantityFor(item.id, menu.orderLines) > 0 }"
                  @click="toggleItem(item.id)"
                >
                  <span class="dish-copy">
                    <strong>{{ item.translatedName }}</strong>
                    <em>{{ item.originalName }}</em>
                    <small v-if="item.translatedDescription">{{ item.translatedDescription }}</small>
                  </span>
                  <span class="price">{{ formatMoney(item.price, menu.currency, item.priceLabel) }}</span>
                </button>
              </section>
            </div>

            <footer class="sheet-foot">
              <button v-if="pausedReason" class="btn" type="button" @click="resume">Resume</button>
              <button class="btn btn-wine" type="button" :disabled="!menu.items.length" @click="finishScan">
                Done · {{ selectedCount }} selected
              </button>
            </footer>
          </div>
        </section>

        <section v-else-if="mode === 'review'" class="panel">
          <header class="panel-head">
            <button class="text-btn" type="button" @click="backToScan">← Scan more</button>
            <h2 class="serif">Your order</h2>
            <p>Adjust quantities, then hand the phone over.</p>
          </header>
          <div class="sheet-body panel-body">
            <p v-if="!selectedItems.length" class="empty">Nothing selected yet. Go back and tap dishes.</p>
            <div v-for="item in selectedItems" :key="item.id" class="qty-row">
              <div>
                <strong>{{ item.translatedName }}</strong>
                <em>{{ item.originalName }}</em>
              </div>
              <div class="stepper">
                <button type="button" class="icon-btn" @click="setQty(item.id, quantityFor(item.id, menu.orderLines) - 1)">−</button>
                <span>{{ quantityFor(item.id, menu.orderLines) }}</span>
                <button type="button" class="icon-btn" @click="setQty(item.id, quantityFor(item.id, menu.orderLines) + 1)">+</button>
              </div>
            </div>
          </div>
          <footer class="panel-foot">
            <p class="total">{{ formatMoney(total, menu.currency) }}</p>
            <button class="btn btn-wine" type="button" :disabled="!selectedItems.length" @click="showWaiter">
              Show to waiter
            </button>
          </footer>
        </section>

        <section v-else class="ticket">
          <header class="ticket-head">
            <p>Für den Kellner / For the waiter</p>
            <h2 class="serif">Bestellung</h2>
          </header>
          <ol>
            <li v-for="item in selectedItems" :key="item.id">
              <span class="qty">{{ quantityFor(item.id, menu.orderLines) }}×</span>
              <span>
                <strong class="serif">{{ item.originalName }}</strong>
                <em>{{ item.translatedName }}</em>
              </span>
              <span class="price">{{ linePrice(item) }}</span>
            </li>
          </ol>
          <p class="ticket-total">
            <span>Summe</span>
            <strong>{{ formatMoney(total, menu.currency) }}</strong>
          </p>
          <p class="share">{{ shareUrl }}</p>
          <button class="btn" type="button" @click="mode = 'review'">Back to quantities</button>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuDto, MenuItemDto } from '../../../shared/types'
import { MOCK_FRAMES } from '../../../shared/mock-frames'

const route = useRoute()
const uuid = computed(() => String(route.params.uuid))

const menu = ref<MenuDto | null>(null)
const pending = ref(true)
const loadError = ref('')
const mode = ref<'scan' | 'review' | 'waiter'>('scan')
const sheetTall = ref(false)
const frameIndex = ref(0)
const looping = ref(false)
const pausedReason = ref('')
const seenFrames = new Set<number>()
const locale = ref('en')

const locales = [
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
]

const SCAN_CAP_MS = 180_000
let timer: ReturnType<typeof setInterval> | undefined
let startedAt = 0

const frame = computed(() => MOCK_FRAMES[frameIndex.value] ?? MOCK_FRAMES[0])
const sections = computed(() => menu.value ? groupBySection(menu.value.items) : [])
const selectedItems = computed<MenuItemDto[]>(() => {
  if (!menu.value) return []
  return menu.value.items.filter(item => quantityFor(item.id, menu.value!.orderLines) > 0)
})
const selectedCount = computed(() =>
  menu.value?.orderLines.reduce((sum, line) => sum + line.quantity, 0) ?? 0,
)
const total = computed(() => {
  if (!menu.value) return 0
  return selectedItems.value.reduce((sum, item) => {
    const qty = quantityFor(item.id, menu.value!.orderLines)
    return sum + (item.price ?? 0) * qty
  }, 0)
})
const shareUrl = computed(() => (import.meta.client ? `${location.origin}/m/${uuid.value}` : `/m/${uuid.value}`))

function linePrice(item: MenuItemDto) {
  const qty = quantityFor(item.id, menu.value!.orderLines)
  if (item.price == null) return item.priceLabel || '—'
  return formatMoney(item.price * qty, menu.value!.currency)
}

async function refresh() {
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}`)
  locale.value = menu.value.targetLocale
  if (menu.value.status === 'review' || menu.value.status === 'done') {
    mode.value = menu.value.status === 'done' ? 'waiter' : 'review'
  }
}

onMounted(async () => {
  try {
    await refresh()
    if (menu.value?.status === 'scanning') startLoop()
  }
  catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Menu not found'
  }
  finally {
    pending.value = false
  }
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  stopLoop()
  document.removeEventListener('visibilitychange', onVisibility)
})

function onVisibility() {
  if (document.hidden) pause('Paused in the background')
  else if (mode.value === 'scan' && menu.value?.status === 'scanning' && !pausedReason.value) startLoop()
}

function startLoop() {
  looping.value = true
  pausedReason.value = ''
  startedAt = startedAt || Date.now()
  void tick()
  timer = setInterval(() => { void tick() }, 1600)
}

function stopLoop() {
  looping.value = false
  if (timer) clearInterval(timer)
  timer = undefined
}

function pause(reason: string) {
  stopLoop()
  pausedReason.value = reason
}

function resume() {
  startLoop()
}

async function tick() {
  if (!looping.value || !menu.value) return
  if (Date.now() - startedAt >= SCAN_CAP_MS) {
    pause('Scan time cap — resume to continue')
    return
  }

  const current = frameIndex.value
  if (!seenFrames.has(current)) {
    try {
      menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}/extract-tick`, {
        method: 'POST',
        body: { frameIndex: current },
      })
      seenFrames.add(current)
    }
    catch {
      pause('Having trouble reading. Retry.')
      return
    }
  }

  if (frameIndex.value < MOCK_FRAMES.length - 1) {
    frameIndex.value += 1
  }
}

async function changeLocale() {
  if (!menu.value) return
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}`, {
    method: 'PATCH',
    body: { targetLocale: locale.value },
  })
}

async function toggleItem(id: number) {
  if (!menu.value) return
  const next = quantityFor(id, menu.value.orderLines) > 0 ? 0 : 1
  await setQty(id, next)
}

async function setQty(id: number, quantity: number) {
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}/selection`, {
    method: 'PATCH',
    body: { menuItemId: id, quantity: Math.max(0, quantity) },
  })
}

async function finishScan() {
  stopLoop()
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}`, {
    method: 'PATCH',
    body: { status: 'review' },
  })
  mode.value = 'review'
}

async function backToScan() {
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}`, {
    method: 'PATCH',
    body: { status: 'scanning' },
  })
  mode.value = 'scan'
  startLoop()
}

async function showWaiter() {
  menu.value = await $fetch<MenuDto>(`/api/menus/${uuid.value}`, {
    method: 'PATCH',
    body: { status: 'done' },
  })
  mode.value = 'waiter'
}
</script>

<style scoped>
.scan-phone {
  background: #0b0908;
  color: var(--paper);
}

.boot {
  margin: auto;
  padding: 24px;
  text-align: center;
}

.scan {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.viewfinder {
  position: relative;
  flex: 1;
  min-height: 240px;
  overflow: hidden;
  background: #111;
}

.frame {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center;
  transition: object-position 0.9s ease, transform 0.9s ease;
  filter: saturate(0.92) contrast(1.05);
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.45) 100%);
  pointer-events: none;
}

.scanline {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #e7c56a, transparent);
  animation: sweep 2.4s linear infinite;
  opacity: 0.7;
}

.scanline.paused {
  animation-play-state: paused;
  opacity: 0.2;
}

@keyframes sweep {
  from { top: 12%; }
  to { top: 78%; }
}

.corners {
  position: absolute;
  inset: 22px 18px 88px;
  pointer-events: none;
}

.corners span {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2px solid rgba(243, 234, 216, 0.85);
}

.corners span:nth-child(1) { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.corners span:nth-child(2) { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.corners span:nth-child(3) { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.corners span:nth-child(4) { bottom: 0; right: 0; border-left: 0; border-top: 0; }

.topbar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.mock-pill {
  background: var(--wine);
  color: #fff8f0;
}

.hint {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(12, 8, 6, 0.62);
  backdrop-filter: blur(8px);
  font-size: 13px;
}

.sheet {
  background: var(--paper);
  color: var(--ink);
  border-radius: 22px 22px 0 0;
  display: flex;
  flex-direction: column;
  height: 42%;
  min-height: 280px;
  transition: height 0.25s ease;
}

.sheet.tall {
  height: 68%;
}

.grab {
  border: 0;
  background: transparent;
  padding: 10px 0 4px;
}

.grab span {
  display: block;
  width: 42px;
  height: 4px;
  margin: 0 auto;
  border-radius: 999px;
  background: rgba(26, 20, 16, 0.2);
}

.sheet-head,
.panel-head {
  padding: 4px 20px 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.kicker {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wine);
}

h2 {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 560;
}

.locale {
  border: 0;
  background: var(--paper-deep);
  border-radius: 999px;
  padding: 8px 10px;
}

.sheet-body {
  overflow: auto;
  padding: 0 16px 12px;
  flex: 1;
}

.group {
  margin-bottom: 14px;
}

.group h3 {
  margin: 0 0 8px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group h3 small {
  font-weight: 400;
  color: var(--ink-soft);
  text-transform: none;
  letter-spacing: 0;
}

.dish,
.qty-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 8px;
  color: inherit;
}

.dish.on {
  border-color: var(--wine);
  background: #fff6ea;
}

.dish-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dish-copy strong,
.qty-row strong {
  font-weight: 600;
}

.dish-copy em,
.qty-row em,
.ticket em {
  font-style: normal;
  color: var(--ink-soft);
  font-size: 13px;
}

.dish-copy small {
  color: var(--ink-soft);
  margin-top: 2px;
}

.price {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--moss);
  font-weight: 600;
}

.sheet-foot,
.panel-foot {
  padding: 12px 16px 20px;
}

.sheet-foot {
  display: flex;
  gap: 8px;
}

.sheet-foot .btn,
.panel-foot .btn,
.ticket .btn {
  flex: 1;
  width: 100%;
}

.empty {
  color: var(--ink-soft);
}

.panel,
.ticket {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  color: var(--ink);
  min-height: 0;
}

.panel-head p {
  margin: 6px 0 0;
  color: var(--ink-soft);
}

.text-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--wine);
}

.panel-body {
  padding-top: 8px;
}

.qty-row {
  align-items: center;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 600;
}

.ticket {
  padding: 28px 22px 24px;
  background:
    repeating-linear-gradient(
      90deg,
      var(--paper),
      var(--paper) 12px,
      #efe4cc 12px,
      #efe4cc 13px
    );
}

.ticket-head p {
  margin: 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--wine);
}

.ticket ol {
  list-style: none;
  padding: 0;
  margin: 18px 0;
  flex: 1;
  overflow: auto;
}

.ticket li {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px dashed rgba(26, 20, 16, 0.18);
  align-items: start;
}

.ticket .qty,
.ticket strong.serif {
  font-size: 22px;
}

.ticket-total {
  display: flex;
  justify-content: space-between;
  font-size: 22px;
  margin: 8px 0 16px;
}

.share {
  font-size: 11px;
  color: var(--ink-soft);
  word-break: break-all;
}
</style>
