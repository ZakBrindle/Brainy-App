import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp, setDoc, writeBatch, increment } from 'firebase/firestore';
import { Swords, Trophy, Clock, ArrowRight, User, AlertCircle, Eye, Sparkles, Gem, Castle } from 'lucide-react';
import QuestMap from './QuestMap';
import QuizApp from './QuizApp';

export default function QuestGameLoop({ user, profile, questId, initialQuest, onBack }) {
    const [quest, setQuest] = useState(initialQuest);
    const [view, setView] = useState('map'); // 'map' | 'picking' | 'quiz' | 'roundSummary' | 'finished'
    const [selectedTopic, setSelectedTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [roundResults, setRoundResults] = useState(null);
    const [peekActive, setPeekActive] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'quests', questId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setQuest(data);
                
                // Check for 3-day timeout
                checkTimeout(data);
            } else {
                onBack();
            }
        });
        return unsub;
    }, [questId]);

    const checkTimeout = async (qData) => {
        if (!qData || qData.status !== 'active') return;
        
        const timeoutMs = 3 * 24 * 60 * 60 * 1000;
        const startedAt = qData.currentTurnStartedAt?.toDate?.() || new Date(qData.currentTurnStartedAt);
        const now = new Date();
        
        if (now - startedAt > timeoutMs) {
            console.log("Timeout detected for player", qData.currentTurnPlayerUid);
            await failCurrentPlayer(qData);
        }
    };

    const failCurrentPlayer = async (qData) => {
        const currentIndex = qData.playerOrder.indexOf(qData.currentTurnPlayerUid);
        const isLastInRound = currentIndex === qData.playerOrder.length - 1;
        const nextIndex = (currentIndex + 1) % qData.playerOrder.length;
        const nextPlayerUid = qData.playerOrder[nextIndex];

        const updates = {
            currentTurnPlayerUid: nextPlayerUid,
            currentTurnStartedAt: serverTimestamp(),
        };

        if (isLastInRound) {
            updates.currentRoundIndex = qData.currentRoundIndex + 1;
            if (updates.currentRoundIndex >= 10) {
                updates.status = 'finished';
            }
        }

        const questRef = doc(db, 'quests', questId);
        await updateDoc(questRef, updates);
    };

    const startPicking = () => {
        if (quest.settings.selectTopicsBefore) {
            // Auto-pick from collective pool
            const allTopics = quest.players.flatMap(p => p.topics).filter(t => t);
            // In a real app, we'd pick 2 per person and shuffle.
            // For now, let's just pick one randomly from the pool.
            const picked = allTopics[Math.floor(Math.random() * allTopics.length)] || "General Knowledge";
            setSelectedTopic(picked);
            setView('quiz');
        } else {
            setView('picking');
        }
    };
    
    const confirmTopic = async () => {
        if (!selectedTopic.trim()) return;
        setIsLoading(true);
        // In a real app we'd generate the quiz here to ensure everyone gets the same one
        // For this demo, the first player to start the quiz "locks" it.
        setView('quiz');
        setIsLoading(false);
    };

    const handleQuizFinish = async (score, results) => {
        setIsLoading(true);
        try {
            const questRef = doc(db, 'quests', questId);
            const myPlayer = quest.players.find(p => p.uid === user.uid);
            
            // Updates to Player Score and Level
            const newPlayers = quest.players.map(p => {
                if (p.uid === user.uid) {
                    return { 
                        ...p, 
                        score: p.score + score, 
                        currentLevel: quest.currentRoundIndex + 1 
                    };
                }
                return p;
            });

            const currentIndex = quest.playerOrder.indexOf(user.uid);
            const isLastInRound = currentIndex === quest.playerOrder.length - 1;
            const nextPlayerUid = quest.playerOrder[(currentIndex + 1) % quest.playerOrder.length];

            const updates = {
                players: newPlayers,
                currentTurnPlayerUid: nextPlayerUid,
                currentTurnStartedAt: serverTimestamp(),
            };

            if (isLastInRound) {
                updates.currentRoundIndex = quest.currentRoundIndex + 1;
                if (updates.currentRoundIndex >= 10) {
                    updates.status = 'finished';
                    // Determine champions
                    const maxScore = Math.max(...newPlayers.map(p => p.score));
                    const winners = newPlayers.filter(p => p.score === maxScore).map(p => p.uid);
                    updates.winners = winners;
                    
                    const batch = writeBatch(db);
                    batch.update(questRef, updates);
                    winners.forEach(uid => {
                        batch.update(doc(db, 'users', uid), { questChampionCount: increment(1) });
                    });
                    await batch.commit();
                    
                    setRoundResults({ score, total: 10 });
                    setView('roundSummary');
                    setIsLoading(false);
                    return;
                }
            }

            await updateDoc(questRef, updates);
            setRoundResults({ score, total: 10 }); // Assuming 10 for Quests
            setView('roundSummary');
        } catch (e) {
            console.error(e);
            alert("Error saving quest progress.");
        } finally {
            setIsLoading(false);
        }
    };

    const isMyTurn = quest.currentTurnPlayerUid === user.uid && quest.status === 'active';

    if (quest.status === 'finished') {
        const bonusCrystals = 100; // Reward for finishing!
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in zoom-in">
                <Castle className="w-48 h-48 text-yellow-400 drop-shadow-[0_8px_0_rgba(0,0,0,1)] mb-8 animate-bounce" />
                <h2 className="text-6xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">VICTORY!</h2>
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-8 w-full max-w-lg">
                    <h3 className="text-3xl font-black text-purple-600 mb-4">Castle Bonus Unlocked!</h3>
                    <div className="flex items-center justify-center gap-4 bg-orange-100 p-6 rounded-3xl border-4 border-black">
                        <Gem className="w-12 h-12 text-orange-500" />
                        <span className="text-5xl font-black">{bonusCrystals} Crystals!</span>
                    </div>
                </div>
                <button 
                  onClick={onBack}
                  className="mt-12 bg-pink-400 border-4 border-black px-12 py-6 rounded-3xl font-black text-3xl shadow-[0_8px_0_rgba(0,0,0,1)] active:translate-y-[8px] active:shadow-none"
                >
                  Return to Dashboard
                </button>
            </div>
        );
    }

    if (view === 'quiz' && isMyTurn) {
        return (
           <QuizApp 
             user={user} 
             onBack={() => setView('map')} 
             questMode={true}
             difficulty={quest.settings.difficulty}
             forcedTopic={selectedTopic}
             onQuestComplete={handleQuizFinish}
             peekOption={quest.playerOrder.indexOf(user.uid) > 0} // Peek only if not first
           />
        );
    }

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500 pt-12">
            <button 
                onClick={onBack}
                className="absolute top-4 left-4 bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] mb-6 flex items-center gap-2 z-50"
            >
                <ArrowLeft className="w-5 h-5" /> Quit Quest
            </button>

            <div className="text-center">
                <h1 className="text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)] uppercase tracking-widest italic">
                    {quest.id} Epic Adventure
                </h1>
            </div>

            <QuestMap quest={quest} currentUserId={user.uid} />

            <div className="flex-1 flex flex-col items-center justify-center p-4">
                {isMyTurn ? (
                    <div className="bg-white border-8 border-black rounded-[3rem] p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center animate-bounce">
                        <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-4xl font-black mb-4 uppercase">It's Your Turn!</h2>
                        <p className="font-bold text-gray-500 mb-8">Ready to pick a topic and lead the way?</p>
                        <button 
                           onClick={startPicking}
                           className="bg-green-400 border-4 border-black px-12 py-6 rounded-3xl font-black text-3xl shadow-[0_6px_0_rgba(0,0,0,1)] active:translate-y-[6px]"
                        >
                           START YOUR ROUND!
                        </button>
                    </div>
                ) : (
                    <div className="bg-black/30 backdrop-blur-md border-4 border-white/20 p-8 rounded-[3rem] text-center text-white">
                        <Clock className="w-16 h-16 mx-auto mb-4 text-cyan-300 animate-pulse" />
                        <h2 className="text-3xl font-bold">Waiting for {quest.players.find(p => p.uid === quest.currentTurnPlayerUid)?.name || 'a friend'}...</h2>
                        <p className="mt-2 opacity-70 italic">They have 3 days to complete their turn before the party moves on without them!</p>
                    </div>
                )}
            </div>

            {view === 'picking' && (
                <div className="fixed inset-0 z-[60] bg-blue-500 p-8 flex flex-col items-center justify-center animate-in slide-in-from-bottom-8">
                     <h2 className="text-5xl font-black text-white mb-8">Pick the Round Topic!</h2>
                     <input 
                        value={selectedTopic}
                        onChange={e => setSelectedTopic(e.target.value)}
                        placeholder="e.g. Sharks, Pok&eacute;mon, Space..."
                        className="w-full max-w-lg border-8 border-black rounded-[2rem] p-8 font-black text-3xl text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8"
                     />
                     <button 
                        onClick={() => setView('quiz')}
                        disabled={!selectedTopic.trim()}
                        className="bg-yellow-400 border-4 border-black px-12 py-6 rounded-3xl font-black text-3xl shadow-[0_8px_0_rgba(0,0,0,1)] active:translate-y-[8px] disabled:opacity-50"
                     >
                        GO! 🚀
                     </button>
                </div>
            )}
        </div>
    );
}

// Minimalist onSnapshot for this component
function onSnapshot(docRef, callback) {
    const unsub = onSnapshotFirebase(docRef, callback);
    return unsub;
}
import { onSnapshot as onSnapshotFirebase } from 'firebase/firestore';
