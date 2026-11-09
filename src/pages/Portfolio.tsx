import { ArrowRight, Sparkles, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Card, Disclosure, Notice, NumberField, SectionIntro, Hint } from '../components/ui';
import { FrontierChart, TimeChart } from '../charts/Charts';
import type { AnalysisModel } from '../services/model';
import { metricExplanation } from '../data/metric-help';
import { investmentLimits } from '../calculations/calculator';
import { fmt, pct, rub, date } from '../utils/format';
import { compound } from '../calculations/statistics';
export interface PortfolioControls {
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
                Ожидаемая / год · арифм. <Hint text={metricExplanation('arithmetic')} />
              </span>
              <strong>{pct(s.mean)}</strong>
            </div>
            <div>
              <span>Годовой риск</span>
              <strong>{pct(s.risk)}</strong>
            </div>
            <div>
              <span>Коэффициент Шарпа</span>
              <strong>{fmt(s.sharpe, 2)}</strong>
            </div>
          </div>
          <p className="footnote">
            Исторический CAGR: {pct(p.model.historical.selected.cagr, 2)}{' '}
            <Hint text={metricExplanation('cagr')} /> · учебная Rf {pct(p.rf)}. История не
            гарантирует будущий результат.
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
            <code>E(Rp) = w × E(Rs) + (1 − w) × E(Rt)</code>
            <code>σp² = w²σs² + (1 − w)²σt² + 2w(1 − w)Cov(s,t)</code>
            <code>Sharpe = (μмесяца − Rfмесяца) / σмесяца × √12</code>
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
  const path = Array.from({ length: p.horizon * 4 + 1 }, (_, i) => ({
    year: i / 4,
    ...Object.fromEntries(p.model.results.map((r) => [r.id, compound(p.amount, r.return, i / 4)])),
  }));
  return (
    <>
      <SectionIntro
        title="Калькулятор"
        description="Настройте сумму, распределение и горизонт. Сравните сценарные результаты в рублях."
      />
      <div className="portfolio-layout">
        <Card
          title="Сценарная стоимость портфеля"
          subtitle="Постоянная годовая ставка каждого сценария, сложный процент"
        >
          <TimeChart
            data={path}
            series={p.model.results.map((r) => ({ key: r.id, name: r.name, color: r.color }))}
            xKey="year"
            height={340}
          />
          <p className="footnote">
            Сценарные ставки повторяются со сложным процентом; это учебное допущение.
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
        {p.model.results.map((r) => {
          const v = compound(p.amount, r.return, p.horizon);
          return (
            <Card key={r.id} title={r.name} subtitle={`${p.horizon} лет · ${pct(r.return)} в год`}>
              <span className="scenario-value" style={{ color: r.color }}>
                {rub(v)}
              </span>
              <div className="scenario-profit">
                Прибыль / убыток{' '}
                <strong className={v - p.amount >= 0 ? 'positive' : 'negative'}>
                  {rub(v - p.amount)}
                </strong>
              </div>
            </Card>
          );
        })}
      </div>
      <Disclosure title="Подробнее">
        <p className="footnote">
          По горизонтали — лет от начала моделирования. Для горизонта более года механически
          повторяется доходность сценария 2026: V = V₀ × (1 + R)^t. Это отдельное учебное допущение,
          а не прогноз эмитентов на последующие годы.
        </p>
        <p className="capital-conclusion">{p.model.conclusions.at(-1)}</p>
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
