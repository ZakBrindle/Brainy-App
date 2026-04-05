import React from 'react';
import { Trophy, Castle, MapPin, User, ArrowRight, Gem, Flame } from 'lucide-react';

export default function QuestMap({ quest, currentUserId }) {
    const totalLevels = 10;
    const levels = Array.from({ length: totalLevels }, (_, i) => i);

    return (
        <div className="w-full bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
            {/* Background Path */}
            <div className="absolute top-1/2 left-8 right-32 h-4 bg-gray-200 border-2 border-black -translate-y-1/2 rounded-full hidden md:block" />
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 z-10">
                {levels.map((lvl) => {
                    const isRoundReached = quest.currentRoundIndex >= lvl;
                    const isCurrentRound = quest.currentRoundIndex === lvl;
                    const playersAtThisLevel = quest.players.filter(p => (p.currentLevel || 0) === lvl);

                    return (
                        <div key={lvl} className="relative flex flex-col items-center">
                            {/* Player Tokens */}
                            <div className="absolute -top-12 flex -space-x-4">
                                {playersAtThisLevel.map((p, i) => (
                                    <div 
                                        key={i} 
                                        title={p.name}
                                        className={`w-10 h-10 rounded-full border-4 border-black flex items-center justify-center font-black transition-all transform hover:scale-110 hover:z-20 ${p.uid === currentUserId ? 'bg-yellow-400' : 'bg-white'}`}
                                    >
                                        {p.name[0]}
                                    </div>
                                ))}
                            </div>

                            {/* Node */}
                            <div className={`
                                w-12 h-12 rounded-full border-4 border-black flex items-center justify-center transition-all duration-500
                                ${isRoundReached ? 'bg-green-400 animate-pulse' : 'bg-white shadow-[0_4px_0_rgba(0,0,0,1)]'}
                                ${isCurrentRound ? 'ring-8 ring-cyan-200 scale-125' : ''}
                            `}>
                                <span className="font-black text-xl">{lvl + 1}</span>
                            </div>

                            {isCurrentRound && (
                                <div className="absolute -bottom-8 whitespace-nowrap bg-black text-white px-2 py-1 rounded text-xs font-bold animate-bounce">
                                    Current Stage
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Final Castle */}
                <div className="relative flex flex-col items-center ml-4">
                    <div className={`
                        w-20 h-20 bg-orange-400 border-8 border-black rounded-3xl flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                        ${quest.currentRoundIndex >= 10 ? 'bg-yellow-400 animate-pulse' : 'grayscale opacity-50'}
                    `}>
                        <Castle className="w-10 h-10 text-white" />
                    </div>
                    <span className="mt-2 font-black text-xs uppercase tracking-tighter">Grand Castle</span>
                </div>
            </div>

            {/* Turn Indicator Banner */}
            <div className="mt-12 bg-blue-50 border-4 border-black rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500 border-2 border-black rounded-xl text-white">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase text-gray-500">Waiting for turn:</p>
                        <p className="text-xl font-black">{quest.players.find(p => p.uid === quest.currentTurnPlayerUid)?.name || 'Next Player'}'s Turn</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-orange-400 border-2 border-black px-4 py-2 rounded-xl text-white font-black shadow-[2px_2px_0_rgba(0,0,0,1)]">
                   <Flame className="w-5 h-5" /> ROUND {quest.currentRoundIndex + 1}
                </div>
            </div>
        </div>
    );
}
