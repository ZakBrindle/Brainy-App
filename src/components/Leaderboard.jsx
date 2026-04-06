import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Trophy, ArrowLeft, Users, Globe, Flame, Castle, AlertCircle } from 'lucide-react';

export default function Leaderboard({ user, profile, onBack }) {
    const [filter, setFilter] = useState('Everyone'); // 'Everyone' | 'Friends'
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            // Load top 100 users by XP
            const q = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(100));
            const snap = await getDocs(q);
            const allUsers = [];
            snap.forEach(doc => {
                allUsers.push({ id: doc.id, ...doc.data() });
            });
            setUsers(allUsers);
        } catch (e) {
            console.error("Error loading leaderboard:", e);
        } finally {
            setLoading(false);
        }
    };

    const friendUids = profile?.friends?.map(f => f.uid) || [];
    if (profile?.parentUid) friendUids.push(profile.parentUid);
    
    // Always include current user in their own friends leaderboard view
    const friendSet = new Set([...friendUids, user.uid]);

    const displayUsers = filter === 'Friends' 
        ? users.filter(u => friendSet.has(u.id))
        : users;

    return (
        <div className="absolute inset-0 bg-blue-500 overflow-y-auto p-4 md:p-8 z-50">
            <button 
                onClick={onBack}
                className="bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2"
            >
                <ArrowLeft className="w-5 h-5" /> Back
            </button>

            <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative overflow-hidden">
                    <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-5xl font-black text-black">Leaderboard</h2>
                    <p className="font-bold text-gray-500 mt-2">Who is the smartest Brainiac?</p>
                </div>

                <div className="flex bg-white/30 backdrop-blur-md p-2 rounded-3xl border-4 border-black font-black text-xl mb-6">
                    <button 
                        onClick={() => setFilter('Friends')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${filter === 'Friends' ? 'bg-cyan-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'text-white hover:bg-white/20'}`}
                    >
                        <Users className="w-6 h-6" /> Friends Only
                    </button>
                    <button 
                        onClick={() => setFilter('Everyone')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${filter === 'Everyone' ? 'bg-yellow-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'text-white hover:bg-white/20'}`}
                    >
                        <Globe className="w-6 h-6" /> Everyone
                    </button>
                </div>

                {loading ? (
                    <div className="text-center text-white font-black text-2xl animate-pulse">Loading rankings...</div>
                ) : (
                    <div className="space-y-4 pb-20">
                        {displayUsers.length === 0 ? (
                            <div className="bg-white border-4 border-black rounded-3xl p-8 text-center text-xl font-bold text-gray-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 justify-center">
                                <AlertCircle className="w-6 h-6" /> No players to show yet!
                            </div>
                        ) : (
                            displayUsers.map((u, index) => {
                                const isMe = u.id === user.uid;
                                return (
                                    <div key={u.id} className={`border-4 border-black rounded-3xl p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 transition-transform hover:scale-105 ${isMe ? 'bg-yellow-100 border-8' : 'bg-white'} shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`}>
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="text-4xl font-black text-gray-400 min-w-[2.5rem] text-center">
                                                {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                            </div>
                                            <div className="w-16 h-16 bg-blue-100 border-4 border-black rounded-full flex items-center justify-center font-black text-2xl text-blue-800 shrink-0">
                                                {u.displayName ? u.displayName[0].toUpperCase() : '?'}
                                            </div>
                                            <div className="flex-1 md:hidden">
                                                <div className="font-black text-2xl">{u.displayName || 'Anonymous'} {isMe && '(You)'}</div>
                                                <div className="font-bold text-yellow-600 flex items-center gap-1"><Trophy className="w-4 h-4"/> {u.xp || 0} XP</div>
                                            </div>
                                        </div>

                                        <div className="hidden md:flex flex-col flex-1 pb-1">
                                            <div className="font-black text-3xl">{u.displayName || 'Anonymous'} {isMe && '(You)'}</div>
                                            <div className="font-bold text-yellow-600 flex items-center gap-1"><Trophy className="w-5 h-5"/> {u.xp || 0} XP</div>
                                        </div>

                                        {/* Badges container */}
                                        <div className="grid grid-cols-3 gap-2 w-full md:w-auto mt-2 md:mt-0">
                                            <div className="bg-orange-100 border-2 border-black rounded-xl p-2 flex flex-col items-center justify-center relative group" title="Max Day Streak">
                                                <Flame className="w-6 h-6 text-orange-500 mb-1" />
                                                <span className="font-black text-black">{u.maxStreakCount || u.streakCount || 0}</span>
                                                <div className="absolute -top-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">Day Streak</div>
                                            </div>
                                            <div className="bg-blue-100 border-2 border-black rounded-xl p-2 flex flex-col items-center justify-center relative group" title="Max 100% Quiz Streak">
                                                <Flame className="w-6 h-6 text-blue-500 mb-1" />
                                                <span className="font-black text-black">{u.maxQuizStreak || 0}</span>
                                                <div className="absolute -top-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">Quiz Streak</div>
                                            </div>
                                            <div className="bg-purple-100 border-2 border-black rounded-xl p-2 flex flex-col items-center justify-center relative group" title="Quest Champion Count">
                                                <Castle className="w-6 h-6 text-purple-500 mb-1" />
                                                <span className="font-black text-black">{u.questChampionCount || 0}</span>
                                                <div className="absolute -top-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">Quest Champion</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
