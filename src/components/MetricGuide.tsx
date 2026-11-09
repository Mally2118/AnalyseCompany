import { metricHelp } from '../data/metric-help';
export function MetricGuide() {
  return (
    <details className="card metric-guide">
      <summary>Как читать показатели — формулы и смысл</summary>
      <div className="grid-two" style={{ marginTop: 18 }}>
        {Object.entries(metricHelp).map(([key, m]) => (
          <div key={key}>
            <h3>{m.name}</h3>
            <code>{m.formula}</code>
            <p>
              {m.meaning} {m.interpretation}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
