import { useState } from 'react';
import { categories, metricHelp } from '../data/metric-help';
import { MathFormula } from '../components/MathFormula';
import { Card, SectionIntro } from '../components/ui';
const pages: Record<string, string> = {
  overview: 'Обзор',
  financial: 'Финансовый анализ',
  risk: 'Доходность и риск',
  portfolio: 'Портфель Марковица',
  calculator: 'Калькулятор',
  forecast: 'Прогноз 2026',
  stability: 'Устойчивость',
};
export function MetricGuide({ selected }: { selected?: string }) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all');
  const m = selected ? metricHelp[selected] : undefined;
  return (
    <>
      <SectionIntro
        title="Формулы и показатели"
        description="Определения, примеры и ограничения финансовых моделей."
      />
      {selected && m ? (
        <>
          <a className="button" href="#guide">
            Все показатели
          </a>
          <Card title={m.name} subtitle={m.category}>
            <h3>Что это такое?</h3>
            <p>{m.meaning}</p>
            <h3>Формула</h3>
            <MathFormula latex={m.latex} />
            <h3>Обозначения</h3>
            <p>{m.variables}</p>
            <h3>Пример расчёта</h3>
            <p>{m.example}</p>
            <h3>Как интерпретировать?</h3>
            <p>{m.interpretation}</p>
            <h3>Где используется?</h3>
            <div className="guide-uses">
              {m.uses.map((p) => (
                <a key={p} href={`#${p}`}>
                  {pages[p]}
                </a>
              ))}
            </div>
            <h3>Ограничения</h3>
            <p>{m.limitations}</p>
          </Card>
        </>
      ) : (
        <>
          {selected && <p>Показатель не найден. Выберите его в справочнике.</p>}
          <div className="filter-row">
            <label className="field">
              <span>Поиск показателя</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Название, сокращение или смысл"
              />
            </label>
            <label className="field">
              <span>Категория</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">Все категории</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {categories
            .filter((c) => category === 'all' || c === category)
            .map((c) => {
              const rows = Object.entries(metricHelp).filter(
                ([, m]) =>
                  m.category === c &&
                  `${m.name} ${m.meaning}`
                    .toLocaleLowerCase('ru')
                    .includes(query.toLocaleLowerCase('ru')),
              );
              return rows.length ? (
                <section className="guide-category" key={c}>
                  <h2>{c}</h2>
                  {rows.map(([id, m]) => (
                    <a className="guide-entry" href={`#guide/${id}`} key={id}>
                      <strong>{m.name}</strong>
                      <span>{m.meaning}</span>
                    </a>
                  ))}
                </section>
              ) : null;
            })}
          {!Object.values(metricHelp).some(
            (m) =>
              (category === 'all' || m.category === category) &&
              `${m.name} ${m.meaning}`
                .toLocaleLowerCase('ru')
                .includes(query.toLocaleLowerCase('ru')),
          ) && <p role="status">Показатели не найдены.</p>}
        </>
      )}
      <a className="text-button" href="#overview">
        К обзору
      </a>
    </>
  );
}
