import { Fragment } from "react";

import { polygonToPath, round } from "../geometry";
import type { ComputedRoom, GeneratedBoard, Project } from "../types";

import { createBoardInspection } from "../app/boardInspection";
import { formatLength } from "../app/units";

type BoardInspectorModalProps = {
  board: GeneratedBoard | null;
  rooms: ComputedRoom[];
  unit: Project["unit"];
  leftLabel: string;
  rightLabel: string;
  onClose: () => void;
};

export function BoardInspectorModal({
  board,
  rooms,
  unit,
  leftLabel,
  rightLabel,
  onClose,
}: BoardInspectorModalProps) {
  if (!board) {
    return null;
  }

  const inspection = createBoardInspection(board, rooms);
  const previewWidth = inspection.previewWidth + 160;
  const previewHeight = inspection.previewHeight + 160;
  const showTopMeasures = inspection.topTrimLeft > 0.5 || inspection.topTrimRight > 0.5;
  const showBottomMeasures = inspection.bottomTrimLeft > 0.5 || inspection.bottomTrimRight > 0.5;
  const showLeftMeasures = inspection.leftTrimTop > 0.5 || inspection.leftTrimBottom > 0.5;
  const showRightMeasures = inspection.rightTrimTop > 0.5 || inspection.rightTrimBottom > 0.5;
  const summaryRows = [
    { label: "Typ", value: board.type === "left" ? leftLabel : rightLabel },
    { label: "Status", value: board.full ? "Pełna klepka" : "Przycięta" },
  ];
  const longSideRows = [
    ...(showTopMeasures && inspection.topTrimLeft > 0.5 ? [{ label: "Góra L", value: formatLength(inspection.topTrimLeft, unit) }] : []),
    ...(showTopMeasures && inspection.topTrimRight > 0.5 ? [{ label: "Góra P", value: formatLength(inspection.topTrimRight, unit) }] : []),
    ...(showTopMeasures ? [{ label: "Góra zostaje", value: formatLength(inspection.topSpan.width, unit) }] : []),
    ...(showBottomMeasures && inspection.bottomTrimLeft > 0.5 ? [{ label: "Dół L", value: formatLength(inspection.bottomTrimLeft, unit) }] : []),
    ...(showBottomMeasures && inspection.bottomTrimRight > 0.5 ? [{ label: "Dół P", value: formatLength(inspection.bottomTrimRight, unit) }] : []),
    ...(showBottomMeasures ? [{ label: "Dół zostaje", value: formatLength(inspection.bottomSpan.width, unit) }] : []),
  ];
  const shortSideRows = [
    ...(showLeftMeasures && inspection.leftTrimTop > 0.5 ? [{ label: "Lewa G", value: formatLength(inspection.leftTrimTop, unit) }] : []),
    ...(showLeftMeasures && inspection.leftTrimBottom > 0.5 ? [{ label: "Lewa D", value: formatLength(inspection.leftTrimBottom, unit) }] : []),
    ...(showLeftMeasures ? [{ label: "Lewa zostaje", value: formatLength(inspection.leftSpan.width, unit) }] : []),
    ...(showRightMeasures && inspection.rightTrimTop > 0.5 ? [{ label: "Prawa G", value: formatLength(inspection.rightTrimTop, unit) }] : []),
    ...(showRightMeasures && inspection.rightTrimBottom > 0.5 ? [{ label: "Prawa D", value: formatLength(inspection.rightTrimBottom, unit) }] : []),
    ...(showRightMeasures ? [{ label: "Prawa zostaje", value: formatLength(inspection.rightSpan.width, unit) }] : []),
  ];
  const angleRows = inspection.cutAngles.map((entry, index) => ({
    label: `Cięcie ${index + 1}`,
    value: `${round(entry.angle)}°`,
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Inspektor Klepki</p>
            <h2>{board.id}</h2>
          </div>
          <button className="secondary" type="button" onClick={onClose}>Zamknij</button>
        </div>

        <div className="modal-grid">
          <div className="panel modal-panel">
            <h2>Powiększenie</h2>
            <svg className="board-preview" viewBox={`-80 -80 ${previewWidth} ${previewHeight}`}>
              <defs>
                <clipPath id={`board-inspector-clip-${board.id}`}>
                  {inspection.clipPolygons.map((polygon, index) => (
                    <path key={`clip-${index}`} d={polygonToPath(polygon)} />
                  ))}
                </clipPath>
              </defs>
              <path d={polygonToPath(inspection.basePoints)} fill="rgba(42,34,25,0.05)" stroke="rgba(42,34,25,0.25)" strokeWidth={6} strokeLinejoin="round" />
              <path
                d={polygonToPath(inspection.basePoints)}
                clipPath={`url(#board-inspector-clip-${board.id})`}
                fill={board.full ? (board.type === "left" ? "rgba(213, 155, 96, 0.82)" : "rgba(240, 199, 133, 0.86)") : "rgba(213, 72, 62, 0.72)"}
                stroke="rgba(42,34,25,0.65)"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              {showTopMeasures && inspection.topTrimLeft > 0.5 ? (
                <>
                  <line x1={0} y1={-64} x2={inspection.topSpan.minX} y2={-64} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={0} y1={-76} x2={0} y2={-48} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.topSpan.minX} y1={-76} x2={inspection.topSpan.minX} y2={-48} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={inspection.topSpan.minX / 2} y={-70} textAnchor="middle" fontSize={24} fill="#af5d32">
                    {formatLength(inspection.topTrimLeft, unit)}
                  </text>
                </>
              ) : null}
              {showTopMeasures && inspection.topTrimRight > 0.5 ? (
                <>
                  <line x1={inspection.topSpan.maxX} y1={-64} x2={inspection.previewWidth} y2={-64} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.topSpan.maxX} y1={-76} x2={inspection.topSpan.maxX} y2={-48} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth} y1={-76} x2={inspection.previewWidth} y2={-48} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={(inspection.topSpan.maxX + inspection.previewWidth) / 2} y={-70} textAnchor="middle" fontSize={24} fill="#af5d32">
                    {formatLength(inspection.topTrimRight, unit)}
                  </text>
                </>
              ) : null}
              {showBottomMeasures && inspection.bottomTrimLeft > 0.5 ? (
                <>
                  <line x1={0} y1={inspection.previewHeight + 64} x2={inspection.bottomSpan.minX} y2={inspection.previewHeight + 64} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={0} y1={inspection.previewHeight + 52} x2={0} y2={inspection.previewHeight + 80} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.bottomSpan.minX} y1={inspection.previewHeight + 52} x2={inspection.bottomSpan.minX} y2={inspection.previewHeight + 80} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={inspection.bottomSpan.minX / 2} y={inspection.previewHeight + 58} textAnchor="middle" fontSize={24} fill="#af5d32">
                    {formatLength(inspection.bottomTrimLeft, unit)}
                  </text>
                </>
              ) : null}
              {showBottomMeasures && inspection.bottomTrimRight > 0.5 ? (
                <>
                  <line x1={inspection.bottomSpan.maxX} y1={inspection.previewHeight + 64} x2={inspection.previewWidth} y2={inspection.previewHeight + 64} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.bottomSpan.maxX} y1={inspection.previewHeight + 52} x2={inspection.bottomSpan.maxX} y2={inspection.previewHeight + 80} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth} y1={inspection.previewHeight + 52} x2={inspection.previewWidth} y2={inspection.previewHeight + 80} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={(inspection.bottomSpan.maxX + inspection.previewWidth) / 2} y={inspection.previewHeight + 58} textAnchor="middle" fontSize={24} fill="#af5d32">
                    {formatLength(inspection.bottomTrimRight, unit)}
                  </text>
                </>
              ) : null}
              {showLeftMeasures && inspection.leftTrimTop > 0.5 ? (
                <>
                  <line x1={-92} y1={0} x2={-92} y2={inspection.leftSpan.minX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={-104} y1={0} x2={-80} y2={0} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={-104} y1={inspection.leftSpan.minX} x2={-80} y2={inspection.leftSpan.minX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={-118} y={inspection.leftSpan.minX / 2} textAnchor="middle" fontSize={24} fill="#af5d32" transform={`rotate(-90 -118 ${inspection.leftSpan.minX / 2})`}>
                    {formatLength(inspection.leftTrimTop, unit)}
                  </text>
                </>
              ) : null}
              {showLeftMeasures && inspection.leftTrimBottom > 0.5 ? (
                <>
                  <line x1={-92} y1={inspection.leftSpan.maxX} x2={-92} y2={inspection.previewHeight} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={-104} y1={inspection.leftSpan.maxX} x2={-80} y2={inspection.leftSpan.maxX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={-104} y1={inspection.previewHeight} x2={-80} y2={inspection.previewHeight} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={-118} y={(inspection.leftSpan.maxX + inspection.previewHeight) / 2} textAnchor="middle" fontSize={24} fill="#af5d32" transform={`rotate(-90 -118 ${(inspection.leftSpan.maxX + inspection.previewHeight) / 2})`}>
                    {formatLength(inspection.leftTrimBottom, unit)}
                  </text>
                </>
              ) : null}
              {showRightMeasures && inspection.rightTrimTop > 0.5 ? (
                <>
                  <line x1={inspection.previewWidth + 92} y1={0} x2={inspection.previewWidth + 92} y2={inspection.rightSpan.minX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth + 80} y1={0} x2={inspection.previewWidth + 104} y2={0} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth + 80} y1={inspection.rightSpan.minX} x2={inspection.previewWidth + 104} y2={inspection.rightSpan.minX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={inspection.previewWidth + 118} y={inspection.rightSpan.minX / 2} textAnchor="middle" fontSize={24} fill="#af5d32" transform={`rotate(-90 ${inspection.previewWidth + 118} ${inspection.rightSpan.minX / 2})`}>
                    {formatLength(inspection.rightTrimTop, unit)}
                  </text>
                </>
              ) : null}
              {showRightMeasures && inspection.rightTrimBottom > 0.5 ? (
                <>
                  <line x1={inspection.previewWidth + 92} y1={inspection.rightSpan.maxX} x2={inspection.previewWidth + 92} y2={inspection.previewHeight} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth + 80} y1={inspection.rightSpan.maxX} x2={inspection.previewWidth + 104} y2={inspection.rightSpan.maxX} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <line x1={inspection.previewWidth + 80} y1={inspection.previewHeight} x2={inspection.previewWidth + 104} y2={inspection.previewHeight} stroke="rgba(175,93,50,0.82)" strokeWidth={3} />
                  <text x={inspection.previewWidth + 118} y={(inspection.rightSpan.maxX + inspection.previewHeight) / 2} textAnchor="middle" fontSize={24} fill="#af5d32" transform={`rotate(-90 ${inspection.previewWidth + 118} ${(inspection.rightSpan.maxX + inspection.previewHeight) / 2})`}>
                    {formatLength(inspection.rightTrimBottom, unit)}
                  </text>
                </>
              ) : null}
              {inspection.cutAngles.map((entry, index) => (
                <g key={`cut-angle-${index}`}>
                  <line x1={entry.center.x} y1={entry.center.y} x2={entry.baseRayEnd.x} y2={entry.baseRayEnd.y} stroke="rgba(175,93,50,0.82)" strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={entry.center.x} y1={entry.center.y} x2={entry.cutRayEnd.x} y2={entry.cutRayEnd.y} stroke="rgba(175,93,50,0.82)" strokeWidth={2.5} strokeLinecap="round" />
                  <path d={entry.arcPath} fill="none" stroke="rgba(175,93,50,0.82)" strokeWidth={2.5} strokeLinecap="round" />
                  <text x={entry.labelPoint.x} y={entry.labelPoint.y + 6} textAnchor="middle" fontSize={18} fontWeight={700} fill="#af5d32">
                    {entry.angle}°
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="panel modal-panel">
            <h2>Dane Klepki</h2>
            <div className="detail-card">
              <div className="detail-groups">
                <section className="detail-group">
                  <h3>Podstawowe</h3>
                  <dl>
                    {summaryRows.map((row) => (
                      <Fragment key={row.label}>
                        <dt>{row.label}</dt><dd>{row.value}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </section>
                {longSideRows.length ? (
                  <section className="detail-group">
                    <h3>Długi bok</h3>
                    <dl>
                      {longSideRows.map((row) => (
                        <Fragment key={row.label}>
                          <dt>{row.label}</dt><dd>{row.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </section>
                ) : null}
                {shortSideRows.length ? (
                  <section className="detail-group">
                    <h3>Krótki bok</h3>
                    <dl>
                      {shortSideRows.map((row) => (
                        <Fragment key={row.label}>
                          <dt>{row.label}</dt><dd>{row.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </section>
                ) : null}
                {angleRows.length ? (
                  <section className="detail-group">
                    <h3>Kąty</h3>
                    <dl>
                      {angleRows.map((row) => (
                        <Fragment key={row.label}>
                          <dt>{row.label}</dt><dd>{row.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </section>
                ) : null}
              </div>
            </div>

            {!board.full ? (
              <p className="hint">
                Ciemniejszy obszar pokazuje fragment klepki, który zostaje po cięciu.
                Jaśniejszy obszar to materiał do odcięcia.
              </p>
            ) : (
              <p className="hint">Ta klepka nie wymaga cięcia.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
