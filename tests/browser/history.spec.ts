import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

async function hoverHistoryEndpoint(page: Page, card: Locator, endpoint: 'first' | 'last') {
  const curve = card.locator('.recharts-line-curve, .recharts-area-curve').first();
  await expect(curve).toHaveAttribute('d', /^M/);
  await curve.scrollIntoViewIfNeeded();
  const position = await curve.evaluate((element, endpoint) => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(endpoint === 'first' ? 0 : path.getTotalLength());
    const transform = path.getScreenCTM();
    if (!transform) throw new Error('График не имеет экранных координат');
    const screen = new DOMPoint(point.x, point.y).matrixTransform(transform);
    return { x: screen.x, y: screen.y };
  }, endpoint);
  // Move off the chart first so an unchanged endpoint also emits a mouse move
  // after changing the period or return convention.
  await page.mouse.move(0, 0);
  await page.mouse.move(position.x, position.y);
  const tooltip = card.locator('.recharts-tooltip-wrapper');
  await expect(tooltip).toBeVisible();
  return tooltip;
}

async function exportedSheets(page: Page) {
  await page.getByRole('button', { name: 'Экспорт отчёта' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel с формулами', exact: false }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Не удалось прочитать экспортированный XLSX');
  return XLSX.read(readFileSync(path), { type: 'buffer' }).Sheets;
}

test('индекс имеет базу 100, а реальные котировки не меняются от периода и дивидендов', async ({
  page,
}) => {
  await page.goto('./#overview');
  const card = page.locator('.history-card');
  const display = card.getByRole('group', { name: 'Режим отображения' });
  const index = display.getByRole('button', { name: 'Индекс доходности', exact: true });
  const price = display.getByRole('button', { name: 'Цена акции (₽)', exact: true });
  await expect(index).toHaveAttribute('aria-pressed', 'true');
  await expect(price).toHaveAttribute('aria-pressed', 'false');
  await expect(card.getByRole('heading', { name: 'Индекс стоимости инвестиций' })).toBeVisible();
  await expect(card).toContainText('При смене периода индекс пересчитывается');
  await expect(card.getByRole('application')).toContainText('пунктов');

  for (const period of ['2021', '2023']) {
    await page.getByLabel('Рыночный период').selectOption(period);
    const baseline = await hoverHistoryEndpoint(page, card, 'first');
    await expect(baseline).toContainText(period === '2021' ? '30.12.2021' : '30.12.2022');
    await expect(baseline).toContainText('100,00 пунктов');
    await expect(baseline).not.toContainText('₽');
  }

  await price.click();
  await expect(price).toHaveAttribute('aria-pressed', 'true');
  await expect(index).toHaveAttribute('aria-pressed', 'false');
  await expect(card.getByRole('heading', { name: 'Рыночная цена акции' })).toBeVisible();
  await expect(card.getByRole('application')).toContainText('₽ за акцию');
  await expect(card).toContainText('Дивиденды не учитываются');
  await expect(card).toContainText('1:10');

  for (const period of ['2021', '2023']) {
    await page.getByLabel('Рыночный период').selectOption(period);
    await expect(card).toContainText(period === '2021' ? '30.12.2020' : '30.12.2022');
    for (const kind of ['Ценовая доходность', 'С дивидендами']) {
      await page.getByRole('button', { name: kind, exact: true }).click();
      await expect(price).toHaveAttribute('aria-pressed', 'true');
      const closing = await hoverHistoryEndpoint(page, card, 'last');
      await expect(closing).toContainText('30.12.2025');
      await expect(closing).toContainText('Сбербанк');
      await expect(closing).toContainText('Т-Технологии');
      await expect(closing).toContainText('299,90 ₽');
      await expect(closing).toContainText('328,00 ₽');
      await expect(closing).not.toContainText('пунктов');
    }
  }
});

test('переключение графика сохраняет KPI и все финансовые листы XLSX', async ({ page }) => {
  await page.goto('./#overview');
  const card = page.locator('.history-card');
  await expect(card.getByRole('heading', { name: 'Индекс стоимости инвестиций' })).toBeVisible();
  const kpis = await page.locator('.kpi').allTextContents();
  const sheets = await exportedSheets(page);
  expect(Object.keys(sheets)).toContain('Марковиц');
  expect(Object.keys(sheets)).toContain('Сопоставимые доходности');

  await card.getByRole('button', { name: 'Цена акции (₽)', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Рыночная цена акции' })).toBeVisible();
  expect(await page.locator('.kpi').allTextContents()).toEqual(kpis);
  expect(await exportedSheets(page)).toEqual(sheets);

  await card.getByRole('button', { name: 'Индекс доходности', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Индекс стоимости инвестиций' })).toBeVisible();
  expect(await page.locator('.kpi').allTextContents()).toEqual(kpis);
});

test('подсказки обоих режимов ведут к формулам в существующем справочнике', async ({ page }) => {
  await page.goto('./#overview');
  for (const metric of [
    { id: 'investment-index', name: 'Индекс стоимости инвестиций', mode: 'Индекс доходности' },
    { id: 'share-price', name: 'Рыночная цена акции', mode: 'Цена акции (₽)' },
  ]) {
    const card = page.locator('.history-card');
    await card.getByRole('button', { name: metric.mode, exact: true }).click();
    await card.getByRole('button', { name: `О показателе «${metric.name}»` }).hover();
    const dialog = page.getByRole('dialog', { name: metric.name, exact: true });
    const guide = dialog.getByRole('link', { name: 'Полная формула и пример →' });
    await expect(guide).toHaveAttribute('href', `#guide/${metric.id}`);
    await guide.click();
    await expect(page).toHaveURL(new RegExp(`#guide/${metric.id}$`));
    await expect(
      page.getByRole('heading', { name: 'Формулы и показатели', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: metric.name, exact: true })).toBeVisible();
    await expect(page.locator('.card .katex')).toHaveCount(1);
    await page.getByRole('link', { name: 'К обзору', exact: true }).click();
  }
});

for (const width of [390, 320]) {
  test(`режимы графика читаемы и помещаются на мобильном экране ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./#overview');
    const card = page.locator('.history-card');
    await expect(card.getByRole('heading', { name: 'Индекс стоимости инвестиций' })).toBeVisible();
    const buttons = card.getByRole('group', { name: 'Режим отображения' }).getByRole('button');
    await expect(buttons).toHaveCount(2);
    for (const button of await buttons.all()) {
      expect(
        await button.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
      ).toBeGreaterThanOrEqual(14);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const bounds = await card.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  });
}
