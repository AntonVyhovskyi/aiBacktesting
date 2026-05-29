import type { DiscoveryMode, ParamGrid } from "./types.js";

export const cartesian = (grid: ParamGrid): Record<string, number>[] => {
  const keys = Object.keys(grid);
  const out: Record<string, number>[] = [];
  const walk = (i: number, cur: Record<string, number>): void => {
    if (i >= keys.length) {
      out.push({ ...cur });
      return;
    }
    const k = keys[i]!;
    for (const v of grid[k]!) walk(i + 1, { ...cur, [k]: v });
  };
  walk(0, {});
  return out;
};

export const countGrid = (grid: ParamGrid): number =>
  Object.values(grid).reduce((a, arr) => a * arr.length, 1);

export const gridForMode = (quick: ParamGrid, fast: ParamGrid, full: ParamGrid, mode: DiscoveryMode): ParamGrid =>
  mode === "quick" ? quick : mode === "fast" ? fast : full;

export const mergeParams = (
  defaults: Record<string, number | string>,
  ...layers: Record<string, number | string>[]
): Record<string, number | string> => Object.assign({}, defaults, ...layers);

export const num = (params: Record<string, number | string>, key: string, fallback: number): number => {
  const v = Number(params[key]);
  return Number.isFinite(v) ? v : fallback;
};

export const boolParam = (params: Record<string, number | string>, key: string): boolean =>
  Number(params[key]) === 1;
