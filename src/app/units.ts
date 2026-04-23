import { round } from "../geometry";
import type { Project } from "../types";

const MM_PER_CM = 10;

export function toDisplayLength(value: number, unit: Project["unit"]): number {
  if (unit === "cm") {
    return round(value / MM_PER_CM, 2);
  }

  return round(value);
}

export function toInternalLength(value: number, unit: Project["unit"]): number {
  if (unit === "cm") {
    return round(value * MM_PER_CM);
  }

  return round(value);
}

export function toDisplayArea(value: number, unit: Project["unit"]): number {
  if (unit === "cm") {
    return round(value / (MM_PER_CM * MM_PER_CM), 2);
  }

  return round(value);
}

export function formatLength(value: number, unit: Project["unit"]): string {
  return `${toDisplayLength(value, unit)} ${unit}`;
}
