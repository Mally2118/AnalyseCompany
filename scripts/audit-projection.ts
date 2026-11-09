import { readFile, writeFile } from 'node:fs/promises';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { defaultScenarios, scenarioResult } from '../src/calculations/scenarios';
import { project } from '../src/calculations/projection';
import { fact } from '../src/calculations/analysis';
const financial = validateFinancial(
    JSON.parse(await readFile('public/data/financial.json', 'utf8')),
  ),
  market = validateMarket(JSON.parse(await readFile('public/data/market.json', 'utf8')));
const eps = { SBER: fact(financial, 'SBER', 2025, 'eps')!, T: fact(financial, 'T', 2025, 'eps')! },
  last = market.monthly.at(-1)!,
  prices = { SBER: last.SBER!, T: last.T! },
  s = defaultScenarios.find((s) => s.id === 'positive')!;
const one = scenarioResult(s, eps, prices, 0, 500000),
  reinvest = project(s, eps, prices, 0, 500000, 5, 'reinvest'),
  cash = project(s, eps, prices, 0, 500000, 5, 'cash');
const result = {
  input: {
    company: 'T',
    weightT: 1,
    amount: 500000,
    horizon: 5,
    scenario: s,
    eps: eps.T,
    initialPrice: prices.T,
  },
  old: {
    return: one.return,
    value: 500000 * (1 + one.return) ** 5,
    reason: 'Ошибочное экономическое повторение доходности переоценки первого года',
  },
  new: { reinvest, cash },
  type: 'Сценарный прогноз на учебных предпосылках, не эконометрическая оценка',
};
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes('--save'))
  await writeFile('docs/examples/T-five-year-audit.json', JSON.stringify(result, null, 2) + '\n');
