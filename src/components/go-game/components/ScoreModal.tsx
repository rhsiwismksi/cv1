import React from 'react';
import { GameScore, Captures } from '../types';

interface ScoreModalProps {
  isOpen: boolean;
  gameScore: GameScore | null;
  captures: Captures;
  onClose: () => void;
  onNewGame: () => void;
}

export const ScoreModal = React.memo(({
  isOpen,
  gameScore,
  captures,
  onClose,
  onNewGame
}: ScoreModalProps) => {
  if (!isOpen || !gameScore) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-white to-gray-100 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center text-gray-800">
          🏆 Kết quả ván cờ
        </h2>
        <div className="space-y-3 text-sm sm:text-base">
          <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
            <span>Vùng đất Đen:</span>
            <span className="font-medium">{gameScore.blackTerritory}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
            <span>Vùng đất Trắng:</span>
            <span className="font-medium">{gameScore.whiteTerritory}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
            <span>Quân bắt Đen:</span>
            <span className="font-medium">{captures.black}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
            <span>Quân bắt Trắng:</span>
            <span className="font-medium">{captures.white}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
            <span>Komi:</span>
            <span className="font-medium">{gameScore.komi}</span>
          </div>
          <hr className="my-3 border-gray-300" />
          <div className="flex justify-between p-2 bg-gray-800 text-white rounded-lg">
            <span className="font-bold">Điểm Đen:</span>
            <span className="font-bold">{gameScore.blackScore.toFixed(1)}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-100 rounded-lg">
            <span className="font-bold">Điểm Trắng:</span>
            <span className="font-bold">{gameScore.whiteScore.toFixed(1)}</span>
          </div>
          <div className={`text-center font-bold text-lg sm:text-xl p-3 rounded-lg ${
            gameScore.winner === 'draw'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white'
              : gameScore.winner === 'black'
              ? 'bg-gradient-to-r from-gray-800 to-black text-white'
              : 'bg-gradient-to-r from-gray-100 to-white text-black border-2 border-gray-800'
          }`}>
            {gameScore.winner === 'draw' 
              ? '🤝 HÒA!' 
              : `🎉 ${gameScore.winner === 'black' ? 'ĐEN' : 'TRẮNG'} THẮNG!`}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-md text-sm sm:text-base"
          >
            Đóng
          </button>
          <button
            onClick={onNewGame}
            className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md text-sm sm:text-base"
          >
            Ván mới
          </button>
        </div>
      </div>
    </div>
  );
});

ScoreModal.displayName = 'ScoreModal';
