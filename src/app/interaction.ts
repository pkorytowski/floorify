import { dot, length, normalize, round, subtract } from "../geometry";
import type { BoundingBox, Point, Project, Room } from "../types";

import { WALL_LABEL_OFFSET } from "./constants";
import { formatLength } from "./units";

type RoomWithIntersections = Room & {
  intersections?: Array<{ aIndex: number; bIndex: number; point: Point }>;
};

export function toWorldPoint(event: React.MouseEvent<SVGGraphicsElement>, _viewBox: BoundingBox): Point {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return {
    x: round(point.x),
    y: round(point.y),
  };
}

export function getEditablePoint(
  point: Point,
  activeRoom: Room | null,
  options: { constrainAngle: boolean; snapToGrid: boolean; gridSize: number },
): Point {
  let nextPoint = point;

  if (options.constrainAngle) {
    nextPoint = getConstrainedPoint(activeRoom, nextPoint);
  }

  if (options.snapToGrid) {
    nextPoint = snapPointToGrid(nextPoint, options.gridSize);
  }

  return nextPoint;
}

export function getDragDelta(
  startPoint: Point,
  currentPoint: Point,
  options: { constrainAxis: boolean; snapToGrid: boolean; gridSize: number },
): Point {
  const unconstrainedDelta = {
    x: currentPoint.x - startPoint.x,
    y: currentPoint.y - startPoint.y,
  };
  const delta = options.constrainAxis ? constrainDeltaToAxis(unconstrainedDelta) : unconstrainedDelta;

  if (!options.snapToGrid || options.gridSize <= 0) {
    return {
      x: round(delta.x),
      y: round(delta.y),
    };
  }

  const snappedStart = snapPointToGrid(startPoint, options.gridSize);
  const snappedCurrent = snapPointToGrid(
    {
      x: startPoint.x + delta.x,
      y: startPoint.y + delta.y,
    },
    options.gridSize,
  );

  return {
    x: round(snappedCurrent.x - snappedStart.x),
    y: round(snappedCurrent.y - snappedStart.y),
  };
}

export function moveWall(room: Room, edgeIndex: number, delta: Point): Room {
  if (room.points.length < 2) {
    return room;
  }

  const nextIndex = edgeIndex === room.points.length - 1 ? 0 : edgeIndex + 1;
  if (!room.closed && edgeIndex >= room.points.length - 1) {
    return room;
  }

  return {
    ...room,
    points: room.points.map((point, index) =>
      index === edgeIndex || index === nextIndex ? translatePoint(point, delta) : point,
    ),
  };
}

export function translatePoint(point: Point, delta: Point): Point {
  return {
    x: round(point.x + delta.x),
    y: round(point.y + delta.y),
  };
}

export function getRoomEdges(room: RoomWithIntersections) {
  const edges: Array<{ start: Point; end: Point; index: number }> = [];

  for (let index = 0; index < room.points.length; index += 1) {
    const start = room.points[index];
    const end = room.points[(index + 1) % room.points.length];
    if (!start || !end) {
      continue;
    }

    const isClosingEdge = index === room.points.length - 1;
    if (!room.closed && isClosingEdge) {
      continue;
    }

    const intersects = room.intersections?.some((entry) => entry.aIndex === index || entry.bIndex === index);
    if (intersects) {
      continue;
    }

    edges.push({ start, end, index });
  }

  return edges;
}

export function getWallMeasurementLabel(start: Point, end: Point, unit: Project["unit"]) {
  const vector = subtract(end, start);
  const edgeLength = length(vector);
  const direction = edgeLength > 1e-6 ? normalize(vector) : { x: 1, y: 0 };
  const normal = { x: direction.y, y: -direction.x };
  const midpoint = {
    x: round((start.x + end.x) / 2 + normal.x * WALL_LABEL_OFFSET),
    y: round((start.y + end.y) / 2 + normal.y * WALL_LABEL_OFFSET),
  };

  let rotation = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  if (rotation > 90 || rotation < -90) {
    rotation += 180;
  }

  return {
    position: midpoint,
    rotation: round(rotation, 1),
    text: formatLength(edgeLength, unit),
  };
}

export function isSameHoveredPoint(roomId: string, point: Point, hovered: { roomId: string; point: Point }) {
  return roomId === hovered.roomId && arePointsEqual(point, hovered.point);
}

export function isSameHoveredEdge(
  roomId: string,
  start: Point,
  end: Point,
  hovered: { roomId: string; start: Point; end: Point },
) {
  if (roomId !== hovered.roomId) {
    return false;
  }

  return (
    (arePointsEqual(start, hovered.start) && arePointsEqual(end, hovered.end)) ||
    (arePointsEqual(start, hovered.end) && arePointsEqual(end, hovered.start))
  );
}

export function findNearestPointDrag(rooms: Room[], point: Point, maxDistance: number) {
  let bestMatch: { roomId: string; pointIndex: number; distance: number } | null = null;

  for (const room of rooms) {
    for (let index = 0; index < room.points.length; index += 1) {
      const entry = room.points[index];
      if (!entry) {
        continue;
      }

      const distance = length(subtract(point, entry));
      if (distance > maxDistance) {
        continue;
      }

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { roomId: room.id, pointIndex: index, distance };
      }
    }
  }

  return bestMatch;
}

export function findNearestWallDrag(rooms: RoomWithIntersections[], point: Point, maxDistance: number) {
  let bestMatch: { roomId: string; edgeIndex: number; distance: number } | null = null;

  for (const room of rooms) {
    for (const edge of getRoomEdges(room)) {
      const distance = distancePointToSegment(point, edge.start, edge.end);
      if (distance > maxDistance) {
        continue;
      }

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { roomId: room.id, edgeIndex: edge.index, distance };
      }
    }
  }

  return bestMatch;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function projectsEqual(a: Project, b: Project): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function getConstrainedPoint(activeRoom: Room | null, point: Point): Point {
  if (!activeRoom || activeRoom.points.length === 0) {
    return point;
  }

  const anchor = activeRoom.points[activeRoom.points.length - 1]!;
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  if (dx === 0 && dy === 0) {
    return point;
  }

  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;
  const distance = Math.hypot(dx, dy);

  return {
    x: round(anchor.x + Math.cos(snappedAngle) * distance),
    y: round(anchor.y + Math.sin(snappedAngle) * distance),
  };
}

function snapPointToGrid(point: Point, gridSize: number): Point {
  if (gridSize <= 0) {
    return point;
  }

  return {
    x: round(Math.round(point.x / gridSize) * gridSize),
    y: round(Math.round(point.y / gridSize) * gridSize),
  };
}

function constrainDeltaToAxis(delta: Point): Point {
  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    return { x: delta.x, y: 0 };
  }

  return { x: 0, y: delta.y };
}

function arePointsEqual(a: Point, b: Point) {
  return round(a.x) === round(b.x) && round(a.y) === round(b.y);
}

function distancePointToSegment(point: Point, start: Point, end: Point): number {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);
  if (segmentLengthSquared <= 1e-6) {
    return length(subtract(point, start));
  }

  const fromStart = subtract(point, start);
  const projection = clamp(dot(fromStart, segment) / segmentLengthSquared, 0, 1);
  const projectedPoint = {
    x: start.x + segment.x * projection,
    y: start.y + segment.y * projection,
  };

  return length(subtract(point, projectedPoint));
}
