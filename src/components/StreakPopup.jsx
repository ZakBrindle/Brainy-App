import React, { useEffect, useState } from 'react';
import { Flame, X } from 'lucide-react';

export default function StreakPopup({ streakCount, onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Small delay for dramatic effect
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-white border-8 border-black rounded-[3rem] p-8 max-w-sm w-full text-center shadow-[16px_16px_0px_0px_rgba(255,165,0,1)] transform transition-transform duration-700 delay-300 ${show ? 'scale-100 translate-y-0' : 'scale-50 translate-y-full'}`}>
        
        <div className="relative inline-block mb-6">
          <Flame className="w-32 h-32 text-orange-500 fill-current animate-bounce" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,1)] mt-8">{streakCount}</span>
          </div>
        </div>

        <h2 className="text-4xl font-black text-black mb-2 uppercase italic tracking-wider">
          Daily Streak!
        </h2>
        
        <p className="text-xl font-bold text-gray-600 mb-8">
          You've played {streakCount} {streakCount === 1 ? 'day' : 'days'} in a row! Keep the fire burning! 🔥
        </p>

        <button 
          onClick={onClose}
          className="w-full bg-orange-400 hover:bg-orange-300 border-4 border-black p-4 rounded-2xl font-black text-white text-2xl active:translate-y-[4px] shadow-[0px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
        >
          Let's Go!
        </button>
      </div>
    </div>
  );
}
