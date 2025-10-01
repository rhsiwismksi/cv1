typescript
// src/components/go-game/utils/board.ts

import { produce } from 'immer';
import { StoneType, Stone, Position, TryPlayResult } from '../types';

export function makeEmptyBoard(size: number): StoneType[][] {
  return Array.from({ length: size }, () => Array<StoneType>(size).fill(Stone.EMPTY));
}

export function inBounds(x: number, y: number, size: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function getNeighbors(x: number, y: number, size: number): Position[] {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return directions
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter(pos => inBounds(pos.x, pos.y, size));
}

export function getGroupAndLiberties(
  board: StoneType[][],
  x: number,
  y: number
): {
  group: Position[];
  liberties: Set<string>;
} {
  const size = board.length;
  const color = board[y][x];
  if (color === Stone.EMPTY) return { group: [], liberties: new Set() };

  const visited = new Set<string>();
  const liberties = new Set<string>();
  const group: Position[] = [];
  const key = (px: number, py: number) => `${px},${py}`;

  const stack: Position[] = [{ x, y }];
  visited.add(key(x, y));

  while (stack.length > 0) {
    const current = stack.pop()!;
    group.push(current);

    for (const neighbor of getNeighbors(current.x, current.y, size)) {
      const neighborColor = board[neighbor.y][neighbor.x];
      if (neighborColor === Stone.EMPTY) {
        liberties.add(key(neighbor.x, neighbor.y));
      } else if (neighborColor === color && !visited.has(key(neighbor.x, neighbor.y))) {
        visited.add(key(neighbor.x, neighbor.y));
        stack.push(neighbor);
      }
    }
  }

  return { group, liberties };
}

export function tryPlay(
  board: StoneType[][],
  x: number,
  y: number,
  color: StoneType,
  koBoard: StoneType[][] | null
): TryPlayResult {
  const size = board.length;
  if (!inBounds(x, y, size) || board[y][x] !== Stone.EMPTY) return { legal: false };

  let totalCaptures = 0;
  const capturedPositions: Position[] = [];
  const opponent: StoneType = color === Stone.BLACK ? Stone.WHITE : Stone.BLACK;

  const finalBoard = produce(board, draft => {
    draft[y][x] = color;
    for (const neighbor of getNeighbors(x, y, size)) {
      if (draft[neighbor.y][neighbor.x] === opponent) {
        const { group, liberties } = getGroupAndLiberties(draft, neighbor.x, neighbor.y);
        if (liberties.size === 0) {
          totalCaptures += group.length;
          group.forEach(pos => {
            draft[pos.y][pos.x] = Stone.EMPTY;
            capturedPositions.push(pos);
          });
        }
      }
    }
  });

  const { liberties } = getGroupAndLiberties(finalBoard, x, y);
  if (liberties.size === 0 && totalCaptures === 0) {
    return { legal: false };
  }

  if (koBoard) {
    let isSameAsKo = true;
    for (let i = 0; i < size && isSameAsKo; i++) {
      for (let j = 0; j < size; j++) {
        if (finalBoard[i][j] !== koBoard[i][j]) {
          isSameAsKo = false;
          break;
        }
      }
    }
    if (isSameAsKo) {
      return { legal: false };
    }
  }

  return {
    legal: true,
    board: finalBoard,
    captures: totalCaptures,
    capturedPositions
  };
}

export function generateStarPoints(boardSize: number): Position[] {
  const points: Position[] = [];
  
  const edge = boardSize <= 9 ? 2 : 3;
  const center = Math.floor(boardSize / 2);
  const far = boardSize - edge - 1;

  if (boardSize >= 9) {
    points.push(
      { x: edge, y: edge },
      { x: edge, y: far },
      { x: far, y: edge },
      { x: far, y: far }
    );
  }
  
  if (boardSize >= 13) {
    points.push(
      { x: edge, y: center },
      { x: far, y: center },
      { x: center, y: edge },
      { x: center, y: far }
    );
  }
  
  if (boardSize >= 9) {
    points.push({ x: center, y: center });
  }

  return points;
}
