import type { Company, FinancialData, Metric, Stats } from '../data/types';
import { companies } from '../data/types';
import type { frontier } from './portfolio';
import { fmt, pct } from '../utils/format';
export function fact(data: FinancialData, c: Company, y: number, m: Metric) {
  return data.facts.find((f) => f.company === c && f.year === y && f.metric === m)?.value ?? null;
}
export function stability(data: FinancialData, c: Company) {
  const get = (m: Metric, y = 2025) => fact(data, c, y, m);
  const profit = get('profit'),
    equity = get('equity'),
    roe = get('roe'),
    capital = get('capital'),
    npl = get('npl'),
    priorProfit = get('profit', 2024),
    priorEquity = get('equity', 2024);
  const complete = [profit, equity, roe, capital, npl, priorProfit, priorEquity].every(
    (x) => x !== null,
  );
  const signals = [
    {
      label: 'Прибыль положительна',
      ok: profit === null ? null : profit > 0,
      value: `${fmt(profit)} млрд ₽`,
    },
    {
      label: 'Капитал растёт',
      ok: equity === null || priorEquity === null ? null : equity >= priorEquity,
      value: `${fmt(priorEquity)} → ${fmt(equity)} млрд ₽`,
    },
    { label: 'ROE ≥ 15%', ok: roe === null ? null : roe >= 15, value: `${fmt(roe)}%` },
    {
      label: 'Общий капитал ≥ 12%',
      ok: capital === null ? null : capital >= 12,
      value: `${fmt(capital)}%`,
    },
    { label: 'NPL / стадия 3 ≤ 6%', ok: npl === null ? null : npl <= 6, value: `${fmt(npl)}%` },
    {
      label: 'Прибыль не снижается',
      ok: profit === null || priorProfit === null ? null : profit >= priorProfit,
      value: `${fmt(priorProfit)} → ${fmt(profit)} млрд ₽`,
    },
  ];
  const fails = signals.filter((s) => s.ok === false).length;
  const category = !complete
    ? 'Недостаточно информации для оценки'
    : (profit ?? 0) <= 0 || (equity ?? 0) <= 0 || fails >= 3
      ? 'Неблагоприятная динамика'
      : fails > 0
        ? 'Повышенные риски'
        : 'Относительно устойчивое';
  return { signals, category, score: complete ? signals.filter((s) => s.ok).length : null };
}
export function marketRisk(s: Stats | null) {
  if (!s) return 'Нет данных';
  return s.annualVol >= 0.35 || (s.maxDrawdown ?? 0) <= -0.4
    ? 'Высокий'
    : s.annualVol >= 0.2 || (s.maxDrawdown ?? 0) <= -0.2
      ? 'Умеренный'
      : 'Низкий';
}
export function conclusions(
  financial: FinancialData,
  stats: Record<Company, Stats | null>,
  model: ReturnType<typeof frontier> | null,
  options: { sameHorizon?: boolean } = {},
) {
  const a = stats.SBER,
    b = stats.T,
    sa = stability(financial, 'SBER'),
    sb = stability(financial, 'T');
  const out: string[] = [];
  out.push(
    sa.score === null || sb.score === null
      ? 'Сравнить устойчивость полностью нельзя: не хватает сопоставимых раскрытий.'
      : sa.score === sb.score
        ? `Одинаковое число положительных аналитических сигналов: ${sa.score} из 6. Это не кредитный рейтинг.`
        : `${companies[sa.score > sb.score ? 'SBER' : 'T'].name} имеет больше положительных сигналов: ${Math.max(sa.score, sb.score)} из 6. Статусы: Сбер — «${sa.category}», Т — «${sb.category}». Определения качества кредитов и ROE различаются.`,
  );
  if (a && b) {
    const better = (a.cagr ?? -Infinity) > (b.cagr ?? -Infinity) ? 'SBER' : 'T',
      volatile = a.annualVol > b.annualVol ? 'SBER' : 'T';
    out.push(
      options.sameHorizon === false
        ? `CAGR полной стоимости: Сбер ${pct(a.cagr)} за 2021–2025, Т ${pct(b.cagr)} за 2022–2025. Периоды различаются: прямое ранжирование некорректно. Для сопоставления выберите 2023–2025.`
        : `Выше исторический CAGR у ${companies[better].name}: Сбер ${pct(a.cagr)}, Т ${pct(b.cagr)} за одинаковый выбранный период.`,
    );
    out.push(
      `Более волатильна ${companies[volatile].name}: Сбер ${pct(a.annualVol)}, Т ${pct(b.annualVol)} в год. Наблюдавшаяся дневная просадка: ${pct(a.maxDrawdown)} и ${pct(b.maxDrawdown)}.`,
    );
  }
  if (model) {
    out.push(
      `Минимум исторического риска: ${fmt(model.min.weight * 100, 0)}% SBER / ${fmt((1 - model.min.weight) * 100, 0)}% T, σ = ${pct(model.min.risk)}, арифметическая доходность ${pct(model.min.mean)} годовых.`,
    );
    out.push(
      `Максимум Sharpe: ${fmt(model.max.weight * 100, 0)}% SBER / ${fmt((1 - model.max.weight) * 100, 0)}% T; Sharpe ${fmt(model.max.sharpe, 2)}, σ ${pct(model.max.risk)}, доходность ${pct(model.max.mean)}.`,
    );
    out.push(
      `Для консервативного выбора внутри этой пары ориентир — минимум дисперсии (${pct(model.min.risk)} риска); для готового к рыночным потерям — максимум Sharpe (${fmt(model.max.sharpe, 2)}). Даже оптимальный портфель из двух банков не заменяет диверсификацию по секторам.`,
    );
  }
  out.push(
    'Убыток возможен при снижении прибыли, мультипликаторов и дивидендов. Просадка цены означает рыночный убыток; из неё не следует дефолт эмитента. Продажа фиксирует результат, временная просадка также не гарантирует последующего восстановления.',
  );
  return out;
}
