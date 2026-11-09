import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import type { Mode, Company } from '../data/types';
import { companies, years } from '../data/types';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import { Card, KPI, SectionIntro, Tag, Hint } from '../components/ui';
import { TimeChart, companySeries } from '../charts/Charts';
import { fact, marketRisk, stability } from '../calculations/analysis';
import { growth } from '../calculations/statistics';
import { metricExplanation } from '../data/metric-help';
import { fmt, pct, rub, date } from '../utils/format';
export function Overview({
  data,
  model,
  mode,
  navigate,
}: {
  data: DataSet;
  model: AnalysisModel;
  mode: Mode;
  navigate: (page: string) => void;
}) {
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode],
    c = cs[0],
    s = model.stats[c],
    profit = fact(data.financial, c, 2025, 'profit'),
    prior = fact(data.financial, c, 2024, 'profit');
  const annual = years.map((year) => ({
    year,
    ...Object.fromEntries(cs.map((c) => [c, fact(data.financial, c, year, 'profit')])),
  }));
  const wealthMap = new Map(model.wealth.T.map((q) => [q.date, q.value]));
  const wealth = model.wealth.SBER.filter(
    (_, i) => i % 5 === 0 || i === model.wealth.SBER.length - 1,
  ).map((q) => ({
    date: q.date,
    SBER: q.value === null ? null : q.value * 100,
    T: (wealthMap.get(q.date) ?? null) === null ? null : wealthMap.get(q.date)! * 100,
  }));
  return (
    <>
      <SectionIntro
        eyebrow="ИССЛЕДОВАНИЕ РОССИЙСКОГО РЫНКА"
        title="За цифрами — решения."
        description="Финансовый анализ, инвестиционные стратегии и прогнозирование российского фондового рынка."
      >
        <div className="research-badge">
          <span className="live-dot" />
          МСФО · MOEX ISS<span>2021 — 2025</span>
        </div>
      </SectionIntro>
      <div className="kpi-grid">
        <KPI
          label={`Прибыль · ${companies[c].name}`}
          value={`${fmt(profit)} млрд ₽`}
          detail={`2025 год · ${pct(growth(prior, profit))} г/г`}
          icon={<Wallet size={18} />}
        >
          {mode === 'compare' && (
            <small>Т-Технологии: {fmt(fact(data.financial, 'T', 2025, 'profit'))} млрд ₽</small>
          )}
        </KPI>
        <KPI
          label="Среднегодовая доходность (CAGR)"
          hint={metricExplanation('cagr')}
          value={pct(s?.cagr)}
          detail={`${companies[c].short} · ${date(model.period.from)} — ${date(model.period.till)}`}
          icon={<ChartNoAxesCombined size={18} />}
          color="blue"
        />
        <KPI
          label="Годовая волатильность"
          value={pct(s?.annualVol)}
          detail={`${s?.n ?? 0} месячных наблюдений · риск ${marketRisk(s).toLowerCase()}`}
          icon={<ArrowDownRight size={18} />}
          color="gold"
        />
        <KPI
          label="Максимальный Sharpe"
          value={fmt(model.model?.max.sharpe, 2)}
          detail={`${fmt((model.model?.max.weight ?? 0) * 100, 0)}% SBER / ${fmt((1 - (model.model?.max.weight ?? 0)) * 100, 0)}% T`}
          icon={<ShieldCheck size={18} />}
          color="purple"
        />
      </div>
      <div className="grid-two">
        <Card
          title="Среднегодовая доходность (CAGR)"
          subtitle={`Одинаковые даты и капитал: ${date(model.period.from)} — ${date(model.period.till)}`}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Акция</th>
                  <th>
                    Ценовая <Hint text={metricExplanation('cagr')} />
                  </th>
                  <th>
                    С дивидендами <Hint text={metricExplanation('total')} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {cs.map((c) => (
                  <tr key={c}>
                    <th>{companies[c].name}</th>
                    <td data-testid={`cagr-price-${c}`}>
                      {pct(model.comparison[c].price?.cagr, 2)}
                    </td>
                    <td data-testid={`cagr-total-${c}`}>
                      {pct(model.comparison[c].total?.cagr, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            R = ((V₁/V₀)^(1/n) − 1) × 100%; n = фактические дни / 365,25 ={' '}
            {fmt(model.period.years, 4)} года. В дивидендном режиме V — стоимость с
            реинвестированием.
          </p>
          {model.period.limited && (
            <p className="footnote">
              За полный период 2021–2025 ценовой CAGR:{' '}
              {cs.map((c) => `${c} ${pct(model.fiveYear[c].price?.cagr, 2)}`).join('; ')}. Полный
              пятилетний дивидендный ряд T отсутствует; он не подменяется четырьмя годами.
            </p>
          )}
        </Card>
        <Card
          title="P/E на историческую дату"
          subtitle="Закрытие 30.12.2025 / базовая годовая EPS · ретроспективно"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Акция</th>
                  <th>Цена, ₽</th>
                  <th>
                    EPS, ₽ <Hint text={metricExplanation('eps')} />
                  </th>
                  <th>
                    P/E <Hint text={metricExplanation('pe')} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.valuations
                  .filter((v) => v.year === 2025 && cs.includes(v.company))
                  .map((v) => (
                    <tr key={v.company}>
                      <th>{v.company}</th>
                      <td>{fmt(v.price, 2)}</td>
                      <td>{fmt(v.eps, 3)}</td>
                      <td>{fmt(v.pe, 2)} ×</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Годовая EPS опубликована в 2026: этот P/E не был доступен инвестору в день цены. Цена и
            EPS T приведены к одной базе сплита; низкий P/E сам по себе не означает недооценку.
          </p>
        </Card>
      </div>
      <div className="dashboard-main">
        <Card
          title="Как менялась стоимость инвестиций"
          subtitle="Начальная стоимость = 100 · выбранный тип доходности"
          action={<Tag color="blue">ИСТОРИЯ</Tag>}
        >
          <TimeChart data={wealth} series={companySeries(mode)} kind="area" height={320} />
          <div className="chart-foot">
            <span>Дневные данные, показана каждая пятая торговая дата</span>
            <button className="text-button" onClick={() => navigate('risk')}>
              Анализ доходности <ArrowRight size={14} />
            </button>
          </div>
        </Card>
        <Card title="Акции в исследовании" subtitle="Закрытие 30 декабря 2025">
          <div className="company-list">
            {cs.map((c) => {
              const stat = model.stats[c];
              return (
                <div className="company-snapshot" key={c}>
                  <div className={`company-logo ${c === 'T' ? 't-logo' : 'sber-logo'}`}>
                    {c === 'T' ? 'T' : 'S'}
                  </div>
                  <div className="company-name">
                    <strong>{companies[c].name}</strong>
                    <span>MOEX: {c} · обыкновенные</span>
                  </div>
                  <div className="company-price">
                    <strong>{rub(data.market.monthly.at(-1)?.[c], 2)}</strong>
                    <span className={(stat?.cagr ?? 0) >= 0 ? 'positive' : 'negative'}>
                      {(stat?.cagr ?? 0) >= 0 ? (
                        <ArrowUpRight size={13} />
                      ) : (
                        <ArrowDownRight size={13} />
                      )}{' '}
                      {pct(stat?.cagr)} CAGR
                    </span>
                  </div>
                  <div className="company-risk">
                    <span>Риск рынка</span>
                    <Tag color={marketRisk(stat) === 'Высокий' ? 'red' : 'mint'}>
                      {marketRisk(stat)}
                    </Tag>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mini-insight">
            <ShieldCheck size={19} />
            <div>
              <strong>Устойчивость ≠ доходность</strong>
              <p>Прибыльный эмитент также может иметь глубокую просадку акций.</p>
            </div>
          </div>
          <button className="button wide" onClick={() => navigate('portfolio')}>
            Собрать портфель <ArrowRight size={16} />
          </button>
        </Card>
      </div>
      <div className="grid-two">
        <Card
          title="Финансовый масштаб"
          subtitle="Чистая прибыль группы, млрд ₽ · общая шкала"
          action={
            <button
              className="icon-button"
              aria-label="Открыть финансовый анализ"
              onClick={() => navigate('financial')}
            >
              <ArrowUpRight size={18} />
            </button>
          }
        >
          <TimeChart
            data={annual}
            series={companySeries(mode)}
            xKey="year"
            kind="bar"
            height={260}
          />
        </Card>
        <Card title="Что говорят данные" subtitle="Выводы пересчитываются вместе с моделью">
          <div className="insight-list">
            {model.conclusions.slice(0, 3).map((text, i) => (
              <div key={i}>
                <span className="insight-number">0{i + 1}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <button className="text-button" onClick={() => navigate('forecast')}>
            Прогноз и инвестиционный вывод <ArrowRight size={14} />
          </button>
        </Card>
      </div>
      <div className="grid-two">
        {cs.map((c) => (
          <Card key={c} title={companies[c].name} subtitle="Финансовое положение эмитента">
            <div className="status-line">
              <ShieldCheck size={21} />
              <strong>{stability(data.financial, c).category}</strong>
              <Tag>{stability(data.financial, c).score ?? '—'} / 6 сигналов</Tag>
            </div>
            <p className="muted">
              По прозрачным учебным критериям: прибыль, капитал, ROE, достаточность капитала и
              качество кредитов.
            </p>
            <button className="text-button" onClick={() => navigate('stability')}>
              Обоснование оценки <ArrowRight size={14} />
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}
