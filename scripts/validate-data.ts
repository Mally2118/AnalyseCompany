import { readFile } from 'node:fs/promises';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { monthlyReturns, paired, wealthSeries, statistics } from '../src/calculations/market';
import { frontier } from '../src/calculations/portfolio';
const financial = validateFinancial(
  JSON.parse(await readFile(new URL('../public/data/financial.json', import.meta.url), 'utf8')),
);
const market = validateMarket(
  JSON.parse(await readFile(new URL('../public/data/market.json', import.meta.url), 'utf8')),
);
for (const kind of ['price', 'total'] as const) {
  const rows = monthlyReturns(market, kind),
    p = paired(rows),
    m = frontier(p.SBER, p.T, 0.1);
  for (const c of ['SBER', 'T'] as const) {
    const s = statistics(
      rows.flatMap((r) => (r[c] === null ? [] : [r[c]])),
      0.1,
      wealthSeries(market, c, kind),
    );
    console.log(kind, c, JSON.stringify(s));
  }
  console.log(kind, `n=${p.rows.length}`, `min=${m.min.weight}`, `Sharpe=${m.max.weight}`);
}
console.log(
  `Проверено: ${financial.facts.length} финансовых полей, ${market.quotes.length} дневных дат, ${market.monthly.length} месяцев с базой декабря 2020.`,
);
