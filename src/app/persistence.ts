import { buildProjectView } from "../engine";
import { createDefaultProject, normalizeProject } from "../model";
import type { BoundingBox, Project } from "../types";

import { DEFAULT_GRID_SIZE, STORAGE_KEY, VIEWBOX_PADDING } from "./constants";
import { inflateBox } from "./layout";

export type AppPersistenceState = {
  project: Project;
  viewport: BoundingBox;
  editMode: boolean;
  gridSize: number;
  addPointMode: boolean;
  splitMode: boolean;
};

export function saveAppState(
  project: Project,
  viewport: BoundingBox,
  editMode: boolean,
  gridSize: number,
  addPointMode: boolean,
  splitMode: boolean,
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      project,
      viewport,
      editMode,
      gridSize,
      addPointMode,
      splitMode,
    }),
  );
}

export function loadInitialState(): AppPersistenceState {
  const fallbackProject = createDefaultProject();
  const fallbackViewport = inflateBox(buildProjectView(fallbackProject).bounds, VIEWBOX_PADDING);
  const fallbackEditMode = true;
  const fallbackGridSize = DEFAULT_GRID_SIZE;
  const fallbackAddPointMode = true;
  const fallbackSplitMode = false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        project: fallbackProject,
        viewport: fallbackViewport,
        editMode: fallbackEditMode,
        gridSize: fallbackGridSize,
        addPointMode: fallbackAddPointMode,
        splitMode: fallbackSplitMode,
      };
    }

    const parsed = JSON.parse(raw) as {
      project?: unknown;
      viewport?: Partial<BoundingBox>;
      editMode?: unknown;
      gridSize?: unknown;
      addPointMode?: unknown;
      splitMode?: unknown;
    };
    const project = normalizeProject(parsed.project);
    const viewport = normalizeViewport(parsed.viewport) ?? inflateBox(buildProjectView(project).bounds, VIEWBOX_PADDING);
    const editMode = typeof parsed.editMode === "boolean" ? parsed.editMode : fallbackEditMode;
    const gridSize = normalizeGridSize(parsed.gridSize) ?? fallbackGridSize;
    const addPointMode = typeof parsed.addPointMode === "boolean" ? parsed.addPointMode : fallbackAddPointMode;
    const splitMode = typeof parsed.splitMode === "boolean" ? parsed.splitMode : fallbackSplitMode;

    return { project, viewport, editMode, gridSize, addPointMode, splitMode };
  } catch {
    return {
      project: fallbackProject,
      viewport: fallbackViewport,
      editMode: fallbackEditMode,
      gridSize: fallbackGridSize,
      addPointMode: fallbackAddPointMode,
      splitMode: fallbackSplitMode,
    };
  }
}

function normalizeViewport(value: Partial<BoundingBox> | undefined): BoundingBox | null {
  if (!value) {
    return null;
  }

  const minX = Number(value.minX);
  const minY = Number(value.minY);
  const maxX = Number(value.maxX);
  const maxY = Number(value.maxY);
  const width = Number(value.width);
  const height = Number(value.height);
  if ([minX, minY, maxX, maxY, width, height].some((entry) => !Number.isFinite(entry))) {
    return null;
  }

  return { minX, minY, maxX, maxY, width, height };
}

function normalizeGridSize(value: unknown): number | null {
  const numeric = Number(value);
  if (![100, 200, 500, 1000].includes(numeric)) {
    return null;
  }

  return numeric;
}
