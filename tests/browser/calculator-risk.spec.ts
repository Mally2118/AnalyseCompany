import { test, expect } from '@playwright/test';

test('калькулятор показывает годовой риск выбранного портфеля в обоих режимах', async ({
  page,
}) => {
  await page.goto('./#calculator');
  const risk = page.getByTestId('calculator-risk');
  const weight = page.getByRole('slider', { name: 'Доля Сбербанка' });
  await expect(risk).toBeVisible();
  await expect(risk).toHaveText(/\d+,\d{2}%/);

  // Independent reference values for the existing historical sample.
  await weight.fill('0');
  await expect(risk).toHaveText('44,03%');
  await weight.fill('100');
  await expect(risk).toHaveText('39,66%');
  await page.getByLabel('Рыночный период').selectOption('2023');
  await expect(risk).toHaveText('27,56%');
  await page.getByRole('button', { name: 'С дивидендами', exact: true }).click();
  await expect(risk).toHaveText('26,97%');

  await page.getByLabel('Сумма инвестиций', { exact: true }).fill('250000');
  await page.getByLabel('Инвестиционный горизонт', { exact: true }).fill('5');
  await expect(risk).toHaveText('26,97%');
  await page.getByLabel('Режим расчёта').selectOption('scenario');
  await expect(risk).toHaveText('26,97%');
  await expect(page.getByRole('group', { name: 'Годовой риск портфеля' })).toContainText(
    'не прогноз риска сценариев',
  );
  await expect(page.locator('.calculator-history')).toContainText('26,97%');
});

test('процент риска читается на мобильном экране', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('./#calculator');
  const risk = page.getByTestId('calculator-risk');
  await risk.scrollIntoViewIfNeeded();
  await expect(risk).toBeVisible();
  await expect(risk).toHaveText(/\d+,\d{2}%/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
