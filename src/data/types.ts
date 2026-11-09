export type Company = 'SBER' | 'T';
export type Mode = Company | 'compare';
export type ReturnKind = 'price' | 'total';
export type Metric =
  | 'profit'
  | 'assets'
  | 'equity'
  | 'nii'
  | 'fees'
  | 'roe'
  | 'roa'
  | 'cir'
  | 'capital'
  | 'npl'
  | 'cor'
  | 'eps'
  | 'dividend';
export interface Source {
  id: string;
  title: string;
  url: string;
  section: string;
  standard: string;
  accessed: string;
  note: string;
}
export interface Fact {
  company: Company;
  year: number;
  metric: Metric;
  value: number | null;
  unit: 'млрд ₽' | '%' | '₽/акцию';
  sourceId: string;
  section: string;
  note: string;
  comparable: boolean;
}
export interface FinancialData {
  updatedAt: string;
  facts: Fact[];
  sources: Source[];
}
export interface Quote {
  date: string;
  SBER: number | null;
  T: number | null;
  tOriginal: number | null;
  tInstrument: string;
  note: string;
}
export interface Dividend {
  company: Company;
  date: string;
  amount: number;
  currency: 'RUB';
  sourceId: string;
  note: string;
}
export interface MarketData {
  updatedAt: string;
  from: string;
  till: string;
  basis: string;
  sources: Source[];
  quotes: Quote[];
  monthly: Quote[];
  dividends: Dividend[];
  totalAvailableFrom: Record<Company, string>;
  notes: string[];
  audit: { overlap: number; maxRatioError: number; cors: string };
}
export interface ReturnRow {
  from: string;
  date: string;
  SBER: number | null;
  T: number | null;
  priceSBER: number | null;
  priceT: number | null;
}
export interface Stats {
  from: string | null;
  till: string | null;
  years: number;
  n: number;
  monthlyMean: number;
  annualMean: number;
  monthlyVol: number;
  annualVol: number;
  sharpe: number | null;
  cagr: number | null;
  maxDrawdown: number | null;
  var95: number | null;
  wealth: number | null;
}
export interface Portfolio {
  weight: number;
  mean: number;
  risk: number;
  sharpe: number | null;
  efficient: boolean;
}
export interface Scenario {
  id: string;
  name: string;
  color: string;
  growthSBER: number;
  growthT: number;
  peSBER: number;
  peT: number;
  payoutSBER: number;
  payoutT: number;
  premise: string;
  risk: string;
}
export interface ScenarioResult {
  id: string;
  name: string;
  color: string;
  SBER: { eps: number; price: number; dividend: number; return: number };
  T: { eps: number; price: number; dividend: number; return: number };
  return: number;
  value: number;
  profit: number;
}
export const companies: Record<Company, { name: string; color: string; short: string }> = {
  SBER: { name: 'Сбербанк', color: '#40cbb0', short: 'SBER' },
  T: { name: 'Т-Технологии', color: '#78a0ff', short: 'T' },
};
export const years = [2021, 2022, 2023, 2024, 2025];
export const metrics: Record<
  Metric,
  { label: string; unit: Fact['unit']; definition: string; formula: string }
> = {
  profit: {
    label: 'Чистая прибыль группы',
    unit: 'млрд ₽',
    definition:
      'Консолидированный результат после расходов и налога; может включать неконтрольную долю и разовые эффекты.',
    formula: 'Доходы − расходы − налог',
  },
  assets: {
    label: 'Активы',
    unit: 'млрд ₽',
    definition: 'Совокупные активы группы на конец года.',
    formula: 'Обязательства + собственный капитал',
  },
  equity: {
    label: 'Собственный капитал',
    unit: 'млрд ₽',
    definition: 'Балансовые собственные средства группы; это не регуляторный капитал.',
    formula: 'Активы − обязательства',
  },
  nii: {
    label: 'Чистый процентный доход',
    unit: 'млрд ₽',
    definition: 'Разница между процентными доходами и расходами до кредитных резервов.',
    formula: 'Процентные доходы − процентные расходы',
  },
  fees: {
    label: 'Чистый комиссионный доход',
    unit: 'млрд ₽',
    definition: 'Комиссионный результат после расходов.',
    formula: 'Комиссионные доходы − комиссионные расходы',
  },
  roe: {
    label: 'ROE',
    unit: '%',
    definition:
      'Опубликованная рентабельность капитала по методике эмитента; у Т за 2025 год операционная.',
    formula: 'Прибыль акционеров / средний капитал акционеров × 100%',
  },
  roa: {
    label: 'ROA',
    unit: '%',
    definition:
      'Рентабельность активов по опубликованной методике. При отсутствии раскрытия не рассчитывается по капиталу на конец года.',
    formula: 'Чистая прибыль / средние активы × 100%',
  },
  cir: {
    label: 'CIR',
    unit: '%',
    definition:
      'Доля операционных расходов в операционных доходах. Ниже обычно означает эффективнее; состав доходов различается.',
    formula: 'Операционные расходы / операционные доходы × 100%',
  },
  capital: {
    label: 'Достаточность капитала',
    unit: '%',
    definition:
      'У Сбера общий капитал Basel, у Т общий капитал группы по опубликованной методике. Не сопоставляется с Н1.0 отдельного банка.',
    formula: 'Регуляторный капитал / активы, взвешенные по риску × 100%',
  },
  npl: {
    label: 'Проблемные кредиты',
    unit: '%',
    definition: 'У Сбера стадия 3 + POCI, у Т NPL. Определения различаются; сравнение условное.',
    formula: 'Проблемные кредиты / кредитный портфель × 100%',
  },
  cor: {
    label: 'Стоимость риска, CoR',
    unit: '%',
    definition:
      'Кредитные потери относительно среднего кредитного портфеля; методики эмитентов различаются.',
    formula: 'Расход на кредитные резервы / средний портфель × 100%',
  },
  eps: {
    label: 'Базовая EPS',
    unit: '₽/акцию',
    definition:
      'Прибыль на обыкновенную акцию по отчету. Для T все значения приведены к сплиту 1:10, для сценария используется EPS 2025.',
    formula: 'Прибыль обыкновенных акционеров / средневзвешенные акции',
  },
  dividend: {
    label: 'Дивиденды в календарном году',
    unit: '₽/акцию',
    definition:
      'Рублевые дивиденды по году события модели, а не по году прибыли. T приведены к сплиту; USD-выплата 2021 не пересчитывается без проверенного курса.',
    formula: 'Σ дивидендов на сопоставимую акцию за календарный год',
  },
};
