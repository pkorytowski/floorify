import type { BoundingBox } from "../types";

type GridLayerProps = {
  viewBox: BoundingBox;
  gridSize: number;
};

export function GridLayer({ viewBox, gridSize }: GridLayerProps) {
  const effectiveGridSize = Math.max(gridSize, 1);
  const startX = Math.floor(viewBox.minX / effectiveGridSize) * effectiveGridSize;
  const endX = Math.ceil(viewBox.maxX / effectiveGridSize) * effectiveGridSize;
  const startY = Math.floor(viewBox.minY / effectiveGridSize) * effectiveGridSize;
  const endY = Math.ceil(viewBox.maxY / effectiveGridSize) * effectiveGridSize;

  const verticalLines = [];
  for (let x = startX; x <= endX; x += effectiveGridSize) {
    const isMajorLine = x === 0;
    verticalLines.push(
      <line
        key={`vx-${x}`}
        x1={x}
        y1={viewBox.minY}
        x2={x}
        y2={viewBox.maxY}
        stroke={isMajorLine ? "rgba(42, 34, 25, 0.1)" : "rgba(42, 34, 25, 0.05)"}
        strokeWidth={isMajorLine ? 8 : 4}
      />,
    );
  }

  const horizontalLines = [];
  for (let y = startY; y <= endY; y += effectiveGridSize) {
    const isMajorLine = y === 0;
    horizontalLines.push(
      <line
        key={`hy-${y}`}
        x1={viewBox.minX}
        y1={y}
        x2={viewBox.maxX}
        y2={y}
        stroke={isMajorLine ? "rgba(42, 34, 25, 0.1)" : "rgba(42, 34, 25, 0.05)"}
        strokeWidth={isMajorLine ? 8 : 4}
      />,
    );
  }

  return (
    <g pointerEvents="none">
      <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="url(#canvas-bg-gradient)" />
      <defs>
        <linearGradient id="canvas-bg-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(243,235,223,0.95)" />
        </linearGradient>
      </defs>
      {verticalLines}
      {horizontalLines}
    </g>
  );
}
