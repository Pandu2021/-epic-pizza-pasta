import React from 'react';

interface Props {
  ratio: number; // 0..1
  startLabel?: string;
  endLabel?: string;
  className?: string;
}

export const PizzaCarProgress: React.FC<Props> = ({ ratio, startLabel = 'Restaurant', endLabel = 'Destination', className }) => {
  const pct = Math.min(Math.max(ratio, 0), 1) * 100;
  const step = Math.round(pct);
  const widthClass = `pcp-w-${step}`;
  const translateClass = `pcp-t-${step}`;
  return (
    <div className={"w-full max-w-xl mx-auto select-none " + (className || '')} data-step={step}>
      <div className="h-3 bg-gray-200 rounded relative overflow-hidden pcp-bar">
        <div className={"h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500 " + widthClass} />
        <div className={"absolute -top-3 left-0 transition-transform duration-500 ease-out " + translateClass}>
          <span role="img" aria-label="pizza-car" className="text-xl">🚗🍕</span>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1"><span>{startLabel}</span><span>{endLabel}</span></div>
    </div>
  );
};

export default PizzaCarProgress;