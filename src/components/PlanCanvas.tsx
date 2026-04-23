import { polygonToPath, round } from "../geometry";
import type { BoundingBox, Point, Project, ProjectView, Room } from "../types";

import { getRoomEdges, getWallMeasurementLabel, isSameHoveredEdge, isSameHoveredPoint } from "../app/interaction";
import { toDisplayLength } from "../app/units";
import { GridLayer } from "./GridLayer";

type HoveredPoint = { roomId: string; point: Point } | null;
type HoveredWall = { roomId: string; start: Point; end: Point } | null;

type PlanCanvasProps = {
  svgRef: React.RefObject<SVGSVGElement | null>;
  project: Project;
  projectView: ProjectView;
  currentViewBox: BoundingBox;
  gridSize: number;
  editMode: boolean;
  addPointMode: boolean;
  splitMode: boolean;
  cursor: Point | null;
  activeRoom: Room | null;
  activeRoomIntersectionsCount: number;
  hoveredPoint: HoveredPoint;
  hoveredWall: HoveredWall;
  draggedPointActive: boolean;
  draggedWallActive: boolean;
  panActive: boolean;
  selectedBoardId: string | null;
  reuseHighlightedBoardIds: string[];
  splitLineStart: Point | null;
  splitFeedback: string | null;
  onMouseDown: (event: React.MouseEvent<SVGSVGElement>) => void;
  onDoubleClickCapture: (event: React.MouseEvent<SVGSVGElement>) => void;
  onWheel: (event: React.WheelEvent<SVGSVGElement>) => void;
  onClick: (event: React.MouseEvent<SVGSVGElement>) => void;
  onDoubleClick: () => void;
  onMouseMove: (event: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
};

export function PlanCanvas({
  svgRef,
  project,
  projectView,
  currentViewBox,
  gridSize,
  editMode,
  addPointMode,
  splitMode,
  cursor,
  activeRoom,
  activeRoomIntersectionsCount,
  hoveredPoint,
  hoveredWall,
  draggedPointActive,
  draggedWallActive,
  panActive,
  selectedBoardId,
  reuseHighlightedBoardIds,
  splitLineStart,
  splitFeedback,
  onMouseDown,
  onDoubleClickCapture,
  onWheel,
  onClick,
  onDoubleClick,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}: PlanCanvasProps) {
  return (
    <main className="workspace">
      <div className="toolbar">
        <div>
          <strong>Tryb:</strong> {editMode ? "Edycja" : "Podgląd"} | <strong>Aktywny pokój:</strong> {activeRoom?.name ?? "brak"} | <strong>Dodawanie punktów:</strong> {addPointMode ? "włączone" : "wyłączone"} | <strong>Podział pokoju:</strong> {splitMode ? "włączony" : "wyłączony"}
        </div>
        <div className="hint">
          {editMode
            ? splitMode
              ? "W trybie podziału kliknij pierwszy i drugi punkt linii cięcia. Linia musi przeciąć obrys aktywnego pokoju dokładnie dwa razy. Shift ogranicza kierunek do 0/45/90 stopni, a Ctrl/Cmd przyciąga do siatki."
              : "Gdy dodawanie punktów jest włączone, klik tła dodaje punkt. Przytrzymaj punkt, aby przesunąć wierzchołek, albo ścianę, aby przesunąć cały segment. Dwuklik zamyka wielokąt. Shift podczas rysowania ogranicza do 0/45/90 stopni, a podczas przeciągania blokuje ruch do pionu lub poziomu. Ctrl/Cmd przyciąga do siatki."
            : "Tryb podglądu blokuje zmiany geometrii. Dwuklik przybliża, Shift + dwuklik oddala, a przeciągnięcie tła przesuwa widok."}{" "}
          `Cmd/Ctrl + Z` cofa, `Cmd/Ctrl + Shift + Z` lub `Ctrl + Y` ponawia. Kursor: {cursor ? `${toDisplayLength(cursor.x, project.unit)} / ${toDisplayLength(cursor.y, project.unit)} ${project.unit}` : "poza planszą"}
        </div>
      </div>

      {activeRoomIntersectionsCount > 0 ? (
        <div className="validation-banner">
          Obrys aktywnego pokoju przecina się sam ze sobą. Popraw kolejność lub położenie punktów, zanim zamkniesz pokój i wygenerujesz podłogę.
        </div>
      ) : null}

      {splitFeedback ? (
        <div className="validation-banner">
          {splitFeedback}
        </div>
      ) : null}

      <div className="canvas-wrap">
        <svg
          ref={svgRef}
          className="plan-canvas"
          viewBox={`${currentViewBox.minX} ${currentViewBox.minY} ${Math.max(currentViewBox.width, 10)} ${Math.max(currentViewBox.height, 10)}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={onMouseDown}
          onDoubleClickCapture={onDoubleClickCapture}
          onWheel={onWheel}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{
            cursor: !editMode && panActive
              ? "grabbing"
              : !editMode
                ? "grab"
                : draggedPointActive || draggedWallActive
                  ? "grabbing"
                  : hoveredPoint || hoveredWall
                    ? "grab"
                    : "crosshair",
          }}
        >
          <defs>
            <filter id="selected-board-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="rgba(31,26,21,0.35)" />
            </filter>
            <filter id="reused-board-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="rgba(39,122,89,0.3)" />
            </filter>
            {projectView.rooms
              .filter((room) => room.closed && room.workingPolygon.length >= 3 && (!room.intersections || room.intersections.length === 0))
              .map((room) => (
                <clipPath key={`clip-${room.id}`} id={`clip-${room.id}`} clipPathUnits="userSpaceOnUse">
                  <path d={polygonToPath(room.workingPolygon)} />
                </clipPath>
              ))}
          </defs>

          <GridLayer viewBox={currentViewBox} gridSize={gridSize} />

          <Legend currentViewBox={currentViewBox} selectedBoardId={selectedBoardId} reuseHighlightedBoardIds={reuseHighlightedBoardIds} />
          <RoomLayer
            project={project}
            projectView={projectView}
            hoveredPoint={hoveredPoint}
            hoveredWall={hoveredWall}
          />
          <PreviewCursor
            editMode={editMode}
            addPointMode={addPointMode}
            splitMode={splitMode}
            activeRoom={activeRoom}
            cursor={cursor}
            unit={project.unit}
          />
          <SplitPreview splitMode={splitMode} splitLineStart={splitLineStart} cursor={cursor} />
          <BoardsLayer
            project={project}
            projectView={projectView}
            editMode={editMode}
            selectedBoardId={selectedBoardId}
            reuseHighlightedBoardIds={reuseHighlightedBoardIds}
          />
          <DoorsLayer project={project} />
        </svg>
      </div>
    </main>
  );
}

function Legend({
  currentViewBox,
  selectedBoardId,
  reuseHighlightedBoardIds,
}: {
  currentViewBox: BoundingBox;
  selectedBoardId: string | null;
  reuseHighlightedBoardIds: string[];
}) {
  const showReuseLegend = Boolean(selectedBoardId && reuseHighlightedBoardIds.length);

  return (
    <g transform={`translate(${currentViewBox.minX + 120} ${currentViewBox.minY + 120})`}>
      <rect x={0} y={0} width={showReuseLegend ? 2360 : 1800} height={190} rx={95} fill="rgba(255,252,247,0.92)" stroke="rgba(42,34,25,0.08)" strokeWidth={8} />
      {[
        { label: "Lewa", color: "#d59b60", x: 130 },
        { label: "Prawa", color: "#f0c785", x: 690 },
        { label: "Przycięta", color: "#d5483e", x: 1250 },
        ...(showReuseLegend ? [{ label: "Powiązana", color: "#2f9d72", x: 1810 }] : []),
      ].map((item) => (
        <g key={item.label}>
          <circle cx={item.x} cy={94} r={28} fill={item.color} />
          <text x={item.x + 50} y={116} fill="#2a2219" fontSize={88} fontWeight={700}>
            {item.label}
          </text>
        </g>
      ))}
    </g>
  );
}

function RoomLayer({
  project,
  projectView,
  hoveredPoint,
  hoveredWall,
}: {
  project: Project;
  projectView: ProjectView;
  hoveredPoint: HoveredPoint;
  hoveredWall: HoveredWall;
}) {
  return (
    <>
      {projectView.rooms.map((room) => (
        <g key={room.id}>
          {room.points.length >= 2 ? (
            room.intersections && room.intersections.length > 0 ? (
              room.points.map((point, index) => {
                const next = room.points[(index + 1) % room.points.length];
                if (!next) {
                  return null;
                }
                const isClosingEdge = index === room.points.length - 1;
                if (!room.closed && isClosingEdge) {
                  return null;
                }
                const intersects = room.intersections?.some((entry) => entry.aIndex === index || entry.bIndex === index);
                if (intersects) {
                  return null;
                }
                return (
                  <line
                    key={`${room.id}-edge-${index}`}
                    x1={point.x}
                    y1={point.y}
                    x2={next.x}
                    y2={next.y}
                    stroke={room.color}
                    strokeWidth={24}
                    strokeLinejoin="round"
                    strokeDasharray={room.closed ? undefined : "40 18"}
                  />
                );
              })
            ) : (
              <path
                d={polygonToPath(room.points)}
                fill={room.closed ? `${room.color}22` : "none"}
                stroke={room.color}
                strokeWidth={24}
                strokeLinejoin="round"
                strokeDasharray={room.closed ? undefined : "40 18"}
              />
            )
          ) : null}
          {getRoomEdges(room).map((edge) => {
            const isHoveredEdge = hoveredWall ? isSameHoveredEdge(room.id, edge.start, edge.end, hoveredWall) : false;
            return (
              <line
                key={`${room.id}-hover-edge-${edge.index}`}
                x1={edge.start.x}
                y1={edge.start.y}
                x2={edge.end.x}
                y2={edge.end.y}
                stroke={isHoveredEdge ? "rgba(36, 105, 165, 0.9)" : "rgba(0, 0, 0, 0)"}
                strokeWidth={isHoveredEdge ? 34 : 28}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}
          {room.closed && room.workingPolygon.length >= 3 ? (
            <path
              d={polygonToPath(room.workingPolygon)}
              fill="rgba(99,122,83,0.08)"
              stroke="rgba(61,88,46,0.55)"
              strokeWidth={10}
              strokeDasharray="20 12"
            />
          ) : null}
          {room.intersections?.map((intersection, index) => (
            <g key={`${room.id}-intersection-${index}`}>
              <circle cx={intersection.point.x} cy={intersection.point.y} r={22} fill="rgba(213,72,62,0.9)" />
              <circle cx={intersection.point.x} cy={intersection.point.y} r={38} fill="none" stroke="rgba(213,72,62,0.4)" strokeWidth={8} />
            </g>
          ))}
          {getRoomEdges(room).map((edge) => {
            const label = getWallMeasurementLabel(edge.start, edge.end, project.unit);
            return (
              <MeasurementLabel key={`${room.id}-wall-label-${edge.index}`} label={label} />
            );
          })}
          {room.points.map((point, index) => (
            <g key={`${room.id}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoveredPoint && isSameHoveredPoint(room.id, point, hoveredPoint) ? 38 : 28}
                fill={hoveredPoint && isSameHoveredPoint(room.id, point, hoveredPoint) ? "#2469a5" : room.id === project.view.activeRoomId ? "#af5d32" : "#7a6d60"}
                stroke={hoveredPoint && isSameHoveredPoint(room.id, point, hoveredPoint) ? "rgba(255,252,247,0.95)" : "none"}
                strokeWidth={hoveredPoint && isSameHoveredPoint(room.id, point, hoveredPoint) ? 8 : 0}
                data-point-room-id={room.id}
                data-point-index={index}
              />
              <text x={point.x + 42} y={point.y - 24} fill="#2a2219" fontSize={90} pointerEvents="none">
                {index + 1}
              </text>
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

function PreviewCursor({
  editMode,
  addPointMode,
  splitMode,
  activeRoom,
  cursor,
  unit,
}: {
  editMode: boolean;
  addPointMode: boolean;
  splitMode: boolean;
  activeRoom: Room | null;
  cursor: Point | null;
  unit: Project["unit"];
}) {
  if (!editMode || splitMode || !addPointMode || !activeRoom || activeRoom.points.length === 0 || !cursor) {
    return null;
  }

  const start = activeRoom.points[activeRoom.points.length - 1]!;
  const label = getWallMeasurementLabel(start, cursor, unit);

  return (
    <g pointerEvents="none">
      <line
        x1={start.x}
        y1={start.y}
        x2={cursor.x}
        y2={cursor.y}
        stroke="rgba(36, 105, 165, 0.85)"
        strokeWidth={10}
        strokeDasharray="24 12"
        strokeLinecap="round"
      />
      <MeasurementLabel label={label} fill="#2469a5" />
      <circle cx={cursor.x} cy={cursor.y} r={22} fill="rgba(36, 105, 165, 0.22)" stroke="rgba(36, 105, 165, 0.85)" strokeWidth={6} />
    </g>
  );
}

function SplitPreview({
  splitMode,
  splitLineStart,
  cursor,
}: {
  splitMode: boolean;
  splitLineStart: Point | null;
  cursor: Point | null;
}) {
  if (!splitMode || !splitLineStart || !cursor) {
    return null;
  }

  return (
    <g pointerEvents="none">
      <line
        x1={splitLineStart.x}
        y1={splitLineStart.y}
        x2={cursor.x}
        y2={cursor.y}
        stroke="rgba(213, 72, 62, 0.92)"
        strokeWidth={14}
        strokeDasharray="32 16"
        strokeLinecap="round"
      />
      <circle cx={splitLineStart.x} cy={splitLineStart.y} r={24} fill="rgba(213, 72, 62, 0.2)" stroke="rgba(213, 72, 62, 0.92)" strokeWidth={6} />
      <circle cx={cursor.x} cy={cursor.y} r={20} fill="rgba(213, 72, 62, 0.18)" stroke="rgba(213, 72, 62, 0.92)" strokeWidth={6} />
    </g>
  );
}

function MeasurementLabel({
  label,
  fill = "#2a2219",
}: {
  label: ReturnType<typeof getWallMeasurementLabel>;
  fill?: string;
}) {
  return (
    <g
      transform={`translate(${label.position.x} ${label.position.y}) rotate(${label.rotation})`}
      pointerEvents="none"
    >
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={54}
        fontWeight={700}
        fill="rgba(255,252,247,0.98)"
        stroke="rgba(255,252,247,0.98)"
        strokeWidth={18}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {label.text}
      </text>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={54}
        fontWeight={700}
        fill={fill}
      >
        {label.text}
      </text>
    </g>
  );
}

function BoardsLayer({
  project,
  projectView,
  editMode,
  selectedBoardId,
  reuseHighlightedBoardIds,
}: {
  project: Project;
  projectView: ProjectView;
  editMode: boolean;
  selectedBoardId: string | null;
  reuseHighlightedBoardIds: string[];
}) {
  const reuseHighlights = new Set(reuseHighlightedBoardIds);

  return (
    <>
      {projectView.boards.map((board) => {
        const roomIds = Array.from(new Set(board.fragments.map((fragment) => fragment.roomId)));
        const boardPath = polygonToPath(board.basePolygon);
        const isSelected = board.id === selectedBoardId;
        const isReuseHighlighted = reuseHighlights.has(board.id);
        const fill = isReuseHighlighted
          ? "rgba(47, 157, 114, 0.84)"
          : board.full
            ? (board.type === "left" ? "rgba(213, 155, 96, 0.82)" : "rgba(240, 199, 133, 0.86)")
            : "rgba(213, 72, 62, 0.72)";
        const stroke = isReuseHighlighted ? "rgba(22, 94, 67, 0.82)" : "rgba(42, 34, 25, 0.55)";

        return roomIds.map((roomId) => (
          <path
            key={`${board.id}-${roomId}`}
            d={boardPath}
            clipPath={`url(#clip-${roomId})`}
            data-board-id={board.id}
            pointerEvents={editMode ? "none" : "auto"}
            fill={fill}
            stroke={stroke}
            strokeWidth={10}
            strokeLinejoin="round"
            opacity={isSelected || isReuseHighlighted ? 1 : 0.98}
            filter={isSelected ? "url(#selected-board-glow)" : isReuseHighlighted ? "url(#reused-board-glow)" : undefined}
          />
        ));
      })}
    </>
  );
}

function DoorsLayer({ project }: { project: Project }) {
  return (
    <>
      {project.doors.map((door) => (
        <line key={door.id} x1={door.start.x} y1={door.start.y} x2={door.end.x} y2={door.end.y} stroke="#2469a5" strokeWidth={26} strokeLinecap="round" />
      ))}
    </>
  );
}
