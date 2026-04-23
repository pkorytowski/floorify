import { describe, expect, it } from "vitest";

import { createBoardReusePlan } from "../src/app/boardReuse";
import type { ComputedRoom, GeneratedBoard, Point } from "../src/types";

describe("board reuse", () => {
  it("matches a donor offcut only with a later board that keeps the same factory-side locks", () => {
    const room = createRoom("room-a");
    const boards = [
      createCutBoard({
        id: "board-1",
        index: 1,
        type: "left",
        keptPolygon: rectangle(300, 0, 720, 120),
      }),
      createCutBoard({
        id: "board-2",
        index: 2,
        type: "left",
        keptPolygon: rectangle(0, 0, 260, 120),
      }),
    ];

    const plan = createBoardReusePlan(boards, [room]);

    expect(plan.savedBoards).toBe(1);
    expect(plan.freshBoardsByType.left).toBe(1);
    expect(plan.assignments).toEqual([
      expect.objectContaining({
        sourceBoardId: "board-1",
        targetBoardId: "board-2",
        sourceSide: "left",
      }),
    ]);
    expect(plan.relatedBoardIdsByBoardId["board-1"]).toEqual(["board-2"]);
    expect(plan.relatedBoardIdsByBoardId["board-2"]).toEqual(["board-1"]);
  });

  it("does not count reuse when the later board would require reversing the offcut", () => {
    const room = createRoom("room-a");
    const boards = [
      createCutBoard({
        id: "board-1",
        index: 1,
        type: "left",
        keptPolygon: rectangle(300, 0, 720, 120),
      }),
      createCutBoard({
        id: "board-2",
        index: 2,
        type: "left",
        keptPolygon: rectangle(460, 0, 720, 120),
      }),
    ];

    const plan = createBoardReusePlan(boards, [room]);

    expect(plan.savedBoards).toBe(0);
    expect(plan.assignments).toHaveLength(0);
    expect(plan.freshBoardsByType.left).toBe(2);
  });

  it("does not let a reused board donate its own leftovers again", () => {
    const room = createRoom("room-a");
    const boards = [
      createCutBoard({
        id: "board-1",
        index: 1,
        type: "left",
        keptPolygon: rectangle(300, 0, 720, 120),
      }),
      createCutBoard({
        id: "board-2",
        index: 2,
        type: "left",
        keptPolygon: rectangle(0, 0, 200, 120),
      }),
      createCutBoard({
        id: "board-3",
        index: 3,
        type: "left",
        keptPolygon: rectangle(0, 0, 120, 120),
      }),
    ];

    const plan = createBoardReusePlan(boards, [room]);

    expect(plan.savedBoards).toBe(1);
    expect(plan.assignments).toHaveLength(1);
    expect(plan.assignments[0]).toEqual(
      expect.objectContaining({
        sourceBoardId: "board-1",
        targetBoardId: "board-2",
      }),
    );
    expect(plan.freshBoardsByType.left).toBe(2);
  });
});

function createRoom(id: string): ComputedRoom {
  const points = rectangle(0, 0, 2000, 2000);
  return {
    id,
    name: "Pokoj testowy",
    color: "#7a9b62",
    closed: true,
    patternShiftX: 0,
    patternShiftY: 0,
    points,
    workingPolygon: points,
    triangles: [],
    edges: [],
    physicalEdges: [],
  };
}

function createCutBoard({
  id,
  index,
  type,
  keptPolygon,
}: {
  id: string;
  index: number;
  type: GeneratedBoard["type"];
  keptPolygon: Point[];
}): GeneratedBoard {
  const basePolygon = rectangle(0, 0, 720, 120);
  return {
    id,
    index,
    type,
    orientation: 0,
    full: false,
    basePolygon,
    totalArea: polygonArea(keptPolygon),
    fragments: [
      {
        roomId: "room-a",
        points: keptPolygon,
        area: polygonArea(keptPolygon),
      },
    ],
    cutSummary: {
      fragments: 1,
      removedArea: polygonArea(basePolygon) - polygonArea(keptPolygon),
      envelopes: [],
    },
    wallDistances: [],
  };
}

function rectangle(minX: number, minY: number, maxX: number, maxY: number): Point[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function polygonArea(points: Point[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}
