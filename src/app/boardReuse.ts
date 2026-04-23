import type { BoardType, ComputedRoom, GeneratedBoard } from "../types";

import { createBoardInspection } from "./boardInspection";

const EPS = 0.5;

type ScrapProfile = {
  id: string;
  boardId: string;
  boardIndex: number;
  type: BoardType;
  side: "left" | "right";
  topLength: number;
  bottomLength: number;
  area: number;
};

type TargetProfile = {
  boardId: string;
  boardIndex: number;
  type: BoardType;
  area: number;
  sourceSide: "left" | "right" | null;
  topLength: number;
  bottomLength: number;
};

export type BoardReuseAssignment = {
  scrapId: string;
  sourceBoardId: string;
  sourceBoardIndex: number;
  sourceType: BoardType;
  sourceSide: "left" | "right";
  targetBoardId: string;
  targetBoardIndex: number;
};

export type BoardReusePlan = {
  assignments: BoardReuseAssignment[];
  incomingByBoardId: Record<string, BoardReuseAssignment | null>;
  outgoingByBoardId: Record<string, BoardReuseAssignment[]>;
  relatedBoardIdsByBoardId: Record<string, string[]>;
  reusableBoardIds: string[];
  savedBoards: number;
  freshBoardsByType: Record<BoardType, number>;
};

export function createBoardReusePlan(boards: GeneratedBoard[], rooms: ComputedRoom[]): BoardReusePlan {
  const incomingByBoardId = Object.fromEntries(boards.map((board) => [board.id, null])) as Record<string, BoardReuseAssignment | null>;
  const outgoingByBoardId = Object.fromEntries(boards.map((board) => [board.id, []])) as Record<string, BoardReuseAssignment[]>;
  const relatedBoardIds = new Map<string, Set<string>>(boards.map((board) => [board.id, new Set<string>()]));

  const scraps: ScrapProfile[] = [];
  const targets: TargetProfile[] = [];

  for (const board of boards) {
    if (board.full) {
      continue;
    }

    const inspection = createBoardInspection(board, rooms);
    const leftArea = calculateTrapezoidArea(inspection.topTrimLeft, inspection.bottomTrimLeft, inspection.width);
    const rightArea = calculateTrapezoidArea(inspection.topTrimRight, inspection.bottomTrimRight, inspection.width);

    if (leftArea > EPS) {
      scraps.push({
        id: `${board.id}-left`,
        boardId: board.id,
        boardIndex: board.index,
        type: board.type,
        side: "left",
        topLength: inspection.topTrimLeft,
        bottomLength: inspection.bottomTrimLeft,
        area: leftArea,
      });
    }

    if (rightArea > EPS) {
      scraps.push({
        id: `${board.id}-right`,
        boardId: board.id,
        boardIndex: board.index,
        type: board.type,
        side: "right",
        topLength: inspection.topTrimRight,
        bottomLength: inspection.bottomTrimRight,
        area: rightArea,
      });
    }

    targets.push({
      boardId: board.id,
      boardIndex: board.index,
      type: board.type,
      area: board.totalArea,
      ...createTargetProfile(inspection),
    });
  }

  const targetByBoardId = new Map(targets.map((target) => [target.boardId, target]));
  const matchedTargetIds = new Set<string>();
  const sourceBoardIds = new Set<string>();
  const assignments: BoardReuseAssignment[] = [];

  scraps.sort((a, b) => a.area - b.area || a.boardIndex - b.boardIndex || a.side.localeCompare(b.side));

  for (const scrap of scraps) {
    if (matchedTargetIds.has(scrap.boardId)) {
      continue;
    }

    const candidate = targets
      .filter((target) => {
        if (matchedTargetIds.has(target.boardId)) {
          return false;
        }
        if (target.boardId === scrap.boardId) {
          return false;
        }
        if (sourceBoardIds.has(target.boardId)) {
          return false;
        }
        if (target.type !== scrap.type) {
          return false;
        }
        if (!target.sourceSide || target.sourceSide !== scrap.side) {
          return false;
        }
        if (target.boardIndex <= scrap.boardIndex) {
          return false;
        }
        return scrapFitsTarget(scrap, target.area, target);
      })
      .map((target) => {
        if (!scrapFitsTarget(scrap, target.area, target)) {
          return null;
        }

        return {
          target,
          waste: profileWaste(scrap, target, target.area),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => {
        if (a.waste !== b.waste) {
          return a.waste - b.waste;
        }
        if (a.target.area !== b.target.area) {
          return b.target.area - a.target.area;
        }
        return a.target.boardIndex - b.target.boardIndex;
      })[0];

    if (!candidate) {
      continue;
    }

    const assignment: BoardReuseAssignment = {
      scrapId: scrap.id,
      sourceBoardId: scrap.boardId,
      sourceBoardIndex: scrap.boardIndex,
      sourceType: scrap.type,
      sourceSide: scrap.side,
      targetBoardId: candidate.target.boardId,
      targetBoardIndex: candidate.target.boardIndex,
    };

    assignments.push(assignment);
    sourceBoardIds.add(scrap.boardId);
    matchedTargetIds.add(candidate.target.boardId);
    incomingByBoardId[candidate.target.boardId] = assignment;
    outgoingByBoardId[scrap.boardId] = [...outgoingByBoardId[scrap.boardId], assignment];
    relatedBoardIds.get(scrap.boardId)?.add(candidate.target.boardId);
    relatedBoardIds.get(candidate.target.boardId)?.add(scrap.boardId);
  }

  const freshBoardsByType = boards.reduce<Record<BoardType, number>>(
    (accumulator, board) => {
      accumulator[board.type] += 1;
      return accumulator;
    },
    { left: 0, right: 0 },
  );

  for (const targetBoardId of matchedTargetIds) {
    const target = targetByBoardId.get(targetBoardId);
    if (target) {
      freshBoardsByType[target.type] = Math.max(0, freshBoardsByType[target.type] - 1);
    }
  }

  const relatedBoardIdsByBoardId = Object.fromEntries(
    Array.from(relatedBoardIds.entries()).map(([boardId, boardIds]) => [boardId, Array.from(boardIds)]),
  );

  return {
    assignments,
    incomingByBoardId,
    outgoingByBoardId,
    relatedBoardIdsByBoardId,
    reusableBoardIds: Array.from(matchedTargetIds),
    savedBoards: assignments.length,
    freshBoardsByType,
  };
}

function createTargetProfile(inspection: ReturnType<typeof createBoardInspection>) {
  const keepsLeftFactorySide = inspection.topTrimLeft <= EPS && inspection.bottomTrimLeft <= EPS;
  const keepsRightFactorySide = inspection.topTrimRight <= EPS && inspection.bottomTrimRight <= EPS;

  if (keepsLeftFactorySide && !keepsRightFactorySide) {
    return {
      sourceSide: "left" as const,
      topLength: inspection.topSpan.width,
      bottomLength: inspection.bottomSpan.width,
    };
  }

  if (keepsRightFactorySide && !keepsLeftFactorySide) {
    return {
      sourceSide: "right" as const,
      topLength: inspection.topSpan.width,
      bottomLength: inspection.bottomSpan.width,
    };
  }

  return {
    sourceSide: null,
    topLength: inspection.topSpan.width,
    bottomLength: inspection.bottomSpan.width,
  };
}

function calculateTrapezoidArea(topLength: number, bottomLength: number, width: number) {
  return ((Math.max(0, topLength) + Math.max(0, bottomLength)) * Math.max(0, width)) / 2;
}

function scrapFitsTarget(
  scrap: ScrapProfile,
  targetArea: number,
  profile: Pick<TargetProfile, "topLength" | "bottomLength">,
) {
  return (
    scrap.area + EPS >= targetArea &&
    scrap.topLength + EPS >= profile.topLength &&
    scrap.bottomLength + EPS >= profile.bottomLength
  );
}

function profileWaste(
  scrap: ScrapProfile,
  profile: Pick<TargetProfile, "topLength" | "bottomLength">,
  targetArea: number,
) {
  const areaWaste = scrap.area - targetArea;
  const topWaste = scrap.topLength - profile.topLength;
  const bottomWaste = scrap.bottomLength - profile.bottomLength;
  return areaWaste * 10 + topWaste + bottomWaste;
}
