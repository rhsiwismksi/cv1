import { StoneType, Stone, Position, Difficulty, MCTSNode } from '../types';
import { AI_CONFIG } from '../constants';
import { inBounds, getNeighbors, getGroupAndLiberties, tryPlay } from './board';

export function getRelevantPositions(board: StoneType[][], maxDistance: number = 2): Position[] {
  const size = board.length;
  const relevantPositions = new Set<string>();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== Stone.EMPTY) {
        for (let dy = -maxDistance; dy <= maxDistance; dy++) {
          for (let dx = -maxDistance; dx <= maxDistance; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (inBounds(nx, ny, size) && board[ny][nx] === Stone.EMPTY) {
              relevantPositions.add(`${nx},${ny}`);
            }
          }
        }
      }
    }
  }

  if (relevantPositions.size < 10) {
    const center = Math.floor(size / 2);
    const positions = [
      { x: center, y: center },
      { x: 3, y: 3 },
      { x: size - 4, y: 3 },
      { x: 3, y: size - 4 },
      { x: size - 4, y: size - 4 }
    ];

    for (const pos of positions) {
      if (inBounds(pos.x, pos.y, size) && board[pos.y][pos.x] === Stone.EMPTY) {
        relevantPositions.add(`${pos.x},${pos.y}`);
      }
    }
  }

  return Array.from(relevantPositions).map(key => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

export function calculateMoveScore(
  board: StoneType[][],
  x: number,
  y: number,
  color: StoneType,
  difficulty: Difficulty,
  koBoard: StoneType[][] | null
): number {
  const size = board.length;
  let score = 0;

  const result = tryPlay(board, x, y, color, koBoard);
  if (!result.legal) return -Infinity;

  const captures = result.captures || 0;
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);
  const distanceFromCenter = Math.abs(centerX - x) + Math.abs(centerY - y);

  score += captures * 20;
  score -= distanceFromCenter * 2;

  const neighbors = getNeighbors(x, y, size);
  const friendlyNeighbors = neighbors.filter(n => board[n.y][n.x] === color).length;
  const opponentNeighbors = neighbors.filter(n =>
    board[n.y][n.x] === (color === Stone.BLACK ? Stone.WHITE : Stone.BLACK)).length;

  score += friendlyNeighbors * 10;
  score += opponentNeighbors * 8;

  if (difficulty === 'easy') {
    score += (x === 3 || x === size - 4 || y === 3 || y === size - 4) ? 15 : 0;
  } else if (difficulty === 'medium') {
    const cornerBonus = (x === 0 || x === size - 1) && (y === 0 || y === size - 1) ? 10 : 0;
    const sideBonus = (x === 0 || x === size - 1 || y === 0 || y === size - 1) ? 5 : 0;
    score += cornerBonus + sideBonus;
  }

  return score;
}

export class MCTSEngine {
  private readonly config: { maxSimulations: number; timeLimit: number; simulationDepth: number };
  private readonly explorationConstant: number = Math.sqrt(2);
  private cache: Map<number, MCTSNode> = new Map();
  private readonly maxCacheSize = 1000;
  private zobristTable: number[][][] = [];

  constructor(difficulty: Difficulty, boardSize: number) {
    this.config = AI_CONFIG[difficulty];
    this.initializeZobrist(boardSize);
  }

  private initializeZobrist(size: number) {
    this.zobristTable = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [
        Math.random() * 1e9 | 0,
        Math.random() * 1e9 | 0,
        Math.random() * 1e9 | 0
      ])
    );
  }

  private getBoardKey(board: StoneType[][], player: StoneType): number {
    let hash = 0;
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board.length; x++) {
        if (board[y][x] !== Stone.EMPTY) {
          hash ^= this.zobristTable[y][x][board[y][x]];
        }
      }
    }
    return hash ^ (player === Stone.BLACK ? 1 : 2);
  }

  selectMove(board: StoneType[][], color: StoneType, koBoard: StoneType[][] | null): Position | null {
    const root = this.createNode(null, null, color, board);
    const startTime = performance.now();
    let simulations = 0;

    while (performance.now() - startTime < this.config.timeLimit && simulations < this.config.maxSimulations) {
      const node = this.select(root, board, koBoard);
      const result = this.simulate(node, board, color, koBoard);
      this.backpropagate(node, result);
      simulations++;
    }

    let bestNode: MCTSNode | null = null;
    let bestVisits = -1;

    for (const child of root.children) {
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
        bestNode = child;
      }
    }

    return bestNode?.position || null;
  }

  private createNode(
    parent: MCTSNode | null,
    position: Position | null,
    playerToMove: StoneType,
    board: StoneType[][]
  ): MCTSNode {
    const untriedMoves = this.getPossibleMoves(board, playerToMove);
    return {
      position,
      wins: 0,
      visits: 0,
      children: [],
      parent,
      untriedMoves,
      playerToMove
    };
  }

  private getPossibleMoves(board: StoneType[][], color: StoneType): Position[] {
    const relevantPositions = getRelevantPositions(board, 2);
    const moves: Position[] = [];

    for (const pos of relevantPositions) {
      const result = tryPlay(board, pos.x, pos.y, color, null);
      if (result.legal) {
        moves.push(pos);
      }
    }

    if (moves.length === 0) {
      return [{ x: -1, y: -1 }];
    }

    return moves;
  }

  private select(node: MCTSNode, board: StoneType[][], koBoard: StoneType[][] | null): MCTSNode {
    let current = node;
    let currentBoard = board.map(row => [...row]);

    while (current.untriedMoves.length === 0 && current.children.length > 0) {
      current = this.selectBestChild(current);
    }

    if (current.untriedMoves.length > 0) {
      const move = current.untriedMoves.pop()!;
      const nextPlayer = current.playerToMove === Stone.BLACK ? Stone.WHITE : Stone.BLACK;
      const child = this.createNode(current, move, nextPlayer, currentBoard);
      current.children.push(child);
      return child;
    }

    return current;
  }

  private selectBestChild(node: MCTSNode): MCTSNode {
    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of node.children) {
      const exploitation = child.wins / (child.visits + 1e-10);
      const exploration = Math.sqrt(Math.log(node.visits + 1) / (child.visits + 1e-10));
      const value = exploitation + this.explorationConstant * exploration;

      if (value > bestValue) {
        bestValue = value;
        bestChild = child;
      }
    }

    return bestChild!;
  }

  private simulate(node: MCTSNode, board: StoneType[][], originalColor: StoneType, koBoard: StoneType[][] | null): number {
    let simulationBoard = board.map(row => [...row]);
    let currentPlayer = node.playerToMove;
    let passes = 0;
    let moveCount = 0;

    while (moveCount < this.config.simulationDepth && passes < 2) {
      const moves = this.getPossibleMoves(simulationBoard, currentPlayer);
      
      if (moves.length === 0 || moves[0].x === -1) {
        passes++;
      } else {
        passes = 0;
        const move = moves[Math.floor(Math.random() * Math.min(5, moves.length))];
        const result = tryPlay(simulationBoard, move.x, move.y, currentPlayer, koBoard);
        if (result.board) {
          simulationBoard = result.board;
        }
      }

      currentPlayer = currentPlayer === Stone.BLACK ? Stone.WHITE : Stone.BLACK;
      moveCount++;
    }

    const score = this.evaluateBoard(simulationBoard, originalColor);
    return score > 0 ? 1 : 0;
  }

  private evaluateBoard(board: StoneType[][], color: StoneType): number {
    let myScore = 0;
    let oppScore = 0;
    const opponent = color === Stone.BLACK ? Stone.WHITE : Stone.BLACK;

    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board.length; x++) {
        if (board[y][x] === color) myScore++;
        else if (board[y][x] === opponent) oppScore++;
      }
    }

    return myScore - oppScore;
  }

  private backpropagate(node: MCTSNode | null, result: number): void {
    while (node !== null) {
      node.visits++;
      node.wins += result;
      node = node.parent;
    }
  }
}

export function pickAiMove(
  board: StoneType[][],
  color: StoneType,
  difficulty: Difficulty,
  koBoard: StoneType[][] | null
): Position {
  if (difficulty === 'hard') {
    const mcts = new MCTSEngine(difficulty, board.length);
    return mcts.selectMove(board, color, koBoard) || { x: -1, y: -1 };
  }

  const relevantPositions = getRelevantPositions(board, difficulty === 'medium' ? 4 : 2);
  const candidates: { position: Position; score: number }[] = [];

  for (const pos of relevantPositions) {
    const score = calculateMoveScore(board, pos.x, pos.y, color, difficulty, koBoard);
    if (score > -Infinity) {
      candidates.push({ position: pos, score });
    }
  }

  if (candidates.length === 0) {
    return { x: -1, y: -1 };
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCount = difficulty === 'easy' ? 3 : 2;
  const selectedIndex = Math.floor(Math.random() * Math.min(topCount, candidates.length));

  return candidates[selectedIndex].position;
}
