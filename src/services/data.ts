import type { FinancialData, MarketData } from '../data/types';
import { validateRecovery, sha256Text, type RecoveryData } from './recovery';
import { validateFinancial, validateMarket } from './validation';
export interface DataSet {
  financial: FinancialData;
  market: MarketData;
  recovery?: RecoveryData;
  recoveryError?: string;
}
export async function loadData(): Promise<DataSet> {
  const [financial, market] = await Promise.all(
    ['financial.json', 'market.json'].map(async (name) => {
      const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
      if (!r.ok) throw new Error(`Не удалось загрузить ${name}: ${r.status}`);
      return r.text();
    }),
  );
  const result: DataSet = {
    financial: validateFinancial(JSON.parse(financial)),
    market: validateMarket(JSON.parse(market)),
  };
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/recovery.json`);
    if (!response.ok) throw new Error('Исследование восстановления недоступно');
    result.recovery = validateRecovery(
      await response.json(),
      result.market,
      await sha256Text(market),
    );
  } catch (e) {
    result.recoveryError = e instanceof Error ? e.message : 'Исследование недоступно';
  }
  return result;
}
