import React from 'react';
import { auth } from '../lib/firebase';
import { User, LogOut, ArrowLeft, Trophy, Flame, BrainCircuit, GraduationCap } from 'lucide-react';

export default function Account({ user, userRole, profile, onBack }) {
  // Rank logic
  const calculateRank = (xp) => {
    if (xp >= 1000) return '🧠 Galaxy Brain';
    if (xp >= 500) return '⭐ Super Star';
    if (xp >= 200) return '🚀 Space Cadet';
    return '🌱 Beginner';
  };

  const currentRank = calculateRank(profile?.xp || 0);
  
  const hasChild = profile?.friends?.some(f => f.type === 'child');
  const displayRole = userRole === 'admin' ? 'Admin' : (userRole === 'parent' && !hasChild ? 'Basic' : userRole);

  return (
    <div className="absolute inset-0 bg-blue-500 overflow-y-auto p-4 md:p-8 z-50">
      <button 
        onClick={onBack}
        className="bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white border-8 border-black rounded-[3rem] p-8 pb-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative mt-16">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                {user?.photoURL ? (
                    <img 
                        src={user.photoURL} 
                        alt="Profile" 
                        className="w-32 h-32 rounded-full border-8 border-black object-cover bg-white"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-32 h-32 rounded-full border-8 border-black bg-cyan-400 flex items-center justify-center">
                        <User className="w-16 h-16 text-white" />
                    </div>
                )}
            </div>

            <div className="mt-16 mb-4">
                <h2 className="text-4xl font-black">{profile?.displayName || 'Brainiac'}</h2>
                {user?.email && (
                    <p className="font-bold text-slate-500 mt-1">{user.email}</p>
                )}
            </div>
            
            <div className="inline-block bg-purple-100 border-4 border-black px-4 py-1 rounded-full font-black text-purple-700 capitalize mb-8">
                {displayRole} Account
            </div>

            <div className="space-y-4 text-left font-bold">
                <div className="bg-yellow-100 border-4 border-black p-4 rounded-2xl flex items-center justify-between">
                    <span className="flex items-center gap-2"><Trophy className="text-yellow-600" /> Total XP</span>
                    <span className="text-2xl font-black">{profile?.xp || 0}</span>
                </div>
                <div className="bg-orange-100 border-4 border-black p-4 rounded-2xl flex items-center justify-between">
                    <span className="flex items-center gap-2"><Flame className="text-orange-600" /> Day Streak</span>
                    <span className="text-2xl font-black">{profile?.streakCount || 1}</span>
                </div>
                <div className="bg-pink-100 border-4 border-black p-4 rounded-2xl flex items-center justify-between">
                    <span className="flex items-center gap-2"><BrainCircuit className="text-pink-600" /> Current Rank</span>
                    <span className="text-lg font-black">{currentRank}</span>
                </div>
            </div>

            <div className="mt-8 text-left">
                <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                    <GraduationCap className="w-8 h-8 text-blue-600" /> Your Masteries
                </h3>
                {profile?.masteryList && profile.masteryList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {profile.masteryList.map((m, i) => (
                            <span key={i} className="bg-blue-100 border-4 border-black rounded-full px-4 py-2 font-black text-blue-800 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                {m}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-100 border-4 border-black border-dashed rounded-3xl p-6 text-center font-bold text-gray-500">
                        Try a Mastery Challenge to earn badges!
                    </div>
                )}
            </div>
        </div>

        <button 
            onClick={() => auth.signOut()}
            className="w-full bg-red-400 hover:bg-red-300 border-4 border-black rounded-3xl p-6 flex items-center justify-center gap-3 text-3xl font-black text-white shadow-[0px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] transition-all"
        >
            <LogOut className="w-8 h-8" /> Sign Out
        </button>
      </div>
    </div>
  );
}
