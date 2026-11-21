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
