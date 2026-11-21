// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'
import { resetDb } from '@/db/init'
import { db } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'

async function mountApp(): Promise<ReturnType<typeof mount>> {
  const pinia = createPinia()
  await useLedgerStore(pinia).bootstrap()
  await router.push('/record')
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(async () => {
  await resetDb()
})

describe('应用冒烟', () => {
  it('渲染底部导航与记账页', async () => {
    const wrapper = await mountApp()
    const text = wrapper.text()
    for (const label of ['记账', '明细', '统计', '我的']) {
      expect(text).toContain(label)
    }
    expect(text).toContain('支出')
    expect(text).toContain('保存')
    expect(text).toContain('餐饮')
  })

  it('可以在界面上记一笔', async () => {
    const wrapper = await mountApp()
    const buttons = wrapper.findAll('button')
    const findKey = (label: string) => buttons.find((button) => button.text() === label)!

    await findKey('8').trigger('click')
    await findKey('保存').trigger('click')
    await flushPromises()

    expect(await db.transactions.count()).toBe(1)
    const transaction = await db.transactions.toCollection().first()
    expect(transaction?.amountCents).toBe(800)
    expect(transaction?.kind).toBe('expense')
  })

  it('明细页空状态', async () => {
    const wrapper = await mountApp()
    await router.push('/ledger')
    await flushPromises()
    expect(wrapper.text()).toContain('本月还没有记录')
  })

  it('统计页显示分类占比', async () => {
    const wrapper = await mountApp()
    await router.push('/stats')
    await flushPromises()
    expect(wrapper.text()).toContain('分类占比')
    expect(wrapper.text()).toContain('近 6 个月趋势')
  })

  it('我的页显示隐私承诺', async () => {
    const wrapper = await mountApp()
    await router.push('/me')
    await flushPromises()
    expect(wrapper.text()).toContain('一纸账本，只属于你')
    expect(wrapper.text()).toContain('关于 Free Ledger')
  })
})
