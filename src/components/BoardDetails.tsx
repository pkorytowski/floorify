import type { GeneratedBoard, Project } from "../types";

import type { BoardReusePlan } from "../app/boardReuse";
import { formatLength, toDisplayArea } from "../app/units";

type BoardDetailsProps = {
  board: GeneratedBoard | null;
  reusePlan: BoardReusePlan;
  unit: Project["unit"];
  leftLabel: string;
  rightLabel: string;
};

export function BoardDetails({ board, reusePlan, unit, leftLabel, rightLabel }: BoardDetailsProps) {
  if (!board) {
    return <div className="detail-card empty">Kliknij klepkę na planie, aby zobaczyć szczegóły wykonawcze.</div>;
  }

  const nearestWalls = board.wallDistances.map((item) => `ściana ${item.wallIndex + 1}: ${formatLength(item.distance, unit)}`).join(", ");
  const envelopes = board.cutSummary.envelopes.map((item, index) => `${index + 1}. ${formatLength(item.width, unit)} × ${formatLength(item.height, unit)}`).join("; ");
  const incomingAssignment = reusePlan.incomingByBoardId[board.id];
  const outgoingAssignments = reusePlan.outgoingByBoardId[board.id] ?? [];
  const outgoingSummary = outgoingAssignments.map((assignment) => assignment.targetBoardId).join(", ");

  return (
    <div className="detail-card">
      <dl>
        <dt>ID</dt><dd>{board.id}</dd>
        <dt>Typ</dt><dd>{board.type === "left" ? leftLabel : rightLabel}</dd>
        <dt>Orientacja</dt><dd>{board.orientation}°</dd>
        <dt>Status</dt><dd>{board.full ? "Pełna klepka" : "Przycięta"}</dd>
        <dt>Pole po przycięciu</dt><dd>{toDisplayArea(board.totalArea, unit)} {unit}²</dd>
        <dt>Fragmenty</dt><dd>{board.cutSummary.fragments}</dd>
        <dt>Usunięte pole</dt><dd>{toDisplayArea(board.cutSummary.removedArea, unit)} {unit}²</dd>
        <dt>Obwiednie fragmentów</dt><dd>{envelopes || "brak"}</dd>
        <dt>Najbliższe ściany</dt><dd>{nearestWalls || "brak danych"}</dd>
        <dt>Wykonana z docinki</dt><dd>{incomingAssignment ? incomingAssignment.sourceBoardId : "nie"}</dd>
        <dt>Zasila inne klepki</dt><dd>{outgoingSummary || "nie"}</dd>
      </dl>
    </div>
  );
}
