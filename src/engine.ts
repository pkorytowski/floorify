import type { BoardFragment, ComputedRoom, GeneratedBoard, LogicalBoundary, Point, PolygonEdge, Project, ProjectView } from "./types";
import {
  add,
  clipPolygonWithConvexClip,
  degToRad,
  dot,
  ensureCounterClockwise,
  findPolygonSelfIntersections,
  getBoundingBox,
  getPolygonEdges,
  inwardOffsetPolygon,
  measurePolygonAgainstEdges,
  normalize,
  polygonArea,
  rotate,
  round,
  scale,
  subtract,
  triangulatePolygon,
} from "./geometry";

const EPS = 1e-3;

export function buildProjectView(project: Project): ProjectView {
  const rooms: ComputedRoom[] = project.rooms.map((room) => {
    const points = ensureCounterClockwise(room.points);
    const intersections = room.closed ? findPolygonSelfIntersections(points) : [];
    const logicalEdgeMask = getLogicalEdgeMask(points, room.id, project.logicalBoundaries);
    const workingPolygon = room.closed
      ? inwardOffsetPolygon(
          points,
          project.gap,
          logicalEdgeMask.map((isLogicalEdge) => (isLogicalEdge && !project.applyGapToInternalBoundaries ? 0 : project.gap)),
        )
      : points;
    const edges = getPolygonEdges(points, room.id);
    const physicalEdges =
      project.applyGapToInternalBoundaries
        ? edges
        : edges.filter((_, edgeIndex) => !logicalEdgeMask[edgeIndex]);
    return {
      ...room,
      points,
      workingPolygon,
      triangles: room.closed ? triangulatePolygon(workingPolygon) : [],
      edges,
      physicalEdges,
      intersections,
    };
  });

  const activeRooms = rooms.filter((room) => room.closed && room.points.length >= 3 && (!room.intersections || room.intersections.length === 0));
  const activeEdges = activeRooms.flatMap((room) => room.physicalEdges);
  const boards = generateBoards(project, activeRooms, activeEdges);
  const bounds = getBoundingBox([
    ...rooms.map((room) => room.points),
    ...rooms.map((room) => room.workingPolygon),
    ...boards.flatMap((board) => board.fragments.map((fragment) => fragment.points)),
  ]);

  return { rooms, boards, bounds };
}

export function generateBoards(project: Project, rooms: ComputedRoom[], wallEdges: PolygonEdge[]): GeneratedBoard[] {
  if (project.layoutMode === "separated" || project.applyGapToInternalBoundaries) {
    let sequence = 1;
    return rooms.flatMap((room) => {
      const roomBoards = generateBoardsForRoomSet(project, [room], room.physicalEdges, sequence, getPatternShift(project, room));
      sequence += roomBoards.length;
      return roomBoards;
    });
  }
  return generateBoardsForRoomSet(project, rooms, wallEdges, 1, getPatternShift(project));
}

function generateBoardsForRoomSet(
  project: Project,
  rooms: ComputedRoom[],
  wallEdges: PolygonEdge[],
  startSequence: number,
  shift: Point,
): GeneratedBoard[] {
  if (!rooms.length) {
    return [];
  }

  const boardLength = Number(project.board.length);
  const boardWidth = Number(project.board.width);
  if (boardLength <= 0 || boardWidth <= 0 || boardLength <= boardWidth) {
    return [];
  }

  const bounds = getBoundingBox(rooms.map((room) => room.workingPolygon));
  const angle = degToRad(Number(project.pattern.angle || 0));
  const chainStepLength = boardLength;
  if (chainStepLength <= 0) {
    return [];
  }

  const u = normalize(rotate({ x: 1, y: 0 }, angle));
  const v = normalize(rotate({ x: 0, y: 1 }, angle));
  const chainVector = scale(add(u, v), chainStepLength);
  const rowVector = scale(subtract(u, v), boardWidth);

  const margin = boardLength * 3;
  const corners: Point[] = [
    { x: bounds.minX - margin, y: bounds.minY - margin },
    { x: bounds.maxX + margin, y: bounds.minY - margin },
    { x: bounds.maxX + margin, y: bounds.maxY + margin },
    { x: bounds.minX - margin, y: bounds.maxY + margin },
  ];
  const chainAxis = normalize(chainVector);
  const rowAxis = normalize(rowVector);
  const chainCoords = corners.map((point) => dot(subtract(point, shift), chainAxis));
  const rowCoords = corners.map((point) => dot(subtract(point, shift), rowAxis));
  const minI = Math.floor(Math.min(...chainCoords) / chainStepLength) - 2;
  const maxI = Math.ceil(Math.max(...chainCoords) / chainStepLength) + 2;
  const minJ = Math.floor(Math.min(...rowCoords) / boardWidth) - 4;
  const maxJ = Math.ceil(Math.max(...rowCoords) / boardWidth) + 4;

  const boards: GeneratedBoard[] = [];
  let sequence = startSequence;

  for (let i = minI; i <= maxI; i += 1) {
    for (let j = minJ; j <= maxJ; j += 1) {
      const anchor = add(shift, add(scale(chainVector, i), scale(rowVector, j)));
      const candidates = [
        {
          type: "left" as const,
          orientation: normalizeAngle(project.pattern.angle),
          polygon: createBoardPolygon(anchor, u, scale(v, -1), boardLength, boardWidth),
        },
        {
          type: "right" as const,
          orientation: normalizeAngle(project.pattern.angle + 90),
          polygon: createBoardPolygon(add(anchor, scale(u, boardLength - boardWidth)), v, u, boardLength, boardWidth),
        },
      ];

      for (const candidate of candidates) {
        const fragments = rooms.flatMap((room) => clipBoardToRoom(candidate.polygon, room));
        const totalArea = fragments.reduce((sum, fragment) => sum + polygonArea(fragment.points), 0);
        if (totalArea < EPS) {
          continue;
        }

        boards.push({
          id: `board-${sequence}`,
          index: sequence,
          type: candidate.type,
          orientation: candidate.orientation,
          full: Math.abs(totalArea - polygonArea(candidate.polygon)) < 0.5,
          basePolygon: candidate.polygon,
          totalArea: round(totalArea),
          fragments,
          cutSummary: summarizeCuts(candidate.polygon, fragments),
          wallDistances: summarizeWallDistances(fragments, wallEdges),
        });
        sequence += 1;
      }
    }
  }

  return boards;
}

function clipBoardToRoom(boardPolygon: Point[], room: ComputedRoom): BoardFragment[] {
  const fragments: BoardFragment[] = [];
  for (const triangle of room.triangles) {
    const clipped = clipPolygonWithConvexClip(boardPolygon, triangle);
    const area = polygonArea(clipped);
    if (clipped.length >= 3 && area > EPS) {
      fragments.push({ roomId: room.id, points: clipped, area: round(area) });
    }
  }
  return mergeDuplicateFragments(fragments);
}

function summarizeCuts(basePolygon: Point[], fragments: BoardFragment[]): GeneratedBoard["cutSummary"] {
  const boardArea = polygonArea(basePolygon);
  const keptArea = fragments.reduce((sum, fragment) => sum + polygonArea(fragment.points), 0);
  const removedArea = Math.max(0, boardArea - keptArea);
  const fragmentBounds = fragments.map((fragment) => getBoundingBox([fragment.points]));
  return {
    fragments: fragments.length,
    removedArea: round(removedArea),
    envelopes: fragmentBounds.map((bounds) => ({
      width: round(bounds.width),
      height: round(bounds.height),
    })),
  };
}

function summarizeWallDistances(fragments: BoardFragment[], edges: PolygonEdge[]): GeneratedBoard["wallDistances"] {
  const summaries = fragments.flatMap((fragment) => measurePolygonAgainstEdges(fragment.points, edges));
  summaries.sort((a, b) => a.distance - b.distance);
  return summaries.slice(0, 4);
}

function mergeDuplicateFragments(fragments: BoardFragment[]): BoardFragment[] {
  const unique: BoardFragment[] = [];
  for (const fragment of fragments) {
    const duplicate = unique.find((entry) => polygonsSimilar(entry.points, fragment.points));
    if (!duplicate) {
      unique.push(fragment);
    }
  }
  return unique;
}

function polygonsSimilar(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const pointsA = a.map((point) => `${round(point.x)}:${round(point.y)}`).sort();
  const pointsB = b.map((point) => `${round(point.x)}:${round(point.y)}`).sort();
  return pointsA.every((value, index) => value === pointsB[index]);
}

function createBoardPolygon(start: Point, lengthDirection: Point, widthDirection: Point, lengthValue: number, widthValue: number): Point[] {
  return [
    start,
    add(start, scale(lengthDirection, lengthValue)),
    add(add(start, scale(lengthDirection, lengthValue)), scale(widthDirection, widthValue)),
    add(start, scale(widthDirection, widthValue)),
  ];
}

function getPatternShift(project: Project, room?: Pick<ComputedRoom, "patternShiftX" | "patternShiftY">): Point {
  return {
    x: Number(project.pattern.shiftX || 0) + (project.applyGapToInternalBoundaries ? Number(room?.patternShiftX || 0) : 0),
    y: Number(project.pattern.shiftY || 0) + (project.applyGapToInternalBoundaries ? Number(room?.patternShiftY || 0) : 0),
  };
}

function normalizeAngle(angle: number): number {
  let normalized = angle % 180;
  if (normalized < 0) {
    normalized += 180;
  }
  return round(normalized);
}

function getLogicalEdgeMask(points: Point[], roomId: string, logicalBoundaries: LogicalBoundary[]): boolean[] {
  return points.map((point, edgeIndex) => {
    const next = points[(edgeIndex + 1) % points.length];
    if (!next) {
      return false;
    }

    return logicalBoundaries.some((boundary) => {
      if (boundary.roomAId !== roomId && boundary.roomBId !== roomId) {
        return false;
      }

      return areMatchingSegments(point, next, boundary.start, boundary.end);
    });
  });
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
