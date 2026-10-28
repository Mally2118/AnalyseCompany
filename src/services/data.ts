import { validateFinancial, validateMarket } from './validation';
export async function loadData() {
  const [financial, market] = await Promise.all(
    ['financial.json', 'market.json'].map(async (name) => {
      const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
      if (!r.ok) throw new Error(`Не удалось загрузить ${name}: ${r.status}`);
      return r.json() as Promise<unknown>;
    }),
  );
  return { financial: validateFinancial(financial), market: validateMarket(market) };
}
export type DataSet = Awaited<ReturnType<typeof loadData>>;
