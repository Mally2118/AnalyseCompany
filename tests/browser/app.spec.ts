import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
test('режимы компаний, восемь страниц и изменение модели', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'За цифрами — решения.' })).toBeVisible();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  await page.getByRole('button', { name: 'Т-Технологии', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('192,4');
  await page.getByRole('button', { name: 'Сбербанк', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  await page.getByRole('button', { name: 'Сравнение', exact: true }).click();
  await page.locator('nav').getByRole('link', { name: 'Финансовый анализ' }).click();
  await expect(page.getByRole('heading', { name: 'Финансовый профиль' })).toBeVisible();
  await page.getByRole('button', { name: 'Изменение г/г' }).click();
  await expect(
    page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Финансовые показатели', exact: true }) })
      .locator('table'),
  ).toContainText('п.п.');
  await page.getByRole('button', { name: 'Значения', exact: true }).click();
  await expect(
    page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Финансовые показатели', exact: true }) })
      .locator('table'),
  ).toContainText('287,8');
  await page.locator('nav').getByRole('link', { name: 'Доходность и риск' }).click();
  await expect(
    page.getByRole('heading', { name: 'Сравнение инвестиционных характеристик' }),
  ).toBeVisible();
  await expect(page.locator('table')).toContainText('46');
  await page.locator('nav').getByRole('link', { name: 'Портфель Марковица' }).click();
  const slider = page.getByRole('slider', { name: 'Доля Сбербанка' });
  await page.getByRole('button', { name: 'На графике: максимум Sharpe' }).click();
  await expect(slider).toHaveValue('100');
  await slider.fill('0');
  await expect(page.locator('.weight-labels')).toContainText('0%');
  const initial = await page.locator('.portfolio-result').innerText();
  await slider.fill('100');
  expect(await page.locator('.portfolio-result').innerText()).not.toBe(initial);
  await page.getByRole('button', { name: 'Выбрать минимальный риск' }).click();
  await expect(slider).toHaveValue('66');
  await page.getByRole('button', { name: 'Найти оптимальный портфель' }).click();
  await expect(slider).toHaveValue('100');
  await page.getByRole('button', { name: 'С дивидендами', exact: true }).click();
  await expect(
    page.getByText('Полная доходность T за 2021 не рассчитана:', { exact: false }),
  ).toBeVisible();
  await expect(slider).toHaveValue('100');
  await page.getByLabel('Рыночный период').selectOption('2023');
  await expect(page.locator('main')).not.toContainText(
    'Полная доходность T за 2021 не рассчитана:',
  );
  await page.locator('nav').getByRole('link', { name: 'Калькулятор', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'От модели к вашему капиталу' })).toBeVisible();
  const old = await page.locator('.scenario-value').allTextContents();
  await page.getByLabel('Сумма инвестиций', { exact: true }).fill('250000');
  expect(await page.locator('.scenario-value').allTextContents()).not.toEqual(old);
  await page.getByLabel('Инвестиционный горизонт').fill('3');
  await expect(page.locator('.scenario-grid')).toContainText('3 лет');
  await page.locator('nav').getByRole('link', { name: 'Прогноз 2026' }).click();
  await expect(page.getByRole('heading', { name: 'Прогноз и инвестиционный вывод' })).toBeVisible();
  const price = await page.locator('.scenario-security').first().innerText();
  await page.getByLabel('Изменение EPS', { exact: true }).first().fill('40');
  expect(await page.locator('.scenario-security').first().innerText()).not.toBe(price);
  await page.getByRole('button', { name: 'Сбросить допущения' }).click();
  await expect(page.getByLabel('Изменение EPS', { exact: true }).first()).toHaveValue('-15');
  await page.locator('nav').getByRole('link', { name: 'Устойчивость', exact: true }).click();
  await expect(page.locator('.signal-list')).toHaveCount(2);
  await expect(page.locator('main')).toContainText('Относительно устойчивое');
  await page.locator('nav').getByRole('link', { name: 'Данные и источники' }).click();
  await expect(page.getByRole('heading', { name: 'От документа до результата' })).toBeVisible();
  await page.getByLabel('Компания', { exact: true }).selectOption('T');
  await page.getByLabel('Год', { exact: true }).selectOption('2025');
  await expect(page.locator('tbody tr')).toHaveCount(13);
  expect(errors).toEqual([]);
});
test('XLSX, CSV и печатный PDF содержат данные', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'За цифрами — решения.' })).toBeVisible();
  await page.getByRole('button', { name: 'Экспорт отчёта' }).click();
  const csvPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV — исходные финансы', exact: false }).click();
  const csv = await csvPromise,
    path = await csv.path();
  await csv.saveAs(testInfo.outputPath('InvestAnalytics.csv'));
  expect(readFileSync(path!, 'utf8')).toContain('192.414');
  await page.getByRole('button', { name: 'Экспорт отчёта' }).click();
  const xlsxPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel с формулами', exact: false }).click();
  const xlsx = await xlsxPromise,
    wb = XLSX.read(readFileSync((await xlsx.path())!), { type: 'buffer' });
  await xlsx.saveAs(testInfo.outputPath('InvestAnalytics.xlsx'));
  expect(wb.SheetNames).toContain('Марковиц');
  expect(wb.Sheets['Марковиц'].B2.f).toBe('1-A2');
  expect(wb.SheetNames).toContain('P-E ретроспективный');
  expect(wb.SheetNames).toContain('Сопоставимые доходности');
  expect(wb.Sheets['Сопоставимые доходности'].H2.f).toBe('(G2/F2)^(1/E2)-1');
  await page.getByRole('button', { name: 'Экспорт отчёта' }).click();
  const reportPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF-отчёт', exact: false }).click();
  const report = await reportPromise;
  await expect(report.getByRole('heading', { name: 'InvestAnalytics', exact: true })).toBeVisible();
  await expect(report.locator('svg')).toHaveCount(5);
  await expect(report.locator('body')).toContainText('68,872');
  await expect(report.locator('body')).toContainText('2021-12-30');
  await expect(
    report.getByRole('heading', { name: 'Ретроспективный исторический P/E' }),
  ).toBeVisible();
  const pdf = await report.pdf({
    path: testInfo.outputPath('InvestAnalytics.pdf'),
    format: 'A4',
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.length).toBeGreaterThan(10000);
  await report.close();
});
test('CAGR сравнивается на общих датах, P/E сохраняет пропуски и источники', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Т-Технологии', exact: true }).click();
  const price = page.getByTestId('cagr-price-T'),
    total = page.getByTestId('cagr-total-T');
  await expect(price).toContainText('14,43');
  await expect(total).toContainText('12,91');
  const before = [await price.innerText(), await total.innerText()];
  await expect(page.locator('.analysis-dates')).toContainText('30.12.2021');
  await expect(page.locator('main')).toContainText('6,80%');
  await page.getByRole('button', { name: 'С дивидендами', exact: true }).click();
  expect([await price.innerText(), await total.innerText()]).toEqual(before);
  await page.getByLabel('Рыночный период').selectOption('2023');
  await expect(price).toContainText('8,89');
  await expect(total).toContainText('11,49');
  await expect(page.locator('.analysis-dates')).toContainText('30.12.2022');
  await page.locator('nav').getByRole('link', { name: 'Финансовый анализ' }).click();
  const pe = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Исторический P/E', exact: true }) });
  await expect(pe.locator('tbody tr')).toHaveCount(5);
  await expect(pe.locator('tbody tr').filter({ hasText: '2022' })).toContainText('Нет данных');
  await expect(pe.locator('tbody tr').filter({ hasText: '2023' })).toContainText('Нет данных');
  const last = pe.locator('tbody tr').filter({ hasText: '2025' });
  await expect(last).toContainText('4,76');
  await expect(last.getByRole('link', { name: 'Котировка MOEX' })).toHaveAttribute(
    'href',
    /iss\.moex\.com/,
  );
  await expect(pe).toContainText('ретроспективные');
});
test('оба ползунка, точный ручной ввод и рублёвый вывод синхронизированы', async ({ page }) => {
  await page.goto('./#calculator');
  const slider = page.getByRole('slider', { name: 'Сумма инвестиций — ползунок' });
  const input = page.getByLabel('Сумма инвестиций', { exact: true });
  await expect(input).toHaveValue('100000');
  await expect(slider).toHaveAttribute('min', '10000');
  await expect(slider).toHaveAttribute('max', '1000000');
  await expect(slider).toHaveAttribute('step', '10000');
  const initial = await page.locator('.scenario-value').allTextContents();
  const initialScale = await page.locator('.chart svg text').allTextContents();
  expect(initialScale.some((v) => /000/.test(v))).toBe(true);
  await slider.fill('250000');
  await expect(input).toHaveValue('250000');
  expect(await page.locator('.scenario-value').allTextContents()).not.toEqual(initial);
  await expect(page.locator('.capital-conclusion')).toContainText('250');
  await expect
    .poll(() => page.locator('.chart svg text').allTextContents())
    .not.toEqual(initialScale);
  await expect(page.locator('.chart path.recharts-line-curve').first()).toHaveAttribute('d', /^M/);
  await input.fill('123456');
  await expect(input).toHaveValue('123456');
  await expect(slider).toHaveValue('120000');
  await expect(slider).toHaveAttribute('aria-valuetext', /123.*456/);
  await page.getByRole('slider', { name: 'Доля Сбербанка' }).fill('25');
  await expect(page.locator('.investment-split')).toContainText('30 864');
  await expect(page.locator('.investment-split')).toContainText('92 592');
  await expect(page.locator('.capital-conclusion')).toContainText('123 456');
  const values = await page.locator('.scenario-value').allTextContents();
  await page.getByLabel('Инвестиционный горизонт').fill('2');
  expect(await page.locator('.scenario-value').allTextContents()).not.toEqual(values);
  await expect(page.locator('.capital-conclusion')).toContainText('горизонте 2 лет');
});
test('адаптивность, светлая тема и навигация телефона', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'За цифрами — решения.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Светлая тема' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('nav').getByRole('link', { name: 'Портфель Марковица' }).click();
  await expect(page.getByRole('heading', { name: 'Портфель, который имеет смысл' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/invest-mobile.png', animations: 'disabled', fullPage: true });
});
test('production работает в произвольном подкаталоге и офлайн после кэширования', async ({
  page,
  context,
}) => {
  const missing: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1:4174')) missing.push(r.url());
  });
  await page.goto('./#sources');
  await expect(page.getByRole('heading', { name: 'От документа до результата' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'От документа до результата' })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  expect(missing).toEqual([]);
  await context.setOffline(false);
});
