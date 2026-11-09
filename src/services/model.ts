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
) {
  return useMemo(
    () => createResearchModel(data, kind, start, rf, weight, amount, scenarios, horizon),
    [data, kind, start, rf, weight, amount, scenarios, horizon],
  );
}
export type AnalysisModel = ReturnType<typeof createResearchModel>;
