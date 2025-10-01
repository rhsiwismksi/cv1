export const Stone = {
  EMPTY: 0,
  BLACK: 1,
  WHITE: 2
} as const;

export type StoneType = typeof Stone[keyof typeof Stone];
export type GameMode = 'ai' | 'local' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameStatus = 'playing' | 'finished' | 'paused';
export type PlayerColor = 'black' | 'white';

export interface Position {
  x: number;
  y: number;
}

export interface GameMove {
  player: StoneType;
  position: Position;
  timestamp: number;
  captures: number;
  isPass?: boolean;
  boardState: StoneType[][];
}

export interface Captures {
  black: number;
  white: number;
}

export interface GameScore {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
  winner: 'black' | 'white' | 'draw';
}

export interface GameSettings {
  boardSize: number;
  komi: number;
  handicap: number;
  difficulty: Difficulty;
  timePerMove: number;
  humanColor: PlayerColor;
}

export interface MCTSNode {
  position: Position | null;
  wins: number;
  visits: number;
  children: MCTSNode[];
  parent: MCTSNode | null;
  untriedMoves: Position[];
  playerToMove: StoneType;
}

export interface TryPlayResult {
  legal: boolean;
  board?: StoneType[][];
  captures?: number;
  capturedPositions?: Position[];
}
