import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Play, Settings, Users, BrainCircuit, Trophy, Flame, Gem, Swords, Map as MapIcon, ShoppingBag } from 'lucide-react';
import StreakPopup from './StreakPopup';

export default function Dashboard({ user, userRole, profile, onNavigate }) {
  const [streakData, setStreakData] = useState({ count: 1, showPopup: false });

  useEffect(() => {
    checkStreak();
  }, [user]);

  const checkStreak = async () => {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const today = new Date().toISOString().slice(0, 10);
      const lastLogin = data.lastLogin || '';
      let newCount = data.streakCount || 1;
      let sessionCount = data.totalSessions || 0;
      let showPopup = false;
      let needsUpdate = false;

      if (!sessionStorage.getItem('sessionTracked')) {
          sessionCount += 1;
          sessionStorage.setItem('sessionTracked', 'true');
          needsUpdate = true;
      }

      if (lastLogin !== today) {
        showPopup = true;
        needsUpdate = true;
        // Check if last login was yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        if (lastLogin === yesterdayStr) {
          newCount += 1;
        } else {
          newCount = 1; // reset streak
        }
      }

      if (needsUpdate) {
        await updateDoc(userRef, {
          lastLogin: today,
          streakCount: newCount,
          totalSessions: sessionCount
        });
      }
      
      setStreakData({ count: newCount, showPopup });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-500 max-w-lg mx-auto px-4 relative">
      {streakData.showPopup && (
        <StreakPopup streakCount={streakData.count} onClose={() => setStreakData(prev => ({...prev, showPopup: false}))} />
      )}

      {/* Main Stats Card */}
      <div className="w-full bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center relative mt-16">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-blue-500 border-4 border-black p-4 rounded-full">
          <BrainCircuit className="w-12 h-12 text-white animate-pulse" />
        </div>
        
        <h2 className="text-4xl font-black mt-4 mb-2">Hello, {profile?.displayName || 'Brainiac'}!</h2>
        <button 
          onClick={() => onNavigate('account')}
          className="inline-block bg-purple-100 hover:bg-purple-200 border-4 border-black px-6 py-2 rounded-full font-black text-purple-700 capitalize mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] transition-all"
        >
          {userRole === 'admin' ? 'Admin' : userRole} Account
        </button>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-100 border-4 border-black rounded-2xl p-4 flex flex-col items-center justify-center">
            <Flame className="w-8 h-8 text-orange-500 mb-2" />
            <span className="text-3xl font-black text-black">{streakData.count}</span>
            <span className="font-bold text-gray-500 text-sm">Day Streak</span>
          </div>
          
          <div className="bg-yellow-100 border-4 border-black rounded-2xl p-4 flex flex-col items-center justify-center">
            <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
            <span className="text-3xl font-black text-black">{profile?.xp || 0}</span>
            <span className="font-bold text-gray-500 text-sm">Total XP</span>
          </div>
        </div>

      </div>

      <div className="w-full space-y-4">
        <button 
          onClick={() => onNavigate('quiz')}
          className="w-full bg-green-400 hover:bg-green-300 border-4 border-black rounded-3xl p-6 flex items-center justify-center gap-4 text-3xl font-black text-black transition-transform active:translate-y-[4px] shadow-[0px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
        >
          <Play className="w-10 h-10 fill-current" /> Play Quiz
        </button>

        <button 
          onClick={() => onNavigate('questLobby')}
          className="w-full bg-purple-400 hover:bg-purple-300 border-4 border-black rounded-3xl p-6 flex items-center justify-center gap-4 text-3xl font-black text-black transition-transform active:translate-y-[4px] shadow-[0px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
        >
          <Swords className="w-10 h-10 fill-current" /> Epic Quest
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => onNavigate('shop')}
            className="bg-yellow-400 hover:bg-yellow-300 border-4 border-black rounded-3xl p-4 flex items-center justify-center gap-2 text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <ShoppingBag className="w-6 h-6" /> Shop
          </button>

          <button 
            onClick={() => onNavigate('friends')}
            className="bg-cyan-400 hover:bg-cyan-300 border-4 border-black rounded-3xl p-4 flex items-center justify-center gap-2 text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <Users className="w-6 h-6" /> Friends
          </button>
        </div>

        <button 
          onClick={() => onNavigate('settings')}
          className="w-full bg-pink-400 hover:bg-pink-300 border-4 border-black rounded-3xl p-4 flex items-center justify-center gap-2 text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none opacity-80"
        >
          <Settings className="w-6 h-6" /> Settings
        </button>
      </div>
    </div>
  );
}
