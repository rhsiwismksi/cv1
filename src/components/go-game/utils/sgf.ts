// src/components/go-game/utils/sgf.ts
import { Position, StoneType, Stone, GameMove, GameSettings, GameScore } from '../types';

// SGF chuẩn dùng bảng a–s, bỏ qua 'i'
const SGF_CHARS = 'abcdefghjklmnopqrs';

function positionToSGF(pos: Position, boardSize: number): string {
  if (pos.x === -1 && pos.y === -1) return ''; // Pass
  if (pos.x >= boardSize || pos.y >= boardSize) return '';
  return SGF_CHARS[pos.x] + SGF_CHARS[pos.y];
}

function sgfToPosition(sgf: string, boardSize: number): Position {
  if (sgf === '' || sgf === 'tt') return { x: -1, y: -1 }; // Pass
  if (sgf.length !== 2) throw new Error(`Invalid SGF position: ${sgf}`);
  const x = SGF_CHARS.indexOf(sgf[0]);
  const y = SGF_CHARS.indexOf(sgf[1]);
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
    throw new Error(`Invalid coordinates in SGF: ${sgf}`);
  }
  return { x, y };
}

export function exportToSGF(
  moves: GameMove[],
  settings: GameSettings,
  score?: GameScore,
  playerNames?: { black: string; white: string }
): string {
  const date = new Date().toISOString().split('T')[0];

  let sgf = '(;FF[4]GM[1]CA[UTF-8]\n';
  sgf += `SZ[${settings.boardSize}]\n`;
  sgf += `KM[${settings.komi}]\n`;
  sgf += `DT[${date}]\n`;
  sgf += `AP[GoGamePro:1.0]\n`;

  if (playerNames) {
    sgf += `PB[${playerNames.black}]\n`;
    sgf += `PW[${playerNames.white}]\n`;
  }

  if (settings.handicap > 0) {
    sgf += `HA[${settings.handicap}]\n`;
  }

  if (score) {
    const result =
      score.winner === 'black'
        ? `B+${(score.blackScore - score.whiteScore).toFixed(1)}`
        : score.winner === 'white'
        ? `W+${(score.whiteScore - score.blackScore).toFixed(1)}`
        : 'Draw';
    sgf += `RE[${result}]\n`;
  }

  // moves
  for (const move of moves) {
    const color = move.player === Stone.BLACK ? 'B' : 'W';
    const coord = positionToSGF(move.position, settings.boardSize);
    sgf += `;${color}[${coord}]`;
    if (move.captures && move.captures > 0) {
      sgf += `C[Captured ${move.captures} stone${move.captures > 1 ? 's' : ''}]`;
    }
  }

  sgf += ')';
  return sgf;
}

export function importFromSGF(sgfContent: string): {
  moves: { position: Position; player: StoneType }[];
  boardSize: number;
  komi: number;
  handicap: number;
  playerNames?: { black: string; white: string };
  result?: string;
} | null {
  try {
    const content = sgfContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Parse header
    const sizeMatch = content.match(/SZ\[(\d+)\]/);
    const boardSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 19;

    const komiMatch = content.match(/KM\[([0-9.-]+)\]/);
    const komi = komiMatch ? parseFloat(komiMatch[1]) : 6.5;

    const handicapMatch = content.match(/HA\[(\d+)\]/);
    const handicap = handicapMatch ? parseInt(handicapMatch[1], 10) : 0;

    const blackNameMatch = content.match(/PB\[([^\]]+)\]/);
    const whiteNameMatch = content.match(/PW\[([^\]]+)\]/);
    const playerNames =
      blackNameMatch && whiteNameMatch
        ? { black: blackNameMatch[1], white: whiteNameMatch[1] }
        : undefined;

    const resultMatch = content.match(/RE\[([^\]]+)\]/);
    const result = resultMatch ? resultMatch[1] : undefined;

    // Parse moves
    const moves: { position: Position; player: StoneType }[] = [];
    const movePattern = /;([BW])\[([a-z]{0,2})\]/g;
    let match;
    while ((match = movePattern.exec(content)) !== null) {
      const player = match[1] === 'B' ? Stone.BLACK : Stone.WHITE;
      const position = sgfToPosition(match[2], boardSize);
      moves.push({ position, player });
    }

    // Parse setup stones
    const setupBlackPattern = /AB\[([a-z]{2})\]/g;
    let setupMatch;
    while ((setupMatch = setupBlackPattern.exec(content)) !== null) {
      moves.unshift({
        position: sgfToPosition(setupMatch[1], boardSize),
        player: Stone.BLACK,
      });
    }

    const setupWhitePattern = /AW\[([a-z]{2})\]/g;
    while ((setupMatch = setupWhitePattern.exec(content)) !== null) {
      moves.unshift({
        position: sgfToPosition(setupMatch[1], boardSize),
        player: Stone.WHITE,
      });
    }

    return { moves, boardSize, komi, handicap, playerNames, result };
  } catch (error) {
    console.error('SGF parse error:', error);
    alert('Không thể phân tích tệp SGF. Vui lòng kiểm tra định dạng.');
    return null;
  }
}
