// src/components/go-game/constants.ts

import { GameSettings, Difficulty } from './types';

export const BOARD_SIZES = [7, 9, 13, 15, 19] as const;

export const AI_CONFIG = {
  easy: { maxSimulations: 100, timeLimit: 500, simulationDepth: 30 },
  medium: { maxSimulations: 500, timeLimit: 1000, simulationDepth: 50 },
  hard: { maxSimulations: 2000, timeLimit: 2000, simulationDepth: 100 },
};

export const DEFAULT_SETTINGS: GameSettings = {
  boardSize: 9,
  komi: 6.5,
  handicap: 0,
  difficulty: 'medium',
  timePerMove: 30,
  humanColor: 'black'
};

export const TUTORIAL_MESSAGES = {
  placement: {
    text: "Click giao điểm trống để đặt quân. Quân cần ít nhất 1 'khí' (ô trống kề bên).",
    tip: "Với AI 'easy', đặt quân ở góc (như 3-3 trên 9x9) để dễ mở rộng."
  },
  capture: {
    text: "Bắt quân đối thủ bằng cách chặn hết 'khí' của chúng. Quân bị bắt được loại khỏi bàn.",
    tip: "Với AI 'easy', chặn khí cuối để bắt quân. AI 'medium' có thể phản công."
  },
  ko: {
    text: "Luật Ko: Không đặt quân tạo trạng thái bàn cờ lặp lại ngay sau khi bắt 1 quân.",
    tip: "Với AI 'medium', đi nước khác trước khi lấy lại quân. AI 'easy' ít tận dụng Ko."
  },
  pass: {
    text: "Pass khi không có nước đi tốt. Hai lần pass liên tiếp kết thúc ván cờ.",
    tip: "Pass sớm với AI 'easy' nếu dẫn điểm. Với AI 'medium', bảo vệ vùng đất trước."
  },
  territory: {
    text: "Vùng đất là các ô trống được bao quanh hoàn toàn bởi quân của bạn.",
    tip: "Tạo vùng đất ở góc với AI 'easy'. AI 'medium' sẽ tranh vùng đất."
  },
  scoring: {
    text: "Điểm = Vùng đất + Quân bắt được + Komi (6.5 cho trắng).",
    tip: "Bắt quân với AI 'easy'. Với AI 'medium', tạo mắt để bảo vệ vùng đất."
  },
  eyes: {
    text: "Mắt là ô trống được bao quanh bởi quân bạn. Hai mắt giúp nhóm 'sống'.",
    tip: "Tạo mắt hình vuông với AI 'medium'. Tấn công nhóm không mắt của AI 'easy'."
  }
};
