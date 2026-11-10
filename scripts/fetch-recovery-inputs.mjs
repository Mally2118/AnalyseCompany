import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
/** Explicit network audit. Does not mutate market.json or replace published research on failure. */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const marketText = await readFile(new URL('public/data/market.json', root), 'utf8');
const market = JSON.parse(marketText);
const missing = market.quotes.filter((q) => q.T === null).map((q) => q.date);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const sources = [];
async function requestText(url) {
  const { stdout } = await promisify(execFile)(
    'curl',
    ['--fail', '--location', '--silent', '--show-error', '--max-time', '30', '--retry', '2', url],
    { maxBuffer: 10000000 },
  );
  return stdout;
}
async function candles(marketName, ticker) {
  const result = [];
  for (let start = 0; start < 10000;) {
    const url = `https://iss.moex.com/iss/engines/stock/markets/${marketName}/securities/${ticker}/candles.json?from=2020-12-01&till=2025-12-31&interval=24&start=${start}&iss.meta=off`;
    const text = await requestText(url),
      json = JSON.parse(text);
    const block = json.candles;
    if (!block?.data || !block.columns.includes('close')) throw new Error(`Bad candles: ${ticker}`);
    sources.push({
      url,
      sha256: sha(text),
      rows: block.data.length,
      accessed: new Date().toISOString().slice(0, 10),
    });
    if (!block.data.length) break;
    const rows = block.data.map((row) =>
      Object.fromEntries(block.columns.map((key, i) => [key, row[i]])),
    );
    result.push(...rows.map((r) => ({ date: r.begin.slice(0, 10), close: r.close })));
    start += rows.length;
  }
  if (!result.length) throw new Error(`Empty source: ${ticker}`);
  return result;
}
const index = await candles('index', 'IMOEX');
// Audit the same continuous-auction board as the original dataset, rather than mix RPS/T0 prices.
async function boardAudit(ticker) {
  const checks = [];
  for (const [from, till] of [
    ['2022-03-24', '2022-03-29'],
    ['2024-02-15', '2024-03-18'],
    ['2025-10-03', '2025-10-06'],
  ]) {
    const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json?from=${from}&till=${till}&interval=24&iss.meta=off`;
    const text = await requestText(url),
      block = JSON.parse(text).candles;
    if (!block?.data) throw new Error('Bad audit');
    const rows = block.data
      .map((r) => Object.fromEntries(block.columns.map((k, i) => [k, r[i]])))
      .map((r) => ({ date: r.begin.slice(0, 10), close: r.close }));
    checks.push({ ticker, from, till, url, sha256: sha(text), rows });
  }
  return checks;
}
const t = await boardAudit('T'),
  old = await boardAudit('TCSG');
const audit = [...t, ...old];
// A revised existing candle requires an explicit audit; never silently refit on inconsistent anchors.
for (const q of t.flatMap((x) => x.rows)) {
  const original = market.quotes.find((r) => r.date === q.date)?.T;
  if (original != null && Math.abs(original - q.close) > 1e-8 * Math.max(1, original))
    throw new Error(`Revised actual candle ${q.date}; review original data before rebuilding.`);
}
const historyChecks = [];
for (const [ticker, from, till] of [
  ['TCSG', '2022-03-24', '2022-03-29'],
  ['TCSG', '2024-02-15', '2024-03-18'],
  ['T', '2025-10-03', '2025-10-06'],
]) {
  const rows = [];
  for (let start = 0; start < 10000;) {
    const url = `https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/${ticker}.json?from=${from}&till=${till}&start=${start}&iss.meta=off&history.columns=BOARDID,TRADEDATE,NUMTRADES,CLOSE,LEGALCLOSEPRICE`;
    const text = await requestText(url),
      block = JSON.parse(text).history;
    if (!block?.data) throw new Error('Bad history audit');
    sources.push({
      url,
      sha256: sha(text),
      rows: block.data.length,
      accessed: new Date().toISOString().slice(0, 10),
    });
    if (!block.data.length) break;
    rows.push(
      ...block.data.map((row) => Object.fromEntries(block.columns.map((k, i) => [k, row[i]]))),
    );
    start += block.data.length;
  }
  historyChecks.push({ ticker, from, till, rows });
}
for (const row of historyChecks.flatMap((c) => c.rows)) {
  if (
    missing.includes(row.TRADEDATE) &&
    row.BOARDID === 'TQBR' &&
    row.NUMTRADES > 0 &&
    row.CLOSE > 0
  )
    throw new Error(
      `Found actual history CLOSE on ${row.TRADEDATE}; audit its corporate basis and restore the fact first.`,
    );
}
const actualPatches = missing.flatMap((date) => {
  const now = t.flatMap((x) => x.rows).find((q) => q.date === date);
  const before = old.flatMap((x) => x.rows).find((q) => q.date === date);
  if (now && before && Math.abs(before.close / now.close - 10) > 1e-6)
    throw new Error('Changed split adjustment');
  return now || before
    ? [
        {
          date,
          price: now?.close ?? before.close / 10,
          source: (now ? t : old).find((q) => q.rows.some((r) => r.date === date)).url,
        },
      ]
    : [];
});
if (actualPatches.length)
  throw new Error(
    `Found ${actualPatches.length} actual quotes; review and record them before economic estimation.`,
  );
const result = {
  schemaVersion: 1,
  marketFileSha256: sha(marketText),
  marketUpdatedAt: market.updatedAt,
  fetchedAt: new Date().toISOString(),
  index: { ticker: 'IMOEX', kind: 'price', observations: index },
  sources,
  checks: audit,
  historyChecks,
  missingDates: missing,
  actualPatches,
};
const destination = new URL('public/data/recovery-inputs.json', root),
  temporary = new URL('public/data/recovery-inputs.json.tmp', root);
await writeFile(temporary, JSON.stringify(result, null, 2) + '\n');
await rename(temporary, destination);
console.log(
  `Verified ${missing.length} missing dates; actual patches ${actualPatches.length}; IMOEX ${index.length} observations.`,
);
