import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
const root = new URL('../', import.meta.url),
  base = 'https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/';
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { Origin: 'https://example.github.io' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data.candles?.data) throw new Error('Нет candles');
      return { data, cors: r.headers.get('access-control-allow-origin') ?? 'не указан' };
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}
async function candles(ticker, interval) {
  let start = 0,
    all = [],
    cors = '';
  for (let page = 0; page < 20; page++) {
    const url = `${base}${ticker}/candles.json?from=2020-12-01&till=2025-12-31&interval=${interval}&start=${start}&iss.meta=off`;
    const r = await request(url);
    cors = r.cors;
    const block = r.data.candles,
      rows = block.data.map((row) => Object.fromEntries(block.columns.map((k, i) => [k, row[i]])));
    if (!rows.length) break;
    all.push(...rows);
    start += rows.length;
    await sleep(350);
  }
  if (!all.length) throw new Error(`Пустой ряд ${ticker}`);
  return { rows: all, cors };
}
try {
  await mkdir(new URL('.data-candidates/raw/', root), { recursive: true });
  const s = await candles('SBER', 24),
    t = await candles('T', 24),
    old = await candles('TCSG', 24);
  const oldMap = new Map(old.rows.map((r) => [r.begin.slice(0, 10), r.close]));
  let overlap = 0,
    maxRatioError = 0;
  for (const r of t.rows) {
    const p = oldMap.get(r.begin.slice(0, 10));
    if (p) {
      overlap++;
      maxRatioError = Math.max(maxRatioError, Math.abs(p / r.close - 10));
    }
  }
  if (overlap < 500 || maxRatioError > 1e-6)
    throw new Error(
      `Изменена методика истории T: overlap=${overlap}, error=${maxRatioError}. Нужна ручная проверка; последняя версия сохранена.`,
    );
  const maps = [s, t].map((x) => new Map(x.rows.map((r) => [r.begin.slice(0, 10), r.close]))),
    dates = [...new Set([...maps[0].keys(), ...maps[1].keys()])].sort();
  const quotes = dates.map((date) => {
    const a = maps[0].get(date) ?? null,
      b = maps[1].get(date) ?? null;
    return {
      date,
      SBER: a,
      T: b,
      tOriginal: oldMap.get(date) ?? (b !== null ? b * 10 : null),
      tInstrument:
        date < '2024-03-18' ? 'TCSG · GDR' : date < '2024-11-28' ? 'TCSG · акция' : 'T · акция',
      note:
        a === null || b === null
          ? 'Отсутствует торговая котировка; без заполнения'
          : date < '2024-03-18'
            ? 'GDR 1:1 к акции; цена T в базе сплита 2026'
            : 'Цена T в базе сплита 2026',
    };
  });
  const monthly = [];
  for (let y = 2020; y <= 2025; y++)
    for (let m = 1; m <= 12; m++) {
      if (y === 2020 && m < 12) continue;
      const prefix = `${y}-${String(m).padStart(2, '0')}`,
        common = quotes.filter((q) => q.date.startsWith(prefix) && q.SBER !== null && q.T !== null),
        last = common.at(-1),
        end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const lag = last ? (Date.parse(end) - Date.parse(last.date)) / 86400000 : Infinity;
      monthly.push(
        last && lag <= 7
          ? last
          : {
              date: end,
              SBER: null,
              T: null,
              tOriginal: null,
              tInstrument: 'Нет синхронной котировки',
              note: 'Нет общей торговой даты не ранее 7 дней до конца месяца; доходности пропущены',
            },
      );
    }
  if (monthly.length !== 61 || quotes.length < 1000) throw new Error('Неполная выгрузка');
  const first = monthly[0],
    last = monthly.at(-1);
  if (
    !first.T ||
    Math.abs(first.T - 236.04) > 0.01 ||
    !last.T ||
    !first.SBER ||
    Math.abs(first.SBER - 271.65) > 0.01
  )
    throw new Error('Нарушены проверенные якоря масштаба');
  const dividends = JSON.parse(await readFile(new URL('public/data/dividends.json', root), 'utf8'));
  for (const d of dividends.dividends) {
    if (!quotes.some((q) => q.date === d.date && q[d.company] !== null))
      throw new Error(`Нет цены реинвестирования ${d.date}`);
  }
  const accessed = new Date().toISOString().slice(0, 10),
    sources = ['SBER', 'T', 'TCSG'].map((ticker) => ({
      id: `moex-${ticker}`,
      title: `MOEX ISS: дневные свечи ${ticker}, TQBR`,
      url: `${base}${ticker}/candles.json?from=2020-12-01&till=2025-12-31&interval=24&iss.meta=off`,
      section: 'candles: close, begin; пагинация start',
      standard: 'Биржевые котировки RUB',
      accessed,
      note:
        ticker === 'T'
          ? 'Сервер возвращает преемственную историю TCSG, уже /10 под сплит 2026. Проверено против TCSG на общей истории.'
          : 'Без дивидендной корректировки.',
    }));
  const data = {
    updatedAt: new Date().toISOString(),
    from: first.date,
    till: last.date,
    basis:
      'T: цена на одну акцию после сплита 1:10 (17.04.2026); SBER: обыкновенная акция. Только период 2021–2025.',
    sources: [...sources, ...dividends.sources],
    quotes,
    monthly,
    dividends: dividends.dividends,
    totalAvailableFrom: dividends.totalAvailableFrom,
    notes: [
      ...dividends.notes,
      'Редомициляция: GDR представляет одну акцию, обмен 1:1. Преемственный ряд ISS проверен по TCSG/10. Приобретение Росбанка в 2024 меняет финансовый периметр; рыночная цена отражает действующие акции с учетом допэмиссии.',
      'Месячная цена — закрытие последнего ОБЩЕГО торгового дня месяца. Если до конца месяца больше 7 дней, месяц отсутствует. Доходность существует только между соседними месяцами с ценами. Средние и ковариация рассчитаны по общей доступной выборке; CAGR и просадка — по отдельному ежедневному ряду.',
      'Полная доходность — условная реинвестиция в день реестра, без налогов, сборов, валютных издержек и целочисленных лотов. Она отличается от фактического результата счета.',
    ],
    audit: { overlap, maxRatioError, cors: t.cors },
  };
  const accept = process.argv.includes('--accept');
  await writeFile(new URL('.data-candidates/market.json', root), JSON.stringify(data, null, 2));
  for (const [name, rows] of [
    ['SBER', s.rows],
    ['T', t.rows],
    ['TCSG', old.rows],
  ])
    await writeFile(new URL(`.data-candidates/raw/${name}.json`, root), JSON.stringify(rows));
  if (accept) {
    const currentRaw = new URL('public/data/raw/', root),
      stagedRaw = new URL('.data-candidates/raw/', root),
      backupRaw = new URL('.data-candidates/previous-raw/', root);
    await rm(backupRaw, { recursive: true, force: true });
    let backedUp = false,
      installed = false;
    try {
      try {
        await rename(currentRaw, backupRaw);
        backedUp = true;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      await rename(stagedRaw, currentRaw);
      installed = true;
      await rename(
        new URL('.data-candidates/market.json', root),
        new URL('public/data/market.json', root),
      );
    } catch (e) {
      if (installed) await rm(currentRaw, { recursive: true, force: true });
      if (backedUp) await rename(backupRaw, currentRaw);
      throw e;
    }
    await rm(backupRaw, { recursive: true, force: true }).catch(() => {});
  }
  console.log(
    `Сохранено ${accept ? 'public/data/market.json' : '.data-candidates/market.json'}: ${quotes.length} дат; ${monthly.filter((x) => x.T !== null).length}/61 месяцев; overlap ${overlap}; CORS ${t.cors}`,
  );
} catch (e) {
  console.error('Обновление отклонено. Последний market.json не изменен.', e);
  process.exitCode = 1;
}
