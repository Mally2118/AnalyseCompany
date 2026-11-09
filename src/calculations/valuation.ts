import type { Company, FinancialData, MarketData } from '../data/types';
import { years } from '../data/types';
export function priceEarnings(price: number | null, eps: number | null): number | null {
  return price !== null &&
    eps !== null &&
    Number.isFinite(price) &&
    Number.isFinite(eps) &&
    price > 0 &&
    eps > 0
    ? price / eps
    : null;
}
export function historicalValuations(financial: FinancialData, market: MarketData) {
  return (['SBER', 'T'] as Company[]).flatMap((company) =>
    years.map((year) => {
      const epsFact = financial.facts.find(
        (f) => f.company === company && f.year === year && f.metric === 'eps',
      );
      const q = market.quotes
        .filter((q) => q.date.startsWith(String(year)) && q[company] !== null)
        .at(-1);
      const fresh = q && (Date.parse(`${year}-12-31`) - Date.parse(q.date)) / 86400000 <= 7;
      const price = fresh ? q[company] : null,
        eps = epsFact?.value ?? null;
      const epsSource = financial.sources.find((s) => s.id === epsFact?.sourceId),
        priceSource = market.sources.find((s) => s.id === `moex-${company}`);
      return {
        company,
        year,
        priceDate: fresh ? q.date : null,
        price,
        eps,
        pe: priceEarnings(price, eps),
        status: eps !== null && eps <= 0 ? 'Не применимо' : 'Нет данных',
        epsSourceId: epsFact?.sourceId ?? 'missing',
        epsUrl: eps === null ? '' : (epsSource?.url ?? ''),
        priceUrl: priceSource?.url ?? '',
        basis:
          company === 'T'
            ? 'Цена и базовая EPS на акцию после сплита 1:10'
            : 'Обыкновенная акция; базовая EPS',
        note: 'Ретроспективный P/E: годовая EPS опубликована позже даты цены. Не показатель, доступный инвестору в тот день.',
      };
    }),
  );
}
