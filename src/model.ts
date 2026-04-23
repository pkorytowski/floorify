import type { Door, LogicalBoundary, Project, Room } from "./types";

const sampleRooms: Room[] = [
  {
    id: "room-living",
    name: "Salon",
    color: "#7a9b62",
    closed: true,
    patternShiftX: 0,
    patternShiftY: 0,
    points: [
      { x: 0, y: 0 },
      { x: 5200, y: 0 },
      { x: 5200, y: 3300 },
      { x: 3600, y: 3300 },
      { x: 3600, y: 4300 },
      { x: 0, y: 4300 },
    ],
  },
  {
    id: "room-hall",
    name: "Hol",
    color: "#9c7d50",
    closed: true,
    patternShiftX: 0,
    patternShiftY: 0,
    points: [
      { x: 5200, y: 900 },
      { x: 7000, y: 900 },
      { x: 7000, y: 2700 },
      { x: 5200, y: 2700 },
    ],
  },
];

const sampleDoors: Door[] = [
  {
    id: "door-1",
    name: "Przejście salon-hol",
    roomAId: "room-living",
    roomBId: "room-hall",
    start: { x: 5200, y: 1400 },
    end: { x: 5200, y: 2200 },
  },
];

export function createDefaultProject(): Project {
  return {
    version: 1,
    name: "Mieszkanie - projekt startowy",
    unit: "mm",
    layoutMode: "continuous",
    board: {
      length: 720,
      width: 120,
      boardsPerPack: 20,
      leftLabel: "Lewa",
      rightLabel: "Prawa",
    },
    pattern: {
      angle: 45,
      shiftX: 0,
      shiftY: 0,
    },
    gap: 8,
    applyGapToInternalBoundaries: false,
    rooms: structuredClone(sampleRooms),
    logicalBoundaries: [],
    doors: structuredClone(sampleDoors),
    view: {
      activeRoomId: sampleRooms[0]?.id ?? null,
    },
  };
}

export function createRoom(index: number): Room {
  const id = `room-${crypto.randomUUID()}`;
  const startX = 500 * index;
  const startY = 500 * index;
  return {
    id,
    name: `Pokój ${index}`,
    color: "#7a9b62",
    closed: false,
    patternShiftX: 0,
    patternShiftY: 0,
    points: [
      { x: startX, y: startY },
      { x: startX + 3200, y: startY },
      { x: startX + 3200, y: startY + 2600 },
    ],
  };
}

export function createDoor(project: Project): Door {
  const roomA = project.rooms[0];
  const roomB = project.rooms[1] ?? project.rooms[0];
  return {
    id: `door-${crypto.randomUUID()}`,
    name: `Otwór ${project.doors.length + 1}`,
    roomAId: roomA?.id ?? "",
    roomBId: roomB?.id ?? "",
    start: { x: 0, y: 0 },
    end: { x: 800, y: 0 },
  };
}

export function normalizeProject(raw: unknown): Project {
  const base = createDefaultProject();
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Project>;
  return {
    ...base,
    ...value,
    board: normalizeBoard({ ...base.board, ...(value.board ?? {}) }),
    pattern: { ...base.pattern, ...(value.pattern ?? {}) },
    view: { ...base.view, ...(value.view ?? {}) },
    applyGapToInternalBoundaries:
      typeof value.applyGapToInternalBoundaries === "boolean"
        ? value.applyGapToInternalBoundaries
        : base.applyGapToInternalBoundaries,
    rooms: Array.isArray(value.rooms) ? value.rooms.map(normalizeRoom) : base.rooms,
    logicalBoundaries: Array.isArray(value.logicalBoundaries)
      ? value.logicalBoundaries.map(normalizeLogicalBoundary)
      : base.logicalBoundaries,
    doors: Array.isArray(value.doors) ? value.doors.map(normalizeDoor) : base.doors,
  };
}

function normalizeBoard(board: Project["board"]): Project["board"] {
  return {
    ...board,
    boardsPerPack: normalizeBoardsPerPack(board.boardsPerPack),
  };
}

function normalizeBoardsPerPack(value: unknown): number {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  if (numeric === 0) {
    return 0;
  }

  return numeric % 2 === 0 ? numeric : numeric + 1;
}

function normalizeRoom(room: Partial<Room>): Room {
  return {
    id: room.id ?? `room-${crypto.randomUUID()}`,
    name: room.name ?? "Pokój",
    color: room.color ?? "#7a9b62",
    closed: room.closed ?? false,
    patternShiftX: Number(room.patternShiftX) || 0,
    patternShiftY: Number(room.patternShiftY) || 0,
    points: Array.isArray(room.points)
      ? room.points.map((point) => ({
          x: Number(point.x) || 0,
          y: Number(point.y) || 0,
        }))
      : [],
  };
}

function normalizeDoor(door: Partial<Door>): Door {
  return {
    id: door.id ?? `door-${crypto.randomUUID()}`,
    name: door.name ?? "Otwór",
    roomAId: door.roomAId ?? "",
    roomBId: door.roomBId ?? "",
    start: {
      x: Number(door.start?.x) || 0,
      y: Number(door.start?.y) || 0,
    },
    end: {
      x: Number(door.end?.x) || 0,
      y: Number(door.end?.y) || 0,
    },
  };
}

function normalizeLogicalBoundary(boundary: Partial<LogicalBoundary>): LogicalBoundary {
  return {
    id: boundary.id ?? `logical-boundary-${crypto.randomUUID()}`,
    roomAId: boundary.roomAId ?? "",
    roomBId: boundary.roomBId ?? "",
    start: {
      x: Number(boundary.start?.x) || 0,
      y: Number(boundary.start?.y) || 0,
    },
    end: {
      x: Number(boundary.end?.x) || 0,
      y: Number(boundary.end?.y) || 0,
    },
  };
}
