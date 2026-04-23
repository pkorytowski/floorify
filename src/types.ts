export type Point = {
  x: number;
  y: number;
};

export type BoardType = "left" | "right";
export type LayoutMode = "continuous" | "separated";
export type Unit = "mm" | "cm";

export type Room = {
  id: string;
  name: string;
  color: string;
  closed: boolean;
  patternShiftX: number;
  patternShiftY: number;
  points: Point[];
};

export type LogicalBoundary = {
  id: string;
  roomAId: string;
  roomBId: string;
  start: Point;
  end: Point;
};

export type Door = {
  id: string;
  name: string;
  roomAId: string;
  roomBId: string;
  start: Point;
  end: Point;
};

export type Project = {
  version: number;
  name: string;
  unit: Unit;
  layoutMode: LayoutMode;
  board: {
    length: number;
    width: number;
    boardsPerPack: number;
    leftLabel: string;
    rightLabel: string;
  };
  pattern: {
    angle: number;
    shiftX: number;
    shiftY: number;
  };
  gap: number;
  applyGapToInternalBoundaries: boolean;
  rooms: Room[];
  logicalBoundaries: LogicalBoundary[];
  doors: Door[];
  view: {
    activeRoomId: string | null;
  };
};

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type PolygonEdge = {
  roomId: string;
  start: Point;
  end: Point;
};

export type BoardFragment = {
  roomId: string;
  points: Point[];
  area: number;
};

export type WallDistance = {
  wallIndex: number;
  distance: number;
  edge: PolygonEdge;
};

export type GeneratedBoard = {
  id: string;
  index: number;
  type: BoardType;
  orientation: number;
  full: boolean;
  basePolygon: Point[];
  totalArea: number;
  fragments: BoardFragment[];
  cutSummary: {
    fragments: number;
    removedArea: number;
    envelopes: Array<{ width: number; height: number }>;
  };
  wallDistances: WallDistance[];
};

export type ComputedRoom = Room & {
  workingPolygon: Point[];
  triangles: Point[][];
  edges: PolygonEdge[];
  physicalEdges: PolygonEdge[];
  intersections?: Array<{ aIndex: number; bIndex: number; point: Point }>;
};

export type ProjectView = {
  rooms: ComputedRoom[];
  boards: GeneratedBoard[];
  bounds: BoundingBox;
};
