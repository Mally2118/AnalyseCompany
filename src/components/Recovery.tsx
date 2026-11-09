import { useState } from 'react';
import type { Company, FinancialData } from '../data/types';
import { reconstruction } from '../calculations/data-records';
import { DataStatus } from './DataStatus';
import { MetricHelp } from './MetricHelp';
import { fmt } from '../utils/format';
export function Recovery({ data, companies }: { data: FinancialData; companies: Company[] }) {
  const [method, setMethod] = useState<'direct' | 'interpolation' | 'regression'>('direct');
  return (
    <>
      <label className="field" htmlFor="recovery-method">
        <span>
          Метод восстановления <MetricHelp metric="interpolation" />
        </span>
        <select
          id="recovery-method"
          aria-label="Метод восстановления"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="direct">Прямой расчёт</option>
          <option value="interpolation">Линейная интерполяция</option>
          <option value="regression">Регрессия: прибыль от активов</option>
        </select>
      </label>
      {companies.map((c) => {
        const r = reconstruction(data, c, method);
        return (
          <div key={c}>
            <h3>{c}</h3>
            <p className="footnote">{r.reason}</p>
            {r.records.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Показатель</th>
                      <th>Год</th>
                      <th>Значение</th>
                      <th>Тип</th>
                      <th>Метод и входы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.records.map((f) => (
                      <tr key={f.year + f.metric}>
                        <th>
                          {method === 'direct'
                            ? 'Расчётная ROA по средним годовым активам'
                            : f.metric}{' '}
                          <MetricHelp metric={f.metric} />
                        </th>
                        <td>{f.year}</td>
                        <td>
                          {fmt(f.value, 3)}
                          {f.value === null ? '' : '%'}
                        </td>
                        <td>
                          <DataStatus fact={f} />
                        </td>
                        <td className="wrap-cell">
                          {f.provenance?.formula}
                          <small>{f.note}</small>
                          {f.provenance?.inputs.map((i, j) => (
                            <p key={j}>
                              {i.label}: {fmt(i.value, 3)} {i.unit} ·{' '}
                              <a
                                href={data.sources.find((s) => s.id === i.sourceId)?.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                источник
                              </a>
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
