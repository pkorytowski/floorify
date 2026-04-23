import { buildProjectView } from "../engine";
import type { BoundingBox } from "../types";

import { VIEWBOX_PADDING } from "./constants";

export function inflateBox(box: BoundingBox, padding: number): BoundingBox {
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    maxX: box.maxX + padding,
    maxY: box.maxY + padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export function createProjectViewport(bounds: BoundingBox): BoundingBox {
  return inflateBox(bounds, VIEWBOX_PADDING);
}

export function createViewportForProject(project: Parameters<typeof buildProjectView>[0]): BoundingBox {
  return createProjectViewport(buildProjectView(project).bounds);
}
