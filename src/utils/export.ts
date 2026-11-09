import type { DataSet } from '../services/data';
import type { AnalysisModel } from '../services/model';
import type { Company, ReturnKind, Scenario } from '../data/types';
import { companies, metrics, years } from '../data/types';
import { metricHelp } from '../data/metric-help';
import { escapeHtml as esc, fmt, pct, rub } from './format';
export interface ExportContext {
  data: DataSet;
  model: AnalysisModel;
  kind: ReturnKind;
  start: number;
  rf: number;
  weight: number;
  amount: number;
  scenarios: Scenario[];
  horizon: number;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function csvString(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? '');
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(';'),
      )
      .join('\r\n')
  );
}
export function financialCSVRows(ctx: ExportContext) {
  const sources = [...ctx.data.financial.sources, ...ctx.data.market.sources];
  const rows = [
    [
      'Компания',
      'Год',
      'Показатель',
      'Значение',
      'Единица',
      'Документ',
      'Раздел',
      'Стандарт',
      'Примечание',
    ],
    ...ctx.data.financial.facts.map((f) => {
      const s = sources.find((s) => s.id === f.sourceId);
      return [
        companies[f.company].name,
        f.year,
        metrics[f.metric].label,
        f.value,
        f.unit,
        s?.url,
        f.section,
        s?.standard,
        f.note,
      ];
    }),
  ];
  rows.push(
    ...ctx.model.valuations.map((v) => [
      companies[v.company].name,
      v.year,
      'P/E ретроспективный',
      v.pe,
      '×',
      `${v.epsUrl} ; ${v.priceUrl}`,
      `Цена ${v.priceDate ?? 'нет'}: ${v.price ?? 'нет'}; базовая EPS: ${v.eps ?? 'нет'}`,
      'МСФО / MOEX',
      `${v.note} ${v.basis}; ${v.pe === null ? v.status : 'P/E = Price / EPS'}`,
    ]),
  );
  return rows;
}
export function exportCSV(ctx: ExportContext) {
  download(
    new Blob([csvString(financialCSVRows(ctx))], { type: 'text/csv;charset=utf-8' }),
    'InvestAnalytics-финансы.csv',
  );
}

export async function exportXLSX(ctx: ExportContext) {
  const XLSX = await import('xlsx');
  const wb = buildWorkbook(XLSX, ctx);
  XLSX.writeFile(wb, 'InvestAnalytics-исследование.xlsx', { compression: true });
}
export function buildWorkbook(XLSX: typeof import('xlsx'), ctx: ExportContext) {
  const { data, model } = ctx,
    wb = XLSX.utils.book_new();
  function sheet(name: string, rows: unknown[][]) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (rows[0] ?? []).map((_, i) => ({ wch: i === 0 ? 27 : 20 }));
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range(
        { r: 0, c: 0 },
        { r: Math.max(0, rows.length - 1), c: Math.max(0, (rows[0]?.length ?? 1) - 1) },
      ),
    };
    XLSX.utils.book_append_sheet(wb, ws, name);
    return ws;
  }
  const formula = (f: string, v: number | null) =>
    v === null ? { t: 's', v: '' } : { t: 'n', f, v };
  sheet('Методика', [
    ['Параметр', 'Значение'],
    ['Исследование', 'Сбербанк и Т-Технологии, 2021–2025'],
    [
      'Тип доходности',
      ctx.kind === 'price' ? 'Ценовая' : 'Полная, условная реинвестиция в дату реестра',
    ],
    ['Начало выбранного периода', ctx.start],
    ['Rf, эффективная годовая', ctx.rf],
    ['Rf, месяц', formula('(1+B5)^(1/12)-1', (1 + ctx.rf) ** (1 / 12) - 1)],
    ['Вес SBER', ctx.weight],
    ['Капитал, ₽', ctx.amount],
    ['Горизонт, лет', ctx.horizon],
    ['Даты котировок', `${data.market.from} — ${data.market.till}`],
    ['Дата выгрузки', data.market.updatedAt],
    ['Ограничение', 'Исторические оценки не гарантируют будущий результат'],
    ['Дивиденды', data.market.notes[0]],
    ['T 2021', data.market.notes[1]],
    ['Рыночный масштаб', data.market.basis],
    ['Статистика', 'Выборочные дисперсия и ковариация, n−1; годовая матрица = месячная ×12'],
    [
      'Сценарии',
      'Ретроспективная учебная оценка на EPS 2025, раскрытой в 2026. Вероятности не заданы.',
    ],
  ]);
  sheet('Исходные финансы', [
    ['Компания', 'Год', 'Показатель', 'Значение', 'Единица', 'Источник', 'Раздел', 'Примечание'],
    ...data.financial.facts.map((f) => [
      f.company,
      f.year,
      f.metric,
      f.value,
      f.unit,
      f.sourceId,
      f.section,
      f.note,
    ]),
  ]);
  sheet('Финансовые показатели', [
    ['Компания', 'Год', ...Object.values(metrics).map((m) => `${m.label} (${m.unit})`)],
    ...(['SBER', 'T'] as Company[]).flatMap((c) =>
      years.map((y) => [
        c,
        y,
        ...Object.keys(metrics).map((m) => {
          const i = data.financial.facts.findIndex(
            (f) => f.company === c && f.year === y && f.metric === m,
          );
          return formula(`'Исходные финансы'!D${i + 2}`, data.financial.facts[i]?.value ?? null);
        }),
      ]),
    ),
  ]);
  sheet('Дневные цены', [
    ['Дата', 'SBER, ₽', 'T, ₽ после сплита', 'Исходная TCSG, ₽', 'Инструмент T', 'Примечание'],
    ...data.market.quotes.map((q) => [q.date, q.SBER, q.T, q.tOriginal, q.tInstrument, q.note]),
  ]);
  const wealth = {
    SBER: new Map(model.wealth.SBER.map((q) => [q.date, q.value])),
    T: new Map(model.wealth.T.map((q) => [q.date, q.value])),
  };
  sheet('Цены и доходности', [
    [
      'Дата',
      'Цена SBER пред.',
      'Цена T пред.',
      'Цена SBER',
      'Цена T',
      'Стоимость SBER пред.',
      'Стоимость T пред.',
      'Стоимость SBER',
      'Стоимость T',
      'R SBER',
      'R T',
    ],
    ...model.rows.map((r, i) => {
      const q = data.market.monthly.find((q) => q.date === r.date)!,
        index = data.market.monthly.indexOf(q),
        prev = data.market.monthly[index - 1],
        row = i + 2;
      return [
        r.date,
        prev.SBER,
        prev.T,
        q.SBER,
        q.T,
        wealth.SBER.get(prev.date) ?? null,
        wealth.T.get(prev.date) ?? null,
        wealth.SBER.get(q.date) ?? null,
        wealth.T.get(q.date) ?? null,
        formula(`(H${row}-F${row})/F${row}`, r.SBER),
        formula(`(I${row}-G${row})/G${row}`, r.T),
      ];
    }),
  ]);
  const n = model.pair.rows.length,
    end = n + 1;
  sheet('Синхронные доходности', [
    ['Дата', 'SBER', 'T'],
    ...model.pair.rows.map((r) => [r.date, r.SBER, r.T]),
  ]);
  const input = `'Синхронные доходности'!`;
  const rawStats = [
    ...(['SBER', 'T'] as Company[]).map((c, i) => {
      const s = model.stats[c],
        column = i === 0 ? 'B' : 'C',
        range = `'Синхронные доходности'!${column}2:${column}${end}`;
      return [
        c,
        s?.n ?? 0,
        formula(`AVERAGE(${range})`, s?.monthlyMean ?? null),
        formula(`C${i + 2}*12`, s?.annualMean ?? null),
        formula(`STDEV.S(${range})`, s?.monthlyVol ?? null),
        formula(`E${i + 2}*SQRT(12)`, s?.annualVol ?? null),
        formula(`(C${i + 2}-'Методика'!B6)/E${i + 2}*SQRT(12)`, s?.sharpe ?? null),
        s?.cagr ?? null,
        s?.maxDrawdown ?? null,
        s?.var95 ?? null,
      ];
    }),
  ];
  sheet('Риск и доходность', [
    [
      'Актив',
      'n месяцев',
      'μ месяц',
      'μ год арифм.',
      'σ месяц',
      'σ год',
      'Sharpe',
      'CAGR дневной стоимости',
      'Max Drawdown дневной',
      'VaR95 месяц',
    ],
    ...rawStats,
  ]);
  if (model.model) {
    const m = model.model;
    sheet('Ковариационная матрица', [
      ['Годовая матрица', 'SBER', 'T'],
      [
        'SBER',
        formula(`VAR.S(${input}B2:B${end})*12`, m.covariance[0][0]),
        formula(`COVARIANCE.S(${input}B2:B${end},${input}C2:C${end})*12`, m.covariance[0][1]),
      ],
      [
        'T',
        formula('C2', m.covariance[1][0]),
        formula(`VAR.S(${input}C2:C${end})*12`, m.covariance[1][1]),
      ],
      ['Корреляция', formula(`CORREL(${input}B2:B${end},${input}C2:C${end})`, model.correlation)],
      ['μ SBER / год', formula(`AVERAGE(${input}B2:B${end})*12`, m.means[0])],
      ['μ T / год', formula(`AVERAGE(${input}C2:C${end})*12`, m.means[1])],
    ]);
    sheet('Марковиц', [
      ['Вес SBER', 'Вес T', 'E год', 'σ год', 'Sharpe', 'Эффективный'],
      ...m.points.map((p, i) => {
        const r = i + 2;
        return [
          p.weight,
          formula(`1-A${r}`, 1 - p.weight),
          formula(`A${r}*'Ковариационная матрица'!B5+B${r}*'Ковариационная матрица'!B6`, p.mean),
          formula(
            `SQRT(A${r}^2*'Ковариационная матрица'!B2+B${r}^2*'Ковариационная матрица'!C3+2*A${r}*B${r}*'Ковариационная матрица'!C2)`,
            p.risk,
          ),
          formula(`(C${r}/12-'Методика'!B6)/(D${r}/SQRT(12))*SQRT(12)`, p.sharpe),
          p.efficient ? 'Да' : 'Нет',
        ];
      }),
    ]);
    sheet('Эффективная граница', [
      ['Вес SBER', 'Доходность / год', 'Риск / год', 'Sharpe'],
      ...m.points.filter((p) => p.efficient).map((p) => [p.weight, p.mean, p.risk, p.sharpe]),
    ]);
    sheet('Оптимальные портфели', [
      ['Метод', 'Вес SBER', 'Вес T', 'Доходность', 'Риск', 'Sharpe'],
      ...[
        [m.min, 'Минимальная дисперсия'],
        [m.max, 'Максимум Sharpe'],
      ].map(([value, label]) => {
        const p = value as typeof m.min;
        return [label, p.weight, 1 - p.weight, p.mean, p.risk, p.sharpe];
      }),
    ]);
  }
  sheet('Сценарные прогнозы', [
    [
      'Сценарий',
      'Компания',
      'EPS 2025',
      'g EPS',
      'P/E',
      'Доля выплат',
      'Цена 30.12.25',
      'EPS 2026',
      'Цена 2026',
      'Дивиденд',
      'Доходность',
      'Вес',
      'Вложено',
      'Стоимость 1 год',
      'Результат 1 год',
      'Исторический P/E 2025 (ретросп.)',
    ],
    ...ctx.scenarios.flatMap((s, i) =>
      (['SBER', 'T'] as Company[]).map((c, j) => {
        const r = i * 2 + j + 2,
          result = model.results.find((r) => r.id === s.id)?.[c],
          eps = model.eps[c],
          price = data.market.monthly.at(-1)?.[c] ?? null,
          w = c === 'SBER' ? ctx.weight : 1 - ctx.weight;
        return [
          s.name,
          c,
          eps,
          s[c === 'SBER' ? 'growthSBER' : 'growthT'] / 100,
          s[c === 'SBER' ? 'peSBER' : 'peT'],
          s[c === 'SBER' ? 'payoutSBER' : 'payoutT'] / 100,
          price,
          formula(`C${r}*(1+D${r})`, result?.eps ?? null),
          formula(`H${r}*E${r}`, result?.price ?? null),
          formula(`H${r}*F${r}`, result?.dividend ?? null),
          formula(`(I${r}-G${r}+J${r})/G${r}`, result?.return ?? null),
          w,
          formula(`L${r}*'Методика'!B8`, w * ctx.amount),
          formula(`M${r}*(1+K${r})`, result ? w * ctx.amount * (1 + result.return) : null),
          formula(`N${r}-M${r}`, result ? w * ctx.amount * result.return : null),
          formula(
            `G${r}/C${r}`,
            model.valuations.find((v) => v.company === c && v.year === 2025)?.pe ?? null,
          ),
        ];
      }),
    ),
  ]);
  sheet('P-E ретроспективный', [
    [
      'Компания',
      'Год',
      'Цена, ₽',
      'Дата цены',
      'Базовая EPS, ₽',
      'P/E',
      'Источник EPS',
      'Источник цены',
      'Оговорка',
    ],
    ...model.valuations.map((v, i) => {
      const row = i + 2,
        epsIndex =
          data.financial.facts.findIndex(
            (f) => f.company === v.company && f.year === v.year && f.metric === 'eps',
          ) + 2;
      const priceIndex = data.market.quotes.findIndex((q) => q.date === v.priceDate) + 2;
      return [
        v.company,
        v.year,
        formula(`'Дневные цены'!${v.company === 'SBER' ? 'B' : 'C'}${priceIndex}`, v.price),
        v.priceDate,
        formula(`'Исходные финансы'!D${epsIndex}`, v.eps),
        formula(`C${row}/E${row}`, v.pe),
        v.epsUrl,
        v.priceUrl,
        `${v.note} ${v.basis}; ${v.pe === null ? v.status : ''}`,
      ];
    }),
  ]);
  sheet('Сопоставимые доходности', [
    ['Актив', 'Тип', 'Начало', 'Конец', 'Лет', 'V0', 'V1', 'CAGR', 'n месяцев', '12 × μ месяца'],
    ...(['SBER', 'T'] as Company[]).flatMap((c, i) =>
      (['price', 'total'] as const).map((kind, j) => {
        const stat = model.comparison[c][kind],
          row = i * 2 + j + 2;
        return [
          c,
          kind === 'price' ? 'Ценовая' : 'Полная',
          model.period.from,
          model.period.till,
          model.period.years,
          1,
          stat?.wealth ?? null,
          formula(`(G${row}/F${row})^(1/E${row})-1`, stat?.cagr ?? null),
          stat?.n ?? 0,
          stat?.annualMean ?? null,
        ];
      }),
    ),
  ]);
  const navT = new Map(model.wealth.T.map((q) => [q.date, q.value]));
  sheet('История портфеля', [
    ['Дата', 'Стоимость портфеля', 'Стоимость SBER', 'Стоимость T'],
    ...model.historical.selected.series.map((q) => [
      q.date,
      q.value,
      model.wealth.SBER.find((a) => a.date === q.date)?.value ?? null,
      navT.get(q.date) ?? null,
    ]),
  ]);
  const meta = wb.Sheets['Методика'];
  const extras = [
    ['Фактическое начало', model.period.from],
    ['Фактический конец', model.period.till],
    ['Лет, ACT/365,25', model.period.years],
    [
      'CAGR портфеля',
      formula(
        `('История портфеля'!B${model.historical.selected.series.length + 1}/'История портфеля'!B2)^(1/${model.period.years})-1`,
        model.historical.selected.cagr,
      ),
    ],
    [
      'Полнота пятилетних данных',
      model.period.limited
        ? 'T: дивиденды 2021 неполны; сравниваем с конца 2021'
        : 'Общая база выбрана без ограничения',
    ],
    ['Пятилетняя арифм. оценка', model.fiveYearPortfolio?.annualMean ?? null],
    ['Пятилетний CAGR портфеля', model.fiveYearPortfolio?.cagr ?? null],
  ];
  XLSX.utils.sheet_add_aoa(meta, extras, { origin: -1 });
  sheet('Источники', [
    ['Код', 'Название', 'URL', 'Раздел', 'Стандарт', 'Дата проверки', 'Примечание'],
    ...[...data.financial.sources, ...data.market.sources]
      .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
      .map((s) => [s.id, s.title, s.url, s.section, s.standard, s.accessed, s.note]),
  ]);
  wb.Workbook = { CalcPr: { calcMode: 'auto', fullCalcOnLoad: true } } as typeof wb.Workbook;
  return wb;
}
function svgChart(data: { label: string; a: number | null; b: number | null }[], title: string) {
  const valid = data.flatMap((d) => [d.a, d.b]).filter((v): v is number => v !== null);
  if (!valid.length) return '';
  const min = Math.min(0, ...valid),
    max = Math.max(...valid),
    range = max - min || 1,
    w = 670,
    h = 190,
    x = (i: number) => 45 + (i * (w - 70)) / Math.max(1, data.length - 1),
    y = (v: number) => h - 28 - ((v - min) / range) * (h - 50);
  const line = (key: 'a' | 'b', color: string) => {
    let path = '',
      open = false;
    data.forEach((d, i) => {
      const v = d[key];
      if (v === null) {
        open = false;
        return;
      }
      path += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      open = true;
    });
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>`;
  };
  return `<figure><figcaption>${esc(title)} · зелёный: SBER, синий: T</figcaption><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="190">${[min, (min + max) / 2, max].map((v) => `<line x1="45" x2="650" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="0" y="${y(v) + 4}" font-size="10">${fmt(v, 0)}</text>`).join('')}${line('a', '#138f79')}${line('b', '#416be0')}<text x="45" y="185" font-size="11">${esc(data[0]?.label)}</text><text x="580" y="185" font-size="11">${esc(data.at(-1)?.label)}</text></svg></figure>`;
}
export function reportHTML(ctx: ExportContext) {
  const { data, model } = ctx;
  const sources = [...data.financial.sources, ...data.market.sources].filter(
    (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
  );
  const annual = (c: Company, m: string, y: number) =>
    data.financial.facts.find((f) => f.company === c && f.year === y && f.metric === m)?.value ??
    null;
  const table = (headers: string[], rows: unknown[][]) =>
    `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const financial = (['SBER', 'T'] as Company[])
    .map(
      (c) =>
        `<h3>${companies[c].name}</h3>${table(
          ['Показатель', 'Ед.', ...years.map(String)],
          Object.entries(metrics).map(([m, meta]) => [
            meta.label,
            meta.unit,
            ...years.map((y) => fmt(annual(c, m, y), m === 'eps' ? 3 : 2)),
          ]),
        )}`,
    )
    .join('');
  const stats = (['SBER', 'T'] as Company[]).map((c) => {
    const s = model.stats[c];
    return [
      c,
      s?.n ?? 0,
      pct(s?.monthlyMean),
      pct(s?.annualMean),
      pct(s?.cagr),
      pct(s?.annualVol),
      fmt(s?.sharpe, 3),
      pct(s?.maxDrawdown),
      pct(s?.var95),
    ];
  });
  const m = model.model;
  const weights = m
    ? table(
        ['Портфель', 'SBER', 'T', 'E(R) год', 'σ год', 'Sharpe'],
        [
          [
            `Минимум риска`,
            pct(m.min.weight),
            pct(1 - m.min.weight),
            pct(m.min.mean),
            pct(m.min.risk),
            fmt(m.min.sharpe, 3),
          ],
          [
            'Максимум Sharpe',
            pct(m.max.weight),
            pct(1 - m.max.weight),
            pct(m.max.mean),
            pct(m.max.risk),
            fmt(m.max.sharpe, 3),
          ],
          [
            'Выбранный',
            pct(ctx.weight),
            pct(1 - ctx.weight),
            pct(model.selected?.mean),
            pct(model.selected?.risk),
            fmt(model.selected?.sharpe, 3),
          ],
        ],
      )
    : '<p>Недостаточно данных</p>';
  const wealth = model.wealth.SBER.filter((_, i, rows) => i % 8 === 0 || i === rows.length - 1).map(
    (q) => ({
      label: q.date,
      a: q.value === null ? null : q.value * 100,
      b:
        (model.wealth.T.find((t) => t.date === q.date)?.value ?? null) === null
          ? null
          : model.wealth.T.find((t) => t.date === q.date)!.value! * 100,
    }),
  );
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>InvestAnalytics — аналитический отчёт</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:12px/1.55 Arial,sans-serif;color:#172338;max-width:760px;margin:30px auto}h1{font-size:30px}h2{font-size:19px;margin:30px 0 12px;border-bottom:1px solid #ccd4df;padding-bottom:8px}h3{font-size:15px}table{border-collapse:collapse;width:100%;font-size:10px;margin:14px 0}th,td{border:1px solid #d1d7df;padding:6px;text-align:left}th{background:#edf2f6}thead{display:table-header-group}tr,figure{break-inside:avoid}a{color:#3154a2;overflow-wrap:anywhere}li{margin:6px 0}.muted{color:#58677b}.cover{border-top:5px solid #138f79;padding-top:20px}.controls{background:#e9eef5;padding:16px;display:flex;gap:15px;align-items:center}button{cursor:pointer;padding:9px 18px;border:0;border-radius:5px;background:#172338;color:white}.notes{font-size:10px}.frontier-table{font-size:9px}@media print{body{margin:0;max-width:none}.controls{display:none}h2{break-after:avoid}}svg{max-width:100%}</style></head><body><div class="controls"><button onclick="window.print()">Сохранить PDF / печать</button><span>В окне печати выберите «Сохранить как PDF». Формат A4.</span></div><div class="cover"><p>БИЗНЕС-АНАЛИТИКА И ПРОГНОЗИРОВАНИЕ · УНИВЕРСИТЕТСКИЙ ПРОЕКТ</p><h1>InvestAnalytics</h1><p>Финансовый и инвестиционный анализ ПАО «Сбербанк» и МКПАО «Т-Технологии»</p><p>База исследования: 2021–2025. Запрошенный период: ${ctx.start}–2025. Фактическая рыночная модель: ${esc(model.period.from)} — ${esc(model.period.till)} (${fmt(model.period.years, 4)} года). Сформировано ${new Date().toLocaleDateString('ru-RU')}.</p><p>Моделируемый капитал: ${rub(ctx.amount)}; веса ${pct(ctx.weight)} SBER / ${pct(1 - ctx.weight)} T; горизонт калькулятора, лет: ${ctx.horizon}.</p><p>Тип доходности: ${ctx.kind === 'price' ? 'ценовая, дивиденды не включены' : 'полная, условное реинвестирование дивидендов в дату реестра'}; учебная эффективная Rf = ${pct(ctx.rf)} годовых.</p></div><h2>1. Объект, данные и методика</h2><p>Обыкновенные SBER и преемственный ряд TCSG → T. Т приведена к сплиту 1:10 апреля 2026. Отчетность относится к банковским группам; показатели EBITDA, текущей ликвидности и модель Альтмана не применяются.</p><p>Финансовые данные проверены ${esc(data.financial.updatedAt)}. Рыночная выгрузка ${esc(data.market.updatedAt)}; последние цены ${esc(data.market.till)}. Всего ${data.market.quotes.length} дневных дат; ${model.pair.rows.length} пар месячных доходностей. Корреляция ${fmt(model.correlation, 4)}.</p><p>Изменение периметра Т в 2024, разовые эффекты Яндекса в 2025, МСФО 17 и ограниченное раскрытие Сбера требуют чтения примечаний. Финансовые значения не заменяются оценками при пропусках.</p><h2>2. Финансовые показатели за пять лет</h2>${financial}${svgChart(
    years.map((y) => ({
      label: String(y),
      a: annual('SBER', 'profit', y),
      b: annual('T', 'profit', y),
    })),
    'Чистая прибыль группы, млрд ₽',
  )}${svgChart(
    years.map((y) => ({
      label: String(y),
      a: annual('SBER', 'equity', y),
      b: annual('T', 'equity', y),
    })),
    'Собственный капитал, млрд ₽',
  )}<h2>3. Доходность и риск</h2><p>Ценовая и полная доходность сравниваются при одинаковом капитале на общей базе ${esc(model.period.from)} — ${esc(model.period.till)}. ${model.period.limited ? 'USD-дивиденд T за 2021 не переведен по неподтвержденному курсу; весь 2021 не включается ни в один из двух сравниваемых режимов. Пятилетний ценовой результат показан отдельно.' : ''}</p>${table(
    ['Актив', 'Ценовой CAGR', 'Полный CAGR', 'Пятилетний ценовой CAGR', 'Пятилетний полный CAGR'],
    (['SBER', 'T'] as Company[]).map((c) => [
      c,
      pct(model.comparison[c].price?.cagr, 2),
      pct(model.comparison[c].total?.cagr, 2),
      pct(model.fiveYear[c].price?.cagr, 2),
      pct(model.fiveYear[c].total?.cagr, 2),
    ]),
  )}${table(['Актив', 'n', 'μ месяц', 'μ год', 'CAGR', 'σ год', 'Sharpe', 'MaxDD', 'VaR95'], stats)}${svgChart(wealth, 'Накопленная стоимость, начальная = 100')}<p>R = (Pₜ − Pₜ₋₁ + Dₜ) / Pₜ₋₁; полная стоимость в модели учитывает отдельные ежедневные дивидендные события и дробное реинвестирование. Средняя годовая = 12 × μ месяца; CAGR = (Vкон / Vнач)^(365,25 / дни) − 1. σ месяца = √[Σ(R − μ)² / (n − 1)], σ года = σ месяца × √12. Cov = Σ[(Rs − μs)(Rt − μt)] / (n − 1). VaR95 — отрицательный 5%-квантиль месячных доходностей, линейная интерполяция, n ≥ 24; не максимальный возможный убыток. MaxDD по дневным закрытиям.</p><h2>4. Модель Марковица и максимум Sharpe</h2><p>E(Rp) = wE(Rs) + (1 − w)E(Rt). σp² = w²σs² + (1 − w)²σt² + 2w(1 − w)Cov(s,t). Перебираются 101 вес с шагом 1%, без плеча. Эффективная граница выделяется по недоминируемости. Эффективные риск и доходность относятся к выбранному портфелю.</p><p>Sharpe = (μ месяца − Rf месяца) / σ месяца × √12; Rf месяца = (1 + Rf года)^(1/12) − 1. Максимум Sharpe учитывает доходность, минимум дисперсии только риск.</p>${weights}<p>Исторический CAGR выбранного портфеля: ${pct(model.historical.selected.cagr, 2)}; арифметическая оценка: ${pct(model.selected?.mean, 2)}. Эти показатели не взаимозаменяемы. CAGR считается по дневной стоимости с ребалансировкой в доступные общие концы месяцев; позиции удерживаются через торговые паузы. Пятилетний CAGR при выбранных весах: ${pct(model.fiveYearPortfolio?.cagr, 2)}, пятилетняя арифметическая оценка ${pct(model.fiveYearPortfolio?.annualMean, 2)}.</p>${svgChart(m ? m.points.map((p) => ({ label: pct(p.weight, 0) + ' SBER', a: p.risk * 100, b: p.mean * 100 })) : [], 'Портфели по весу SBER: зелёный σ год, синий μ год, %')}${
    m
      ? '<h3>Ковариационная матрица</h3>' +
        table(
          ['Годовая Cov', 'SBER', 'T'],
          [
            ['SBER', fmt(m.covariance[0][0], 6), fmt(m.covariance[0][1], 6)],
            ['T', fmt(m.covariance[1][0], 6), fmt(m.covariance[1][1], 6)],
          ],
        )
      : ''
  }<h2>Ретроспективный исторический P/E</h2>${table(
    ['Актив / год', 'Дата цены', 'Цена', 'Базовая EPS', 'P/E'],
    model.valuations.map((v) => [
      `${v.company} / ${v.year}`,
      v.priceDate,
      fmt(v.price, 2),
      fmt(v.eps, 3),
      v.pe === null ? v.status : fmt(v.pe, 2),
    ]),
  )}<p>P/E = Price / EPS. Годовая EPS опубликована позже даты цены: все значения ретроспективны, цена и EPS на одинаковой базе акций. При неположительной или неизвестной EPS положительный P/E не показывается. Сценарный P/E ниже — допущение, не историческое значение. При фиксированной EPS цена пропорциональна P/E.</p>${svgChart(
    years.map((y) => ({
      label: String(y),
      a: model.valuations.find((v) => v.company === 'SBER' && v.year === y)?.pe ?? null,
      b: model.valuations.find((v) => v.company === 'T' && v.year === y)?.pe ?? null,
    })),
    'Исторический P/E, ×',
  )}<h2>5. Сценарии 2026</h2><p>Ретроспективная учебная модель на EPS 2025, раскрытой в 2026. EPS Сбера ${rub(model.eps.SBER, 2)}, Т ${rub(model.eps.T, 3)} после сплита. Цена = EPS2025 × (1 + g) × P/E. Дивиденд = EPS2026 × доля выплат. Сценариям не приписаны вероятности. Горизонт данной таблицы — один год; в калькуляторе V(t) = V₀(1 + R)^t при постоянной сценарной ставке на весь горизонт.</p>${table(
    ['Сценарий', 'Компания', 'g EPS', 'P/E', 'Выплаты', 'Цена', 'Дивиденд', 'Доходность'],
    ctx.scenarios.flatMap((s) =>
      (['SBER', 'T'] as Company[]).map((c) => {
        const r = model.results.find((r) => r.id === s.id)?.[c];
        return [
          s.name,
          c,
          pct(s[c === 'SBER' ? 'growthSBER' : 'growthT'] / 100),
          s[c === 'SBER' ? 'peSBER' : 'peT'],
          pct(s[c === 'SBER' ? 'payoutSBER' : 'payoutT'] / 100),
          rub(r?.price, 2),
          rub(r?.dividend, 2),
          pct(r?.return),
        ];
      }),
    ),
  )}${table(
    ['Сценарий', 'Стоимость портфеля', 'Результат, ₽'],
    model.results.map((r) => [r.name, rub(r.value), rub(r.profit)]),
  )}<ul>${ctx.scenarios.map((s) => `<li><b>${esc(s.name)}:</b> ${esc(s.premise)} Нарушение: ${esc(s.risk)}</li>`).join('')}</ul><h2>6. Инвестиционный вывод</h2><ol>${model.conclusions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p>Положение эмитента оценивается по шести сигналам: положительная прибыль, рост капитала, ROE ≥ 15%, общий капитал ≥ 12%, NPL ≤ 6%, отсутствие снижения прибыли. Недостаточно данных — отсутствует ключевое поле; неблагоприятная динамика — прибыль/капитал ≤ 0 либо ≥3 отрицательных сигнала; повышенные риски — 1–2; устойчивое — 0. Риск акции высокий при σ ≥35% или просадке ≥40%, умеренный при σ ≥20% или просадке ≥20%, иначе низкий. Это учебные пороги.</p><h2>7. Ограничения</h2><ul>${data.market.notes.map((s) => `<li>${esc(s)}</li>`).join('')}<li>Две группы одного сектора не обеспечивают широкую диверсификацию; история и корреляция нестабильны. Нет гарантии доходности и достоверного прогноза банкротства по пяти годовым наблюдениям.</li><li>Налоги, комиссии, инфляция, валютные издержки и целочисленные лоты не учтены. Фактическая стратегия счета отличается от условной реинвестиции.</li><li>Падение цены и временный убыток не означают дефолт. NPL и ROE разных групп методологически различаются.</li></ul><h2>Пояснения показателей</h2><ul>${Object.values(
    metricHelp,
  )
    .map(
      (m) =>
        `<li><b>${esc(m.name)}:</b> ${esc(m.formula)}. ${esc(m.meaning)} ${esc(m.interpretation)}</li>`,
    )
    .join(
      '',
    )}</ul><h2>8. Источники</h2><ol class="notes">${sources.map((s) => `<li><b>${esc(s.title)}</b>. ${esc(s.standard)}; ${esc(s.section)}. Проверено ${esc(s.accessed)}. <a href="${esc(s.url)}">${esc(s.url)}</a>. ${esc(s.note)}</li>`).join('')}</ol><h2>Приложение. Примечания к финансовым значениям</h2>${table(
    ['Компания', 'Год', 'Показатель', 'Источник', 'Примечание'],
    data.financial.facts
      .filter((f) => f.note)
      .map((f) => [f.company, f.year, metrics[f.metric].label, f.sourceId, f.note]),
  )}</body></html>`;
}
export function exportPDF(ctx: ExportContext) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Разрешите открытие окна отчёта в браузере');
  win.document.open();
  win.document.write(reportHTML(ctx));
  win.document.close();
}
