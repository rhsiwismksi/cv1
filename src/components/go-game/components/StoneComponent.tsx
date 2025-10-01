import React from 'react';
import { StoneType, Stone } from '../types';

interface StoneComponentProps {
  stone: StoneType;
  size: 'small' | 'medium' | 'large';
  isLastMove: boolean;
  isAnimating: boolean;
}

export const StoneComponent = React.memo(({ 
  stone, 
  size, 
  isLastMove, 
  isAnimating 
}: StoneComponentProps) => {
  const sizeClasses = {
    small: 'w-3 h-3 xs:w-2.5 xs:h-2.5 sm:w-4 sm:h-4',
    medium: 'w-5 h-5 xs:w-4 xs:h-4 sm:w-7 sm:h-7',
    large: 'w-8 h-8 xs:w-6 xs:h-6 sm:w-10 sm:h-10'
  };

  if (stone === Stone.EMPTY) return null;

  return (
    <div
      className={`
        rounded-full transition-all duration-300 relative 
        ${sizeClasses[size]} 
        ${stone === Stone.BLACK 
          ? 'bg-gradient-to-br from-gray-700 via-gray-800 to-black shadow-stone-black' 
          : 'bg-gradient-to-br from-gray-100 via-white to-gray-200 shadow-stone-white'} 
        ${isLastMove ? 'ring-2 ring-red-500 ring-opacity-60 animate-pulse' : ''} 
        ${isAnimating ? 'animate-place-stone scale-110' : ''}
      `}
      style={{
        boxShadow: stone === Stone.BLACK
          ? '2px 2px 4px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.1)'
          : '2px 2px 4px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.1)'
      }}
    >
      <div
        className={`absolute top-0.5 left-0.5 xs:top-0.5 xs:left-0.5 sm:top-1 sm:left-1 
          w-1.5 h-1.5 xs:w-1 xs:h-1 sm:w-2 sm:h-2 rounded-full ${
          stone === Stone.BLACK ? 'bg-gray-600 opacity-30' : 'bg-white opacity-60'
        }`}
      />
    </div>
  );
});

StoneComponent.displayName = 'StoneComponent';
