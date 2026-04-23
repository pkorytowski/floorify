import { describe, expect, it } from "vitest";

import { buildProjectView, generateBoards } from "../src/engine";
import { polygonArea, splitPolygonWithSegment, triangulatePolygon } from "../src/geometry";
import { createDefaultProject } from "../src/model";

describe("engine", () => {
  it("triangulatePolygon preserves polygon area for concave room", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 250 },
      { x: 250, y: 250 },
      { x: 250, y: 500 },
      { x: 0, y: 500 },
    ];
    const triangles = triangulatePolygon(polygon);
    const triangleArea = triangles.reduce((sum, triangle) => sum + polygonArea(triangle), 0);
    expect(Math.round(triangleArea)).toBe(Math.round(polygonArea(polygon)));
  });

  it("buildProjectView creates left and right boards", () => {
    const project = createDefaultProject();
    const view = buildProjectView(project);
    expect(view.boards.some((board) => board.type === "left")).toBe(true);
    expect(view.boards.some((board) => board.type === "right")).toBe(true);
  });

  it("separated layout still produces independent board sets", () => {
    const project = createDefaultProject();
    project.layoutMode = "separated";
    const rooms = buildProjectView(project).rooms.filter((room) => room.closed);
    const boards = generateBoards(project, rooms, rooms.flatMap((room) => room.edges));
    expect(boards.length).toBeGreaterThan(0);
  });

  it("pattern shift changes board placement", () => {
    const project = createDefaultProject();
    const before = buildProjectView(project).boards[0]?.basePolygon[0];
    project.pattern.shiftX = 200;
    project.pattern.shiftY = 150;
    const after = buildProjectView(project).boards[0]?.basePolygon[0];
    expect(after).not.toEqual(before);
  });

  it("room pattern shift works only when internal boundaries use gap", () => {
    const project = createDefaultProject();
    project.layoutMode = "continuous";
    project.applyGapToInternalBoundaries = false;
    project.rooms[0]!.patternShiftX = 180;
    const withoutInternalGap = buildProjectView(project).boards[0]?.basePolygon[0];

    project.rooms[0]!.patternShiftX = 0;
    const baseline = buildProjectView(project).boards[0]?.basePolygon[0];
    expect(withoutInternalGap).toEqual(baseline);

    project.applyGapToInternalBoundaries = true;
    project.rooms[0]!.patternShiftX = 180;
    const withInternalGap = buildProjectView(project).boards.find((board) => board.fragments.some((fragment) => fragment.roomId === project.rooms[0]!.id))?.basePolygon[0];
    expect(withInternalGap).not.toEqual(baseline);
  });

  it("board metadata includes distances and cut summary", () => {
    const project = createDefaultProject();
    const view = buildProjectView(project);
    const board = view.boards.find((entry) => !entry.full) ?? view.boards[0];
    expect(board).toBeDefined();
    expect(board!.cutSummary.fragments).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(board!.wallDistances)).toBe(true);
  });

  it("splitPolygonWithSegment divides a room into two valid polygons", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 400 },
      { x: 0, y: 400 },
    ];

    const split = splitPolygonWithSegment(polygon, { x: 300, y: -100 }, { x: 300, y: 500 });

    expect(split).not.toBeNull();
    expect(split).toHaveLength(2);
    expect(Math.round((split ?? []).reduce((sum, entry) => sum + polygonArea(entry), 0))).toBe(Math.round(polygonArea(polygon)));
    expect((split ?? []).every((entry) => entry.length >= 3)).toBe(true);
  });

  it("logical room boundaries can keep continuous floor gap-free between rooms", () => {
    const project = createDefaultProject();
    project.gap = 10;
    project.rooms = [
      {
        id: "room-a",
        name: "Pokoj A",
        color: "#7a9b62",
        closed: true,
        patternShiftX: 0,
        patternShiftY: 0,
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 400 },
          { x: 0, y: 400 },
        ],
      },
      {
        id: "room-b",
        name: "Pokoj B",
        color: "#8aa972",
        closed: true,
        patternShiftX: 0,
        patternShiftY: 0,
        points: [
          { x: 300, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 400 },
          { x: 300, y: 400 },
        ],
      },
    ];
    project.logicalBoundaries = [
      {
        id: "logical-boundary-1",
        roomAId: "room-a",
        roomBId: "room-b",
        start: { x: 300, y: 0 },
        end: { x: 300, y: 400 },
      },
    ];

    project.applyGapToInternalBoundaries = false;
    const withoutInternalGap = buildProjectView(project);
    const continuousArea = withoutInternalGap.rooms.reduce((sum, room) => sum + polygonArea(room.workingPolygon), 0);
    expect(Math.round(continuousArea)).toBe(220400);

    project.applyGapToInternalBoundaries = true;
    const withInternalGap = buildProjectView(project);
    const separatedArea = withInternalGap.rooms.reduce((sum, room) => sum + polygonArea(room.workingPolygon), 0);
    expect(Math.round(separatedArea)).toBe(212800);
  });
});
