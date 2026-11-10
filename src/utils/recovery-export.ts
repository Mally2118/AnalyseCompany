import type { DataSet } from '../services/data';
import type { ReturnKind } from '../data/types';
import { recoverySensitivity } from '../calculations/recovery';
export function sensitivityRows(
  data: DataSet,
  kind: ReturnKind,
  start: number,
  rf: number,
  weight: number,
): (string | number | null)[][] {
  if (!data.recovery) return [];
  const s = recoverySensitivity(data, data.recovery, kind, start, rf, weight),
    a = s.before,
    b = s.after;
  const rows: (string | number | null)[][] = [
    ['Общие месяцы', a.pair.rows.length, b.pair.rows.length],
    ['Корреляция', a.correlation, b.correlation],
  ];
  for (const c of ['SBER', 'T'] as const)
    for (const key of ['annualMean', 'annualVol', 'sharpe', 'cagr'] as const)
      rows.push([`${c} ${key}`, a.stats[c]?.[key] ?? null, b.stats[c]?.[key] ?? null]);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      rows.push([
        `Cov год ${i === 0 ? 'SBER' : 'T'} / ${j === 0 ? 'SBER' : 'T'}`,
        a.model?.covariance[i][j] ?? null,
        b.model?.covariance[i][j] ?? null,
      ]);
  for (const key of ['mean', 'risk', 'sharpe'] as const)
    rows.push([`Выбранный портфель: ${key}`, a.selected?.[key] ?? null, b.selected?.[key] ?? null]);
  for (const key of ['min', 'max'] as const) {
    rows.push([
      `${key === 'min' ? 'Минимальный риск' : 'Максимальный Sharpe'} · вес SBER`,
      a.model?.[key].weight ?? null,
      b.model?.[key].weight ?? null,
    ]);
    rows.push([
      `${key === 'min' ? 'Минимальный риск' : 'Максимальный Sharpe'} · риск`,
      a.model?.[key].risk ?? null,
      b.model?.[key].risk ?? null,
    ]);
    rows.push([
      `${key === 'min' ? 'Минимальный риск' : 'Максимальный Sharpe'} · Sharpe`,
      a.model?.[key].sharpe ?? null,
      b.model?.[key].sharpe ?? null,
    ]);
  }
  return rows;
}
