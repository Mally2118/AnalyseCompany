import type { Fact } from '../data/types';
import { statusLabels } from '../calculations/data-records';
export function DataStatus({ fact }: { fact: Fact }) {
  return (
    <small
      className={`data-origin origin-${fact.status}`}
      title={`${fact.note} ${fact.provenance?.limitations ?? ''}`}
    >
      {statusLabels[fact.status]}
    </small>
  );
}
