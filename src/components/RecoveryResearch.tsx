import { useMemo, useState } from 'react';
import type { DataSet } from '../services/data';
import type { ReturnKind } from '../data/types';
import { recoverySensitivity, recoveryMethodNames } from '../calculations/recovery';
import { Disclosure } from './ui';
import { MetricHelp } from './MetricHelp';
import { MathFormula } from './MathFormula';
import { date, fmt, pct, rub } from '../utils/format';
export function RecoveryResearch({
  data,
  kind,
  start,
  rf,
  weight,
}: {
  data: DataSet;
  kind: ReturnKind;
  start: number;
  rf: number;
  weight: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const recovery = data.recovery;
  const sensitivity = useMemo(
    () =>
      enabled && recovery ? recoverySensitivity(data, recovery, kind, start, rf, weight) : null,
    [enabled, recovery, data, kind, start, rf, weight],
  );
  if (!recovery)
    return (
      <p className="footnote">Исследование восстановления: {data.recoveryError ?? 'нет данных'}.</p>
    );
  const fit = recovery.models.find((m) => m.method === recovery.selectedFactorModel)!;
  const validation = recovery.validation.filter(
    (q) => q.phase === 'validation' && q.mode === 'bridge' && q.length === null,
  );
  const test = recovery.validation.filter(
    (q) => q.phase === 'test' && q.mode === 'bridge' && q.length === null,
  );
  const winner = (rows: typeof validation) =>
    rows.reduce((a, b) => (a.relativeRmse < b.relativeRmse ? a : b));
  const beatsInterpolation =
    validation.find((q) => q.method === recovery.selectedMethod)!.relativeRmse <
    validation.find((q) => q.method === 'interpolation')!.relativeRmse;

  return (
    <Disclosure title="Эконометрическая модель восстановления">
      <p className="footnote">
        Проверено {date(recovery.updatedAt)} · исторические данные 2021–2025.
      </p>
      <p>
        {recovery.summary.missing} пропуска: фактических котировок дополнено{' '}
        {recovery.summary.actualRecovered}; условных оценок {recovery.summary.estimated}; оставлено
        без оценки {recovery.summary.leftUnestimated}. Все исходные котировки сохранены.
      </p>
      <p>
        Выбранный метод: <strong>{recoveryMethodNames[recovery.selectedMethod]}</strong>{' '}
        <MetricHelp
          metric={
            recovery.selectedMethod === 'interpolation' ? 'log_interpolation' : 'linear_regression'
          }
        />
        . Условная стоимость при отсутствии торгов TQBR не означает возможность сделки.
      </p>
      <MathFormula
        latex={
          fit.method === 'market'
            ? 'r_t^T=\\alpha+\\beta_M r_t^M+\\varepsilon_t'
            : 'r_t^T=\\alpha+\\beta_M r_t^M+\\beta_S r_t^S+\\varepsilon_t'
        }
      />
      <p>
        Лог-доходность <MetricHelp metric="log_return" />; α = {fmt(fit.coefficients[0], 6)}; β
        IMOEX <MetricHelp metric="beta" /> = {fmt(fit.coefficients[1], 4)}
        {fit.coefficients.length > 2 ? `; β SBER = ${fmt(fit.coefficients[2], 4)}` : ''}. Обучение:{' '}
        {date(fit.from)} — {date(fit.till)}, {fit.n} интервала. R² обучения{' '}
        <MetricHelp metric="r_squared" /> = {fmt(fit.r2, 3)}.
      </p>
      <p className="footnote">
        Выбор сделан на {validation[0]?.folds} validation-блоках до 2025 года по относительной RMSE.
        Test 2025 ({test[0]?.folds} блоков) не участвовал в выборе. SBER допускается только при VIF
        ≤ 5 и улучшении validation. Лучший метод на test: {recoveryMethodNames[winner(test).method]}
        ; менять выбор по test нельзя.
      </p>
      <div className="table-scroll">
        <table className="recovery-quality">
          <thead>
            <tr>
              <th>Проверка / метод</th>
              <th>Блоков</th>
              <th>
                MAE, ₽ <MetricHelp metric="mae" />
              </th>
              <th>
                RMSE, ₽ <MetricHelp metric="rmse" />
              </th>
              <th>Относительная RMSE</th>
            </tr>
          </thead>
          <tbody>
            {recovery.validation
              .filter((q) => q.length === null && q.mode === 'bridge')
              .map((q) => (
                <tr key={`${q.phase}-${q.method}`}>
                  <th>
                    {q.phase === 'test' ? 'Проверка 2025' : 'Подбор до 2025'} ·{' '}
                    {recoveryMethodNames[q.method]}
                  </th>
                  <td>{q.folds}</td>
                  <td>{fmt(q.mae, 3)}</td>
                  <td>{fmt(q.rmse, 3)}</td>
                  <td>{pct(q.relativeRmse, 2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Средние ошибки по блокам на общей базе сплита.{' '}
        {beatsInterpolation
          ? 'Выбранный рыночный метод улучшил validation относительно интерполяции.'
          : 'Рыночные факторы не улучшили validation: выбран контрольный метод.'}{' '}
        Ошибки торговых дней не проверяют истинную цену в период остановки.
      </p>
      <label className="research-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Оценка чувствительности к восстановлению пропусков
      </label>
      {sensitivity && (
        <div className="research-comparison">
          <p>
            <strong>Исследовательский расчёт на модельных данных.</strong> Общих месяцев:{' '}
            {sensitivity.before.pair.rows.length} → {sensitivity.after.pair.rows.length}; добавлены{' '}
            {sensitivity.addedMonths.map(date).join(', ') || 'не добавлены'}.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th>Только факты</th>
                  <th>Факты + условные оценки</th>
                </tr>
              </thead>
              <tbody>
                {(['SBER', 'T'] as const).flatMap((c) =>
                  (
                    [
                      ['Арифметическая доходность / год', 'annualMean'],
                      ['Волатильность / год', 'annualVol'],
                      ['Коэффициент Шарпа', 'sharpe'],
                      ['CAGR фактических краёв', 'cagr'],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={c + key}>
                      <th>
                        {c} · {label}
                        <MetricHelp
                          metric={
                            key === 'annualMean'
                              ? 'arithmetic'
                              : key === 'annualVol'
                                ? 'volatility'
                                : key === 'sharpe'
                                  ? 'sharpe'
                                  : 'cagr'
                          }
                        />
                      </th>
                      {[sensitivity.before, sensitivity.after].map((a, i) => (
                        <td key={i}>
                          {key === 'sharpe' ? fmt(a.stats[c]?.[key], 3) : pct(a.stats[c]?.[key], 2)}
                        </td>
                      ))}
                    </tr>
                  )),
                )}
                <tr>
                  <th>
                    Корреляция <MetricHelp metric="correlation" />
                  </th>
                  {[sensitivity.before, sensitivity.after].map((a, i) => (
                    <td key={i}>{fmt(a.correlation, 4)}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    Годовая ковариационная матрица <MetricHelp metric="covariance" />
                  </th>
                  {[sensitivity.before, sensitivity.after].map((a, i) => (
                    <td key={i}>
                      {a.model?.covariance
                        .map((row) => row.map((v) => fmt(v, 6)).join('; '))
                        .join(' / ') ?? 'Нет данных'}
                    </td>
                  ))}
                </tr>
                {(['mean', 'risk', 'sharpe'] as const).map((key) => (
                  <tr key={key}>
                    <th>
                      Портфель {pct(weight, 0)} SBER ·{' '}
                      {key === 'mean' ? 'μ год' : key === 'risk' ? 'σ год' : 'Sharpe'}
                      <MetricHelp
                        metric={
                          key === 'mean'
                            ? 'portfolio_return'
                            : key === 'risk'
                              ? 'portfolio_risk'
                              : 'sharpe'
                        }
                      />
                    </th>
                    {[sensitivity.before, sensitivity.after].map((a, i) => (
                      <td key={i}>
                        {key === 'sharpe' ? fmt(a.selected?.[key], 3) : pct(a.selected?.[key], 2)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th>
                    Минимальный риск · доля SBER <MetricHelp metric="minimum" />
                  </th>
                  {[sensitivity.before, sensitivity.after].map((a, i) => (
                    <td key={i}>
                      {pct(a.model?.min.weight, 0)} · σ {pct(a.model?.min.risk, 2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>
                    Максимальный Sharpe · доля SBER <MetricHelp metric="maximum" />
                  </th>
                  {[sensitivity.before, sensitivity.after].map((a, i) => (
                    <td key={i}>
                      {pct(a.model?.max.weight, 0)} · S {fmt(a.model?.max.sharpe, 3)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Восстановлены отдельные границы февраля и марта 2024, а не одна двухмесячная доходность.
            Интерполяция и регрессия могут сглаживать риск и менять корреляцию. Это контрфактические
            моменты, не исполнимый бэктест: ребалансировка при остановке торгов невозможна. Основная
            модель Марковица и калькулятор не переключены на оценки. Неизвестные дивиденды не
            восстанавливаются.
          </p>
        </div>
      )}
      <Disclosure title="Все пропуски и источники">
        <p className="footnote">
          ГДР заменены обыкновенными акциями 27.02.2024, возобновление TQBR — 18.03.2024. Тикер TCSG
          изменён на T с 28.11.2024. ISS уже привёл цены T к сплиту 1:10 апреля 2026: повторной
          корректировки нет. Служебная подпись GDR в исходных пустых строках после 27.02 не означает
          торговлю расписками.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Причина</th>
                <th>Условная цена</th>
                <th>Метод</th>
                <th>Источник</th>
              </tr>
            </thead>
            <tbody>
              {recovery.observations
                .filter((q) => q.actualPrice === null)
                .map((q) => (
                  <tr key={q.date}>
                    <th>{date(q.date)}</th>
                    <td>{q.reason}</td>
                    <td>
                      {q.estimatedPrice === null ? 'Не оценивается' : rub(q.estimatedPrice, 3)}
                    </td>
                    <td>{recoveryMethodNames[q.method]}</td>
                    <td>
                      {q.sourceIds.map((id) => {
                        const source = recovery.sources.find((s) => s.id === id)!;
                        return (
                          <a key={id} href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                            <br />
                          </a>
                        );
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <a href={`${import.meta.env.BASE_URL}data/recovery.json`} download>
          Скачать факты, оценки и все проверки JSON
        </a>
        {' · '}
        <a href={`${import.meta.env.BASE_URL}data/recovery-inputs.json`} download>
          Скачать исходные факторы и проверку ISS
        </a>
      </Disclosure>
      <Disclosure title="Остатки, устойчивость и методика">
        <p>
          Остатки log-доходности: среднее {fmt(fit.residuals.mean, 6)}, σ{' '}
          {fmt(fit.residuals.std, 5)}, автокорреляция первого лага {fmt(fit.residuals.lag1, 3)},
          Durbin–Watson {fmt(fit.residuals.durbinWatson, 3)}. Асимметрия{' '}
          {fmt(fit.residuals.skewness, 3)}, куртозис {fmt(fit.residuals.kurtosis, 3)}; Jarque–Bera p
          = {fit.residuals.jarqueBeraP.toExponential(2)}.
        </p>
        <p>
          β IMOEX на двух половинах обучения:{' '}
          {fit.stability.map((s) => fmt(s?.coefficients[1], 4)).join(' → ')}. Коэффициент не
          постоянен. 95%-интервал β с HAC(5):{' '}
          {fit.coefficientIntervalsHAC95[1].map((v) => fmt(v, 4)).join(' — ')}; это интервал
          коэффициента, не цены.
        </p>
        <p>
          Условный мост <MetricHelp metric="return_bridge" /> использует правую фактическую цену.
          Интервалы неопределённости цен не заявляются. Опоры: {date(recovery.bridge.leftDate)} —{' '}
          {rub(recovery.bridge.leftPrice, 3)}; {date(recovery.bridge.rightDate)} —{' '}
          {rub(recovery.bridge.rightPrice, 3)}. N = {recovery.bridge.intervals}, δ ={' '}
          {fmt(recovery.bridge.correction, 6)}.
        </p>
        <MathFormula
          latex={
            '\\begin{aligned}\\widehat r_t&=\\widehat\\alpha+\\widehat\\beta_M r_t^M\\\\ \\delta&=\\frac{\\ln(P_R/P_L)-\\sum_{j=1}^N\\widehat r_j}{N}\\end{aligned}'
          }
        />
        <MathFormula
          latex={'\\widehat P_{L+k}=P_L\\exp\\left(\\sum_{j=1}^{k}(\\widehat r_j+\\delta)\\right)'}
        />
        <ul className="readable-list">
          {recovery.methodology.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Disclosure>
    </Disclosure>
  );
}
