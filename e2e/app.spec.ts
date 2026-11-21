import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/record')
  await expect(page.locator('.tabbar')).toBeVisible()
})

test('可以记一笔并出现在明细', async ({ page }) => {
  await page.getByRole('button', { name: '8', exact: true }).click()
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await expect(page.locator('.toast')).toContainText('已记一笔')

  await page.goto('/#/ledger')
  await expect(page.locator('.tx-row')).toHaveCount(1)
  await expect(page.locator('.tx-row')).toContainText('8.00')
})

test('界面风格默认折叠，展开后可以切换', async ({ page }) => {
  await page.goto('/#/me')
  await expect(page.locator('.skin-card')).toHaveCount(0)

  await page.locator('.collapse-head').click()
  await expect(page.locator('.skin-card')).toHaveCount(7)

  await page.locator('.skin-card').nth(1).click()
  await expect(page.locator('.collapse-head__meta')).toContainText('墨白')
})

test('账户弹层支持 Esc 关闭', async ({ page }) => {
  await page.locator('.account-chip').click()
  await expect(page.locator('.sheet')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.sheet')).toHaveCount(0)
})

test('可以导入微信账单并标记为未分类', async ({ page }) => {
  await page.goto('/#/me/data')

  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
  const csv = [
    '微信支付账单明细',
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注',
    `${date} 12:30:00,商户消费,便利店,矿泉水,支出,¥3.50,零钱,支付成功,wx-e2e-1,,`,
    `${date} 13:00:00,转账,李四,转账,收入,¥50.00,零钱,已收钱,wx-e2e-2,,`
  ].join('\n')

  await page.locator('.wechat-file-input').setInputFiles({
    name: 'wechat.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8')
  })
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('已导入 2 笔')

  await page.goto('/#/ledger')
  await expect(page.locator('.tx-row')).toHaveCount(2)
  await expect(page.locator('.tx-row').first()).toContainText('未分类')
})
