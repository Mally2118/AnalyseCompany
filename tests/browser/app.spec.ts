import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
test('режимы компаний, восемь страниц и изменение модели', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Обзор' })).toBeVisible();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  await page.getByRole('button', { name: 'Т-Технологии', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('192,4');
  await page.getByRole('button', { name: 'Сбербанк', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  await page.getByRole('button', { name: 'Сравнение', exact: true }).click();
  await page.locator('nav').getByRole('link', { name: 'Финансовый анализ' }).click();
  await expect(page.getByRole('heading', { name: 'Финансовый анализ' })).toBeVisible();
  await expect(page.locator('.chart')).toHaveCount(2);
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
  await page.getByText('Подробнее', { exact: true }).click();
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
  await page.getByRole('button', { name: 'Минимальный риск', exact: true }).click();
  await expect(slider).toHaveValue('66');
  await page.getByRole('button', { name: 'Максимальный Шарп' }).click();
  await expect(slider).toHaveValue('100');
  await page.getByRole('button', { name: 'С дивидендами', exact: true }).click();
  await expect(page.locator('.analysis-dates')).toContainText('Общий период сокращён');
  await expect(slider).toHaveValue('100');
  await page.getByLabel('Рыночный период').selectOption('2023');
  await expect(page.locator('.analysis-dates')).not.toContainText('Общий период сокращён');
  await page.locator('nav').getByRole('link', { name: 'Калькулятор', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Калькулятор' })).toBeVisible();
  await page.getByLabel('Режим расчёта').selectOption('scenario');
  const old = await page.locator('.scenario-value').allTextContents();
  await page.getByLabel('Сумма инвестиций', { exact: true }).fill('250000');
  expect(await page.locator('.scenario-value').allTextContents()).not.toEqual(old);
  await page.getByLabel('Инвестиционный горизонт', { exact: true }).fill('3');
  await expect(page.locator('.scenario-grid')).toContainText('3 лет');
  await page.locator('nav').getByRole('link', { name: 'Прогноз 2026' }).click();
  await expect(page.getByRole('heading', { name: 'Прогноз 2026' })).toBeVisible();
  await expect(page.getByLabel('Изменение EPS', { exact: true })).toHaveCount(0);
  await page.getByText('Настроить сценарий', { exact: true }).first().click();
  const price = await page.locator('.scenario-security').first().innerText();
  await page.getByLabel('Изменение EPS', { exact: true }).first().fill('40');
  expect(await page.locator('.scenario-security').first().innerText()).not.toBe(price);
  await page.getByRole('button', { name: 'Сбросить допущения' }).click();
  await expect(page.getByLabel('Изменение EPS', { exact: true }).first()).toHaveValue('-15');
  await page.locator('nav').getByRole('link', { name: 'Устойчивость', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Устойчивость', exact: true })).toBeVisible();
  await expect(page.getByText('Шесть критериев', { exact: true })).toHaveCount(2);
  await expect(page.locator('.signal-list')).toHaveCount(0);
  for (const summary of await page.getByText('Шесть критериев', { exact: true }).all())
    await summary.click();
  await expect(page.locator('.signal-list')).toHaveCount(2);
  await expect(page.locator('main')).toContainText('Относительно устойчивое');
  await page.locator('nav').getByRole('link', { name: 'Данные и источники' }).click();
  await expect(page.getByRole('heading', { name: 'Данные и источники' })).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
  await page.getByText('Финансовая отчётность', { exact: true }).click();
  await page.getByText('Показать исходную таблицу', { exact: true }).click();
  await page.getByLabel('Компания', { exact: true }).selectOption('T');
  await page.getByLabel('Год', { exact: true }).selectOption('2025');
  await expect(page.locator('tbody tr')).toHaveCount(13);
  expect(errors).toEqual([]);
});
test('XLSX, CSV и печатный PDF содержат данные', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Обзор' })).toBeVisible();
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
  await page.getByText('Подробнее', { exact: true }).click();
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
  await page.getByText('Дополнительные показатели', { exact: true }).click();
  const pe = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Исторический P/E', exact: true }) });
  await expect(pe.locator('tbody tr')).toHaveCount(5);
  await expect(pe.locator('tbody tr').filter({ hasText: '2022' })).toContainText('24,06');
  await expect(pe.locator('tbody tr').filter({ hasText: '2023' })).toContainText('7,93');
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
  await page.getByText('Подробнее', { exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Сумма инвестиций — ползунок' });
  const input = page.getByLabel('Сумма инвестиций', { exact: true });
  await expect(input).toHaveValue('100000');
  await expect(slider).toHaveAttribute('min', '10000');
  await expect(slider).toHaveAttribute('max', '1000000');
  await expect(slider).toHaveAttribute('step', '10000');
  const initial = await page.locator('.calculator-value').allTextContents();
  const initialScale = await page.locator('.chart svg text').allTextContents();
  expect(initialScale.some((v) => /000/.test(v))).toBe(true);
  await slider.fill('250000');
  await expect(input).toHaveValue('250000');
  expect(await page.locator('.calculator-value').allTextContents()).not.toEqual(initial);
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
  const values = await page.locator('.calculator-value').allTextContents();
  await page.getByLabel('Инвестиционный горизонт', { exact: true }).fill('2');
  expect(await page.locator('.calculator-value').allTextContents()).not.toEqual(values);
  await expect(page.locator('.capital-conclusion')).toContainText('горизонте 2 лет');
});
test('адаптивность, светлая тема и навигация телефона', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Обзор' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Светлая тема' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('nav').getByRole('link', { name: 'Портфель Марковица' }).click();
  await expect(page.getByRole('heading', { name: 'Портфель Марковица' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Данные и источники' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Данные и источники' })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('705,9');
  expect(missing).toEqual([]);
  await context.setOffline(false);
});

test('компактные страницы, основной CAGR и подробные расчёты', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.kpi')).toHaveCount(3);
  await expect(page.locator('.chart')).toHaveCount(1);
  await expect(page.locator('table')).toHaveCount(0);
  const cagr = page.locator('.kpi').filter({ hasText: 'Среднегодовая доходность (CAGR)' });
  await cagr.getByRole('button', { name: /О показателе/ }).hover();
  await expect(page.getByRole('dialog')).toContainText('365,25');
  await expect(page.getByRole('dialog').locator('.katex')).toHaveCount(1);
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть подсказку' }).click();
  const cases = [
    { company: 'Сбербанк', period: '2021', kind: 'Ценовая доходность', value: '0,54%' },
    { company: 'Т-Технологии', period: '2021', kind: 'Ценовая доходность', value: '-14,43%' },
    { company: 'Т-Технологии', period: '2021', kind: 'С дивидендами', value: '-12,91%' },
    { company: 'Т-Технологии', period: '2023', kind: 'С дивидендами', value: '11,49%' },
    { company: 'Т-Технологии', period: '2023', kind: 'Ценовая доходность', value: '8,89%' },
    { company: 'Сбербанк', period: '2023', kind: 'Ценовая доходность', value: '28,55%' },
    { company: 'Сбербанк', period: '2023', kind: 'С дивидендами', value: '42,87%' },
  ];
  for (const c of cases) {
    await page.getByRole('button', { name: c.company, exact: true }).click();
    await page.getByLabel('Рыночный период').selectOption(c.period);
    await page.getByRole('button', { name: c.kind, exact: true }).click();
    await expect(cagr.locator('.kpi-value')).toHaveText(c.value);
  }
  await page.locator('nav').getByRole('link', { name: 'Доходность и риск' }).click();
  await expect(page.locator('.kpi')).toHaveCount(4);
  await expect(page.locator('.chart')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Просадка', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Доходность', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Месячная доходность', exact: true }),
  ).toBeVisible();
  await page.locator('nav').getByRole('link', { name: 'Портфель Марковица' }).click();
  await expect(page.locator('table')).toHaveCount(0);
  const details = page.getByText('Методика и подробные расчёты', { exact: true });
  await details.focus();
  await page.keyboard.press('Enter');
  const combinations = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Все допустимые комбинации' }) });
  await expect(combinations.locator('tbody tr')).toHaveCount(101);
  await expect(page.getByLabel('Безрисковая ставка, годовых', { exact: true })).toBeVisible();
  await details.click();
  await expect(page.locator('table')).toHaveCount(0);
});

test('многолетний прогноз, выплаты и годовые предпосылки', async ({ page }) => {
  await page.goto('./#calculator');
  await page.getByLabel('Сумма инвестиций', { exact: true }).fill('500000');
  await page.getByRole('slider', { name: 'Доля Сбербанка' }).fill('0');
  await page.getByLabel('Режим расчёта').selectOption('scenario');
  await page.getByLabel('Инвестиционный горизонт', { exact: true }).fill('5');
  const positive = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Позитивный', exact: true }) });
  await expect(positive.locator('.scenario-value')).toContainText('2 744 272');
  await expect(positive).toContainText('40,57%');
  await page.getByText('Годовые предпосылки', { exact: true }).click();
  await page.getByLabel('Дивиденды в прогнозе').selectOption('cash');
  await expect(positive.locator('.scenario-value')).toContainText('2 570 019');
  await page.getByLabel('Сценарий траектории').selectOption('positive');
  const before = await positive.locator('.scenario-value').innerText();
  await page.getByLabel('2027 T growth', { exact: true }).fill('10');
  expect(await positive.locator('.scenario-value').innerText()).not.toBe(before);
  await page.getByRole('button', { name: 'Сбросить годовые предпосылки' }).click();
  await expect(positive.locator('.scenario-value')).toHaveText(before);
  await expect(
    page.getByRole('heading', { name: 'Исторические показатели и прогноз' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('10 п.п.');
});
test('справочник, поиск, переход по ? и браузерный Назад', async ({ page }) => {
  await page.goto('./');
  const cagr = page.locator('.kpi').filter({ hasText: 'Среднегодовая доходность (CAGR)' });
  await cagr.getByRole('button', { name: /О показателе/ }).click();
  await expect(page).toHaveURL(/#guide\/cagr$/);
  await expect(
    page.getByRole('heading', { name: 'Формулы и показатели', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.math-formula .katex')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Пример расчёта' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Обзор', exact: true })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: 'Формулы и показатели' }).click();
  await page.getByLabel('Поиск показателя').fill('шарпа');
  await expect(page.locator('.guide-entry')).toHaveCount(3);
  await page.locator('.guide-entry').filter({ hasText: 'Коэффициент Шарпа' }).first().click();
  await expect(page).toHaveURL(/#guide\/sharpe$/);
  await expect(page.locator('main')).toContainText('0,4');
  await expect(page.locator('.katex-error')).toHaveCount(0);
});
test('сводка, восстановленные EPS и отдельная расчётная ROA', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Сводка показателей', { exact: true }).click();
  await page.getByRole('button', { name: 'Все показатели', exact: true }).click();
  await expect(page.locator('main')).toContainText('Расчётная ROA по средним годовым активам');
  await page.getByRole('button', { name: 'Т-Технологии', exact: true }).click();
  await expect(page.locator('table').first()).toContainText('68,872');
  await page.locator('nav').getByRole('link', { name: 'Финансовый анализ' }).click();
  await page.getByText('Восстановление и расчётные показатели', { exact: true }).click();
  await expect(page.locator('main')).toContainText('3,435');
  await page.getByLabel('Метод восстановления').selectOption('interpolation');
  await expect(page.locator('main')).toContainText('Нет допустимого одиночного');
  await page.getByLabel('Метод восстановления').selectOption('regression');
  await expect(page.locator('main')).toContainText('≥12');
});
test('мобильная подсказка остаётся в экране и ведёт к формуле', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Touch-specific first-tap behaviour is selected via the coarse-hover media query.
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q === '(hover: none)'
        ? {
            ...original(q),
            matches: true,
            media: q,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return true;
            },
            onchange: null,
          }
        : original(q);
  });
  await page.goto('./');
  const help = page
    .locator('.kpi')
    .filter({ hasText: 'Среднегодовая доходность (CAGR)' })
    .getByRole('button', { name: /О показателе/ });
  await help.click();
  const popup = page.getByRole('dialog');
  await expect(popup).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await popup.getByRole('link', { name: 'Полная формула и пример →' }).click();
  await expect(page).toHaveURL(/#guide\/cagr$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('исторический режим по умолчанию: отрицательный CAGR, периоды и дивиденды', async ({
  page,
}) => {
  await page.goto('./#calculator');
  await expect(page.getByLabel('Режим расчёта')).toHaveValue('history');
  await expect(
    page.getByRole('heading', { name: 'Расчёт при сохранении исторической доходности' }),
  ).toBeVisible();
  await expect(page.locator('.scenario-value')).toHaveCount(0);
  await page.getByLabel('Сумма инвестиций', { exact: true }).fill('500000');
  await page.getByLabel('Инвестиционный горизонт', { exact: true }).fill('5');
  const weight = page.getByRole('slider', { name: 'Доля Сбербанка' });
  await weight.fill('0');
  await expect(page.locator('.calculator-value')).toHaveText('229 377 ₽');
  await expect(page.locator('.historical-result')).toContainText('-270 623');
  await expect(page.locator('.calculator-history')).toContainText('-14,43%');
  await weight.fill('100');
  await expect(page.locator('.calculator-value')).toHaveText('513 687 ₽');
  await page.getByRole('button', { name: 'С дивидендами', exact: true }).click();
  await expect(page.locator('.calculator-value')).toHaveText('763 429 ₽');
  await weight.fill('0');
  await expect(page.locator('.calculator-value')).toHaveText('250 558 ₽');
  await page.getByLabel('Рыночный период').selectOption('2023');
  const before = await page.locator('.calculator-value').innerText();
  expect(before).not.toBe('250 558 ₽');
  await page.getByRole('button', { name: 'Ценовая доходность', exact: true }).click();
  expect(await page.locator('.calculator-value').innerText()).not.toBe(before);
  await page.getByLabel('Режим расчёта').selectOption('scenario');
  await expect(page.locator('.scenario-value')).toHaveCount(3);
  await expect(page.getByRole('status')).toContainText('ростом EPS');
  await page.getByLabel('Режим расчёта').selectOption('history');
  await expect(page.locator('.calculator-value')).toBeVisible();
});

test('типографика: локальная кириллица, контраст AA и отсутствие переполнения всех страниц', async ({
  page,
}) => {
  test.setTimeout(90000);
  const routes = [
    'overview',
    'financial',
    'risk',
    'portfolio',
    'calculator',
    'forecast',
    'stability',
    'guide',
    'guide/cagr',
    'sources',
  ];
  const failures: string[] = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    for (const theme of ['dark', 'light']) {
      for (const route of routes) {
        await page.goto(`./#${route}`);
        await expect(page.locator('main')).toBeVisible();
        await page.evaluate(async (t) => {
          document.documentElement.dataset.theme = t;
          await document.fonts.ready;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        }, theme);
        expect(
          await page.evaluate(() =>
            document.fonts.check('17px "Source Serif 4"', 'Русский текст Ёж'),
          ),
        ).toBe(true);
        if (
          [
            'financial',
            'risk',
            'portfolio',
            'calculator',
            'forecast',
            'stability',
            'sources',
          ].includes(route)
        ) {
          for (const detail of await page.locator('details > summary').all()) await detail.click();
        }
        const audit = await page.evaluate(() => {
          const rgba = (value: string): number[] => (value.match(/[\d.]+/g) ?? []).map(Number);
          const over = (fg: number[], bg: number[]) => {
            const alpha = fg[3] ?? 1;
            return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)).concat(1);
          };
          const luminance = (v: number[]) =>
            v
              .slice(0, 3)
              .map((c) => {
                const s = c / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
          const bad: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            if (
              !el.childNodes.length ||
              ![...el.childNodes].some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              )
            )
              continue;
            if (el.closest('.katex, .company-logo, .brand-mark, [disabled]')) continue;
            const style = getComputedStyle(el),
              rect = el.getBoundingClientRect();
            if (
              !rect.width ||
              !rect.height ||
              rect.right <= 0 ||
              rect.left >= innerWidth ||
              style.visibility === 'hidden' ||
              !el.checkVisibility()
            )
              continue;
            const parents: Element[] = [];
            for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
            let bg = [255, 255, 255, 1];
            for (const p of parents) bg = over(rgba(getComputedStyle(p).backgroundColor), bg);
            const fg = over(rgba(el.closest('svg') ? style.fill : style.color), bg);
            const a = luminance(fg),
              b = luminance(bg);
            const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            const size = parseFloat(style.fontSize);
            const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight) >= 700);
            const name = `${el.tagName}.${el.className} ${el.textContent?.trim().slice(0, 32)}`;
            if (contrast < (large ? 3 : 4.5) - 0.01)
              bad.push(`Контраст ${contrast.toFixed(2)}: ${name}`);
            if (size < 14) bad.push(`Шрифт ${size}px: ${name}`);
          }
          return {
            bad,
            overflow: document.documentElement.scrollWidth > innerWidth,
            bodyFont: getComputedStyle(document.body).fontFamily,
          };
        });
        expect(audit.bodyFont).toContain('Source Serif 4');
        if (audit.overflow)
          failures.push(`${width}/${theme}/${route}: горизонтальное переполнение`);
        failures.push(...audit.bad.map((s) => `${width}/${theme}/${route}: ${s}`));
      }
    }
  }
  expect(failures).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('./#calculator');
  await page.screenshot({
    path: '/tmp/invest-calculator-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({
    path: '/tmp/invest-calculator-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});
