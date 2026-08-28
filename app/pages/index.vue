<template>
  <div class="stage">
    <div class="phone landing">
      <header class="hero">
        <p class="eyebrow">SmartMenu · mock camera</p>
        <h1 class="serif">Point at the card.<br>Order in their language.</h1>
        <p class="lede">
          A diner pans a booklet. Dishes appear translated. The waiter still reads the original names.
        </p>
      </header>

      <div class="preview" aria-hidden="true">
        <img src="/mock-frames/page-1.jpg" alt="">
        <div class="preview-fade" />
      </div>

      <footer class="cta">
        <p class="fixture">Fixture: Gasthaus zur Linde · 2-page German booklet</p>
        <button class="btn btn-wine" :disabled="starting" @click="startScan">
          {{ starting ? 'Opening the camera…' : 'Scan the menu' }}
        </button>
        <p v-if="error" class="err">{{ error }}</p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
const starting = ref(false)
const error = ref('')

async function startScan() {
  starting.value = true
  error.value = ''
  try {
    const menu = await $fetch<{ uuid: string }>('/api/menus', { method: 'POST' })
    await navigateTo(`/m/${menu.uuid}`)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start a scan'
    starting.value = false
  }
}
</script>

<style scoped>
.landing {
  background:
    linear-gradient(180deg, #241910 0 42%, var(--paper) 42%);
  color: var(--paper);
}

.hero {
  padding: 36px 28px 12px;
}

.eyebrow {
  margin: 0 0 16px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
}

h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.08;
  font-weight: 560;
}

.lede {
  margin: 14px 0 0;
  color: rgba(243, 234, 216, 0.78);
  line-height: 1.45;
}

.preview {
  position: relative;
  margin: 8px 24px 0;
  height: 280px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.preview img {
  width: 100%;
  height: 140%;
  object-fit: cover;
  object-position: 50% 18%;
  transform: scale(1.05);
}

.preview-fade {
  position: absolute;
  inset: auto 0 0;
  height: 80px;
  background: linear-gradient(transparent, var(--paper));
}

.cta {
  margin-top: auto;
  padding: 20px 28px 32px;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fixture {
  margin: 0;
  font-size: 13px;
  color: var(--ink-soft);
}

.err {
  margin: 0;
  color: var(--wine);
  font-size: 13px;
}
</style>
