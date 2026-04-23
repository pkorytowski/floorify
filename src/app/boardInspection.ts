import { cross, dot, length, normalize, round, subtract } from "../geometry";
import type { ComputedRoom, GeneratedBoard, Point } from "../types";

export function createBoardInspection(board: GeneratedBoard, rooms: ComputedRoom[]) {
  const origin = board.basePolygon[0]!;
  const xAxis = normalize(subtract(board.basePolygon[1]!, origin));
  const lengthValue = length(subtract(board.basePolygon[1]!, board.basePolygon[0]!));
  const widthValue = length(subtract(board.basePolygon[3]!, board.basePolygon[0]!));
  const roomPolygons = Array.from(new Set(board.fragments.map((fragment) => fragment.roomId)))
    .map((roomId) => rooms.find((room) => room.id === roomId)?.workingPolygon)
    .filter((polygon): polygon is Point[] => Array.isArray(polygon) && polygon.length >= 3);
  const transformedBasePoints = board.basePolygon.map((point) => toBoardFramePoint(point, origin, xAxis));
  const boardBounds = getLocalBounds(transformedBasePoints);
  const offsetX = -boardBounds.minX;
  const offsetY = -boardBounds.minY;

  const basePoints = transformedBasePoints.map((point) => ({
    x: round(point.x + offsetX),
    y: round(point.y + offsetY),
  }));

  const clipPolygons = roomPolygons.map((polygon) =>
    polygon.map((point) => {
      const transformed = toBoardFramePoint(point, origin, xAxis);
      return {
        x: round(transformed.x + offsetX),
        y: round(transformed.y + offsetY),
      };
    }),
  );
  const keptPoints = board.fragments.flatMap((fragment) =>
    fragment.points.map((point) => {
      const transformed = toBoardFramePoint(point, origin, xAxis);
      return {
        x: round(transformed.x + offsetX),
        y: round(transformed.y + offsetY),
      };
    }),
  );
  const keptBounds = getLocalBounds(keptPoints.length ? keptPoints : basePoints);
  const transformedPolygons = transformedFragmentsOrFallback(board, origin, xAxis, offsetX, offsetY);
  const topSpan = getEdgeSpan(transformedPolygons, 0, "y", boardBounds.width);
  const bottomSpan = getEdgeSpan(transformedPolygons, round(boardBounds.height), "y", boardBounds.width);
  const leftSpan = getEdgeSpan(transformedPolygons, 0, "x", boardBounds.height);
  const rightSpan = getEdgeSpan(transformedPolygons, round(boardBounds.width), "x", boardBounds.height);
  const cutAngles = getCutAngleAnnotations(transformedPolygons, boardBounds);

  return {
    basePoints,
    clipPolygons,
    keptBounds,
    topSpan,
    bottomSpan,
    leftSpan,
    rightSpan,
    topTrimLeft: round(topSpan.minX),
    topTrimRight: round(Math.max(0, boardBounds.maxX - topSpan.maxX)),
    bottomTrimLeft: round(bottomSpan.minX),
    bottomTrimRight: round(Math.max(0, boardBounds.maxX - bottomSpan.maxX)),
    leftTrimTop: round(leftSpan.minX),
    leftTrimBottom: round(Math.max(0, boardBounds.maxY - leftSpan.maxX)),
    rightTrimTop: round(rightSpan.minX),
    rightTrimBottom: round(Math.max(0, boardBounds.maxY - rightSpan.maxX)),
    cutAngles,
    length: round(lengthValue),
    width: round(widthValue),
    previewWidth: round(boardBounds.width),
    previewHeight: round(boardBounds.height),
  };
}

function toBoardFramePoint(point: Point, origin: Point, xAxis: Point): Point {
  const relative = subtract(point, origin);
  const yAxis = { x: -xAxis.y, y: xAxis.x };
  return {
    x: round(dot(relative, xAxis)),
    y: round(dot(relative, yAxis)),
  };
}

function transformedFragmentsOrFallback(
  board: GeneratedBoard,
  origin: Point,
  xAxis: Point,
  offsetX: number,
  offsetY: number,
) {
  const transformed = board.fragments.map((fragment) =>
    fragment.points.map((point) => {
      const local = toBoardFramePoint(point, origin, xAxis);
      return {
        x: round(local.x + offsetX),
        y: round(local.y + offsetY),
      };
    }),
  );

  return transformed.length
    ? transformed
    : [
        board.basePolygon.map((point) => {
          const local = toBoardFramePoint(point, origin, xAxis);
          return {
            x: round(local.x + offsetX),
            y: round(local.y + offsetY),
          };
        }),
      ];
}

function getEdgeSpan(polygons: Point[][], edgeValue: number, axis: "x" | "y", fallbackWidth: number) {
  const coordinates: number[] = [];

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index]!;
      const next = polygon[(index + 1) % polygon.length]!;
      const currentAxis = axis === "y" ? current.y : current.x;
      const nextAxis = axis === "y" ? next.y : next.x;
      const currentOther = axis === "y" ? current.x : current.y;
      const nextOther = axis === "y" ? next.x : next.y;

      if (Math.abs(currentAxis - edgeValue) < 0.2) {
        coordinates.push(round(currentOther));
      }

      const crossesEdge =
        (currentAxis < edgeValue && nextAxis > edgeValue) ||
        (currentAxis > edgeValue && nextAxis < edgeValue);

      if (crossesEdge && Math.abs(nextAxis - currentAxis) > 1e-6) {
        const ratio = (edgeValue - currentAxis) / (nextAxis - currentAxis);
        coordinates.push(round(currentOther + ratio * (nextOther - currentOther)));
      }
    }
  }

  if (!coordinates.length) {
    return { minX: 0, maxX: fallbackWidth, width: fallbackWidth };
  }

  const minX = Math.min(...coordinates);
  const maxX = Math.max(...coordinates);
  return {
    minX: round(minX),
    maxX: round(maxX),
    width: round(maxX - minX),
  };
}

function getCutAngleAnnotations(polygons: Point[][], boardBounds: ReturnType<typeof getLocalBounds>) {
  const countedSegments = new Map<string, { start: Point; end: Point; count: number }>();

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      if (length(subtract(end, start)) < 0.1) {
        continue;
      }
      const key = createUndirectedSegmentKey(start, end);
      const existing = countedSegments.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        countedSegments.set(key, { start, end, count: 1 });
      }
    }
  }

  const cutSegments = Array.from(countedSegments.values())
    .filter((entry) => entry.count === 1)
    .filter((entry) => !isBoardBoundarySegment(entry.start, entry.end, boardBounds));

  const mergedSegments = mergeCollinearSegments(cutSegments);

  return mergedSegments
    .map((segment) => {
      const vector = subtract(segment.end, segment.start);
      const vectorLength = Math.max(length(vector), 1e-6);
      const direction = { x: vector.x / vectorLength, y: vector.y / vectorLength };
      const anchorInfo = selectAngleAnchor(segment, boardBounds);
      const cutDirection = normalize(subtract(anchorInfo.otherPoint, anchorInfo.anchorPoint));
      const baseDirection = anchorInfo.baseDirection;
      const angleRad = Math.acos(clamp(dot(baseDirection, cutDirection), -1, 1));
      const roundedAngle = Math.round((angleRad * 180) / Math.PI);
      if (roundedAngle <= 0) {
        return null;
      }
      const radius = 22;
      const startAngle = Math.atan2(baseDirection.y, baseDirection.x);
      const endAngle = Math.atan2(cutDirection.y, cutDirection.x);
      const sweep = smallestSignedAngle(startAngle, endAngle);
      const arcEndAngle = startAngle + sweep;
      const baseRayEnd = {
        x: round(anchorInfo.anchorPoint.x + baseDirection.x * radius),
        y: round(anchorInfo.anchorPoint.y + baseDirection.y * radius),
      };
      const cutRayEnd = {
        x: round(anchorInfo.anchorPoint.x + cutDirection.x * radius),
        y: round(anchorInfo.anchorPoint.y + cutDirection.y * radius),
      };
      const labelAngle = startAngle + sweep / 2;
      const labelPoint = {
        x: round(anchorInfo.anchorPoint.x + Math.cos(labelAngle) * (radius + 18)),
        y: round(anchorInfo.anchorPoint.y + Math.sin(labelAngle) * (radius + 18)),
      };
      return {
        start: segment.start,
        end: segment.end,
        angle: roundedAngle,
        center: anchorInfo.anchorPoint,
        baseRayEnd,
        cutRayEnd,
        arcPath: describeAngleArc(anchorInfo.anchorPoint, radius, startAngle, arcEndAngle),
        labelPoint,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function selectAngleAnchor(segment: { start: Point; end: Point }, boardBounds: ReturnType<typeof getLocalBounds>) {
  const startSide = getBoundarySide(segment.start, boardBounds);
  const endSide = getBoundarySide(segment.end, boardBounds);
  const preferredStart = boundaryPriority(startSide);
  const preferredEnd = boundaryPriority(endSide);

  if (preferredStart <= preferredEnd) {
    return {
      anchorPoint: segment.start,
      otherPoint: segment.end,
      baseDirection: getBoundaryDirection(startSide, segment.start, segment.end),
    };
  }

  return {
    anchorPoint: segment.end,
    otherPoint: segment.start,
    baseDirection: getBoundaryDirection(endSide, segment.end, segment.start),
  };
}

function boundaryPriority(side: "top" | "bottom" | "left" | "right" | "unknown") {
  switch (side) {
    case "top":
      return 0;
    case "bottom":
      return 1;
    case "left":
      return 2;
    case "right":
      return 3;
    default:
      return 4;
  }
}

function getBoundarySide(point: Point, boardBounds: ReturnType<typeof getLocalBounds>) {
  if (Math.abs(point.y - boardBounds.minY) < 0.2) {
    return "top" as const;
  }
  if (Math.abs(point.y - boardBounds.maxY) < 0.2) {
    return "bottom" as const;
  }
  if (Math.abs(point.x - boardBounds.minX) < 0.2) {
    return "left" as const;
  }
  if (Math.abs(point.x - boardBounds.maxX) < 0.2) {
    return "right" as const;
  }
  return "unknown" as const;
}

function getBoundaryDirection(
  side: "top" | "bottom" | "left" | "right" | "unknown",
  anchorPoint: Point,
  otherPoint: Point,
) {
  switch (side) {
    case "top":
    case "bottom":
      return normalize({ x: otherPoint.x - anchorPoint.x, y: 0 });
    case "left":
    case "right":
      return normalize({ x: 0, y: otherPoint.y - anchorPoint.y });
    default:
      return normalize(subtract(otherPoint, anchorPoint));
  }
}

function smallestSignedAngle(startAngle: number, endAngle: number) {
  let delta = endAngle - startAngle;
  while (delta <= -Math.PI) {
    delta += Math.PI * 2;
  }
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  if (delta > Math.PI / 2) {
    delta -= Math.PI;
  } else if (delta < -Math.PI / 2) {
    delta += Math.PI;
  }
  return delta;
}

function describeAngleArc(center: Point, radius: number, startAngle: number, endAngle: number) {
  const arcStart = {
    x: round(center.x + Math.cos(startAngle) * radius, 1),
    y: round(center.y + Math.sin(startAngle) * radius, 1),
  };
  const arcEnd = {
    x: round(center.x + Math.cos(endAngle) * radius, 1),
    y: round(center.y + Math.sin(endAngle) * radius, 1),
  };
  const delta = Math.abs(endAngle - startAngle);
  const largeArcFlag = delta > Math.PI ? 1 : 0;
  const sweepFlag = endAngle >= startAngle ? 1 : 0;
  return `M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${arcEnd.x} ${arcEnd.y}`;
}

function createUndirectedSegmentKey(a: Point, b: Point) {
  const first = `${round(a.x)}:${round(a.y)}`;
  const second = `${round(b.x)}:${round(b.y)}`;
  return [first, second].sort().join("|");
}

function isBoardBoundarySegment(start: Point, end: Point, boardBounds: ReturnType<typeof getLocalBounds>) {
  const onTop = Math.abs(start.y - boardBounds.minY) < 0.2 && Math.abs(end.y - boardBounds.minY) < 0.2;
  const onBottom = Math.abs(start.y - boardBounds.maxY) < 0.2 && Math.abs(end.y - boardBounds.maxY) < 0.2;
  const onLeft = Math.abs(start.x - boardBounds.minX) < 0.2 && Math.abs(end.x - boardBounds.minX) < 0.2;
  const onRight = Math.abs(start.x - boardBounds.maxX) < 0.2 && Math.abs(end.x - boardBounds.maxX) < 0.2;
  return onTop || onBottom || onLeft || onRight;
}

function mergeCollinearSegments(segments: Array<{ start: Point; end: Point }>) {
  const groups = new Map<string, Array<{ start: Point; end: Point; dir: Point }>>();

  for (const segment of segments) {
    const vector = subtract(segment.end, segment.start);
    const segmentLength = length(vector);
    if (segmentLength < 0.1) {
      continue;
    }
    let dir = { x: vector.x / segmentLength, y: vector.y / segmentLength };
    if (dir.x < -1e-6 || (Math.abs(dir.x) < 1e-6 && dir.y < 0)) {
      dir = { x: -dir.x, y: -dir.y };
    }
    const offset = round(cross(segment.start, dir), 1);
    const key = `${round(dir.x, 2)}:${round(dir.y, 2)}:${offset}`;
    const group = groups.get(key) ?? [];
    group.push({ ...segment, dir });
    groups.set(key, group);
  }

  const merged: Array<{ start: Point; end: Point }> = [];
  for (const group of groups.values()) {
    const dir = group[0]!.dir;
    const intervals = group
      .map((segment) => {
        const startT = dot(segment.start, dir);
        const endT = dot(segment.end, dir);
        return {
          startT: Math.min(startT, endT),
          endT: Math.max(startT, endT),
          anchor: segment.start,
        };
      })
      .sort((a, b) => a.startT - b.startT);

    let active = intervals[0];
    for (let index = 1; index < intervals.length; index += 1) {
      const next = intervals[index]!;
      if (next.startT <= active.endT + 0.2) {
        active.endT = Math.max(active.endT, next.endT);
      } else {
        merged.push(projectMergedSegment(active.anchor, dir, active.startT, active.endT));
        active = next;
      }
    }
    if (active) {
      merged.push(projectMergedSegment(active.anchor, dir, active.startT, active.endT));
    }
  }

  return merged;
}

function projectMergedSegment(anchor: Point, dir: Point, startT: number, endT: number) {
  const anchorT = dot(anchor, dir);
  return {
    start: {
      x: round(anchor.x + dir.x * (startT - anchorT)),
      y: round(anchor.y + dir.y * (startT - anchorT)),
    },
    end: {
      x: round(anchor.x + dir.x * (endT - anchorT)),
      y: round(anchor.y + dir.y * (endT - anchorT)),
    },
  };
}

function getLocalBounds(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: round(Math.min(...xs)),
    maxX: round(Math.max(...xs)),
    minY: round(Math.min(...ys)),
    maxY: round(Math.max(...ys)),
    width: round(Math.max(...xs) - Math.min(...xs)),
    height: round(Math.max(...ys) - Math.min(...ys)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
