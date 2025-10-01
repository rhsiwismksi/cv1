import React, { useState } from 'react';
import { TUTORIAL_MESSAGES } from '../constants';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal = React.memo(({ isOpen, onClose }: TutorialModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = Object.entries(TUTORIAL_MESSAGES).map(([key, { text, tip }]) => ({
    key: key.charAt(0).toUpperCase() + key.slice(1),
    text,
    tip,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-white to-gray-100 p-6 rounded-xl shadow-2xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Hướng dẫn chơi cờ vây</h2>
        <h3 className="text-xl font-semibold mb-2 text-gray-700">{steps[currentStep].key}</h3>
        <p className="text-gray-600 mb-4">{steps[currentStep].text}</p>
        <p className="text-gray-500 mb-4">
          <strong>Mẹo:</strong> {steps[currentStep].tip}
        </p>
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              currentStep === 0 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Trước
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep === steps.length - 1}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              currentStep === steps.length - 1 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Tiếp
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
});

TutorialModal.displayName = 'TutorialModal';
