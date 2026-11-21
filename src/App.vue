<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useLedgerStore } from '@/stores/useLedger'
import { resolveSkin, skinMeta } from '@/services/skins'
import TabBar from '@/components/TabBar.vue'
import ToastHost from '@/components/ToastHost.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'

const store = useLedgerStore()

function applyTheme(): void {
  const theme = store.settings.theme
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  const skin = skinMeta(resolveSkin(store.settings.skin))
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? skin.themeColorDark : skin.themeColor)
}

function applySkin(): void {
  document.documentElement.dataset.skin = resolveSkin(store.settings.skin)
}

watch(() => store.settings.theme, applyTheme, { immediate: true })
watch(() => store.settings.skin, () => {
  applySkin()
  applyTheme()
}, { immediate: true })

onMounted(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (store.settings.theme === 'system') applyTheme()
  })
})
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <TabBar />
  </div>
  <ToastHost />
  <ConfirmHost />
</template>
