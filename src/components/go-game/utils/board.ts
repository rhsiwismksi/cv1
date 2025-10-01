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

// So sánh 2 bàn cờ (để check Ko)
function boardsEqual(board1: StoneType[][], board2: StoneType[][]): boolean {
  const size = board1.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board1[y][x] !== board2[y][x]) return false;
    }
  }
  return true;
}

export function tryPlay(
  board: StoneType[][],
  x: number,
  y: number,
  color: StoneType,
  boardHistory: StoneType[][][] = []
): TryPlayResult {
  const size = board.length;

  // Vị trí hợp lệ?
  if (!inBounds(x, y, size) || board[y][x] !== Stone.EMPTY) {
    return { legal: false };
  }

  const opponent: StoneType = color === Stone.BLACK ? Stone.WHITE : Stone.BLACK;
  let totalCaptures = 0;
  const capturedPositions: Position[] = [];

  // Tạo bàn mới
  const newBoard = produce(board, draft => {
    draft[y][x] = color;

    // Check bắt quân
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

  // Suicide check
  const { liberties: ownLiberties } = getGroupAndLiberties(newBoard, x, y);
  if (ownLiberties.size === 0 && totalCaptures === 0) {
    return { legal: false };
  }

  // Ko rule (check 1–2 trạng thái gần nhất)
  const historyToCheck = Math.min(2, boardHistory.length);
  for (let i = boardHistory.length - historyToCheck; i < boardHistory.length; i++) {
    if (i >= 0 && boardsEqual(newBoard, boardHistory[i])) {
      return { legal: false };
    }
  }

  return {
    legal: true,
    board: newBoard,
    captures: totalCaptures,
    capturedPositions
  };
}

// Đặt quân chấp (handicap)
export function placeHandicapStones(
  boardSize: number,
  handicap: number
): Position[] {
  const positions: Position[] = [];
  const starPoints: { [key: number]: Position[] } = {
    9: [
      { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 2, y: 6 }, { x: 6, y: 6 },
      { x: 4, y: 4 }, { x: 4, y: 2 }, { x: 4, y: 6 }, { x: 2, y: 4 }, { x: 6, y: 4 }
    ],
    13: [
      { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 },
      { x: 6, y: 6 }, { x: 6, y: 3 }, { x: 6, y: 9 }, { x: 3, y: 6 }, { x: 9, y: 6 }
    ],
    19: [
      { x: 3, y: 3 }, { x: 15, y: 3 }, { x: 3, y: 15 }, { x: 15, y: 15 },
      { x: 9, y: 9 }, { x: 9, y: 3 }, { x: 9, y: 15 }, { x: 3, y: 9 }, { x: 15, y: 9 }
    ]
  };

  const order = [0, 1, 2, 3, 4, 8, 5, 6, 7];
  const availablePoints = starPoints[boardSize] || starPoints[9];

  for (let i = 0; i < Math.min(handicap, 9); i++) {
    positions.push(availablePoints[order[i]]);
  }
  return positions;
}

// Vẽ điểm sao (hoshi)
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

  if (boardSize % 2 === 1 && boardSize >= 9) {
    points.push({ x: center, y: center });
  }

  return points;
}
