import type { DividendMode, ProjectionPlans } from '../calculations/projection';
import { useMemo } from 'react';
import type { ReturnKind, Scenario } from '../data/types';
import type { DataSet } from './data';
import { createResearchModel } from '../calculations/research';
export function useModel(
  data: DataSet,
  kind: ReturnKind,
  start: number,
  rf: number,
  weight: number,
  amount: number,
  scenarios: Scenario[],
  horizon = 1,
  dividendMode: DividendMode = 'reinvest',
  plans?: ProjectionPlans,
) {
  return useMemo(
    () =>
      createResearchModel(
        data,
        kind,
        start,
        rf,
        weight,
        amount,
        scenarios,
        horizon,
        dividendMode,
        plans,
      ),
    [data, kind, start, rf, weight, amount, scenarios, horizon, dividendMode, plans],
  );
}
export type AnalysisModel = ReturnType<typeof createResearchModel>;
