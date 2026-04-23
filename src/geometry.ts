import type { BoundingBox, Point, PolygonEdge, WallDistance } from "./types";

const EPS = 1e-6;

type SegmentIntersection = {
  point: Point;
  firstT: number;
  secondT: number;
};

type PolygonCutIntersection = SegmentIntersection & {
  id: number;
  edgeIndex: number;
};

export function round(value: number, precision = 0): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalize(vector: Point): Point {
  const len = length(vector);
  return len < EPS ? { x: 0, y: 0 } : { x: vector.x / len, y: vector.y / len };
}

export function rotate(point: Point, angleRad: number): Point {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: point.x * c - point.y * s,
    y: point.x * s + point.y * c,
  };
}

export function polygonSignedArea(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
}

export function polygonArea(points: Point[]): number {
  return Math.abs(polygonSignedArea(points));
}

export function ensureCounterClockwise(points: Point[]): Point[] {
  if (polygonSignedArea(points) >= 0) {
    return points.map(copyPoint);
  }
  return points.slice().reverse().map(copyPoint);
}

export function getBoundingBox(polygons: Point[][]): BoundingBox {
  const allPoints = polygons.flat();
  if (allPoints.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of allPoints) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function distancePointToSegment(point: Point, a: Point, b: Point): number {
  const ab = subtract(b, a);
  const ap = subtract(point, a);
  const abLenSq = dot(ab, ab);
  if (abLenSq < EPS) {
    return length(ap);
  }
  const t = clamp(dot(ap, ab) / abLenSq, 0, 1);
  const projection = add(a, scale(ab, t));
  return length(subtract(point, projection));
}

export function inwardOffsetPolygon(points: Point[], offset: number, edgeOffsets?: number[]): Point[] {
  if (points.length < 3 || offset <= EPS) {
    return ensureCounterClockwise(points);
  }

  const polygon = ensureCounterClockwise(points);
  const shifted: Point[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const prev = polygon[(i - 1 + polygon.length) % polygon.length]!;
    const current = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const prevOffset = edgeOffsets?.[(i - 1 + polygon.length) % polygon.length] ?? offset;
    const currentOffset = edgeOffsets?.[i] ?? offset;

    const edgeA = subtract(current, prev);
    const edgeB = subtract(next, current);
    const normalA = normalize({ x: -edgeA.y, y: edgeA.x });
    const normalB = normalize({ x: -edgeB.y, y: edgeB.x });

    const lineA = { point: add(current, scale(normalA, prevOffset)), direction: edgeA };
    const lineB = { point: add(current, scale(normalB, currentOffset)), direction: edgeB };
    const intersection = intersectLines(lineA.point, lineA.direction, lineB.point, lineB.direction);
    shifted.push(intersection ?? add(current, scale(add(normalA, normalB), offset)));
  }

  const area = polygonArea(shifted);
  if (shifted.length < 3 || area < EPS || shifted.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return polygon;
  }

  return shifted;
}

function intersectLines(p: Point, r: Point, q: Point, s: Point): Point | null {
  const denominator = cross(r, s);
  if (Math.abs(denominator) < EPS) {
    return null;
  }
  const qp = subtract(q, p);
  const t = cross(qp, s) / denominator;
  return add(p, scale(r, t));
}

export function triangulatePolygon(points: Point[]): Point[][] {
  const polygon = ensureCounterClockwise(points);
  if (polygon.length < 3) {
    return [];
  }
  if (polygon.length === 3) {
    return [polygon];
  }

  const vertices = polygon.map((point) => ({ point }));
  const triangles: Point[][] = [];
  let guard = 0;

  while (vertices.length > 3 && guard < 1000) {
    let earFound = false;
    for (let i = 0; i < vertices.length; i += 1) {
      const prev = vertices[(i - 1 + vertices.length) % vertices.length]!.point;
      const current = vertices[i]!.point;
      const next = vertices[(i + 1) % vertices.length]!.point;
      if (!isConvex(prev, current, next)) {
        continue;
      }
      const blocked = vertices.some((candidate, candidateIndex) => {
        if (candidateIndex === i || candidateIndex === (i - 1 + vertices.length) % vertices.length || candidateIndex === (i + 1) % vertices.length) {
          return false;
        }
        return pointInTriangle(candidate.point, prev, current, next);
      });
      if (blocked) {
        continue;
      }

      triangles.push([copyPoint(prev), copyPoint(current), copyPoint(next)]);
      vertices.splice(i, 1);
      earFound = true;
      break;
    }
    if (!earFound) {
      break;
    }
    guard += 1;
  }

  if (vertices.length === 3) {
    triangles.push(vertices.map((vertex) => copyPoint(vertex.point)));
  }

  return triangles.filter((triangle) => polygonArea(triangle) > EPS);
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const area1 = cross(subtract(b, a), subtract(p, a));
  const area2 = cross(subtract(c, b), subtract(p, b));
  const area3 = cross(subtract(a, c), subtract(p, c));
  const hasNegative = area1 < -EPS || area2 < -EPS || area3 < -EPS;
  const hasPositive = area1 > EPS || area2 > EPS || area3 > EPS;
  return !(hasNegative && hasPositive);
}

function isConvex(prev: Point, current: Point, next: Point): boolean {
  return cross(subtract(current, prev), subtract(next, current)) > EPS;
}

export function clipPolygonWithConvexClip(subject: Point[], clipPolygon: Point[]): Point[] {
  let output = ensureCounterClockwise(subject);
  const clip = ensureCounterClockwise(clipPolygon);

  for (let i = 0; i < clip.length; i += 1) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = output.slice();
    output = [];
    if (input.length === 0) {
      break;
    }
    for (let j = 0; j < input.length; j += 1) {
      const current = input[j]!;
      const prev = input[(j - 1 + input.length) % input.length]!;
      const currentInside = isInsideHalfPlane(current, a, b);
      const prevInside = isInsideHalfPlane(prev, a, b);
      if (currentInside) {
        if (!prevInside) {
          output.push(intersectSegments(prev, current, a, b));
        }
        output.push(current);
      } else if (prevInside) {
        output.push(intersectSegments(prev, current, a, b));
      }
    }
  }

  return dedupePolygon(output);
}

function isInsideHalfPlane(point: Point, a: Point, b: Point): boolean {
  return cross(subtract(b, a), subtract(point, a)) >= -EPS;
}

function intersectSegments(p1: Point, p2: Point, q1: Point, q2: Point): Point {
  const r = subtract(p2, p1);
  const s = subtract(q2, q1);
  return intersectLines(p1, r, q1, s) ?? copyPoint(p2);
}

function dedupePolygon(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    return !prev || length(subtract(point, prev)) > 0.1;
  });
}

export function measurePolygonAgainstEdges(polygon: Point[], edges: PolygonEdge[]): WallDistance[] {
  const distances: WallDistance[] = [];
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]!;
    let minDistance = Infinity;
    for (const point of polygon) {
      minDistance = Math.min(minDistance, distancePointToSegment(point, edge.start, edge.end));
    }
    distances.push({
      wallIndex: i,
      distance: round(minDistance),
      edge,
    });
  }
  distances.sort((a, b) => a.distance - b.distance);
  return distances;
}

export function polygonToPath(points: Point[]): string {
  if (!points.length) {
    return "";
  }
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x, 2)} ${round(point.y, 2)}`).join(" ")} Z`;
}

export function getPolygonEdges(points: Point[], roomId: string): PolygonEdge[] {
  const edges: PolygonEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    edges.push({
      roomId,
      start: points[i]!,
      end: points[(i + 1) % points.length]!,
    });
  }
  return edges;
}

export function findPolygonSelfIntersections(points: Point[]) {
  if (points.length < 4) {
    return [];
  }

  const intersections: Array<{
    aIndex: number;
    bIndex: number;
    point: Point;
  }> = [];

  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % points.length]!;
    for (let j = i + 1; j < points.length; j += 1) {
      if (Math.abs(i - j) <= 1) {
        continue;
      }
      if (i === 0 && j === points.length - 1) {
        continue;
      }

      const b1 = points[j]!;
      const b2 = points[(j + 1) % points.length]!;
      const point = segmentIntersectionPoint(a1, a2, b1, b2);
      if (point) {
        intersections.push({ aIndex: i, bIndex: j, point });
      }
    }
  }

  return intersections;
}

export function splitPolygonWithSegment(points: Point[], start: Point, end: Point): Point[][] | null {
  if (points.length < 3 || length(subtract(end, start)) < EPS) {
    return null;
  }

  const polygon = ensureCounterClockwise(points);
  const rawIntersections: PolygonCutIntersection[] = [];
  const uniqueIntersections: Array<{ id: number; point: Point; firstT: number }> = [];

  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const edgeStart = polygon[edgeIndex]!;
    const edgeEnd = polygon[(edgeIndex + 1) % polygon.length]!;
    const intersection = getSegmentIntersection(start, end, edgeStart, edgeEnd);
    if (!intersection) {
      continue;
    }

    let id = uniqueIntersections.find((entry) => arePointsNear(entry.point, intersection.point))?.id;
    if (id === undefined) {
      id = uniqueIntersections.length;
      uniqueIntersections.push({ id, point: intersection.point, firstT: intersection.firstT });
    }

    rawIntersections.push({ ...intersection, id, edgeIndex });
  }

  if (uniqueIntersections.length !== 2) {
    return null;
  }

  const orderedUniqueIntersections = uniqueIntersections.slice().sort((a, b) => a.firstT - b.firstT);
  const pointIndexByIntersectionId = new Map<number, number>();
  const expandedPolygon: Point[] = [copyPoint(polygon[0]!)];

  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const edgeIntersections = rawIntersections
      .filter((entry) => entry.edgeIndex === edgeIndex)
      .sort((a, b) => a.secondT - b.secondT);

    for (const intersection of edgeIntersections) {
      if (!arePointsNear(expandedPolygon[expandedPolygon.length - 1]!, intersection.point)) {
        expandedPolygon.push(copyPoint(intersection.point));
      }
      pointIndexByIntersectionId.set(intersection.id, expandedPolygon.length - 1);
    }

    if (edgeIndex < polygon.length - 1) {
      const nextVertex = polygon[edgeIndex + 1]!;
      if (!arePointsNear(expandedPolygon[expandedPolygon.length - 1]!, nextVertex)) {
        expandedPolygon.push(copyPoint(nextVertex));
      }
    }
  }

  const firstPoint = expandedPolygon[0];
  const lastPoint = expandedPolygon[expandedPolygon.length - 1];
  if (firstPoint && lastPoint && expandedPolygon.length > 1 && arePointsNear(firstPoint, lastPoint)) {
    const duplicateIndex = expandedPolygon.length - 1;
    expandedPolygon.pop();
    for (const intersection of orderedUniqueIntersections) {
      if (pointIndexByIntersectionId.get(intersection.id) === duplicateIndex) {
        pointIndexByIntersectionId.set(intersection.id, 0);
      }
    }
  }

  const firstIntersectionIndex = pointIndexByIntersectionId.get(orderedUniqueIntersections[0]!.id);
  const secondIntersectionIndex = pointIndexByIntersectionId.get(orderedUniqueIntersections[1]!.id);
  if (firstIntersectionIndex === undefined || secondIntersectionIndex === undefined || firstIntersectionIndex === secondIntersectionIndex) {
    return null;
  }

  const startIndex = Math.min(firstIntersectionIndex, secondIntersectionIndex);
  const endIndex = Math.max(firstIntersectionIndex, secondIntersectionIndex);
  const firstPolygon = expandedPolygon.slice(startIndex, endIndex + 1);
  const secondPolygon = [...expandedPolygon.slice(endIndex), ...expandedPolygon.slice(0, startIndex + 1)];

  const result = [firstPolygon, secondPolygon]
    .map((polygonPart) => dedupePolygon(polygonPart))
    .map((polygonPart) => ensureCounterClockwise(polygonPart))
    .filter((polygonPart) => polygonPart.length >= 3 && polygonArea(polygonPart) > EPS);

  return result.length === 2 ? result : null;
}

function segmentIntersectionPoint(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const r = subtract(a2, a1);
  const s = subtract(b2, b1);
  const denominator = cross(r, s);
  const diff = subtract(b1, a1);

  if (Math.abs(denominator) < EPS) {
    return null;
  }

  const t = cross(diff, s) / denominator;
  const u = cross(diff, r) / denominator;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) {
    return null;
  }

  return add(a1, scale(r, t));
}

function getSegmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): SegmentIntersection | null {
  const r = subtract(a2, a1);
  const s = subtract(b2, b1);
  const denominator = cross(r, s);
  const diff = subtract(b1, a1);

  if (Math.abs(denominator) < EPS) {
    return null;
  }

  const firstT = cross(diff, s) / denominator;
  const secondT = cross(diff, r) / denominator;
  if (firstT < -EPS || firstT > 1 + EPS || secondT < -EPS || secondT > 1 + EPS) {
    return null;
  }

  return {
    point: add(a1, scale(r, clamp(firstT, 0, 1))),
    firstT,
    secondT,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function arePointsNear(a: Point, b: Point): boolean {
  return length(subtract(a, b)) <= 0.1;
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}
