import { RefreshCw } from 'lucide-react';
import type { Mode, Scenario, Company } from '../data/types';
import { companies } from '../data/types';
import type { AnalysisModel } from '../services/model';
import { Card, Disclosure, Hint, NumberField, SectionIntro } from '../components/ui';
import { metricExplanation } from '../data/metric-help';
import { fmt, pct, rub } from '../utils/format';
export function Forecast({
  model,
  scenarios,
  setScenarios,
  reset,
  mode,
  amount,
  weight,
}: {
  model: AnalysisModel;
  scenarios: Scenario[];
  setScenarios: (s: Scenario[]) => void;
  reset: () => void;
  mode: Mode;
  amount: number;
  weight: number;
}) {
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode];
  function update(id: string, key: keyof Scenario, value: number) {
    setScenarios(scenarios.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }
  return (
    <>
      <SectionIntro
        title="Прогноз 2026"
        description="Три сценария на базе EPS 2025. Учебные допущения, без заданных вероятностей."
      >
        <button className="button" onClick={reset}>
          <RefreshCw size={15} />
          Сбросить допущения
        </button>
      </SectionIntro>
      <p className="forecast-capital">
        Капитал {rub(amount)} · {fmt(weight * 100, 0)}% SBER / {fmt((1 - weight) * 100, 0)}% T.{' '}
        <a href="#calculator">Изменить</a>
      </p>
      <div className="scenario-grid">
        {scenarios.map((s) => {
          const r = model.results.find((r) => r.id === s.id);
          return (
            <Card key={s.id} title={s.name} className={`scenario-card scenario-${s.id}`}>
              {r ? (
                <>
                  {cs.map((c) => (
                    <div className="scenario-security" key={c}>
                      <strong className="mini-company">{companies[c].name}</strong>
                      <div>
                        <span>Цена акции</span>
                        <b>{rub(r[c].price, 2)}</b>
                      </div>
                      <div>
                        <span>Доходность с дивидендом</span>
                        <b>{pct(r[c].return)}</b>
                      </div>
                    </div>
                  ))}
                  <div className="scenario-total">
                    <span>Портфель · итог одного года</span>
                    <strong>{rub(r.value)}</strong>
                    <span>
                      Прибыль / убыток{' '}
                      <b className={r.profit >= 0 ? 'positive' : 'negative'}>{rub(r.profit)}</b> ·{' '}
                      {pct(r.return)}
                    </span>
                  </div>
                </>
              ) : (
                <p>Нет подтверждённой EPS для оценки.</p>
              )}
              <Disclosure title="Настроить сценарий">
                <p className="footnote">{s.premise}</p>
                {cs.map((c) => (
                  <div className="scenario-inputs" key={c}>
                    <strong className="mini-company">{companies[c].name}</strong>
                    <NumberField
                      label="Изменение EPS"
                      value={s[c === 'SBER' ? 'growthSBER' : 'growthT']}
                      onChange={(v) => update(s.id, c === 'SBER' ? 'growthSBER' : 'growthT', v)}
                      min={-95}
                      max={100}
                      suffix="%"
                    />
                    <div className="grid-two plain">
                      <NumberField
                        label="Сценарный P/E"
                        value={s[c === 'SBER' ? 'peSBER' : 'peT']}
                        onChange={(v) => update(s.id, c === 'SBER' ? 'peSBER' : 'peT', v)}
                        min={0.5}
                        max={30}
                        step={0.5}
                        suffix="×"
                      />
                      <NumberField
                        label="Доля выплат"
                        value={s[c === 'SBER' ? 'payoutSBER' : 'payoutT']}
                        onChange={(v) => update(s.id, c === 'SBER' ? 'payoutSBER' : 'payoutT', v)}
                        max={100}
                        suffix="%"
                      />
                    </div>
                    <p className="footnote">
                      Исторический P/E 2025:{' '}
                      {fmt(model.valuations.find((v) => v.company === c && v.year === 2025)?.pe, 2)}{' '}
                      ×. Дивиденд сценария: {rub(r?.[c].dividend, 2)}.{' '}
                      <Hint text={metricExplanation('pe')} />
                    </p>
                  </div>
                ))}
                <p className="footnote">
                  Риски: {s.risk} Допэмиссия и изменение дивидендной политики также меняют
                  результат.
                </p>
              </Disclosure>
            </Card>
          );
        })}
      </div>
      <Card title="Инвестиционный вывод">
        <p>{model.conclusions[1]}</p>
        <p className="compact-insight">
          Минимальный исторический риск: {pct(model.model?.min.weight, 0)} SBER /{' '}
          {pct(model.model ? 1 - model.model.min.weight : null, 0)} T. Сценарный результат зависит
          от роста прибыли, дивидендов и рыночной оценки.
        </p>
      </Card>
      <Disclosure title="Подробнее">
        <h3>Методика прогноза</h3>
        <p>
          Цена = EPS2025 × (1 + g) × P/E; дивиденд = EPS2026 × доля выплат. Доходность = (цена −
          цена конца 2025 + дивиденд) / цена конца 2025. Внутри года дивиденд не реинвестируется.
        </p>
        <p className="footnote">
          Базовая EPS: Сбер {rub(model.eps.SBER, 2)}, Т {rub(model.eps.T, 3)}. Цена и EPS T на общей
          базе сплита 1:10. EPS может содержать разовые эффекты, количество акций может измениться.
        </p>
        <p className="footnote">
          Исторический P/E ретроспективный: годовая EPS опубликована позже даты цены. Сценарный P/E
          — допущение. При неизменной EPS рост P/E на 10% повышает модельную цену на 10%.
        </p>
        <h3>Полный вывод</h3>
        <ol className="conclusion-list">
          {model.conclusions.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
        <p className="footnote">
          Ретроспективная учебная модель использует отчётность 2025, опубликованную в 2026, а не
          информацию, доступную 31.12.2025. Фактические результаты 2026 не используются. Две
          банковские группы, короткая история и структурные изменения ограничивают модель.
          Историческая доходность не гарантирует будущую; банкротство по пяти наблюдениям не
          предсказывается.
        </p>
      </Disclosure>
    </>
  );
}
