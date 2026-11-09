import { MetricHelp } from '../components/MetricHelp';
import { Check, Minus, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Company, Mode } from '../data/types';
import { companies } from '../data/types';
import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import { stability, marketRisk, fact } from '../calculations/analysis';
import { Card, Disclosure, SectionIntro, Tag } from '../components/ui';
import { pct, fmt } from '../utils/format';
export function Stability({
  data,
  model,
  mode,
}: {
  data: DataSet;
  model: AnalysisModel;
  mode: Mode;
}) {
  const cs: Company[] = mode === 'compare' ? ['SBER', 'T'] : [mode];
  return (
    <>
      <SectionIntro
        title="Устойчивость"
        description="Состояние эмитента и риск вложения в его акции оцениваются отдельно."
      />
      <div className="grid-two">
        {cs.map((c) => {
          const a = stability(data.financial, c),
            s = model.stats[c];
          return (
            <Card key={c} title={companies[c].name} subtitle="Финансовые сигналы на конец 2025">
              <div className="status-line">
                <ShieldCheck size={22} />
                <strong>{a.category}</strong>
                <Tag>{a.score ?? '—'} / 6</Tag>
              </div>
              <div className="market-risk-panel">
                <span>
                  Риск рыночной инвестиции <MetricHelp metric="volatility" />
                </span>
                <Tag color={marketRisk(s) === 'Высокий' ? 'red' : 'gold'}>{marketRisk(s)}</Tag>
                <p>
                  Годовая волатильность {pct(s?.annualVol)} · максимальная дневная просадка{' '}
                  {pct(s?.maxDrawdown)}.
                </p>
              </div>
              <p className="footnote">
                {c === 'T'
                  ? 'Основные риски: качество кредитов, интеграция Росбанка, допэмиссия.'
                  : 'Основные риски: санкции, кредитные потери, высокая ставка.'}
              </p>
              <Disclosure title="Шесть критериев">
                <div className="signal-list">
                  {a.signals.map((q) => (
                    <div key={q.label}>
                      <span className={q.ok === null ? 'muted' : q.ok ? 'positive' : 'negative'}>
                        {q.ok === null ? (
                          <Minus size={16} />
                        ) : q.ok ? (
                          <Check size={16} />
                        ) : (
                          <TriangleAlert size={16} />
                        )}
                      </span>
                      <span>
                        {q.label}{' '}
                        <MetricHelp
                          metric={
                            q.label.includes('ROE')
                              ? 'roe'
                              : q.label.includes('NPL')
                                ? 'npl'
                                : q.label.includes('Общий капитал')
                                  ? 'capital'
                                  : q.label.includes('Капитал')
                                    ? 'equity'
                                    : 'profit'
                          }
                        />
                      </span>
                      <strong>{q.value}</strong>
                    </div>
                  ))}
                </div>
                <p className="footnote">
                  CoR <MetricHelp metric="cor" />: {fmt(fact(data.financial, c, 2024, 'cor'))}% →{' '}
                  {fmt(fact(data.financial, c, 2025, 'cor'))}%; ROE:{' '}
                  {fmt(fact(data.financial, c, 2024, 'roe'))}% →{' '}
                  {fmt(fact(data.financial, c, 2025, 'roe'))}%.{' '}
                  {c === 'T'
                    ? 'Дополнительные риски: интеграция Росбанка, изменение периметра и доли неконтролирующих акционеров, допэмиссия и разовые эффекты инвестиций.'
                    : 'Дополнительные риски: санкции, концентрация на российской экономике, кредитные потери и влияние высокой ставки на маржу.'}
                </p>{' '}
              </Disclosure>
            </Card>
          );
        })}
      </div>
      <Disclosure title="Методика оценки">
        <p className="footnote">Учебные критерии; пороги не являются нормативами Банка России.</p>
        <div className="grid-two plain">
          <div>
            <h3>Финансовое положение</h3>
            <ul className="readable-list">
              <li>
                Недостаточно информации — отсутствует прибыль, капитал, ROE, достаточность или NPL
                за 2025.
              </li>
              <li>
                Неблагоприятная динамика — прибыль или капитал ≤ 0 либо не выполнены минимум три
                критерия.
              </li>
              <li>Повышенные риски — один или два отрицательных сигнала.</li>
              <li>Относительно устойчивое — все шесть критериев выполнены.</li>
            </ul>
          </div>
          <div>
            <h3>Риск акции</h3>
            <ul className="readable-list">
              <li>Высокий — годовая σ ≥ 35% или дневная просадка ≥ 40% по абсолютной величине.</li>
              <li>Умеренный — σ ≥ 20% или просадка ≥ 20% при отсутствии высокого риска.</li>
              <li>Низкий — σ &lt; 20% и просадка &lt; 20% в выбранной истории.</li>
            </ul>
          </div>
        </div>
        <p className="footnote">
          Сигналы не взвешиваются. NPL и стадия 3 + POCI, а также ROE у групп имеют разные
          определения. Число сигналов позволяет обсуждать данные, но не ранжировать
          кредитоспособность с точностью рейтингового агентства.
        </p>
      </Disclosure>
      <p className="footnote">
        Дефолт и неплатёжеспособность — неспособность исполнять обязательства. Падение котировки и
        временный инвестиционный убыток сами по себе не доказывают дефолт. Положительная
        историческая доходность не исключает будущие убытки.
      </p>
    </>
  );
}
