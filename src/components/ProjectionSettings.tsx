import { useState } from 'react';
import type { Scenario, Company } from '../data/types';
import { defaultPlan, type ProjectionPlans } from '../calculations/projection';
import { MetricHelp } from './MetricHelp';
export function ProjectionSettings({
  scenarios,
  plans,
  setPlans,
  horizon,
}: {
  scenarios: Scenario[];
  plans: ProjectionPlans;
  setPlans: (p: ProjectionPlans) => void;
  horizon: number;
}) {
  const [id, setId] = useState('base'),
    [company, setCompany] = useState<Company>('T');
  const s = scenarios.find((s) => s.id === id)!;
  const rows = defaultPlan(s, company).map((a, i) =>
    i === 0 ? a : { ...a, ...plans[id]?.[company]?.[i] },
  );
  function change(i: number, key: keyof (typeof rows)[number], v: number) {
    const next = [...(plans[id]?.[company] ?? [])];
    next[i] = { ...next[i], [key]: v };
    setPlans({
      ...plans,
      [id]: {
        ...plans[id],
        [company]: next,
      },
    });
  }
  return (
    <>
      <p className="footnote">
        Упрощённые учебные предпосылки, не прогноз эмитента: рост EPS плавно приближается к
        устойчивому темпу к пятому году (Сбер: 0/5/8%, T: 5/10/15% для
        негативного/базового/позитивного сценария). P/E после переоценки 2026 постоянен, выплаты
        сохраняют заданную долю. Каждое последующее значение можно изменить. Нет автоматической
        допэмиссии, налогов и комиссий; ребалансировка между компаниями не производится.
      </p>
      <div className="filter-row">
        <label className="field">
          <span>Сценарий траектории</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Компания траектории</span>
          <select value={company} onChange={(e) => setCompany(e.target.value as Company)}>
            <option value="SBER">Сбербанк</option>
            <option value="T">Т-Технологии</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Год</th>
              <th>
                Рост EPS, % <MetricHelp metric="forecast_eps" />
              </th>
              <th>
                P/E <MetricHelp metric="pe" />
              </th>
              <th>
                Выплаты, % <MetricHelp metric="payout" />
              </th>
              <th>
                Сплит, × <MetricHelp metric="eps" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, horizon).map((a, i) => (
              <tr key={i}>
                <th>{2026 + i}</th>
                {(['growth', 'pe', 'payout', 'shareFactor'] as const).map((key) => (
                  <td key={key}>
                    {i === 0 ? (
                      <span>{a[key]}</span>
                    ) : (
                      <input
                        className="year-assumption"
                        type="number"
                        step={key === 'growth' || key === 'payout' ? '1' : '0.1'}
                        min={key === 'growth' ? -99 : key === 'payout' ? 0 : 0.01}
                        max={key === 'payout' ? 100 : undefined}
                        aria-label={`${2026 + i} ${company} ${key}`}
                        value={a[key]}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          if (
                            Number.isFinite(v) &&
                            v > (key === 'growth' ? -100 : key === 'payout' ? -1 : 0) &&
                            (key !== 'payout' || v <= 100)
                          )
                            change(i, key, v);
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Параметры 2026 меняются на странице <a href="#forecast">«Прогноз 2026»</a>. Котировки и EPS
        уже на базе сплита 1:10; начальный коэффициент 1 предотвращает повторную корректировку.
        Будущий сплит меняет EPS и число акций взаимно; дополнительная эмиссия требует отдельного
        сценария EPS, а не множителя акций.
      </p>
      <button className="button" onClick={() => setPlans({})}>
        Сбросить годовые предпосылки
      </button>
    </>
  );
}
