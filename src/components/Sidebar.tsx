import { createDoor, createRoom } from "../model";
import type { GeneratedBoard, Project, Room } from "../types";

import type { BoardReusePlan } from "../app/boardReuse";
import { formatLength } from "../app/units";
import { BoardDetails } from "./BoardDetails";
import { DoorCard } from "./DoorCard";
import { NumericField } from "./NumericField";
import { RoomCard } from "./RoomCard";

type SidebarProps = {
  project: Project;
  boards: GeneratedBoard[];
  reusePlan: BoardReusePlan;
  selectedBoard: GeneratedBoard | null;
  editMode: boolean;
  addPointMode: boolean;
  splitMode: boolean;
  gridSize: number;
  onPatchProject: (updater: (draft: Project) => Project, options?: { recordHistory?: boolean; clearFuture?: boolean }) => void;
  onSetGridSize: (value: number) => void;
  onSetAddPointMode: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetSplitMode: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetEditMode: (value: boolean) => void;
  onResetInteractionState: () => void;
  onResetViewport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

export function Sidebar({
  project,
  boards,
  reusePlan,
  selectedBoard,
  editMode,
  addPointMode,
  splitMode,
  gridSize,
  onPatchProject,
  onSetGridSize,
  onSetAddPointMode,
  onSetSplitMode,
  onSetEditMode,
  onResetInteractionState,
  onResetViewport,
  onExport,
  onUndo,
  onRedo,
  onImport,
}: SidebarProps) {
  const boardsPerPack = normalizeBoardsPerPack(project.board.boardsPerPack);
  const boardsPerSidePerPack = boardsPerPack / 2;
  const leftBoards = boards.filter((board) => board.type === "left").length;
  const rightBoards = boards.filter((board) => board.type === "right").length;
  const freshLeftBoards = reusePlan.freshBoardsByType.left;
  const freshRightBoards = reusePlan.freshBoardsByType.right;
  const boardAreaSquareMeters = (project.board.length * project.board.width) / 1_000_000;
  const usedAreaSquareMeters = boards.reduce((sum, board) => sum + board.totalArea, 0) / 1_000_000;
  const packagesToOrderWithoutReuse =
    boardsPerSidePerPack > 0 ? Math.max(Math.ceil(leftBoards / boardsPerSidePerPack), Math.ceil(rightBoards / boardsPerSidePerPack)) : 0;
  const packagesToOrder =
    boardsPerSidePerPack > 0 ? Math.max(Math.ceil(freshLeftBoards / boardsPerSidePerPack), Math.ceil(freshRightBoards / boardsPerSidePerPack)) : 0;
  const orderAreaWithoutReuseSquareMeters = packagesToOrderWithoutReuse * boardsPerPack * boardAreaSquareMeters;
  const orderAreaSquareMeters = packagesToOrder * boardsPerPack * boardAreaSquareMeters;

  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="eyebrow">Floorify React</p>
        <h1>Planer podłogi w jodełkę</h1>
        <p className="lede">
          Wersja przepisana na Reacta: stabilny stan formularzy, osobny silnik geometrii i pewniejsze mapowanie kliknięć na planie.
        </p>
      </div>

      <section className="panel">
        <div className="section-head">
          <h2>Projekt</h2>
          <div className="button-row compact">
            <button className={editMode ? "" : "secondary"} type="button" onClick={() => onSetEditMode(true)}>
              Edycja
            </button>
            <button
              className={!editMode ? "" : "secondary"}
              type="button"
              onClick={() => {
                onSetEditMode(false);
                onResetInteractionState();
              }}
            >
              Podgląd
            </button>
            <button className="secondary" type="button" onClick={onResetViewport}>Reset widoku</button>
            <button
              className={addPointMode ? "" : "secondary"}
              type="button"
              disabled={!editMode}
              onClick={() => onSetAddPointMode((current) => !current)}
            >
              {addPointMode ? "Dodawanie punktów: wł." : "Dodawanie punktów: wył."}
            </button>
            <button
              className={splitMode ? "" : "secondary"}
              type="button"
              disabled={!editMode}
              onClick={() => onSetSplitMode((current) => !current)}
            >
              {splitMode ? "Podział pokoju: wł." : "Podział pokoju: wył."}
            </button>
          </div>
        </div>
        <label>
          Nazwa projektu
          <input value={project.name} disabled={!editMode} onChange={(event) => onPatchProject((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="grid two">
          <label>
            Tryb montażu
            <select
              value={project.layoutMode}
              disabled={!editMode}
              onChange={(event) =>
                onPatchProject((current) => ({ ...current, layoutMode: event.target.value as Project["layoutMode"] }))
              }
            >
              <option value="continuous">Ciągła powierzchnia</option>
              <option value="separated">Osobne pokoje</option>
            </select>
          </label>
          <label>
            Jednostka
            <select value={project.unit} disabled={!editMode} onChange={(event) => onPatchProject((current) => ({ ...current, unit: event.target.value as Project["unit"] }))}>
              <option value="mm">mm</option>
              <option value="cm">cm</option>
            </select>
          </label>
          <label>
            Gęstość siatki
            <select value={String(gridSize)} onChange={(event) => onSetGridSize(Number(event.target.value))}>
              <option value="100">{formatLength(100, project.unit)}</option>
              <option value="200">{formatLength(200, project.unit)}</option>
              <option value="500">{formatLength(500, project.unit)}</option>
              <option value="1000">{formatLength(1000, project.unit)}</option>
            </select>
          </label>
          <label>
            Dylatacja między pokojami
            <select
              value={project.applyGapToInternalBoundaries ? "on" : "off"}
              disabled={!editMode}
              onChange={(event) =>
                onPatchProject((current) => ({
                  ...current,
                  applyGapToInternalBoundaries: event.target.value === "on",
                }))
              }
            >
              <option value="off">Nie, tylko podział logiczny</option>
              <option value="on">Tak, traktuj jak ściany</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button type="button" onClick={onExport}>Eksportuj JSON</button>
          <button className="secondary" type="button" onClick={onUndo}>Cofnij</button>
          <button className="secondary" type="button" onClick={onRedo}>Ponów</button>
          <label className="button secondary">
            Importuj JSON
            <input type="file" accept="application/json" hidden onChange={onImport} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Parametry podłogi</h2>
        <div className="grid two">
          <NumericField label="Długość klepki" value={project.board.length} unit={project.unit} disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, board: { ...current.board, length: value } }))} />
          <NumericField label="Szerokość klepki" value={project.board.width} unit={project.unit} disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, board: { ...current.board, width: value } }))} />
          <label>
            Liczba klepek w paczce
            <input
              type="number"
              min="2"
              step="2"
              value={project.board.boardsPerPack}
              disabled={!editMode}
              onChange={(event) =>
                onPatchProject((current) => ({
                  ...current,
                  board: {
                    ...current.board,
                    boardsPerPack: normalizeBoardsPerPack(event.target.value),
                  },
                }))
              }
            />
          </label>
          <NumericField label="Dylatacja przy ścianach" value={project.gap} unit={project.unit} disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, gap: value }))} />
          <NumericField label="Kąt wzoru" value={project.pattern.angle} unit="mm" disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, pattern: { ...current.pattern, angle: value } }))} />
          <NumericField label="Przesunięcie X" value={project.pattern.shiftX} unit={project.unit} disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, pattern: { ...current.pattern, shiftX: value } }))} />
          <NumericField label="Przesunięcie Y" value={project.pattern.shiftY} unit={project.unit} disabled={!editMode} onChange={(value) => onPatchProject((current) => ({ ...current, pattern: { ...current.pattern, shiftY: value } }))} />
        </div>
      </section>

      <section className="panel">
        <h2>Zapotrzebowanie</h2>
        <div className="summary-grid">
          <div className="summary-card">
            <span>Powierzchnia na planie</span>
            <strong>{formatSquareMeters(usedAreaSquareMeters)} m²</strong>
          </div>
          <div className="summary-card">
            <span>Paczki do zamówienia</span>
            <strong>{packagesToOrder}</strong>
          </div>
          <div className="summary-card">
            <span>Oszczędność z docinek</span>
            <strong>{reusePlan.savedBoards}</strong>
          </div>
          <div className="summary-card">
            <span>Powierzchnia do zamówienia</span>
            <strong>{formatSquareMeters(orderAreaSquareMeters)} m²</strong>
          </div>
          <div className="summary-card">
            <span>Pow. bez reużycia docinek</span>
            <strong>{formatSquareMeters(orderAreaWithoutReuseSquareMeters)} m²</strong>
          </div>
          <div className="summary-card">
            <span>Świeże klepki L / P</span>
            <strong>{freshLeftBoards} / {freshRightBoards}</strong>
          </div>
          <div className="summary-card">
            <span>Wszystkie klepki L / P</span>
            <strong>{leftBoards} / {rightBoards}</strong>
          </div>
        </div>
        <p className="hint">
          Liczenie paczek zakłada równy podział na lewe i prawe klepki w każdej paczce oraz odejmuje klepki, które da się wykonać z wcześniej odciętych końcówek.
        </p>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Pokoje</h2>
          <button
            type="button"
            disabled={!editMode}
            onClick={() =>
              onPatchProject((current) => {
                const room = createRoom(current.rooms.length + 1);
                return {
                  ...current,
                  rooms: [...current.rooms, room],
                  view: { ...current.view, activeRoomId: room.id },
                };
              })
            }
          >
            Dodaj pokój
          </button>
        </div>
        <div className="stack">
          {project.rooms.map((room, roomIndex) => (
            <RoomCard
              key={room.id}
              room={room}
              unit={project.unit}
              active={room.id === project.view.activeRoomId}
              editMode={editMode}
              allowPatternShift={project.applyGapToInternalBoundaries}
              onSelect={() => onPatchProject((current) => ({ ...current, view: { ...current.view, activeRoomId: room.id } }))}
              onDelete={() =>
                onPatchProject((current) => {
                  const rooms = current.rooms.filter((entry) => entry.id !== room.id);
                  return {
                    ...withoutLogicalBoundariesForRoom(current, room.id),
                    rooms,
                    view: { ...current.view, activeRoomId: current.view.activeRoomId === room.id ? rooms[0]?.id ?? null : current.view.activeRoomId },
                  };
                })
              }
              onChange={(nextRoom) =>
                onPatchProject((current) => {
                  const currentRoom = current.rooms.find((entry) => entry.id === nextRoom.id);
                  const baseProject =
                    currentRoom && haveRoomPointsChanged(currentRoom, nextRoom)
                      ? withoutLogicalBoundariesForRoom(current, nextRoom.id)
                      : current;

                  return {
                    ...baseProject,
                    rooms: baseProject.rooms.map((entry) => (entry.id === nextRoom.id ? nextRoom : entry)),
                  };
                })
              }
              onAddPoint={() =>
                onPatchProject((current) => ({
                  ...withoutLogicalBoundariesForRoom(current, room.id),
                  rooms: current.rooms.map((entry) => {
                    if (entry.id !== room.id) {
                      return entry;
                    }
                    const last = entry.points.at(-1) ?? { x: roomIndex * 300, y: roomIndex * 300 };
                    return { ...entry, points: [...entry.points, { x: last.x + 500, y: last.y }] };
                  }),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Otwory drzwiowe</h2>
          <button type="button" disabled={!editMode} onClick={() => onPatchProject((current) => ({ ...current, doors: [...current.doors, createDoor(current)] }))}>
            Dodaj otwór
          </button>
        </div>
        <div className="stack">
          {project.doors.map((door) => (
            <DoorCard
              key={door.id}
              door={door}
              unit={project.unit}
              rooms={project.rooms}
              editMode={editMode}
              onChange={(nextDoor) =>
                onPatchProject((current) => ({
                  ...current,
                  doors: current.doors.map((entry) => (entry.id === nextDoor.id ? nextDoor : entry)),
                }))
              }
              onDelete={() =>
                onPatchProject((current) => ({
                  ...current,
                  doors: current.doors.filter((entry) => entry.id !== door.id),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Wybrana klepka</h2>
        <BoardDetails
          board={selectedBoard}
          reusePlan={reusePlan}
          unit={project.unit}
          leftLabel={project.board.leftLabel}
          rightLabel={project.board.rightLabel}
        />
      </section>
    </aside>
  );
}

function formatSquareMeters(value: number): string {
  return value.toFixed(2);
}

function normalizeBoardsPerPack(value: unknown): number {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  if (numeric === 0) {
    return 0;
  }

  return numeric % 2 === 0 ? numeric : numeric + 1;
}

function withoutLogicalBoundariesForRoom(project: Project, roomId: string): Project {
  return {
    ...project,
    logicalBoundaries: project.logicalBoundaries.filter(
      (boundary) => boundary.roomAId !== roomId && boundary.roomBId !== roomId,
    ),
  };
}

function haveRoomPointsChanged(currentRoom: Room, nextRoom: Room): boolean {
  if (currentRoom.points.length !== nextRoom.points.length) {
    return true;
  }

  return currentRoom.points.some((point, index) => {
    const nextPoint = nextRoom.points[index];
    return !nextPoint || point.x !== nextPoint.x || point.y !== nextPoint.y;
  });
}
