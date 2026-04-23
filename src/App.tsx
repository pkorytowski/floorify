import { useEffect, useMemo, useRef, useState } from "react";

import { buildProjectView } from "./engine";
import { findPolygonSelfIntersections, polygonArea, splitPolygonWithSegment } from "./geometry";
import { normalizeProject } from "./model";
import type { BoundingBox, LogicalBoundary, Point, Project, Room } from "./types";

import {
  MAX_HISTORY,
  MAX_VIEWBOX_SIZE,
  MIN_VIEWBOX_SIZE,
  POINT_DRAG_PICK_DISTANCE,
  WALL_DRAG_PICK_DISTANCE,
} from "./app/constants";
import {
  clamp,
  findNearestPointDrag,
  findNearestWallDrag,
  getDragDelta,
  getEditablePoint,
  getRoomEdges,
  isEditableTarget,
  moveWall,
  projectsEqual,
  slugify,
  toWorldPoint,
  translatePoint,
} from "./app/interaction";
import { createProjectViewport } from "./app/layout";
import { loadInitialState, saveAppState } from "./app/persistence";
import { createBoardReusePlan } from "./app/boardReuse";
import { BoardInspectorModal } from "./components/BoardInspectorModal";
import { PlanCanvas } from "./components/PlanCanvas";
import { Sidebar } from "./components/Sidebar";

type DraggedPoint = { roomId: string; pointIndex: number; startPoint: Point } | null;
type DraggedWall = { roomId: string; edgeIndex: number; startPoint: Point } | null;
type HoveredPoint = { roomId: string; point: Point } | null;
type HoveredWall = { roomId: string; start: Point; end: Point } | null;
type PanState = { startClientX: number; startClientY: number; startViewport: BoundingBox } | null;

export function App() {
  const initialState = useMemo(loadInitialState, []);
  const [project, setProject] = useState<Project>(initialState.project);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [inspectedBoardId, setInspectedBoardId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<BoundingBox>(initialState.viewport);
  const [gridSize, setGridSize] = useState<number>(initialState.gridSize);
  const [addPointMode, setAddPointMode] = useState<boolean>(initialState.addPointMode);
  const [splitMode, setSplitMode] = useState<boolean>(initialState.splitMode);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<DraggedPoint>(null);
  const [draggedWall, setDraggedWall] = useState<DraggedWall>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint>(null);
  const [hoveredWall, setHoveredWall] = useState<HoveredWall>(null);
  const [editMode, setEditMode] = useState<boolean>(initialState.editMode);
  const [panState, setPanState] = useState<PanState>(null);
  const [splitLineStart, setSplitLineStart] = useState<Point | null>(null);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const historyRef = useRef<{ past: Project[]; future: Project[] }>({ past: [], future: [] });
  const dragStartProjectRef = useRef<Project | null>(null);
  const suppressCanvasClickRef = useRef(false);

  const projectView = useMemo(() => buildProjectView(project), [project]);
  const reusePlan = useMemo(() => createBoardReusePlan(projectView.boards, projectView.rooms), [projectView.boards, projectView.rooms]);
  const reuseHighlightedBoardIds = useMemo(
    () => (selectedBoardId ? reusePlan.relatedBoardIdsByBoardId[selectedBoardId] ?? [] : []),
    [reusePlan.relatedBoardIdsByBoardId, selectedBoardId],
  );

  const selectedBoard = projectView.boards.find((board) => board.id === selectedBoardId) ?? null;
  const inspectedBoard = projectView.boards.find((board) => board.id === inspectedBoardId) ?? null;
  const activeRoom = project.rooms.find((room) => room.id === project.view.activeRoomId) ?? null;
  const activeRoomIntersections = activeRoom ? findPolygonSelfIntersections(activeRoom.points) : [];
  const currentViewBox = viewport;

  useEffect(() => {
    saveAppState(project, viewport, editMode, gridSize, addPointMode, splitMode);
  }, [project, viewport, editMode, gridSize, addPointMode, splitMode]);

  useEffect(() => {
    setSplitLineStart(null);
    setSplitFeedback(null);
  }, [project.view.activeRoomId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target)) {
        return;
      }

      if (event.key === "Escape") {
        setSplitLineStart(null);
        setSplitFeedback(null);
        resetInteractionState();
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((key === "z" && event.shiftKey) || (event.ctrlKey && key === "y")) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project]);

  function patchProject(updater: (draft: Project) => Project, options?: { recordHistory?: boolean; clearFuture?: boolean }) {
    setProject((current) => {
      const next = updater(current);
      if (!projectsEqual(current, next) && options?.recordHistory !== false) {
        historyRef.current.past.push(structuredClone(current));
        if (historyRef.current.past.length > MAX_HISTORY) {
          historyRef.current.past.shift();
        }
        if (options?.clearFuture !== false) {
          historyRef.current.future = [];
        }
      }
      return next;
    });
  }

  function resetInteractionState() {
    setDraggedPoint(null);
    setDraggedWall(null);
    setHoveredPoint(null);
    setHoveredWall(null);
    dragStartProjectRef.current = null;
    suppressCanvasClickRef.current = false;
    setSplitLineStart(null);
  }

  function refitViewport() {
    setViewport(createProjectViewport(projectView.bounds));
  }

  function zoomAtPoint(worldPoint: Point, factor: number) {
    setViewport((current) => {
      const nextWidth = clamp(current.width * factor, MIN_VIEWBOX_SIZE, MAX_VIEWBOX_SIZE);
      const nextHeight = clamp(current.height * factor, MIN_VIEWBOX_SIZE, MAX_VIEWBOX_SIZE);

      const relativeX = current.width === 0 ? 0.5 : (worldPoint.x - current.minX) / current.width;
      const relativeY = current.height === 0 ? 0.5 : (worldPoint.y - current.minY) / current.height;

      const minX = worldPoint.x - relativeX * nextWidth;
      const minY = worldPoint.y - relativeY * nextHeight;

      return {
        minX,
        minY,
        maxX: minX + nextWidth,
        maxY: minY + nextHeight,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function undo() {
    const previous = historyRef.current.past.pop();
    if (!previous) {
      return;
    }
    historyRef.current.future.push(structuredClone(project));
    setProject(previous);
    setSelectedBoardId(null);
    resetInteractionState();
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) {
      return;
    }
    historyRef.current.past.push(structuredClone(project));
    setProject(next);
    setSelectedBoardId(null);
    resetInteractionState();
  }

  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }

    if (panState || draggedPoint || draggedWall) {
      return;
    }

    const pointHandle = (event.target as HTMLElement).closest("[data-point-room-id]");
    if (pointHandle && !splitMode) {
      return;
    }

    const boardId = (event.target as HTMLElement).closest("[data-board-id]")?.getAttribute("data-board-id");
    if (boardId) {
      setSelectedBoardId(boardId);
      return;
    }

    if (!editMode || !activeRoom) {
      return;
    }

    const rawPoint = toWorldPoint(event, currentViewBox);
    const point = getCanvasPoint(rawPoint, event, splitLineStart ? createSplitGuideRoom(activeRoom, splitLineStart) : activeRoom);

    if (splitMode) {
      if (!activeRoom.closed || activeRoom.points.length < 3) {
        setSplitFeedback("Podział działa tylko dla zamkniętego pomieszczenia z co najmniej trzema punktami.");
        return;
      }

      if (!splitLineStart) {
        setSplitLineStart(point);
        setSplitFeedback("Wskaż drugi punkt linii, która ma przeciąć obrys pokoju.");
        return;
      }

      const nextProject = splitRoom(project, activeRoom, splitLineStart, point);
      if (!nextProject) {
        setSplitFeedback("Linia podziału musi przeciąć obrys aktywnego pokoju dokładnie w dwóch miejscach.");
        setSplitLineStart(null);
        return;
      }

      patchProject(() => nextProject);
      setSplitFeedback(`Podzielono pokój "${activeRoom.name}" na dwa pomieszczenia.`);
      setSplitLineStart(null);
      return;
    }

    if (!addPointMode) {
      return;
    }

    patchProject((current) => ({
      ...withoutLogicalBoundariesForRooms(current, [activeRoom.id]),
      rooms: current.rooms.map((room) =>
        room.id === activeRoom.id ? { ...room, points: [...room.points, point] } : room,
      ),
    }));
  }

  function getCanvasPoint(rawPoint: Point, event: React.MouseEvent<SVGSVGElement>, guideRoom: Room | null) {
    return getEditablePoint(rawPoint, guideRoom, {
      constrainAngle: event.shiftKey,
      snapToGrid: event.ctrlKey || event.metaKey,
      gridSize,
    });
  }

  function handleCanvasDoubleClick() {
    if (!editMode || splitMode || !activeRoom || activeRoom.points.length < 3) {
      return;
    }

    if (findPolygonSelfIntersections(activeRoom.points).length > 0) {
      return;
    }

    patchProject((current) => ({
      ...current,
      rooms: current.rooms.map((room) => (room.id === activeRoom.id ? { ...room, closed: true } : room)),
    }));
  }

  function handleCanvasDoubleClickCapture(event: React.MouseEvent<SVGSVGElement>) {
    const boardId = (event.target as HTMLElement).closest("[data-board-id]")?.getAttribute("data-board-id");
    if (boardId) {
      event.preventDefault();
      setSelectedBoardId(boardId);
      setInspectedBoardId(boardId);
      return;
    }

    if (editMode) {
      return;
    }

    event.preventDefault();
    const worldPoint = toWorldPoint(event, currentViewBox);
    zoomAtPoint(worldPoint, event.shiftKey ? 1.25 : 0.8);
  }

  function handlePointerMove(event: React.MouseEvent<SVGSVGElement>) {
    const rawPoint = toWorldPoint(event, currentViewBox);
    const point = getCanvasPoint(rawPoint, event, splitLineStart ? createSplitGuideRoom(activeRoom, splitLineStart) : activeRoom);
    setCursor(point);

    if (panState) {
      setHoveredPoint(null);
      setHoveredWall(null);
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const scaleX = panState.startViewport.width / rect.width;
      const scaleY = panState.startViewport.height / rect.height;
      const dx = (event.clientX - panState.startClientX) * scaleX;
      const dy = (event.clientY - panState.startClientY) * scaleY;
      setViewport({
        ...panState.startViewport,
        minX: panState.startViewport.minX - dx,
        maxX: panState.startViewport.maxX - dx,
        minY: panState.startViewport.minY - dy,
        maxY: panState.startViewport.maxY - dy,
      });
      return;
    }

    if (!editMode) {
      setHoveredPoint(null);
      setHoveredWall(null);
      return;
    }

    if (splitMode) {
      setHoveredPoint(null);
      setHoveredWall(null);
      return;
    }

    if (draggedPoint) {
      setHoveredWall(null);
      suppressCanvasClickRef.current = true;
      const initialRoom = dragStartProjectRef.current?.rooms.find((entry) => entry.id === draggedPoint.roomId);
      const initialPoint = initialRoom?.points[draggedPoint.pointIndex];
      if (!initialPoint) {
        return;
      }
      setHoveredPoint({ roomId: draggedPoint.roomId, point: initialPoint });
      const delta = getDragDelta(draggedPoint.startPoint, rawPoint, {
        constrainAxis: event.shiftKey,
        snapToGrid: event.ctrlKey || event.metaKey,
        gridSize,
      });
      patchProject((current) => ({
        ...withoutLogicalBoundariesForRooms(current, [draggedPoint.roomId]),
        rooms: current.rooms.map((room) => {
          if (room.id !== draggedPoint.roomId) {
            return room;
          }
          return {
            ...room,
            points: room.points.map((entry, index) => (index === draggedPoint.pointIndex ? translatePoint(initialPoint, delta) : entry)),
          };
        }),
      }), { recordHistory: false, clearFuture: false });
      return;
    }

    if (draggedWall && dragStartProjectRef.current) {
      setHoveredPoint(null);
      suppressCanvasClickRef.current = true;
      const initialRoom = dragStartProjectRef.current.rooms.find((entry) => entry.id === draggedWall.roomId);
      const draggedEdge = initialRoom ? getRoomEdges(initialRoom).find((edge) => edge.index === draggedWall.edgeIndex) : null;
      setHoveredWall(draggedEdge ? { roomId: draggedWall.roomId, start: draggedEdge.start, end: draggedEdge.end } : null);
      const delta = getDragDelta(draggedWall.startPoint, rawPoint, {
        constrainAxis: event.shiftKey,
        snapToGrid: event.ctrlKey || event.metaKey,
        gridSize,
      });

      patchProject((current) => ({
        ...withoutLogicalBoundariesForRooms(current, [draggedWall.roomId]),
        rooms: current.rooms.map((room) => {
          if (room.id !== draggedWall.roomId) {
            return room;
          }
          const initialRoom = dragStartProjectRef.current?.rooms.find((entry) => entry.id === room.id) ?? room;
          return moveWall(initialRoom, draggedWall.edgeIndex, delta);
        }),
      }), { recordHistory: false, clearFuture: false });
      return;
    }

    const nearestPoint = findNearestPointDrag(project.rooms, rawPoint, POINT_DRAG_PICK_DISTANCE);
    if (nearestPoint) {
      const room = project.rooms.find((entry) => entry.id === nearestPoint.roomId);
      const pointEntry = room?.points[nearestPoint.pointIndex];
      setHoveredPoint(pointEntry ? { roomId: nearestPoint.roomId, point: pointEntry } : null);
      setHoveredWall(null);
      return;
    }

    const nearestWall = findNearestWallDrag(project.rooms, rawPoint, WALL_DRAG_PICK_DISTANCE);
    if (nearestWall) {
      const room = project.rooms.find((entry) => entry.id === nearestWall.roomId);
      const edge = room ? getRoomEdges(room).find((entry) => entry.index === nearestWall.edgeIndex) : null;
      setHoveredWall(edge ? { roomId: nearestWall.roomId, start: edge.start, end: edge.end } : null);
      setHoveredPoint(null);
      return;
    }

    setHoveredPoint(null);
    setHoveredWall(null);
  }

  function handlePointerUp() {
    if (panState) {
      setPanState(null);
    }

    if ((draggedPoint || draggedWall) && dragStartProjectRef.current && !projectsEqual(dragStartProjectRef.current, project)) {
      historyRef.current.past.push(structuredClone(dragStartProjectRef.current));
      if (historyRef.current.past.length > MAX_HISTORY) {
        historyRef.current.past.shift();
      }
      historyRef.current.future = [];
    }
    dragStartProjectRef.current = null;
    setDraggedPoint(null);
    setDraggedWall(null);
    setHoveredPoint(null);
    setHoveredWall(null);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(project.name || "floorify-project")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const nextProject = normalizeProject(JSON.parse(text));
    setProject(nextProject);
    setSelectedBoardId(null);
    setInspectedBoardId(null);
    setViewport(createProjectViewport(buildProjectView(nextProject).bounds));
    historyRef.current = { past: [], future: [] };
    dragStartProjectRef.current = null;
    event.target.value = "";
  }

  function handleCanvasMouseDown(event: React.MouseEvent<SVGSVGElement>) {
    const target = event.target as HTMLElement;
    const clickedBoard = target.closest("[data-board-id]");

    if (editMode) {
      if (splitMode) {
        return;
      }

      if (clickedBoard) {
        return;
      }

      const worldPoint = toWorldPoint(event, currentViewBox);
      const nearestPoint = findNearestPointDrag(project.rooms, worldPoint, POINT_DRAG_PICK_DISTANCE);
      if (nearestPoint) {
        dragStartProjectRef.current = structuredClone(project);
        setDraggedWall(null);
        setDraggedPoint({ roomId: nearestPoint.roomId, pointIndex: nearestPoint.pointIndex, startPoint: worldPoint });
        if (project.view.activeRoomId !== nearestPoint.roomId) {
          patchProject((current) => ({
            ...current,
            view: { ...current.view, activeRoomId: nearestPoint.roomId },
          }), { recordHistory: false, clearFuture: false });
        }
        return;
      }

      const nearestWall = findNearestWallDrag(project.rooms, worldPoint, WALL_DRAG_PICK_DISTANCE);
      if (!nearestWall) {
        return;
      }

      dragStartProjectRef.current = structuredClone(project);
      setDraggedPoint(null);
      setDraggedWall({
        roomId: nearestWall.roomId,
        edgeIndex: nearestWall.edgeIndex,
        startPoint: worldPoint,
      });
      if (project.view.activeRoomId !== nearestWall.roomId) {
        patchProject((current) => ({
          ...current,
          view: { ...current.view, activeRoomId: nearestWall.roomId },
        }), { recordHistory: false, clearFuture: false });
      }
      return;
    }

    const clickedPoint = target.closest("[data-point-room-id]");
    if (clickedBoard || clickedPoint) {
      return;
    }

    setPanState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewport: { ...currentViewBox },
    });
  }

  function handleCanvasWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
    const worldPoint = toWorldPoint(event, currentViewBox);
    zoomAtPoint(worldPoint, zoomFactor);
  }

  function handleSetAddPointMode(value: boolean | ((current: boolean) => boolean)) {
    setAddPointMode((current) => {
      const next = typeof value === "function" ? value(current) : value;
      if (next) {
        setSplitMode(false);
      }
      return next;
    });
    setSplitLineStart(null);
    setSplitFeedback(null);
  }

  function handleSetSplitMode(value: boolean | ((current: boolean) => boolean)) {
    setSplitMode((current) => {
      const next = typeof value === "function" ? value(current) : value;
      if (next) {
        setAddPointMode(false);
      }
      return next;
    });
    setSplitLineStart(null);
    setSplitFeedback(null);
  }

  function handleSetEditMode(nextEditMode: boolean) {
    setEditMode(nextEditMode);
    if (!nextEditMode) {
      resetInteractionState();
      setSplitFeedback(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        project={project}
        boards={projectView.boards}
        reusePlan={reusePlan}
        selectedBoard={selectedBoard}
        editMode={editMode}
        addPointMode={addPointMode}
        splitMode={splitMode}
        gridSize={gridSize}
        onPatchProject={patchProject}
        onSetGridSize={setGridSize}
        onSetAddPointMode={handleSetAddPointMode}
        onSetSplitMode={handleSetSplitMode}
        onSetEditMode={handleSetEditMode}
        onResetInteractionState={resetInteractionState}
        onResetViewport={refitViewport}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        onImport={handleImport}
      />

      <PlanCanvas
        svgRef={svgRef}
        project={project}
        projectView={projectView}
        currentViewBox={currentViewBox}
        gridSize={gridSize}
        editMode={editMode}
        addPointMode={addPointMode}
        splitMode={splitMode}
        cursor={cursor}
        activeRoom={activeRoom}
        activeRoomIntersectionsCount={activeRoomIntersections.length}
        hoveredPoint={hoveredPoint}
        hoveredWall={hoveredWall}
        draggedPointActive={Boolean(draggedPoint)}
        draggedWallActive={Boolean(draggedWall)}
        panActive={Boolean(panState)}
        selectedBoardId={selectedBoardId}
        reuseHighlightedBoardIds={reuseHighlightedBoardIds}
        splitLineStart={splitLineStart}
        splitFeedback={splitFeedback}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClickCapture={handleCanvasDoubleClickCapture}
        onWheel={handleCanvasWheel}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => {
          setCursor(null);
          setHoveredPoint(null);
          setHoveredWall(null);
          handlePointerUp();
        }}
      />

      <BoardInspectorModal
        board={inspectedBoard}
        rooms={projectView.rooms}
        unit={project.unit}
        leftLabel={project.board.leftLabel}
        rightLabel={project.board.rightLabel}
        onClose={() => setInspectedBoardId(null)}
      />
    </div>
  );
}

function createSplitGuideRoom(activeRoom: Room | null, anchor: Point): Room | null {
  if (!activeRoom) {
    return null;
  }

  return {
    ...activeRoom,
    points: [anchor],
  };
}

function splitRoom(project: Project, room: Room, start: Point, end: Point): Project | null {
  const splitPolygons = splitPolygonWithSegment(room.points, start, end);
  if (!splitPolygons || splitPolygons.length !== 2) {
    return null;
  }

  const [primaryPolygon, secondaryPolygon] = splitPolygons
    .map((polygon) => ({ polygon, area: polygonArea(polygon) }))
    .sort((a, b) => b.area - a.area);

  const nextRoom: Room = {
    ...room,
    id: `room-${crypto.randomUUID()}`,
    name: createSplitRoomName(project.rooms, room.name),
    color: shiftHexColor(room.color, 16),
    points: secondaryPolygon!.polygon,
    closed: true,
  };
  const sharedBoundary = findSharedBoundary(primaryPolygon!.polygon, secondaryPolygon!.polygon);
  if (!sharedBoundary) {
    return null;
  }
  const baseProject = withoutLogicalBoundariesForRooms(project, [room.id]);

  return {
    ...baseProject,
    rooms: baseProject.rooms.flatMap((entry) => {
      if (entry.id !== room.id) {
        return entry;
      }

      return [
        {
          ...entry,
          points: primaryPolygon!.polygon,
          closed: true,
        },
        nextRoom,
      ];
    }),
    logicalBoundaries: [
      ...baseProject.logicalBoundaries,
      {
        id: `logical-boundary-${crypto.randomUUID()}`,
        roomAId: room.id,
        roomBId: nextRoom.id,
        start: sharedBoundary.start,
        end: sharedBoundary.end,
      },
    ],
    view: { ...baseProject.view, activeRoomId: room.id },
  };
}

function createSplitRoomName(rooms: Room[], baseName: string): string {
  const existingNames = new Set(rooms.map((room) => room.name));
  if (!existingNames.has(`${baseName} 2`)) {
    return `${baseName} 2`;
  }

  let index = 3;
  while (existingNames.has(`${baseName} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function shiftHexColor(color: string, delta: number): string {
  const normalized = color.replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return color;
  }

  const channels = normalized.match(/.{2}/g);
  if (!channels) {
    return color;
  }

  return `#${channels
    .map((channel) => {
      const nextValue = clamp(Number.parseInt(channel, 16) + delta, 0, 255);
      return Math.round(nextValue).toString(16).padStart(2, "0");
    })
    .join("")}`;
}

function withoutLogicalBoundariesForRooms(project: Project, roomIds: string[]): Project {
  const roomIdSet = new Set(roomIds);
  return {
    ...project,
    logicalBoundaries: project.logicalBoundaries.filter(
      (boundary) => !roomIdSet.has(boundary.roomAId) && !roomIdSet.has(boundary.roomBId),
    ),
  };
}

function findSharedBoundary(firstPolygon: Point[], secondPolygon: Point[]): { start: Point; end: Point } | null {
  for (let firstIndex = 0; firstIndex < firstPolygon.length; firstIndex += 1) {
    const firstStart = firstPolygon[firstIndex]!;
    const firstEnd = firstPolygon[(firstIndex + 1) % firstPolygon.length]!;

    for (let secondIndex = 0; secondIndex < secondPolygon.length; secondIndex += 1) {
      const secondStart = secondPolygon[secondIndex]!;
      const secondEnd = secondPolygon[(secondIndex + 1) % secondPolygon.length]!;
      if (areMatchingSegments(firstStart, firstEnd, secondStart, secondEnd)) {
        return {
          start: { ...firstStart },
          end: { ...firstEnd },
        };
      }
    }
  }

  return null;
}

function areMatchingSegments(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): boolean {
  return (
    (arePointsNear(aStart, bStart) && arePointsNear(aEnd, bEnd)) ||
    (arePointsNear(aStart, bEnd) && arePointsNear(aEnd, bStart))
  );
}

function arePointsNear(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 0.1 && Math.abs(a.y - b.y) <= 0.1;
}
