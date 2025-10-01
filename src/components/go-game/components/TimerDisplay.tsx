import React, { useEffect } from 'react';
import { useTimer } from 'react-timer-hook';

interface TimerDisplayProps {
  expiryTimestamp: Date;
  onExpire: () => void;
  isActive: boolean;
  color: 'black' | 'white';
}

export const TimerDisplay = React.memo(({
  expiryTimestamp,
  onExpire,
  isActive,
  color
}: TimerDisplayProps) => {
  const {
    seconds,
    minutes,
    pause,
    resume,
  } = useTimer({
    expiryTimestamp,
    onExpire,
    autoStart: isActive
  });

  useEffect(() => {
    if (isActive) {
      resume();
    } else {
      pause();
    }
  }, [isActive, pause, resume]);

  return (
    <div className={`px-3 py-1.5 rounded-lg shadow-md font-semibold ${
      isActive 
        ? 'bg-red-600 text-white' 
        : 'bg-gray-200 text-gray-800'
    }`}>
      {color === 'black' ? '⚫' : '⚪'} {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
});

TimerDisplay.displayName = 'TimerDisplay';
