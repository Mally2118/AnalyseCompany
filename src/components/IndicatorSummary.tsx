import { useState } from 'react';
import type { Company, Mode, Fact } from '../data/types';
import { companies, metrics } from '../data/types';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import { calculatedROA, statusLabels } from '../calculations/data-records';
import { MetricHelp } from './MetricHelp';
import { fmt, pct } from '../utils/format';
export function IndicatorSummary({
  data,
  model,
  mode,
}: {
  data: DataSet;
  model: AnalysisModel;
  mode: Mode;
}) {
  const [all, setAll] = useState(false);
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode];
  const financial = (c: Company) =>
    data.financial.facts.filter(
      (f) =>
        f.company === c &&
        f.year === 2025 &&
        (all
          ? ['profit', 'assets', 'equity', 'roe', 'roa', 'cir', 'cor', 'eps'].includes(f.metric)
          : f.metric === 'profit'),
    );
  const row = (
    key: string,
    label: string,
    values: (string | number | null | undefined)[],
    note?: string,
  ) => (
    <tr key={label}>
      <th>
        {label} <MetricHelp metric={key} />
        {note && <small>{note}</small>}
      </th>
      {values.map((v, i) => (
        <td key={i}>{v ?? 'Нет данных'}</td>
      ))}
    </tr>
  );
  const showFact = (f: Fact) =>
    `${fmt(f.value, f.metric === 'eps' ? 3 : 2)}${f.value === null ? '' : ` ${f.unit}`} · ${statusLabels[f.status]}`;
  return (
    <>
      <div className="segmented small" aria-label="Объём сводки">
        <button className={!all ? 'active' : ''} onClick={() => setAll(false)}>
          Основные показатели
        </button>
        <button className={all ? 'active' : ''} onClick={() => setAll(true)}>
          Все показатели
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Показатель</th>
              {cs.map((c) => (
                <th key={c}>{companies[c].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="summary-group">
              <th colSpan={cs.length + 1}>Финансы · 2025</th>
            </tr>
            {financial(cs[0]).map((f) =>
              row(
                f.metric,
                metrics[f.metric].label,
                cs.map((c) =>
                  showFact(
                    data.financial.facts.find(
                      (x) => x.company === c && x.year === 2025 && x.metric === f.metric,
                    )!,
                  ),
                ),
                f.metric === 'cir'
                  ? 'Нет сопоставимого расчёта для T: не подтверждён единый состав доходов/расходов.'
                  : f.metric === 'roa'
                    ? 'Официальная ROA не подтверждена в наборе; расчётная показана отдельно.'
                    : undefined,
              ),
            )}
            {all &&
              row(
                'roa',
                'Расчётная ROA по средним годовым активам',
                cs.map((c) => showFact(calculatedROA(data.financial, c, 2025))),
                'Отдельно от официальной ROA; периметр T менялся после Росбанка.',
              )}
            {all &&
              row(
                'pe',
                'Исторический P/E',
                cs.map(
                  (c) =>
                    fmt(model.valuations.find((v) => v.company === c && v.year === 2025)?.pe, 2) +
                    ' ×',
                ),
                'Ретроспективно: годовая EPS раскрыта позже даты цены.',
              )}
            <tr className="summary-group">
              <th colSpan={cs.length + 1}>
                Инвестиции · {model.period.from} — {model.period.till}
              </th>
            </tr>
            {row(
              'cagr',
              'CAGR выбранного режима',
              cs.map((c) => pct(model.stats[c]?.cagr, 2)),
            )}
            {all &&
              row(
                'price',
                'Ценовой CAGR',
                cs.map((c) => pct(model.comparison[c].price?.cagr, 2)),
              )}
            {all &&
              row(
                'total',
                'Полный CAGR',
                cs.map((c) => pct(model.comparison[c].total?.cagr, 2)),
              )}
            {row(
              'volatility',
              'Годовая волатильность',
              cs.map((c) => pct(model.stats[c]?.annualVol, 2)),
            )}
            {all &&
              row(
                'sharpe',
                'Коэффициент Шарпа',
                cs.map((c) => fmt(model.stats[c]?.sharpe, 3)),
              )}
            {all &&
              row(
                'drawdown',
                'Максимальная просадка',
                cs.map((c) => pct(model.stats[c]?.maxDrawdown, 2)),
              )}
            {all && (
              <>
                <tr className="summary-group">
                  <th colSpan={cs.length + 1}>Портфель · общая выборка</th>
                </tr>
                {row(
                  'investment',
                  'Выбранные доли',
                  cs.map((c) =>
                    pct(
                      c === 'SBER'
                        ? model.selected?.weight
                        : model.selected
                          ? 1 - model.selected.weight
                          : null,
                      0,
                    ),
                  ),
                )}
                {row(
                  'correlation',
                  'Корреляция',
                  cs.map(() => fmt(model.correlation, 3)),
                )}
                {row(
                  'minimum',
                  'Портфель минимального риска',
                  cs.map(
                    (c) =>
                      `${pct(c === 'SBER' ? model.model?.min.weight : model.model ? 1 - model.model.min.weight : null, 0)} доля; σ ${pct(model.model?.min.risk)}`,
                  ),
                )}
                {row(
                  'maximum',
                  'Портфель максимального Sharpe',
                  cs.map(
                    (c) =>
                      `${pct(c === 'SBER' ? model.model?.max.weight : model.model ? 1 - model.model.max.weight : null, 0)} доля; S ${fmt(model.model?.max.sharpe, 3)}`,
                  ),
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Источники и паспорта каждого финансового поля — в <a href="#sources">данных и источниках</a>
        . Один коэффициент не делает банк безусловно лучшим. Сводка пересчитывается вместе с общей
        моделью.
      </p>
    </>
  );
}
