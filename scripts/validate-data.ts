import { createHash } from 'node:crypto';
import { validateRecovery } from '../src/services/recovery';
import { readFile } from 'node:fs/promises';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { createResearchModel } from '../src/calculations/research';
import { defaultScenarios } from '../src/calculations/scenarios';
const financial = validateFinancial(
  JSON.parse(await readFile(new URL('../public/data/financial.json', import.meta.url), 'utf8')),
);
const market = validateMarket(
  JSON.parse(await readFile(new URL('../public/data/market.json', import.meta.url), 'utf8')),
);
for (const start of [2021, 2023])
  for (const kind of ['price', 'total'] as const) {
    const m = createResearchModel(
      { financial, market },
      kind,
      start,
      0.1,
      0.5,
      100000,
      defaultScenarios,
    );
    console.log(
      `${start}–2025 ${kind}: ${m.period.from} — ${m.period.till}; ${m.period.years.toFixed(6)} года; ${m.pair.rows.length} синхронных месяцев`,
    );
    for (const c of ['SBER', 'T'] as const) {
      const s = m.stats[c];
      console.log(
        c,
        JSON.stringify({
          CAGR: s?.cagr,
          arithmeticAnnual: s?.annualMean,
          volatility: s?.annualVol,
          sharpe: s?.sharpe,
          fiveYearCAGR: m.fiveYear[c][kind]?.cagr ?? null,
        }),
      );
    }
    console.log(`min SBER=${m.model?.min.weight}, max Sharpe SBER=${m.model?.max.weight}`);
  }
console.log(
  `Проверено: ${financial.facts.length} финансовых полей, ${market.quotes.length} дневных дат, ${market.monthly.length} месяцев с базой декабря 2020.`,
);

const marketRaw = await readFile(new URL('../public/data/market.json', import.meta.url), 'utf8');
const recovery = validateRecovery(
  JSON.parse(await readFile(new URL('../public/data/recovery.json', import.meta.url), 'utf8')),
  market,
  createHash('sha256').update(marketRaw).digest('hex'),
);
const inputsRaw = await readFile(
  new URL('../public/data/recovery-inputs.json', import.meta.url),
  'utf8',
);
if (recovery.inputsFileSha256 !== createHash('sha256').update(inputsRaw).digest('hex'))
  throw new Error('Изменены факторы восстановления; пересоберите исследование');
console.log(
  `Исследование: ${recovery.summary.missing} пропуска; фактических дополнений ${recovery.summary.actualRecovered}; условных оценок ${recovery.summary.estimated}; выбран ${recovery.selectedMethod}. Исходная модель не изменена.`,
);
