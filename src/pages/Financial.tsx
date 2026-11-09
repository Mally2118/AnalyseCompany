import { MetricHelp } from '../components/MetricHelp';
import { DataStatus } from '../components/DataStatus';
import { Recovery } from '../components/Recovery';
import { ValuationHistory } from '../components/ValuationHistory';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Company, Metric, Mode } from '../data/types';
import { companies, metrics, years } from '../data/types';
import type { DataSet } from '../services/data';
import { Card, Disclosure, Hint, SectionIntro } from '../components/ui';
import { TimeChart } from '../charts/Charts';
import { fact } from '../calculations/analysis';
import { growth } from '../calculations/statistics';
import { balanceROA, comparableCagr } from '../calculations/financial';
import { fmt, pct } from '../utils/format';
export function Financial({ data, mode }: { data: DataSet; mode: Mode }) {
  const [view, setView] = useState<'values' | 'growth'>('values');
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode];
  const [selected, setSelected] = useState<Metric>('profit');
  const chart = (ms: Metric[]) =>
    years.map((year) => ({
      year,
      ...Object.fromEntries(
        cs.flatMap((c) =>
          ms.map((m) => [
            `${c}-${m}`,
            m === 'roa' ? balanceROA(data.financial, c, year) : fact(data.financial, c, year, m),
          ]),
        ),
      ),
    }));
  const series = (ms: Metric[]) =>
    cs.flatMap((c) =>
      ms.map((m, i) => ({
        key: `${c}-${m}`,
        name: `${companies[c].name} · ${ms.length > 1 ? (m === 'roa' ? 'ROA по среднему балансу' : metrics[m].label) : ''}`,
        color: i === 0 ? companies[c].color : c === 'SBER' ? '#8ce6b7' : '#b1a0ff',
      })),
    );
  const allRows = Object.keys(metrics) as Metric[];
  const rows: Metric[] = ['profit', 'assets', 'equity', 'roe', 'roa'];
  const [showReport, setShowReport] = useState(false);
  const metricTable = (items: Metric[]) => (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Показатель</th>
              {mode === 'compare' && <th>Компания</th>}
              {years.map((y) => (
                <th key={y}>{y}</th>
              ))}
              <th>CAGR 2021–25</th>
            </tr>
          </thead>
          <tbody>
            {items.flatMap((m) =>
              cs.map((c) => {
                const facts = years.map((y) =>
                  data.financial.facts.find(
                    (f) => f.company === c && f.year === y && f.metric === m,
                  ),
                );
                const comparable = facts.every(
                  (f) => f?.comparable && f.value !== null && f.value > 0,
                );
                return (
                  <tr key={c + m}>
                    <th>
                      <span className="metric-label">
                        {metrics[m].label} <MetricHelp metric={m} />
                      </span>
                      <small>
                        {view === 'growth'
                          ? metrics[m].unit === '%'
                            ? 'п.п.'
                            : '%'
                          : metrics[m].unit}
                      </small>
                    </th>
                    {mode === 'compare' && (
                      <td>
                        <span className="company-dot" style={{ background: companies[c].color }} />
                        {c}
                      </td>
                    )}
                    {years.map((y, i) => {
                      const f = facts[i],
                        v = f?.value ?? null,
                        previous = fact(data.financial, c, y - 1, m),
                        g =
                          metrics[m].unit === '%'
                            ? v !== null && previous !== null
                              ? v - previous
                              : null
                            : growth(previous, v);
                      return (
                        <td key={y}>
                          <button
                            className="cell-button"
                            onClick={() => {
                              setSelected(m);
                              setShowReport(true);
                            }}
                            title={`${f?.note ?? ''} ${f?.section ?? ''}`}
                          >
                            {view === 'values'
                              ? fmt(v, m === 'eps' || m === 'dividend' ? 3 : 1)
                              : metrics[m].unit === '%'
                                ? `${fmt(g)}${g !== null ? ' п.п.' : ''}`
                                : pct(g)}
                          </button>
                          {f && <DataStatus fact={f} />}
                        </td>
                      );
                    })}
                    <td>
                      {metrics[m].unit === '%' || !comparable
                        ? '—'
                        : pct(comparableCagr(data.financial, c, m))}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        CAGR = (конечное / начальное)^(1/4) − 1; показан только для положительных сопоставимых
        рядов. «—» означает неприменимость. «Нет данных» — отсутствие проверенного значения. Г/г —
        механическое изменение опубликованных значений; при пересмотре или M&A его нельзя считать
        органическим ростом.
      </p>
    </>
  );
  return (
    <>
      <SectionIntro
        title="Финансовый анализ"
        description="Основные результаты МСФО за 2021–2025 годы."
      />
      <div className="grid-two">
        <Card title="Чистая прибыль" subtitle="Млрд ₽ · прибыль всей группы">
          <TimeChart data={chart(['profit'])} series={series(['profit'])} kind="bar" xKey="year" />
        </Card>
        <Card
          title="Рентабельность"
          subtitle="ROE раскрытая; расчётная ROA по средним годовым активам, %"
        >
          <TimeChart
            data={chart(['roe', 'roa'])}
            series={series(['roe', 'roa'])}
            percent
            xKey="year"
          />
          <p className="footnote">
            ROA — расчёт по среднему годовому балансу, не раскрытая ROA.{' '}
            <Hint text="ROA = прибыль группы / среднее активов на начало и конец года × 100%. Отличается от опубликованной ROA на среднемесячных остатках; за 2021 нет начального баланса." />
          </p>
        </Card>
      </div>
      <Card
        title="Финансовые показатели"
        subtitle="Нажмите на значение, чтобы проверить источник"
        action={
          <div className="segmented small">
            <button className={view === 'values' ? 'active' : ''} onClick={() => setView('values')}>
              Значения
            </button>
            <button className={view === 'growth' ? 'active' : ''} onClick={() => setView('growth')}>
              Изменение г/г
            </button>
          </div>
        }
      >
        {metricTable(rows)}
      </Card>
      <Disclosure title="Восстановление и расчётные показатели">
        <Recovery data={data.financial} companies={cs} />
      </Disclosure>
      <Disclosure title="Дополнительные показатели">
        <div className="grid-two">
          {' '}
          <Card title="Собственный капитал" subtitle="Млрд ₽ · на конец года">
            <TimeChart
              data={chart(['equity'])}
              series={series(['equity'])}
              kind="area"
              xKey="year"
            />
          </Card>
          <Card
            title="Структура банковского дохода"
            subtitle="Чистый процентный и комиссионный доход, млрд ₽"
          >
            <TimeChart data={chart(['nii', 'fees'])} series={series(['nii', 'fees'])} xKey="year" />
          </Card>
        </div>
        {metricTable(allRows.filter((m) => !rows.includes(m)))}
        <ValuationHistory data={data} mode={mode} />
      </Disclosure>
      <Disclosure title="Подробная отчётность" open={showReport} onOpenChange={setShowReport}>
        <p className="footnote">
          Периметр T в 2024 включает Росбанк. Обобщённая отчётность Сбера и изменения МСФО 17
          ограничивают сопоставимость; источники МСФО и пресс-релизы отмечены раздельно.
        </p>
        <p className="footnote">
          {metrics[selected].definition} {metrics[selected].formula}
        </p>
        <label className="field inline-field">
          <span>Показатель</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value as Metric)}>
            {allRows.map((m) => (
              <option key={m} value={m}>
                {metrics[m].label}
              </option>
            ))}
          </select>
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Компания / год</th>
                <th>Значение</th>
                <th>Документ и раздел</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {data.financial.facts
                .filter((f) => cs.includes(f.company) && f.metric === selected)
                .map((f) => {
                  const source = data.financial.sources.find((s) => s.id === f.sourceId)!;
                  return (
                    <tr key={f.company + f.year}>
                      <td>
                        {f.company} · {f.year}
                      </td>
                      <td>
                        {fmt(f.value, 3)} {f.value === null ? '' : f.unit}
                        <DataStatus fact={f} />
                      </td>
                      <td>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title} <ExternalLink size={11} />
                        </a>
                        <small>
                          {f.section} · {source.standard}
                        </small>
                      </td>
                      <td className="wrap-cell">
                        {f.note || source.note || 'Опубликованные данные'}
                        <small>
                          {f.provenance?.method} {f.provenance?.formula} {f.provenance?.limitations}
                        </small>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </>
  );
}
