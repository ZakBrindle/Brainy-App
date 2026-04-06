import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, onSnapshot, getDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Users, Play, Plus, ArrowLeft, CheckCircle2, XCircle, Settings, Swords, Sparkles, Map as MapIcon, Loader2, Key } from 'lucide-react';
import { getTopicsForDifficulty, shuffleArray } from '../lib/topics';

export default function QuestLobby({ user, profile, onBack, onStartQuest }) {
    const [activeQuests, setActiveQuests] = useState([]);
    const [currentQuest, setCurrentQuest] = useState(null);
    const [lobbyStatus, setLobbyStatus] = useState('list'); // 'list' | 'joining' | 'hosting'
    const [joinCode, setJoinCode] = useState('');
    const [topics, setTopics] = useState(['', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [questId, setQuestId] = useState(null);

    // Settings for new quest
    const [config, setConfig] = useState({
        difficulty: 'Easy',
        selectTopicsBefore: false,
        suggestTopics: false
    });

    useEffect(() => {
        if (!user) return;
        
        // Listen to active quests where friends might be or where I am
        // For simplicity, we'll listen to a "public" or "friends-only" global quests list,
        // or just rely on Join Code / Direct Friend Invitation.
        // Let's implement "Friend's active quests" by searching for games where hostUid is in my friends list.
        const friendUids = (profile?.friends || []).map(f => f.uid);
        if (profile?.parentUid) friendUids.push(profile.parentUid);

        // Fetching active quests from friends
        // Note: Real-time query across all friends might be slow, so we'll start with Join Code for now
        // and a "My Current Quest" listener.
    }, [user, profile]);

    const createQuest = async () => {
        setIsLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newQuestId = `quest_${Date.now()}`;
        
        const questData = {
            id: code,
            hostUid: user.uid,
            hostName: profile?.displayName || 'Hero',
            status: 'lobby',
            settings: config,
            players: [{
                uid: user.uid,
                name: profile?.displayName || 'Hero',
                ready: false,
                score: 0,
                currentLevel: 0,
                topics: []
            }],
            currentRoundIndex: 0,
            playerOrder: [],
            createdAt: serverTimestamp(),
            shuffledTopics: config.suggestTopics ? shuffleArray(getTopicsForDifficulty(config.difficulty)) : []
        };
        
        if (config.suggestTopics) {
            questData.settings.selectTopicsBefore = true; // Implicitly enable selecting topics
        }

        try {
            await setDoc(doc(db, 'quests', newQuestId), questData);
            setQuestId(newQuestId);
            setLobbyStatus('hosting');
            setCurrentQuest(questData);
            
            // Start listener
            startQuestListener(newQuestId);
        } catch (e) {
            console.error(e);
            alert("Failed to create quest.");
        } finally {
            setIsLoading(false);
        }
    };

    const joinQuest = async (code) => {
        if (!code) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, 'quests'), where('id', '==', code.toUpperCase()), where('status', '==', 'lobby'));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                alert("Quest not found or already started!");
                setIsLoading(false);
                return;
            }

            const qDoc = snap.docs[0];
            const qId = qDoc.id;
            const qData = qDoc.data();

            // Check if already in
            if (qData.players.some(p => p.uid === user.uid)) {
                setQuestId(qId);
                setLobbyStatus('joining');
                startQuestListener(qId);
                return;
            }

            const newPlayer = {
                uid: user.uid,
                name: profile?.displayName || 'Hero',
                ready: false,
                score: 0,
                currentLevel: 0,
                topics: []
            };

            await updateDoc(doc(db, 'quests', qId), {
                players: arrayUnion(newPlayer)
            });

            setQuestId(qId);
            setLobbyStatus('joining');
            startQuestListener(qId);
        } catch (e) {
            console.error(e);
            alert("Error joining quest.");
        } finally {
            setIsLoading(false);
        }
    };

    const startQuestListener = (id) => {
        const unsub = onSnapshot(doc(db, 'quests', id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentQuest(data);
                
                // If status changed to 'active', trigger transition
                if (data.status === 'active') {
                    onStartQuest(data, id);
                }
            } else {
                alert("Quest has been closed.");
                setLobbyStatus('list');
                setCurrentQuest(null);
            }
        });
        return unsub;
    };

    const toggleReady = async () => {
        if (!currentQuest) return;
        const newPlayers = currentQuest.players.map(p => {
            if (p.uid === user.uid) return { ...p, ready: !p.ready, topics: config.selectTopicsBefore ? topics : [] };
            return p;
        });

        await updateDoc(doc(db, 'quests', questId), { players: newPlayers });
    };

    const handleTopicChange = (idx, val) => {
        const next = [...topics];
        next[idx] = val;
        setTopics(next);
    };

    const startGame = async () => {
        if (!currentQuest || currentQuest.hostUid !== user.uid) return;
        
        // Ensure everyone is ready
        if (!currentQuest.players.every(p => p.ready)) {
            alert("Everyone must be Ready before starting!");
            return;
        }

        setIsLoading(true);
        try {
            // Shuffle player order
            const uids = currentQuest.players.map(p => p.uid);
            const shuffled = [...uids].sort(() => Math.random() - 0.5);
            
            await updateDoc(doc(db, 'quests', questId), {
                status: 'active',
                playerOrder: shuffled,
                currentTurnPlayerUid: shuffled[0],
                currentTurnStartedAt: serverTimestamp()
            });
            
            await updateDoc(doc(db, 'users', user.uid), {
                totalQuestsStarted: (profile?.totalQuestsStarted || 0) + 1
            });
        } catch (e) {
            console.error(e);
            alert("Failed to start game.");
        } finally {
            setIsLoading(false);
        }
    };

    const leaveQuest = async () => {
        if (currentQuest.hostUid === user.uid) {
            // Delete quest if host leaves
            await deleteDoc(doc(db, 'quests', questId));
        } else {
            const newPlayers = currentQuest.players.filter(p => p.uid !== user.uid);
            await updateDoc(doc(db, 'quests', questId), { players: newPlayers });
        }
        setLobbyStatus('list');
        setCurrentQuest(null);
    };

    const renderList = () => (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500 max-w-xl mx-auto w-full">
            <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center relative mt-16">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-purple-500 border-4 border-black p-4 rounded-full">
                    <Swords className="w-12 h-12 text-white animate-bounce" />
                </div>
                <h2 className="text-4xl font-black mt-4 mb-2">Quest Board</h2>
                <p className="font-bold text-gray-500">Form a party and explore the Magic Map together!</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Create Section */}
                <div className="bg-cyan-100 border-4 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                        <Plus className="w-6 h-6" /> Start a New Quest
                    </h3>
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center justify-between bg-white border-2 border-black p-3 rounded-xl font-bold">
                            <span>Difficulty:</span>
                            <div className="flex gap-2">
                                {['Easy', 'Medium', 'Hard'].map(d => (
                                    <button 
                                        key={d} 
                                        onClick={() => setConfig({...config, difficulty: d})}
                                        className={`px-3 py-1 rounded-lg border-2 border-black text-sm uppercase ${config.difficulty === d ? 'bg-yellow-400 font-black' : 'bg-gray-100'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <label className="flex items-center justify-between bg-white border-2 border-black p-3 rounded-xl font-bold cursor-pointer">
                            <span>Pre-select Topics?</span>
                            <input 
                                type="checkbox" 
                                checked={config.selectTopicsBefore} 
                                onChange={e => setConfig({...config, selectTopicsBefore: e.target.checked})}
                                className="w-6 h-6 accent-purple-500"
                            />
                        </label>
                        <label className="flex items-center justify-between bg-white border-2 border-black p-3 rounded-xl font-bold cursor-pointer">
                            <span>Suggest Topics?</span>
                            <input 
                                type="checkbox" 
                                checked={config.suggestTopics} 
                                onChange={e => setConfig({...config, suggestTopics: e.target.checked})}
                                className="w-6 h-6 accent-purple-500"
                            />
                        </label>
                    </div>
                    <button 
                        onClick={createQuest}
                        disabled={isLoading}
                        className="w-full bg-green-400 hover:bg-green-300 border-4 border-black p-4 rounded-2xl font-black text-xl shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <MapIcon />} Create Party
                    </button>
                </div>

                {/* Join Section */}
                <div className="bg-pink-100 border-4 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                        <Key className="w-6 h-6" /> Enter Magical Code
                    </h3>
                    <div className="flex gap-2">
                        <input 
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="QUEST_ID"
                            className="flex-1 border-4 border-black rounded-xl p-3 font-black text-center text-xl uppercase"
                            maxLength={6}
                        />
                        <button 
                            onClick={() => joinQuest(joinCode)}
                            disabled={isLoading || joinCode.length < 4}
                            className="bg-yellow-400 border-4 border-black rounded-xl px-6 font-black hover:bg-yellow-300 active:translate-y-[2px] transition-all disabled:opacity-50"
                        >
                            Join
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLobby = () => {
        const isHost = currentQuest?.hostUid === user.uid;
        const myPlayerIndex = currentQuest?.players.findIndex(p => p.uid === user.uid) || 0;
        const myPlayer = currentQuest?.players[myPlayerIndex];
        const isReady = myPlayer?.ready;
        const suggestedTopics = currentQuest?.settings.suggestTopics && currentQuest?.shuffledTopics
             ? currentQuest.shuffledTopics.slice(myPlayerIndex * 4, myPlayerIndex * 4 + 4)
             : [];

        return (
            <div className="space-y-8 animate-in slide-in-from-right-8 max-w-2xl mx-auto w-full px-4 pt-12 pb-20">
                <button 
                    onClick={leaveQuest}
                    className="absolute top-4 left-4 bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] mb-6 flex items-center gap-2"
                >
                    <ArrowLeft className="w-5 h-5" /> Leave Party
                </button>

                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center relative">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-yellow-400 border-4 border-black p-4 rounded-3xl font-black text-2xl uppercase">
                        CODE: {currentQuest.id}
                    </div>
                    <h2 className="text-4xl font-black mt-6">The Adventure Awaits!</h2>
                    <p className="font-bold text-gray-500 mt-2">Waiting for everyone and picking topics...</p>
                    <div className="flex justify-center gap-4 mt-6">
                        <span className="bg-purple-100 border-2 border-black px-4 py-1 rounded-full font-bold text-purple-700">Difficulty: {currentQuest.settings.difficulty}</span>
                        {currentQuest.settings.selectTopicsBefore && <span className="bg-blue-100 border-2 border-black px-4 py-1 rounded-full font-bold text-blue-700">Topic Selection: ON</span>}
                    </div>
                </div>

                {/* Topics Submission */}
                {currentQuest.settings.selectTopicsBefore && (
                    <div className="bg-cyan-100 border-4 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-2xl font-black mb-4">Pick 3 Topics you Love!</h3>
                        <div className="space-y-3">
                            {topics.map((t, i) => (
                                <input 
                                    key={i}
                                    value={t}
                                    onChange={e => handleTopicChange(i, e.target.value)}
                                    placeholder={`Topic #${i+1} (Dinos, Minecraft, Pets...)`}
                                    disabled={isReady}
                                    className="w-full border-2 border-black rounded-xl p-3 font-bold"
                                />
                            ))}
                        </div>
                        {suggestedTopics.length > 0 && (
                            <div className="mt-4 border-t-2 border-cyan-300 pt-4">
                                <span className="font-black text-slate-600 block mb-2">Suggested (Click to add):</span>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedTopics.map(t => (
                                        <button 
                                           key={t}
                                           onClick={() => {
                                               if (isReady) return;
                                               const next = [...topics];
                                               const emptyIdx = next.findIndex(x => x.trim() === '');
                                               if (emptyIdx !== -1) {
                                                   next[emptyIdx] = t;
                                                   setTopics(next);
                                               }
                                           }}
                                           disabled={isReady}
                                           className="bg-yellow-100 hover:bg-yellow-200 border-2 border-black rounded-lg px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                                        >
                                           {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Players List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQuest.players.map((p, idx) => (
                        <div key={idx} className={`bg-white border-4 border-black rounded-2xl p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${p.ready ? 'border-green-500 bg-green-50' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-200 border-2 border-black rounded-full flex items-center justify-center font-black">
                                    {p.name[0]}
                                </div>
                                <span className="font-black text-xl">{p.name} {p.uid === user.uid && '(YOU)'}</span>
                            </div>
                            {p.ready ? <CheckCircle2 className="text-green-500 w-8 h-8" /> : <XCircle className="text-gray-300 w-8 h-8" />}
                        </div>
                    ))}
                </div>

                {/* Footer Controls */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t-4 border-black z-50 flex gap-4">
                   <button 
                     onClick={toggleReady}
                     className={`flex-1 p-6 border-4 border-black rounded-[2rem] font-black text-2xl shadow-[0px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[8px] transition-all ${isReady ? 'bg-orange-400 text-white' : 'bg-yellow-400'}`}
                   >
                     {isReady ? 'Unready?' : 'READY UP!'}
                   </button>
                   
                   {isHost && (
                     <button 
                        onClick={startGame}
                        disabled={!currentQuest.players.every(p => p.ready) || currentQuest.players.length < 1}
                        className={`flex-1 p-6 border-4 border-black rounded-[2rem] font-black text-2xl shadow-[0px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[8px] transition-all ${currentQuest.players.every(p => p.ready) ? 'bg-green-400 active:bg-green-300' : 'bg-gray-200 grayscale opacity-50 cursor-not-allowed'}`}
                     >
                       START GAME! ⚔️
                     </button>
                   )}
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 bg-blue-500 overflow-y-auto">
             <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff33 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
             <div className="container mx-auto h-full flex flex-col p-4 relative z-10">
                {lobbyStatus === 'list' ? renderList() : renderLobby()}
             </div>
        </div>
    );
}
