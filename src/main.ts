import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useLedgerStore } from './stores/useLedger'
import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

async function boot(): Promise<void> {
  const store = useLedgerStore(pinia)
  try {
    await store.bootstrap()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const root = document.getElementById('app')
    if (root) {
      root.innerHTML = `<div style="padding:24px;font-family:system-ui;color:#16181d">
        <h1 style="font-size:18px">无法初始化本地数据库</h1>
        <p style="color:#5b6270;line-height:1.6">${message}</p>
        <p style="color:#5b6270;line-height:1.6">Free Ledger 依赖浏览器的 IndexedDB。请确认未使用无痕模式，并允许站点存储数据。</p>
      </div>`
    }
    return
  }
  app.mount('#app')
}

boot()
