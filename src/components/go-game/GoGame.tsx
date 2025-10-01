import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { produce } from 'immer';

// Import types và constants
import { 
  StoneType, Stone, GameMode, GameStatus, Position, 
  GameMove, Captures, GameScore, GameSettings 
} from './types';
import { DEFAULT_SETTINGS, BOARD_SIZES } from './constants';

// Import utils
import { 
  makeEmptyBoard, inBounds, tryPlay, generateStarPoints,
  getGroupAndLiberties 
} from './utils/board';
import { pickAiMove } from './utils/ai';
import { exportToSGF, importFromSGF } from './utils/sgf';

// Import components
import { StoneComponent } from './components/StoneComponent';
import { BoardCell } from './components/BoardCell';
import { TimerDisplay } from './components/TimerDisplay';
import { TutorialModal } from './components/TutorialModal';
import { ScoreModal } from './components/ScoreModal';

const GoGame: React.FC = () => {
  // State declarations
  const [animatingCaptures, setAnimatingCaptures] = useState<Position[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [board, setBoard] = useState<StoneType[][]>(() => makeEmptyBoard(settings.boardSize));
  const [currentPlayer, setCurrentPlayer] = useState<StoneType>(Stone.BLACK);
  const [captures, setCaptures] = useState<Captures>({ black: 0, white: 0 });
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [passCount, setPassCount] = useState(0);
  const [hoverPosition, setHoverPosition] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [gameScore, setGameScore] = useState<GameScore | null>(null);
  const [timerExpiry, setTimerExpiry] = useState<Date>(() => {
    const now = new Date();
    now.setSeconds(now.getSeconds() + settings.timePerMove);
    return now;
  });
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  
  const koHistoryRef = useRef<StoneType[][] | null>(null);
  const aiMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const boardHistoryRef = useRef<StoneType[][][]>([]);

  const getAIColor = useCallback((): StoneType => {
    return settings.humanColor === 'black' ? Stone.WHITE : Stone.BLACK;
  }, [settings.humanColor]);

  const initializeGame = useCallback(() => {
    const newBoard = makeEmptyBoard(settings.boardSize);
    setBoard(newBoard);
    setCurrentPlayer(Stone.BLACK);
    setCaptures({ black: 0, white: 0 });
    setMoveHistory([]);
    setGameStatus('playing');
    setPassCount(0);
    setLastMove(null);
    setShowScore(false);
    setGameScore(null);
    setAnimatingCaptures([]);
    setTimerExpiry(() => {
      const now = new Date();
      now.setSeconds(now.getSeconds() + settings.timePerMove);
      return now;
    });
    setIsTimerActive(true);
    koHistoryRef.current = null;
    boardHistoryRef.current = [];
    
    if (gameMode === 'ai' && settings.humanColor === 'white') {
      setTimeout(() => handleAIMove(), 500);
    }
  }, [settings.boardSize, settings.humanColor, settings.timePerMove, gameMode]);

  const cleanup = useCallback(() => {
    if (aiMoveTimeoutRef.current) {
      clearTimeout(aiMoveTimeoutRef.current);
      aiMoveTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const isValidMove = useCallback((position: Position): boolean => {
    const { x, y } = position;
    if (!inBounds(x, y, board.length) || board[y][x] !== Stone.EMPTY || gameStatus !== 'playing') {
      return false;
    }
    if (gameMode === 'ai' && currentPlayer === getAIColor()) {
      return false;
    }
    const result = tryPlay(board, x, y, currentPlayer, koHistoryRef.current);
    return result.legal;
  }, [board, gameStatus, currentPlayer, gameMode, getAIColor]);

  const calculateTerritory = useCallback((): { black: number; white: number } => {
    const size = board.length;
    const visited = new Set<string>();
    let blackTerritory = 0;
    let whiteTerritory = 0;

    const floodFill = (startX: number, startY: number): { owner: StoneType } => {
      if (visited.has(`${startX},${startY}`) || board[startY][startX] !== Stone.EMPTY) {
        return { owner: Stone.EMPTY };
      }

      const queue: Position[] = [{ x: startX, y: startY }];
      const territory: Position[] = [];
      const borderStones = new Set<StoneType>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.x},${current.y}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        territory.push(current);

        const neighbors = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 }
        ];

        for (const neighbor of neighbors) {
          if (!inBounds(neighbor.x, neighbor.y, size)) continue;
          
          const neighborStone = board[neighbor.y][neighbor.x];
          if (neighborStone === Stone.EMPTY && !visited.has(`${neighbor.x},${neighbor.y}`)) {
            queue.push(neighbor);
          } else if (neighborStone !== Stone.EMPTY) {
            borderStones.add(neighborStone);
          }
        }
      }

      if (borderStones.size === 1) {
        const owner = Array.from(borderStones)[0];
        if (owner === Stone.BLACK) {
          blackTerritory += territory.length;
        } else {
          whiteTerritory += territory.length;
        }
        return { owner };
      }

      return { owner: Stone.EMPTY };
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!visited.has(`${x},${y}`) && board[y][x] === Stone.EMPTY) {
          floodFill(x, y);
        }
      }
    }

    return { black: blackTerritory, white: whiteTerritory };
  }, [board]);

  const calculateScore = useCallback((): GameScore => {
    const territory = calculateTerritory();
    const blackScore = territory.black + captures.black;
    const whiteScore = territory.white + captures.white + settings.komi;
    const winner = blackScore > whiteScore ? 'black' : whiteScore > blackScore ? 'white' : 'draw';
    
    return {
      blackScore,
      whiteScore,
      blackTerritory: territory.black,
      whiteTerritory: territory.white,
      komi: settings.komi,
      winner
    };
  }, [board, captures, settings.komi, calculateTerritory]);

  const handleAIMove = useCallback(() => {
    if (gameStatus !== 'playing' || currentPlayer !== getAIColor()) return;
    
    setIsLoadingAI(true);
    aiMoveTimeoutRef.current = setTimeout(() => {
      try {
        const aiMove = pickAiMove(board, currentPlayer, settings.difficulty, koHistoryRef.current);
        setIsLoadingAI(false);
        
        if (aiMove && aiMove.x !== -1) {
          handlePlaceStone(aiMove);
        } else {
          handlePass();
        }
      } catch (error) {
        console.error('AI move error:', error);
        setIsLoadingAI(false);
        alert('Lỗi khi AI tính toán nước đi. Vui lòng thử lại.');
      }
    }, 100);
  }, [board, currentPlayer, gameStatus, settings.difficulty, getAIColor]);

  const handlePlaceStone = useCallback((position: Position) => {
    if (!isValidMove(position) && !(gameMode === 'ai' && currentPlayer === getAIColor())) return;
    
    const result = tryPlay(board, position.x, position.y, currentPlayer, koHistoryRef.current);
    if (!result.legal || !result.board) return;

    boardHistoryRef.current = [...boardHistoryRef.current, board];
    koHistoryRef.current = result.captures === 1 ? board : null;
    
    setBoard(result.board);
    setLastMove(position);
    
    if (result.captures && result.captures > 0) {
      setCaptures(prev => ({
        ...prev,
        [currentPlayer === Stone.BLACK ? 'black' : 'white']: 
          prev[currentPlayer === Stone.BLACK ? 'black' : 'white'] + result.captures!
      }));
      
      if (result.capturedPositions) {
        setAnimatingCaptures(result.capturedPositions);
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeout(() => setAnimatingCaptures([]), 600);
        });
      }
    }
    
    const newMove: GameMove = {
      player: currentPlayer,
      position,
      timestamp: Date.now(),
      captures: result.captures || 0,
      boardState: produce(result.board, draft => draft)
    };
    
    setMoveHistory(prev => [...prev, newMove]);
    const nextPlayer: StoneType = currentPlayer === Stone.BLACK ? Stone.WHITE : Stone.BLACK;
    setCurrentPlayer(nextPlayer);
    setPassCount(0);
    
    setTimerExpiry(() => {
      const now = new Date();
      now.setSeconds(now.getSeconds() + settings.timePerMove);
      return now;
    });
    
    if (gameMode === 'ai' && nextPlayer === getAIColor()) {
      handleAIMove();
    }
  }, [board, currentPlayer, gameMode, isValidMove, settings.timePerMove, getAIColor, handleAIMove]);

  const handlePass = useCallback(() => {
    const newPassCount = passCount + 1;
    setPassCount(newPassCount);
    
    const passMove: GameMove = {
      player: currentPlayer,
      position: { x: -1, y: -1 },
      timestamp: Date.now(),
      captures: 0,
      isPass: true,
      boardState: produce(board, draft => draft)
    };
    
    setMoveHistory(prev => [...prev, passMove]);
    
    if (newPassCount >= 2) {
      setGameStatus('finished');
      const finalScore = calculateScore();
      setGameScore(finalScore);
      setShowScore(true);
      setIsTimerActive(false);
    } else {
      const nextPlayer: StoneType = currentPlayer === Stone.BLACK ? Stone.WHITE : Stone.BLACK;
      setCurrentPlayer(nextPlayer);
      
      setTimerExpiry(() => {
        const now = new Date();
        now.setSeconds(now.getSeconds() + settings.timePerMove);
        return now;
      });
      
      if (gameMode === 'ai' && nextPlayer === getAIColor()) {
        handleAIMove();
      }
    }
  }, [passCount, currentPlayer, board, gameMode, calculateScore, settings.timePerMove, getAIColor, handleAIMove]);

  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0) return;
    
    const movesToUndo = gameMode === 'ai' ? 2 : 1;
    const actualMovesToUndo = Math.min(movesToUndo, moveHistory.length);
    
    const newHistory = moveHistory.slice(0, -actualMovesToUndo);
    setMoveHistory(newHistory);
    
    const previousBoard = boardHistoryRef.current[boardHistoryRef.current.length - actualMovesToUndo] || 
                         makeEmptyBoard(settings.boardSize);
    setBoard(previousBoard);
    
    setLastMove(newHistory.length > 0 && !newHistory[newHistory.length - 1].isPass ? 
                newHistory[newHistory.length - 1].position : null);
    
    let blackCaptures = 0;
    let whiteCaptures = 0;
    for (const move of newHistory) {
      if (move.player === Stone.BLACK) blackCaptures += move.captures;
      else whiteCaptures += move.captures;
    }
    setCaptures({ black: blackCaptures, white: whiteCaptures });
    
    setCurrentPlayer(newHistory.length > 0 ? 
      (newHistory[newHistory.length - 1].player === Stone.BLACK ? Stone.WHITE : Stone.BLACK) : 
      Stone.BLACK);
    
    setPassCount(newHistory.slice(-2).filter(m => m.isPass).length);
    setGameStatus('playing');
    setShowScore(false);
    koHistoryRef.current = null;
    boardHistoryRef.current = boardHistoryRef.current.slice(0, -actualMovesToUndo);
    
    setTimerExpiry(() => {
      const now = new Date();
      now.setSeconds(now.getSeconds() + settings.timePerMove);
      return now;
    });
  }, [moveHistory, gameMode, settings.boardSize, settings.timePerMove]);

  const saveGame = useCallback(() => {
    try {
      const sgf = exportToSGF(moveHistory, settings, gameScore || undefined);
      const blob = new Blob([sgf], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `go_game_${new Date().toISOString().replace(/[:.]/g, '-')}.sgf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Save game error:', error);
      alert('Lỗi khi lưu ván cờ. Vui lòng thử lại.');
    }
  }, [moveHistory, settings, gameScore]);

  const loadGame = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const gameData = importFromSGF(content);
      if (!gameData) return;
      
      try {
        setSettings(prev => ({ 
          ...prev, 
          boardSize: gameData.boardSize, 
          komi: gameData.komi 
        }));
        
        const newBoard = makeEmptyBoard(gameData.boardSize);
        let currentBoard = newBoard;
        let currentCaptures = { black: 0, white: 0 };
        let koBoard: StoneType[][] | null = null;
        const newMoveHistory: GameMove[] = [];
        
        for (const move of gameData.moves) {
          if (move.position.x === -1 && move.position.y === -1) {
            const passMove: GameMove = {
              player: move.player,
              position: move.position,
              timestamp: Date.now(),
              captures: 0,
              isPass: true,
              boardState: produce(currentBoard, draft => draft)
            };
            newMoveHistory.push(passMove);
          } else {
            const result = tryPlay(currentBoard, move.position.x, move.position.y, move.player, koBoard);
            if (!result.legal || !result.board) continue;
            
            currentBoard = result.board;
            if (result.captures && result.captures > 0) {
              currentCaptures[move.player === Stone.BLACK ? 'black' : 'white'] += result.captures;
            }
            koBoard = result.captures === 1 ? currentBoard : null;
            
            const gameMove: GameMove = {
              player: move.player,
              position: move.position,
              timestamp: Date.now(),
              captures: result.captures || 0,
              boardState: produce(currentBoard, draft => draft)
            };
            newMoveHistory.push(gameMove);
            boardHistoryRef.current.push(currentBoard);
          }
        }
        
        setBoard(currentBoard);
        setCaptures(currentCaptures);
        setMoveHistory(newMoveHistory);
        
        const lastMove = newMoveHistory[newMoveHistory.length - 1];
        setCurrentPlayer(lastMove ? 
          (lastMove.player === Stone.BLACK ? Stone.WHITE : Stone.BLACK) : 
          Stone.BLACK);
        setLastMove(lastMove && !lastMove.isPass ? lastMove.position : null);
        setPassCount(newMoveHistory.slice(-2).filter(m => m.isPass).length);
        setGameStatus('playing');
        setShowScore(false);
        koHistoryRef.current = koBoard;
        
        event.target.value = '';
      } catch (error) {
        console.error('Load game error:', error);
        alert('Lỗi khi tải ván cờ. Vui lòng kiểm tra định dạng SGF.');
      }
    };
    
    reader.onerror = () => alert('Lỗi khi đọc file. Vui lòng thử lại.');
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    initializeGame();
    return cleanup;
  }, [initializeGame, cleanup]);

  useEffect(() => {
    if (gameMode === 'ai' && currentPlayer === getAIColor() && gameStatus === 'playing') {
      handleAIMove();
    }
  }, [gameMode, currentPlayer, gameStatus, getAIColor, handleAIMove]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') handlePass();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 't' || e.key === 'T') setShowTutorial(true);
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePass, handleUndo]);

  const renderBoard = useMemo(() => {
    const size = settings.boardSize;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const maxDisplaySize = Math.min(
      windowWidth - 40, 
      size <= 9 ? 400 : size <= 13 ? 500 : 600
    );
    const cellSize = maxDisplaySize / (size - 1);
    const padding = cellSize / 2;
    const starPoints = generateStarPoints(size);

    return (
      <div
        className="relative rounded-xl shadow-2xl mx-auto transform transition-transform duration-300 hover:scale-[1.01]"
        style={{
          width: maxDisplaySize + padding * 2,
          height: maxDisplaySize + padding * 2,
          background: 'linear-gradient(135deg, #d2b48c 0%, #e6c088 50%, #d2b48c 100%)',
          padding,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: maxDisplaySize + padding * 2, height: maxDisplaySize + padding * 2 }}
        >
          {Array.from({ length: size }).map((_, index) => (
            <line
              key={`h-${index}`}
              x1={padding}
              y1={padding + index * cellSize}
              x2={padding + maxDisplaySize}
              y2={padding + index * cellSize}
              stroke="#5c4033"
              strokeWidth="1.5"
              opacity="0.9"
            />
          ))}
          {Array.from({ length: size }).map((_, index) => (
            <line
              key={`v-${index}`}
              x1={padding + index * cellSize}
              y1={padding}
              x2={padding + index * cellSize}
              y2={padding + maxDisplaySize}
              stroke="#5c4033"
              strokeWidth="1.5"
              opacity="0.9"
            />
          ))}
          {starPoints.map((point, index) => (
            <circle
              key={`star-${index}`}
              cx={padding + point.x * cellSize}
              cy={padding + point.y * cellSize}
              r={size >= 19 ? 4 : size >= 13 ? 3 : 2.5}
              fill="#5c4033"
            />
          ))}
        </svg>
        
        {board.map((row, y) =>
          row.map((stone, x) => {
            const isLastMovePosition = lastMove?.x === x && lastMove?.y === y;
            const isAnimating = animatingCaptures.some(pos => pos.x === x && pos.y === y);
            const isHovered = hoverPosition?.x === x && hoverPosition?.y === y;
            
            return (
              <BoardCell
                key={`cell-${x}-${y}`}
                position={{ x, y }}
                stone={stone}
                cellSize={cellSize}
                isValidMove={isValidMove({ x, y })}
                isLastMove={isLastMovePosition}
                onHover={setHoverPosition}
                onClick={handlePlaceStone}
                isAnimating={isAnimating}
                showTooltip={isHovered}
              />
            );
          })
        )}
        
        {isLoadingAI && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-xl">
            <div className="bg-white px-4 py-2 rounded-lg shadow-lg animate-pulse flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-gray-800">AI đang tính toán...</span>
            </div>
          </div>
        )}
      </div>
    );
  }, [
    board, settings.boardSize, hoverPosition, lastMove,
    isValidMove, handlePlaceStone, isLoadingAI, animatingCaptures
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 py-4 sm:py-8 px-2 sm:px-6">
      <style>
        {`
          @keyframes place-stone {
            0% { transform: scale(0.5); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-place-stone {
            animation: place-stone 0.3s ease-out;
          }
          .shadow-stone-black {
            box-shadow: 2px 2px 6px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.2);
          }
          .shadow-stone-white {
            box-shadow: 2px 2px 6px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.1);
          }
        `}
      </style>
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-6 rounded-t-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">⚫⚪ Cờ Vây Pro</h1>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <span className="flex items-center gap-2">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-300 ${
                  currentPlayer === Stone.BLACK
                    ? 'bg-gradient-to-br from-gray-800 to-black shadow-stone-black'
                    : 'bg-gradient-to-br from-white to-gray-200 shadow-stone-white'
                }`} />
                <span className="text-sm sm:text-lg font-medium">
                  Lượt: {currentPlayer === Stone.BLACK ? 'Đen' : 'Trắng'}
                </span>
              </span>
              <button
                onClick={() => setShowTutorial(true)}
                className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors duration-200 shadow-md"
                aria-label="Hướng dẫn"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="bg-white rounded-b-2xl shadow-xl p-4 sm:p-8">
          {/* Game Mode Selection */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
            <button
              onClick={() => setGameMode('local')}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 shadow-md ${
                gameMode === 'local'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white transform scale-105'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              👥 Chơi 2 người
            </button>
            <button
              onClick={() => setGameMode('ai')}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 shadow-md ${
                gameMode === 'ai'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white transform scale-105'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              🤖 Chơi với AI
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-8">
            {/* Sidebar */}
            <div className="lg:w-80 space-y-4 sm:space-y-6 order-2 lg:order-1">
              {/* Game Info */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 rounded-xl border border-gray-200 shadow-lg">
                <h3 className="font-bold text-base sm:text-lg mb-3 text-gray-800">📊 Thông tin ván cờ</h3>
                <div className="space-y-2 text-sm sm:text-base">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quân bắt được:</span>
                    <span className="font-medium">⚫ {captures.black} | ⚪ {captures.white}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Komi:</span>
                    <span className="font-medium">{settings.komi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Số nước:</span>
                    <span className="font-medium">{moveHistory.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pass liên tiếp:</span>
                    <span className="font-medium">{passCount}/2</span>
                  </div>
                  <TimerDisplay
                    expiryTimestamp={timerExpiry}
                    onExpire={() => {
                      handlePass();
                      alert(`${currentPlayer === Stone.BLACK ? 'Đen' : 'Trắng'} hết thời gian và pass.`);
                    }}
                    isActive={isTimerActive && gameStatus === 'playing'}
                    color={currentPlayer === Stone.BLACK ? 'black' : 'white'}
                  />
                </div>
              </div>
              
              {/* Settings */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200 shadow-lg">
                <h3 className="font-bold text-base sm:text-lg mb-3 text-gray-800">⚙️ Cài đặt</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm sm:text-base font-medium mb-1 text-gray-700">
                      Kích thước bàn cờ:
                    </label>
                    <select
                      value={settings.boardSize}
                      onChange={(e) => setSettings(prev => ({ ...prev, boardSize: Number(e.target.value) }))}
                      className="w-full p-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      {BOARD_SIZES.map(size => (
                        <option key={size} value={size}>{size}x{size}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm sm:text-base font-medium mb-1 text-gray-700">
                      Thời gian mỗi nước (giây):
                    </label>
                    <input
                      type="number"
                      value={settings.timePerMove}
                      onChange={(e) => setSettings(prev => ({ ...prev, timePerMove: Number(e.target.value) }))}
                      min="10"
                      max="300"
                      className="w-full p-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  
                  {gameMode === 'ai' && (
                    <>
                      <div>
                        <label className="block text-sm sm:text-base font-medium mb-1 text-gray-700">
                          Bạn chơi quân:
                        </label>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSettings(prev => ({ ...prev, humanColor: 'black' }))}
                            className={`flex-1 py-2 px-3 text-sm sm:text-base rounded-lg font-medium transition-all duration-200 ${
                              settings.humanColor === 'black'
                                ? 'bg-gradient-to-r from-gray-800 to-black text-white shadow-md'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                            }`}
                          >
                            ⚫ Đen
                          </button>
                          <button
                            onClick={() => setSettings(prev => ({ ...prev, humanColor: 'white' }))}
                            className={`flex-1 py-2 px-3 text-sm sm:text-base rounded-lg font-medium transition-all duration-200 ${
                              settings.humanColor === 'white'
                                ? 'bg-gradient-to-r from-gray-100 to-white text-black border-2 border-gray-800 shadow-md'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                            }`}
                          >
                            ⚪ Trắng
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm sm:text-base font-medium mb-1 text-gray-700">
                          Độ khó AI:
                        </label>
                        <select
                          value={settings.difficulty}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            difficulty: e.target.value as 'easy' | 'medium' | 'hard' 
                          }))}
                          className="w-full p-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                          <option value="easy">🟢 Dễ</option>
                          <option value="medium">🟡 Trung bình</option>
                          <option value="hard">🔴 Khó (MCTS)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Save/Load */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 sm:p-6 rounded-xl border border-purple-200 shadow-lg">
                <h3 className="font-bold text-base sm:text-lg mb-3 text-gray-800">💾 Lưu/Tải</h3>
                <div className="space-y-3">
                  <button
                    onClick={saveGame}
                    className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm sm:text-base rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-md transform hover:scale-105"
                  >
                    💾 Lưu ván cờ (SGF)
                  </button>
                  <label className="block">
                    <span className="sr-only">Tải ván cờ</span>
                    <input
                      type="file"
                      accept=".sgf"
                      onChange={loadGame}
                      className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 transition-all"
                    />
                  </label>
                </div>
              </div>
            </div>
            
            {/* Board Area */}
            <div className="flex-1 order-1 lg:order-2">
              <div className="flex justify-center mb-4 sm:mb-6">
                {renderBoard}
              </div>
              
              {/* Control Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                <button
                  onClick={handlePass}
                  disabled={gameStatus !== 'playing'}
                  className="px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-300 disabled:to-gray-400 shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  Pass (P)
                </button>
                <button
                  onClick={handleUndo}
                  disabled={moveHistory.length === 0}
                  className="px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  ↶ Hoàn tác
                </button>
                <button
                  onClick={initializeGame}
                  className="px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  🔄 Chơi lại
                </button>
                <button
                  onClick={() => {
                    const score = calculateScore();
                    setGameScore(score);
                    setShowScore(true);
                    setIsTimerActive(false);
                  }}
                  className="px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 shadow-md transition-all duration-200 transform hover:scale-105"
                >
                  📊 Tính điểm
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Modals */}
        <TutorialModal
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
        />
        
        <ScoreModal
          isOpen={showScore}
          gameScore={gameScore}
          captures={captures}
          onClose={() => setShowScore(false)}
          onNewGame={() => {
            setShowScore(false);
            initializeGame();
          }}
        />
      </div>
    </div>
  );
};

export default GoGame;
