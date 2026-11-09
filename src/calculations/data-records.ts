import type { Fact, FinancialData, Company } from '../data/types';
import { balanceROA } from './financial';
import { interpolate, regressionEstimate } from './econometrics';
export const statusLabels = {
  actual: 'Фактическое',
  calculated: 'Расчётное',
  estimated: 'Оценочное',
  missing: 'Нет данных',
};
export function calculatedROA(data: FinancialData, c: Company, year: number): Fact {
  const inputs = data.facts.filter(
    (f) =>
      f.company === c &&
      ((f.year === year && f.metric === 'profit') ||
        ([year - 1, year].includes(f.year) && f.metric === 'assets')),
  );
  const value = balanceROA(data, c, year);
  return {
    company: c,
    year,
    metric: 'roa',
    value,
    unit: '%',
    status: value === null ? 'missing' : 'calculated',
    sourceId: inputs[0]?.sourceId ?? 'missing',
    comparable: c !== 'T',
    section: 'Расчётная ROA по средним годовым активам',
    note: 'Не официальная ROA. Для T 2024 приобретение Росбанка меняет периметр; используется простое среднее двух балансов. Округление исходных пресс-релизов сохраняется.',
    provenance: {
      method: 'Прямой расчёт по подтверждённым данным',
      formula: 'NI / ((Aнач + Aкон) / 2) × 100%',
      inputs: inputs
        .filter((f) => f.value !== null)
        .map((f) => ({
          label: `${f.company} ${f.year} ${f.metric}`,
          value: f.value!,
          unit: f.unit,
          sourceId: f.sourceId,
        })),
      limitations:
        'При отсутствии начальных активов расчёт не выполняется. Среднее двух остатков не равно среднедневным/среднемесячным активам. Используются сохранённые опубликованные значения, включая округления пресс-релизов; полный ретроспективный пересчёт балансов по IFRS 17 не выполняется.',
    },
  };
}
export function reconstruction(
  data: FinancialData,
  c: Company,
  method: 'direct' | 'interpolation' | 'regression',
) {
  if (method === 'direct')
    return {
      records: [2021, 2022, 2023, 2024, 2025].map((y) => calculatedROA(data, c, y)),
      reason: 'Расчётная ROA отделена от официальной; источник каждого входа сохранён.',
    };
  if (method === 'regression')
    return {
      records: [] as Fact[],
      reason: regressionEstimate(
        data.facts
          .filter((f) => f.company === c && f.metric === 'assets' && f.value !== null)
          .map((f) => f.value!),
        data.facts
          .filter((f) => f.company === c && f.metric === 'profit' && f.value !== null)
          .map((f) => f.value!),
        0,
        c === 'T',
      ).reason,
    };
  const records: Fact[] = [];
  for (const missing of data.facts.filter((f) => f.company === c && f.value === null)) {
    const l = data.facts.find(
        (f) =>
          f.company === c &&
          f.metric === missing.metric &&
          f.year === missing.year - 1 &&
          f.status === 'actual',
      ),
      r = data.facts.find(
        (f) =>
          f.company === c &&
          f.metric === missing.metric &&
          f.year === missing.year + 1 &&
          f.status === 'actual',
      );
    if (l?.value == null || r?.value == null) continue;
    const value = interpolate(
      missing.year,
      { t: l.year, value: l.value },
      { t: r.year, value: r.value },
      c === 'T' ? [2024] : [],
    );
    if (value !== null)
      records.push({
        ...missing,
        value,
        status: 'estimated',
        section: 'Учебная линейная интерполяция',
        provenance: {
          method: 'Линейная интерполяция одиночного пропуска',
          formula: 'Y0 + (t−t0)/(t1−t0) × (Y1−Y0)',
          inputs: [l, r].map((f) => ({
            label: `${f.year} ${f.metric}`,
            value: f.value!,
            unit: f.unit,
            sourceId: f.sourceId,
          })),
          limitations: 'Не факт отчётности; интервалы не заявляются. Не используется в Марковице.',
        },
      });
  }
  return {
    records,
    reason: records.length
      ? 'Оценки показаны отдельно и не подмешаны в исходную отчётность.'
      : 'Нет допустимого одиночного промежуточного пропуска с двумя фактическими соседями без структурного разрыва.',
  };
}
