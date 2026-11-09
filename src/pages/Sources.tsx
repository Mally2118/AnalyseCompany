import { useState } from 'react';
import { ExternalLink, FileJson } from 'lucide-react';
import type { DataSet } from '../services/data';
import { Card, Disclosure, SectionIntro } from '../components/ui';
import { MetricGuide } from '../components/MetricGuide';
import { fmt, date } from '../utils/format';
import { metrics, type Source } from '../data/types';
export function Sources({ data }: { data: DataSet }) {
  const [company, setCompany] = useState('all'),
    [year, setYear] = useState('all');
  const sources = [...data.financial.sources, ...data.market.sources].filter(
    (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
  );
  const financialIds = new Set(data.financial.sources.map((s) => s.id));
  const sourceList = (items: Source[]) => (
    <div className="source-list">
      {items.map((s) => (
        <div key={s.id}>
          <div>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
              <ExternalLink size={13} />
            </a>
            <span>
              {s.standard} · {s.section}
            </span>
            {s.note && <p>{s.note}</p>}
          </div>
          <code>{s.id}</code>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <SectionIntro
        title="Данные и источники"
        description="Документы, исходные значения и правила расчёта."
      />
      <p className="sources-summary">
        {data.financial.facts.filter((f) => f.value !== null).length} подтверждённых значений ·{' '}
        {fmt(data.market.quotes.length, 0)} торговых дат · проверено{' '}
        {date(data.financial.updatedAt)}
      </p>
      <Disclosure title="Финансовая отчётность">
        {sourceList(sources.filter((s) => financialIds.has(s.id)))}
        <Disclosure title="Показать исходную таблицу">
          <Card
            title="Исходные финансовые наблюдения"
            subtitle="Источник и примечание хранятся для каждого поля"
          >
            <div className="filter-row">
              <label className="field">
                <span>Компания</span>
                <select
                  aria-label="Компания"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  <option value="all">Все компании</option>
                  <option value="SBER">Сбербанк</option>
                  <option value="T">Т-Технологии</option>
                </select>
              </label>
              <label className="field">
                <span>Год</span>
                <select aria-label="Год" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="all">Все годы</option>
                  {[2021, 2022, 2023, 2024, 2025].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-scroll compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>Год</th>
                    <th>Показатель</th>
                    <th>Значение</th>
                    <th>Источник / раздел</th>
                    <th>Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financial.facts
                    .filter(
                      (f) =>
                        (company === 'all' || f.company === company) &&
                        (year === 'all' || f.year === Number(year)),
                    )
                    .map((f) => (
                      <tr key={f.company + f.year + f.metric}>
                        <td>{f.company}</td>
                        <td>{f.year}</td>
                        <td>{metrics[f.metric].label}</td>
                        <td>
                          {fmt(f.value, 3)} {f.value === null ? '' : f.unit}
                        </td>
                        <td>
                          <a
                            href={sources.find((s) => s.id === f.sourceId)?.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.sourceId}
                          </a>
                          <small>{f.section}</small>
                        </td>
                        <td className="wrap-cell">{f.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Disclosure>
      </Disclosure>
      <Disclosure title="Биржевые данные">
        {sourceList(sources.filter((s) => !financialIds.has(s.id)))}
        <p className="footnote">
          Проверка масштаба TCSG/T: {data.market.audit.overlap} общих дат; максимальная ошибка
          отношения 10:1 — {fmt(data.market.audit.maxRatioError, 10)}.
        </p>
        <ul className="readable-list">
          {data.market.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
        <p>
          ISS: документация{' '}
          <a href="https://www.moex.com/a2193" target="_blank" rel="noreferrer">
            Московской биржи
          </a>
          . Сервер возвращает CORS: {data.market.audit.cors}. Скрипт использует пагинацию, паузу 350
          мс и повторные попытки; общедоступный гарантированный лимит запросов не установлен. Данные
          предназначены для ознакомительного университетского исследования; свободный доступ не
          предоставляет права на коммерческое распространение. Точные условия определяет MOEX.
        </p>
      </Disclosure>
      <Disclosure title="Методология">
        <div className="timeline">
          <div>
            <span>2021–2023</span>
            <p>
              История TCS Group: GDR, каждая представляет одну обыкновенную акцию. USD-дивиденд 2021
              не переведён в рубли по неподтверждённому курсу.
            </p>
          </div>
          <div>
            <span>Март 2024</span>
            <p>
              После редомициляции торги акциями TCSG начались 18 марта. Преемственность GDR → акция
              1:1 подтверждается документами. Февраль 2024 не используется как полноценный конец
              месяца.
            </p>
          </div>
          <div>
            <span>2024</span>
            <p>
              Приобретение Росбанка и допэмиссия изменили капитал и финансовый периметр. 28 ноября
              торговый код TCSG заменён на T.
            </p>
          </div>
          <div>
            <span>Апрель 2026</span>
            <p>
              Сплит 1:10; торги возобновлены 17 апреля. Текущий ряд свечей ISS под T уже пересчитан.
              В коде повторное деление T на 10 не выполняется; TCSG используется для проверки
              масштаба.
            </p>
          </div>
        </div>
        <MetricGuide />
        <p className="footnote">
          Если обновление не проходит проверку масштаба или полноты, сохранённые JSON не заменяются.
          Приложение работает без внешних API.
        </p>
      </Disclosure>
      <Disclosure title="Исторические данные для скачивания">
        <div className="download-grid">
          {[
            'financial.json',
            'market.json',
            'dividends.json',
            'raw/SBER.json',
            'raw/T.json',
            'raw/TCSG.json',
          ].map((file) => (
            <a
              className="button"
              key={file}
              href={`${import.meta.env.BASE_URL}data/${file}`}
              download
            >
              <FileJson size={16} />
              {file}
            </a>
          ))}
        </div>
        <p className="footnote">
          Рыночный период заканчивается 30.12.2025. Выгрузка: {date(data.market.updatedAt)}; это не
          дата текущей котировки. Фактические результаты 2026 не используются.
        </p>
      </Disclosure>
    </>
  );
}
