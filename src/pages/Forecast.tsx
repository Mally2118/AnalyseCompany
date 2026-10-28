import { RefreshCw } from 'lucide-react';
import type { Mode, Scenario, Company } from '../data/types';
import { companies } from '../data/types';
import type { AnalysisModel } from '../services/model';
import { Card, Notice, NumberField, SectionIntro, Tag } from '../components/ui';
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
        eyebrow="СЦЕНАРНЫЙ АНАЛИЗ · 2026"
        title="Прогноз и инвестиционный вывод"
        description="Три возможных траектории, прозрачные предпосылки и чувствительность к оценке бизнеса."
      >
        <button className="button" onClick={reset}>
          <RefreshCw size={15} />
          Сбросить допущения
        </button>
      </SectionIntro>
      <Notice>
        Это ретроспективное учебное моделирование 2026 года на базе отчётности за 2025,
        опубликованной в 2026. Фактические результаты 2026 не используются. Модель не является
        прогнозом, доступным на 31.12.2025, и не получает вероятностей сценариев без обоснования.
      </Notice>
      <Card
        title="Как устроена оценка"
        subtitle="P2026 = EPS2025 × (1 + g) × P/E · D = EPS2026 × payout"
      >
        <div className="grid-two plain">
          <div>
            <p>
              Используется опубликованная базовая EPS: Сбер{' '}
              <strong>{rub(model.eps.SBER, 2)}</strong>, Т <strong>{rub(model.eps.T, 3)}</strong>. T
              и его цена на конец 2025 приведены к сплиту 1:10. EPS может включать разовые эффекты,
              а число акций в будущем может измениться.
            </p>
            <p className="muted">
              Полная доходность сценария = (целевая цена − цена 30.12.2025 + предполагаемый
              дивиденд) / цена 30.12.2025. Реинвестирование внутри одного сценарного года не
              предполагается.
            </p>
          </div>
          <div className="model-caption">
            <span>Моделируемый капитал</span>
            <strong>{rub(amount)}</strong>
            <span>
              {fmt(weight * 100, 0)}% Сбербанк · {fmt((1 - weight) * 100, 0)}% Т-Технологии
            </span>
            <a href="#calculator">Изменить сумму и доли →</a>
          </div>
        </div>
      </Card>
      <div className="scenario-grid">
        {scenarios.map((s) => {
          const r = model.results.find((r) => r.id === s.id);
          return (
            <Card key={s.id} className={`scenario-card scenario-${s.id}`}>
              <div className="scenario-title">
                <i style={{ background: s.color }} />
                <h2>{s.name}</h2>
                <Tag color={s.id === 'negative' ? 'red' : s.id === 'base' ? 'blue' : 'mint'}>
                  2026
                </Tag>
              </div>
              <p className="scenario-premise">{s.premise}</p>
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
                  {r && (
                    <div className="scenario-security">
                      <div>
                        <span>Модельная цена</span>
                        <b>{rub(r[c].price, 2)}</b>
                      </div>
                      <div>
                        <span>Дивиденд</span>
                        <b>{rub(r[c].dividend, 2)}</b>
                      </div>
                      <div>
                        <span>Доходность</span>
                        <b style={{ color: s.color }}>{pct(r[c].return)}</b>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {r ? (
                <div className="scenario-total">
                  <span>Портфель · итог одного года</span>
                  <strong style={{ color: s.color }}>{rub(r.value)}</strong>
                  <span>
                    Результат <b>{rub(r.profit)}</b> · {pct(r.return)}
                  </span>
                </div>
              ) : (
                <Notice>Нет подтверждённой EPS для сценарной оценки.</Notice>
              )}
              <p className="footnote">
                <b>Что может нарушить сценарий:</b> {s.risk} Допэмиссия и изменение дивидендной
                политики также меняют результат.
              </p>
            </Card>
          );
        })}
      </div>
      <Card
        title="Инвестиционный вывод"
        subtitle="Сформирован из текущих данных, весов и безрисковой ставки"
      >
        <ol className="conclusion-list">
          {model.conclusions.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
          {model.results.length > 0 && (
            <li>
              При капитале {rub(amount)} сценарные результаты 2026:{' '}
              {model.results
                .map((r) => `${r.name.toLowerCase()} — ${rub(r.value)} (${pct(r.return)})`)
                .join('; ')}
              . Все три результата зависят от заданных EPS, P/E и доли выплат.
            </li>
          )}
        </ol>
      </Card>
      <Notice tone="warn">
        Ограничения исследования: две группы из одного сектора, короткая история и структурные
        изменения Т. Доходности, корреляция и оптимальные доли чувствительны к периоду наблюдения.
        Ни пять годовых наблюдений, ни портфельная модель не позволяют достоверно предсказывать
        банкротство.
      </Notice>
    </>
  );
}
