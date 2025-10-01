import { Position, StoneType, Stone, GameMove, GameSettings, GameScore } from '../types';

function positionToSGF(pos: Position): string {
  if (pos.x === -1 && pos.y === -1) return '';
  const x = String.fromCharCode(97 + pos.x);
  const y = String.fromCharCode(97 + pos.y);
  return x + y;
}

function sgfToPosition(sgf: string): Position {
  if (sgf === '') return { x: -1, y: -1 };
  if (sgf.length !== 2) throw new Error(`Invalid SGF position: ${sgf}`);
  const x = sgf.charCodeAt(0) - 97;
  const y = sgf.charCodeAt(1) - 97;
  if (x < 0 || y < 0) throw new Error(`Invalid coordinates in SGF: ${sgf}`);
  return { x, y };
}

export function exportToSGF(
  moves: GameMove[],
  settings: GameSettings,
  score?: GameScore
): string {
  let sgf = `(;FF[4]GM[1]SZ[${settings.boardSize}]`;
  sgf += `KM[${settings.komi}]`;

  if (score) {
    const result = score.winner === 'black'
      ? `B+${(score.blackScore - score.whiteScore).toFixed(1)}`
      : `W+${(score.whiteScore - score.blackScore).toFixed(1)}`;
    sgf += `RE[${result}]`;
  }

  for (const move of moves) {
    const color = move.player === Stone.BLACK ? 'B' : 'W';
    const coord = positionToSGF(move.position);
    sgf += `;${color}[${coord}]`;
  }

  sgf += ')';
  return sgf;
}

export function importFromSGF(sgfContent: string): {
  moves: { position: Position; player: StoneType }[];
  boardSize: number;
  komi: number;
} | null {
  try {
    const content = sgfContent.replace(/\s+/g, ' ').trim();
    const sizeMatch = content.match(/SZ\[(\d+)\]/);
    const boardSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 19;
    const komiMatch = content.match(/KM\[([0-9.-]+)\]/);
    const komi = komiMatch ? parseFloat(komiMatch[1]) : 6.5;
    const moves: { position: Position; player: StoneType }[] = [];
    const movePattern = /;([BW])\[([a-z]{0,2})\]/g;
    let match;

    while ((match = movePattern.exec(content)) !== null) {
      const player = match[1] === 'B' ? Stone.BLACK : Stone.WHITE;
      const position = sgfToPosition(match[2]);
      moves.push({ position, player });
    }

    return { moves, boardSize, komi };
  } catch (error) {
    console.error('SGF parse error:', error);
    alert('Không thể phân tích tệp SGF. Vui lòng kiểm tra định dạng và thử lại.');
    return null;
  }
}
