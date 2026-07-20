import { getQrCanvasLayout } from "./qr-design";

export type CircularQrFillerCell = {
  row: number;
  col: number;
};

export type ProtectedQrSquare = {
  start: number;
  end: number;
  size: number;
};

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cellNoise(seed: number, row: number, col: number) {
  let value = seed ^ Math.imul(row + 1, 374761393) ^ Math.imul(col + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function getProtectedQrSquare(matrixSize: number): ProtectedQrSquare {
  const layout = getQrCanvasLayout(matrixSize, "circle");
  const start = layout.offset - layout.quietZone;
  return {
    start,
    end: start + layout.quietSquareSize,
    size: layout.quietSquareSize,
  };
}

function cellIntersectsProtectedSquare(
  row: number,
  col: number,
  protectedSquare: ProtectedQrSquare
) {
  return (
    col + 1 > protectedSquare.start &&
    col < protectedSquare.end &&
    row + 1 > protectedSquare.start &&
    row < protectedSquare.end
  );
}

function fullCellFitsInsideCircle(row: number, col: number, total: number) {
  const center = total / 2;
  const radius = total / 2 - 1.1;
  const farthestX = Math.max(Math.abs(col - center), Math.abs(col + 1 - center));
  const farthestY = Math.max(Math.abs(row - center), Math.abs(row + 1 - center));
  return Math.hypot(farthestX, farthestY) <= radius;
}

/**
 * Builds deterministic decorative modules for the circular silhouette.
 * These cells are never part of the encoded QR matrix and never intersect
 * the protected matrix-plus-quiet-zone square.
 */
export function getCircularQrFillerCells(
  matrixSize: number,
  seedText: string,
  density = 0.54
): CircularQrFillerCell[] {
  if (density < 0 || density > 1) {
    throw new Error("Circular QR filler density must be between 0 and 1.");
  }

  const layout = getQrCanvasLayout(matrixSize, "circle");
  const protectedSquare = getProtectedQrSquare(matrixSize);
  const seed = hashText(`${seedText}:${matrixSize}`);
  const cells: CircularQrFillerCell[] = [];

  for (let row = 0; row < layout.total; row += 1) {
    for (let col = 0; col < layout.total; col += 1) {
      if (cellIntersectsProtectedSquare(row, col, protectedSquare)) continue;
      if (!fullCellFitsInsideCircle(row, col, layout.total)) continue;
      if (cellNoise(seed, row, col) > density) continue;
      cells.push({ row, col });
    }
  }

  return cells;
}
