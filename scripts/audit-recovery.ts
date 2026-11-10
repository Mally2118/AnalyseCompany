import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateFinancial, validateMarket } from '../src/services/validation';
import { validateRecovery } from '../src/services/recovery';
import { recoverySensitivity } from '../src/calculations/recovery';
const read = (n: string) =>
  readFileSync(new URL(`../public/data/${n}.json`, import.meta.url), 'utf8');
const market = validateMarket(JSON.parse(read('market'))),
  financial = validateFinancial(JSON.parse(read('financial')));
const recovery = validateRecovery(
  JSON.parse(read('recovery')),
  market,
  createHash('sha256').update(read('market')).digest('hex'),
);
const data = { market, financial, recovery };
const cases = [2021, 2023].flatMap((start) =>
  (['price', 'total'] as const).map((kind) => {
    const sensitivity = recoverySensitivity(data, recovery, kind, start, 0.1, 0.5);
    const compact = (a: typeof sensitivity.before) => ({
      n: a.pair.rows.length,
      from: a.period.from,
      till: a.period.till,
      stats: a.stats,
      correlation: a.correlation,
      covariance: a.model?.covariance,
      selected: a.selected,
      min: a.model?.min,
      max: a.model?.max,
    });
    return {
      start,
      kind,
      rf: 0.1,
      weightSBER: 0.5,
      addedMonths: sensitivity.addedMonths,
      before: compact(sensitivity.before),
      after: compact(sensitivity.after),
    };
  }),
);
writeFileSync(
  new URL('../docs/examples/recovery-sensitivity.json', import.meta.url),
  JSON.stringify(cases, null, 2) + '\n',
);
for (const q of cases) console.log(JSON.stringify(q));
