import React from 'react';
import { Position, StoneType, Stone } from '../types';
import { StoneComponent } from './StoneComponent';

interface BoardCellProps {
  position: Position;
  stone: StoneType;
  cellSize: number;
  isValidMove: boolean;
  isLastMove: boolean;
  onHover: (position: Position | null) => void;
  onClick: (position: Position) => void;
  isAnimating: boolean;
  showTooltip?: boolean;
}

export const BoardCell = React.memo(({
  position,
  stone,
  cellSize,
  isValidMove,
  isLastMove,
  onHover,
  onClick,
  isAnimating,
  showTooltip = false
}: BoardCellProps) => {
  const handleMouseEnter = () => onHover(position);
  const handleMouseLeave = () => onHover(null);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick(position);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x * cellSize,
        top: position.y * cellSize,
        width: cellSize,
        height: cellSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isValidMove ? 'pointer' : 'default',
        zIndex: 10
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => isValidMove && onClick(position)}
      onKeyDown={handleKeyDown}
      role="gridcell"
      aria-label={`Vị trí ${position.x},${position.y}, ${
        stone === Stone.BLACK ? 'Quân đen' : stone === Stone.WHITE ? 'Quân trắng' : 'Trống'
      }${isLastMove ? ', nước đi cuối' : ''}`}
      tabIndex={isValidMove ? 0 : -1}
    >
      {stone !== Stone.EMPTY && (
        <StoneComponent
          stone={stone}
          size="medium"
          isLastMove={isLastMove}
          isAnimating={isAnimating}
        />
      )}
      {isValidMove && showTooltip && stone === Stone.EMPTY && (
        <div className="absolute w-full h-full rounded-full bg-current opacity-20 pointer-events-none" />
      )}
    </div>
  );
});

BoardCell.displayName = 'BoardCell';
