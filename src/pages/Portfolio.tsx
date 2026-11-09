import { ArrowRight, Sparkles, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Card, Disclosure, Notice, NumberField, SectionIntro } from '../components/ui';
import { FrontierChart, TimeChart } from '../charts/Charts';
import type { AnalysisModel } from '../services/model';
import { investmentLimits } from '../calculations/calculator';
import { fmt, pct, rub, date } from '../utils/format';
import { ProjectionSettings } from '../components/ProjectionSettings';
import { MetricHelp } from '../components/MetricHelp';
import { MathFormula } from '../components/MathFormula';
import type { Scenario } from '../data/types';
import type { DividendMode, ProjectionPlans } from '../calculations/projection';
export interface PortfolioControls {
  dividendMode: DividendMode;
  setDividendMode: (v: DividendMode) => void;
  plans: ProjectionPlans;
  setPlans: (v: ProjectionPlans) => void;
  scenarios: Scenario[];
  model: AnalysisModel;
  weight: number;
  setWeight: (w: number) => void;
  rf: number;
  setRf: (v: number) => void;
  amount: number;
  setAmount: (v: number) => void;
  horizon: number;
  setHorizon: (v: number) => void;
  method: string;
  setMethod: (m: string) => void;
}
export function WeightControl({
  weight,
  setWeight,
}: {
  weight: number;
  setWeight: (w: number) => void;
}) {
  return (
    <div className="weight-control">
      <div className="weight-labels">
        <span>
          <i className="dot mint-bg" />
          Сбербанк <strong>{fmt(weight * 100, 0)}%</strong>
        </span>
        <span>
          <i className="dot blue-bg" />
          Т-Технологии <strong>{fmt((1 - weight) * 100, 0)}%</strong>
        </span>
      </div>
      <input
        aria-label="Доля Сбербанка"
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(weight * 100)}
        onChange={(e) => setWeight(Number(e.target.value) / 100)}
        style={{
          background: `linear-gradient(90deg, #40cbb0 ${weight * 100}%, #78a0ff ${weight * 100}%)`,
        }}
      />
      <div className="range-labels">
        <span>0% SBER</span>
        <span>50 / 50</span>
        <span>100% SBER</span>
      </div>
    </div>
  );
}
export function PortfolioPage(p: PortfolioControls) {
  const m = p.model.model,
    s = p.model.selected;
  if (!m || !s) return <Notice>Недостаточно синхронных наблюдений для оптимизации.</Notice>;
  return (
    <>
      <SectionIntro
        title="Портфель Марковица"
        description="Модель Марковица · два рискованных актива · без коротких продаж и кредитного плеча."
      />
      <div className="portfolio-layout">
        <Card
          title="Эффективная граница"
          subtitle={`${p.model.pair.rows.length} синхронных месяцев · 101 комбинация с шагом 1%`}
        >
          <FrontierChart
            points={m.points}
            selected={s}
            min={m.min}
            max={m.max}
            onSelect={(w) => {
              p.setMethod('manual');
              p.setWeight(w);
            }}
          />
        </Card>
        <Card title="Ваше распределение" subtitle="Измените вес и сравните результат">
          <WeightControl
            weight={p.weight}
            setWeight={(w) => {
              p.setMethod('manual');
              p.setWeight(w);
            }}
          />
          <div className="portfolio-result">
            <div>
              <span>
                Ожидаемая / год · арифм. <MetricHelp metric="portfolio_return" />
              </span>
              <strong>{pct(s.mean)}</strong>
            </div>
            <div>
              <span>
                Годовой риск <MetricHelp metric="portfolio_risk" />
              </span>
              <strong>{pct(s.risk)}</strong>
            </div>
            <div>
              <span>
                Коэффициент Шарпа <MetricHelp metric="sharpe" />
              </span>
              <strong>{fmt(s.sharpe, 2)}</strong>
            </div>
          </div>
          <p className="footnote">
            Исторический CAGR: {pct(p.model.historical.selected.cagr, 2)}{' '}
            <MetricHelp metric="cagr" /> · учебная Rf {pct(p.rf)}. История не гарантирует будущий
            результат.
          </p>
          <button
            className="button primary wide"
            onClick={() => {
              p.setMethod('sharpe');
              p.setWeight(m.max.weight);
            }}
          >
            <Sparkles size={16} />
            Максимальный Шарп
          </button>
          <button
            className="button wide"
            onClick={() => {
              p.setMethod('minimum');
              p.setWeight(m.min.weight);
            }}
          >
            <ShieldCheck size={16} />
            Минимальный риск
          </button>
        </Card>
      </div>
      <Disclosure title="Методика и подробные расчёты">
        <NumberField
          label="Безрисковая ставка, годовых"
          value={p.rf * 100}
          onChange={(v) => p.setRf(v / 100)}
          max={50}
          step={0.5}
          suffix="%"
        />
        <p className="footnote">
          Начальные 10% Rf — учебное допущение. Rf месяца = (1 + Rf года)^(1/12) − 1.
        </p>
        <Card
          title="Арифметическая оценка и исторический CAGR"
          subtitle={`База ${date(p.model.period.from)} — ${date(p.model.period.till)} · одинаковые даты и общая выборка для обоих активов`}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Актив / портфель</th>
                  <th>12 × μ месяца</th>
                  <th>CAGR фактической стоимости</th>
                  <th>σ год</th>
                  <th>Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {(['SBER', 'T'] as const).map((c) => (
                  <tr key={c}>
                    <th>{c} · 100%</th>
                    <td>{pct(p.model.stats[c]?.annualMean, 2)}</td>
                    <td>{pct(p.model.stats[c]?.cagr, 2)}</td>
                    <td>{pct(p.model.stats[c]?.annualVol, 2)}</td>
                    <td>{fmt(p.model.stats[c]?.sharpe, 3)}</td>
                  </tr>
                ))}
                <tr>
                  <th>Ваш портфель</th>
                  <td>{pct(s.mean, 2)}</td>
                  <td>{pct(p.model.historical.selected.cagr, 2)}</td>
                  <td>{pct(s.risk, 2)}</td>
                  <td>{fmt(s.sharpe, 3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Для Сбера за 2023–2025 значения 27,54% без дивидендов и 38,83% с дивидендами —
            историческое среднее месяца × 12, а не стабильная ожидаемая ставка. Кризисные движения
            не удаляются и не ограничиваются. CAGR учитывает реальную длительность периода и сложный
            процент.
          </p>
          <p className="footnote">
            Пятилетняя база 30.12.2020–30.12.2025 при текущих весах: арифметическая оценка{' '}
            {pct(p.model.fiveYearPortfolio?.annualMean, 2)}, CAGR{' '}
            {pct(p.model.fiveYearPortfolio?.cagr, 2)}.{' '}
            {p.model.fiveYearPortfolio === null
              ? 'Для пятилетнего портфеля с T нет полного дивидендного ряда; частичный результат не называется пятилетним.'
              : ''}
          </p>
          <p className="footnote">
            Модель Марковица использует {p.model.pair.rows.length} общих месячных интервалов;
            февраль и март 2024 пропущены из-за отсутствующего конца февраля. Дневной портфельный
            CAGR удерживает позиции через паузу: ребалансировка только в доступные общие концы
            месяцев. При 0% или 100% результат совпадает с соответствующим активом.
          </p>
        </Card>
        <div className="grid-two">
          <Card
            title="Портфель минимального риска"
            subtitle="Минимум выборочной дисперсии среди 101 веса"
          >
            <div className="allocation">
              <strong>
                {fmt(m.min.weight * 100, 0)}
                <small>% SBER</small>
              </strong>
              <span> / </span>
              <strong>
                {fmt((1 - m.min.weight) * 100, 0)}
                <small>% T</small>
              </strong>
            </div>
            <div className="triplet">
              <div>
                <span>Арифм. оценка / год</span>
                <b>{pct(m.min.mean)}</b>
              </div>
              <div>
                <span>Риск</span>
                <b>{pct(m.min.risk)}</b>
              </div>
              <div>
                <span>Sharpe</span>
                <b>{fmt(m.min.sharpe, 2)}</b>
              </div>
            </div>
          </Card>
          <Card
            title="Портфель максимального Sharpe"
            subtitle="Максимальная премия к риску при заданной Rf"
          >
            <div className="allocation">
              <strong>
                {fmt(m.max.weight * 100, 0)}
                <small>% SBER</small>
              </strong>
              <span> / </span>
              <strong>
                {fmt((1 - m.max.weight) * 100, 0)}
                <small>% T</small>
              </strong>
            </div>
            <div className="triplet">
              <div>
                <span>Арифм. оценка / год</span>
                <b>{pct(m.max.mean)}</b>
              </div>
              <div>
                <span>Риск</span>
                <b>{pct(m.max.risk)}</b>
              </div>
              <div>
                <span>Sharpe</span>
                <b>{fmt(m.max.sharpe, 2)}</b>
              </div>
            </div>
          </Card>
        </div>
        <Notice>
          Эффективная доходность и эффективный риск — характеристики конкретного портфеля на
          эффективной границе. Максимум Sharpe учитывает премию доходности над Rf, а минимум
          дисперсии учитывает только риск, поэтому их веса могут различаться.
        </Notice>
        <Card
          title="Методика и ковариационная матрица"
          subtitle="Годовой масштаб: месячная ковариационная матрица × 12"
        >
          <div className="formula-grid">
            <MathFormula latex="E(R_p)=wE(R_s)+(1-w)E(R_t)" />
            <MathFormula latex={'\\sigma_p^2=w^2\\sigma_s^2+(1-w)^2\\sigma_t^2+2w(1-w)Cov(s,t)'} />
            <MathFormula latex={'S=\\frac{\\mu_m-R_{f,m}}{\\sigma_m}\\sqrt{12}'} />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cov · год</th>
                  <th>SBER</th>
                  <th>T</th>
                </tr>
              </thead>
              <tbody>
                {m.covariance.map((r, i) => (
                  <tr key={i}>
                    <th>{i === 0 ? 'SBER' : 'T'}</th>
                    {r.map((v, j) => (
                      <td key={j}>{fmt(v, 6)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Эффективные комбинации определяются проверкой доминирования: нет другого веса с меньшим
            или равным риском и большей или равной доходностью при хотя бы одном строгом улучшении.
            Доходность арифметическая, 12 × μ месяца; это оценка модели по истории. Предполагается
            ежемесячное поддержание весов (ребалансировка) без издержек.
          </p>
        </Card>
        <Card title="Все допустимые комбинации" subtitle="Выберите строку для изменения весов">
          <div className="table-scroll compact-table">
            <table>
              <thead>
                <tr>
                  <th>SBER</th>
                  <th>T</th>
                  <th>Доходность / год</th>
                  <th>Риск / год</th>
                  <th>Sharpe</th>
                  <th>Эффективный</th>
                </tr>
              </thead>
              <tbody>
                {m.points.map((q) => (
                  <tr key={q.weight} className={q.weight === p.weight ? 'selected-row' : ''}>
                    <td>
                      <button
                        className="cell-button"
                        onClick={() => {
                          p.setMethod('manual');
                          p.setWeight(q.weight);
                        }}
                      >
                        {fmt(q.weight * 100, 0)}%
                      </button>
                    </td>
                    <td>{fmt((1 - q.weight) * 100, 0)}%</td>
                    <td>{pct(q.mean)}</td>
                    <td>{pct(q.risk)}</td>
                    <td>{fmt(q.sharpe, 2)}</td>
                    <td>{q.efficient ? 'Да' : 'Нет'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Disclosure>
    </>
  );
}
export function Calculator(p: PortfolioControls) {
  const path =
    p.model.projections[0]?.path.map((q, i) => ({
      year: q.year,
      ...Object.fromEntries(p.model.projections.map((r) => [r.id, r.path[i].value])),
    })) ?? [];
  return (
    <>
      <SectionIntro
        title="Калькулятор"
        description="Настройте сумму, распределение и горизонт. Сравните сценарные результаты в рублях."
      />
      <div className="portfolio-layout">
        <Card
          title="Сценарная стоимость портфеля"
          subtitle={p.horizon === 1 ? 'Один год · EPS × P/E' : 'Годовые EPS, P/E и дивиденды'}
        >
          <TimeChart
            data={path}
            series={p.model.results.map((r) => ({ key: r.id, name: r.name, color: r.color }))}
            xKey="year"
            height={340}
          />
          <p className="footnote">
            Переоценка P/E не повторяется автоматически. Дивиденды:{' '}
            {p.dividendMode === 'reinvest'
              ? 'реинвестируются по цене конца года'
              : 'накапливаются деньгами без процентов'}
            .
          </p>
        </Card>
        <Card title="Параметры инвестиций" action={<SlidersHorizontal size={17} />}>
          <div className="amount-control">
            <label htmlFor="investment-amount-range">
              Сумма инвестиций — ползунок <strong>{rub(p.amount)}</strong>
            </label>
            <input
              id="investment-amount-range"
              aria-label="Сумма инвестиций — ползунок"
              aria-valuetext={rub(p.amount)}
              type="range"
              min={investmentLimits.min}
              max={investmentLimits.max}
              step={investmentLimits.step}
              value={Math.round(p.amount / investmentLimits.step) * investmentLimits.step}
              onChange={(e) => p.setAmount(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>{rub(investmentLimits.min)}</span>
              <span>{rub(investmentLimits.max)}</span>
            </div>
          </div>
          <NumberField
            label="Сумма инвестиций"
            value={p.amount}
            onChange={p.setAmount}
            min={investmentLimits.min}
            max={investmentLimits.max}
            step={1}
            suffix="₽"
          />
          <label className="field">
            <span>Режим прогноза</span>
            <select
              aria-label="Режим прогноза"
              value={p.horizon === 1 ? 'one' : 'multi'}
              onChange={(e) => p.setHorizon(e.target.value === 'one' ? 1 : Math.max(2, p.horizon))}
            >
              <option value="one">Один год — 2026</option>
              <option value="multi">Многолетний — 2–10 лет</option>
            </select>
          </label>
          <label className="field" htmlFor="forecast-dividend-mode">
            <span>
              Дивиденды в прогнозе <MetricHelp metric="total" />
            </span>
            <select
              id="forecast-dividend-mode"
              aria-label="Дивиденды в прогнозе"
              value={p.dividendMode}
              onChange={(e) => p.setDividendMode(e.target.value as DividendMode)}
            >
              <option value="reinvest">Реинвестировать</option>
              <option value="cash">Накапливать деньгами</option>
            </select>
          </label>
          <NumberField
            label="Инвестиционный горизонт"
            value={p.horizon}
            onChange={(v) => p.setHorizon(Math.round(v))}
            min={1}
            max={10}
            suffix="лет"
          />
          <label className="field">
            <span>Метод распределения</span>
            <select
              value={p.method}
              onChange={(e) => {
                const method = e.target.value;
                p.setMethod(method);
                if (method === 'minimum' && p.model.model) p.setWeight(p.model.model.min.weight);
                if (method === 'sharpe' && p.model.model) p.setWeight(p.model.model.max.weight);
              }}
            >
              <option value="manual">Вручную</option>
              <option value="minimum">Минимальный риск</option>
              <option value="sharpe">Максимальный Sharpe</option>
            </select>
          </label>
          <WeightControl
            weight={p.weight}
            setWeight={(w) => {
              p.setMethod('manual');
              p.setWeight(w);
            }}
          />
          <div className="investment-split">
            <div>
              <span>В Сбербанк</span>
              <b>{rub(p.model.allocation.SBER)}</b>
            </div>
            <div>
              <span>В Т-Технологии</span>
              <b>{rub(p.model.allocation.T)}</b>
            </div>
          </div>
        </Card>
      </div>
      <div className="scenario-grid">
        {p.model.projections.map((r) => {
          const v = r.value;
          return (
            <Card
              key={r.id}
              title={r.name}
              subtitle={`${p.horizon} лет · прогнозный CAGR ${pct(r.cagr)}`}
            >
              <span className="scenario-value" style={{ color: r.color }}>
                {rub(v)}
              </span>
              <div className="scenario-profit">
                Прибыль / убыток <MetricHelp metric="value" />{' '}
                <strong className={v - p.amount >= 0 ? 'positive' : 'negative'}>
                  {rub(v - p.amount)}
                </strong>
              </div>
            </Card>
          );
        })}
      </div>
      <Card title="Исторические показатели и прогноз">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>История выбранного портфеля</th>
                <th>Значение</th>
                <th>Сценарий</th>
                <th>
                  CAGR <MetricHelp metric="forecast_cagr" />
                </th>
                <th>
                  Стоимость <MetricHelp metric="value" />
                </th>
                <th>
                  Прибыль / убыток <MetricHelp metric="value" />
                </th>
              </tr>
            </thead>
            <tbody>
              {p.model.projections.map((r, i) => (
                <tr key={r.id}>
                  <th>
                    {i === 0
                      ? 'Исторический CAGR'
                      : i === 1
                        ? 'Годовая волатильность'
                        : 'Максимальная просадка'}{' '}
                    <MetricHelp metric={i === 0 ? 'cagr' : i === 1 ? 'volatility' : 'drawdown'} />
                  </th>
                  <td>
                    {pct(
                      i === 0
                        ? p.model.portfolioStats?.cagr
                        : i === 1
                          ? p.model.portfolioStats?.annualVol
                          : p.model.portfolioStats?.maxDrawdown,
                    )}
                  </td>
                  <th className="forecast-origin">{r.name} · прогноз</th>
                  <td>{pct(r.cagr)}</td>
                  <td>{rub(r.value)}</td>
                  <td>{rub(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.model.projections.some(
          (r) =>
            r.cagr !== null &&
            p.model.portfolioStats?.cagr != null &&
            r.cagr - p.model.portfolioStats.cagr > 0.1,
        ) && (
          <p className="footnote" role="status">
            Прогнозный CAGR как минимум одного сценария выше исторического более чем на 10 п.п. Это
            учебный порог чувствительности, не оценка вероятности; результат не ограничивается
            автоматически.
          </p>
        )}
        <p className="footnote">
          История и прогноз относятся к разным периодам и стратегиям. Исторический портфель
          ребалансируется в доступные концы месяцев, прогноз удерживает позиции и выбранный режим
          дивидендов. Историческая доходность не гарантирует будущую.
        </p>
      </Card>
      <Disclosure title="Годовые предпосылки">
        <ProjectionSettings
          scenarios={p.scenarios}
          plans={p.plans}
          setPlans={p.setPlans}
          horizon={p.horizon}
        />
      </Disclosure>
      <Disclosure title="Подробнее">
        <p className="capital-conclusion">{p.model.conclusions.at(-1)}</p>
        <h3>Годовая стоимость портфеля</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Год</th>
                {p.model.projections.map((r) => (
                  <th key={r.id}>{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {path.map((q) => (
                <tr key={q.year}>
                  <th>{q.year}</th>
                  {p.model.projections.map((r) => (
                    <td key={r.id}>{rub(r.path.find((t) => t.year === q.year)?.value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
      <p className="footnote">
        Сценарии — допущения EPS × P/E, без налогов и комиссий. Доходность не гарантирована.
      </p>
      <a className="button" href="#forecast">
        Изменить сценарии 2026 <ArrowRight size={15} />
      </a>
    </>
  );
}
