import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { Play, Settings, Users, BrainCircuit, Trophy, Flame, Gem, Swords, Map as MapIcon, ShoppingBag, Sparkles } from 'lucide-react';
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

  const [activeFriendQuests, setActiveFriendQuests] = useState([]);
  const [hiddenQuests, setHiddenQuests] = useState([]);

  useEffect(() => {
     const friendUids = profile?.friends?.map(f => f.uid) || [];
     if (profile?.parentUid) friendUids.push(profile.parentUid);
     
     if (friendUids.length === 0) return;
     
     const q = query(collection(db, 'quests'), where('status', '==', 'lobby'));
     const unsub = onSnapshot(q, (snap) => {
         const quests = [];
         snap.forEach(docSnap => {
             const d = docSnap.data();
             if (friendUids.includes(d.hostUid) && d.hostUid !== user.uid) {
                 const joined = d.players.some(p => p.uid === user.uid);
                 if (!joined) quests.push(d);
             }
         });
         setActiveFriendQuests(quests);
     });
     return () => unsub();
  }, [profile?.friends, profile?.parentUid, user.uid]);

  const hasChild = profile?.friends?.some(f => f.type === 'child');
  const displayRole = userRole === 'admin' ? 'Admin' : (userRole === 'parent' && !hasChild ? 'Basic' : userRole);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-500 max-w-lg mx-auto px-4 relative">
      {streakData.showPopup && (
        <StreakPopup streakCount={streakData.count} onClose={() => setStreakData(prev => ({...prev, showPopup: false}))} />
      )}

      {/* Friend Quest Banners */}
      {activeFriendQuests.filter(q => !hiddenQuests.includes(q.id)).map(q => (
          <div key={q.id} className="w-full bg-orange-200 border-4 border-black p-4 rounded-3xl flex justify-between items-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-bounce mt-8 relative z-50">
              <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-orange-600 fill-current" />
                  <div>
                      <div className="font-black text-xl text-black">{q.hostName} is waiting in Lobby!</div>
                      <div className="font-bold text-gray-700">Quick Join their Party!</div>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button 
                      onClick={() => setHiddenQuests(prev => [...prev, q.id])}
                      className="bg-white border-2 border-black p-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold active:translate-y-[2px]"
                  >
                      Dismiss
                  </button>
                  <button 
                      onClick={() => {
                          sessionStorage.setItem('pendingJoin', q.id);
                          onNavigate('questLobby');
                      }}
                      className="bg-green-400 border-2 border-black px-4 py-2 rounded-xl font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none hover:bg-green-300"
                  >
                      Join
                  </button>
              </div>
          </div>
      ))}

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
          {displayRole} Account
        </button>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-orange-100 border-4 border-black rounded-2xl p-4 flex flex-col items-center justify-center relative cursor-pointer active:scale-95 transition-transform" onClick={() => setStreakData({ ...streakData, showPopup: true })}>
            <Flame className="w-8 h-8 text-orange-500 mb-2" />
            <span className="text-2xl font-black text-black">{streakData.count}</span>
            <span className="font-bold text-gray-500 text-xs text-center leading-tight mt-1">Day<br/>Streak</span>
          </div>
          
          <div className="bg-yellow-100 border-4 border-black rounded-2xl p-4 flex flex-col items-center justify-center">
            <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
            <span className="text-2xl font-black text-black">{profile?.xp || 0}</span>
            <span className="font-bold text-gray-500 text-xs text-center leading-tight mt-1">Total<br/>XP</span>
          </div>

          <div 
            className="bg-blue-100 border-4 border-black rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] cursor-pointer transition-all"
            onClick={() => setStreakData({ ...streakData, showBreakdown: true })}
          >
            <Flame className="w-8 h-8 text-blue-500 mb-2 drop-shadow-[0_2px_0_rgba(255,255,255,1)]" />
            <span className="text-2xl font-black text-blue-700">{profile?.maxQuizStreak || 0}</span>
            <span className="font-bold text-gray-500 text-xs text-center leading-tight mt-1">100%<br/>Streak</span>
          </div>
        </div>

        {streakData.showBreakdown && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 w-full max-w-sm shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300 relative">
                    <button 
                        onClick={() => setStreakData({ ...streakData, showBreakdown: false })}
                        className="absolute -top-4 -right-4 bg-red-400 border-4 border-black w-12 h-12 rounded-full font-black text-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none"
                    >
                        X
                    </button>
                    <h3 className="text-3xl font-black text-center mb-6 text-blue-600">Quiz Streaks!</h3>
                    <p className="font-bold text-gray-500 text-center mb-6">Your highest completely perfect scores in a row.</p>
                    
                    <div className="space-y-4">
                        <div className="bg-green-100 border-4 border-black rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Flame className="w-8 h-8 text-green-500" />
                                <span className="font-black text-xl">Easy</span>
                            </div>
                            <span className="text-3xl font-black text-green-700">{profile?.maxEasyStreak || 0}</span>
                        </div>
                        <div className="bg-orange-100 border-4 border-black rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Flame className="w-8 h-8 text-orange-500" />
                                <span className="font-black text-xl">Medium</span>
                            </div>
                            <span className="text-3xl font-black text-orange-700">{profile?.maxMediumStreak || 0}</span>
                        </div>
                        <div className="bg-red-100 border-4 border-black rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Flame className="w-8 h-8 text-red-500" />
                                <span className="font-black text-xl">Hard</span>
                            </div>
                            <span className="text-3xl font-black text-red-700">{profile?.maxHardStreak || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

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

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <button 
            onClick={() => onNavigate('shop')}
            className="bg-yellow-400 hover:bg-yellow-300 border-4 border-black rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-sm sm:text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <ShoppingBag className="w-6 h-6" /> Shop
          </button>

          <button 
            onClick={() => onNavigate('leaderboard')}
            className="bg-blue-400 hover:bg-blue-300 border-4 border-black rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-sm sm:text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
          >
            <Trophy className="w-6 h-6" /> Ranks
          </button>

          <button 
            onClick={() => onNavigate('friends')}
            className="bg-cyan-400 hover:bg-cyan-300 border-4 border-black rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-sm sm:text-xl font-black transition-transform active:translate-y-[4px] shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
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
