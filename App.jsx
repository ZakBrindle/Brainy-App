import React, { useState, useEffect, useRef } from 'react';
import { Play, Star, HelpCircle, Check, X, Sparkles, Brain, Trophy, ArrowRight, RefreshCw, AlertCircle, Settings, ChevronDown, ChevronUp, History, Medal } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc } from 'firebase/firestore';

// --- API Configuration ---
const apiKey = ""; // API key is injected by the execution environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Game Logic & Constants ---

const RANK_THRESHOLDS = [
    { min: 0, name: "Seedling 🌱", color: "text-green-500" },
    { min: 50, name: "Curious Cub 🐻", color: "text-amber-500" },
    { min: 150, name: "Clever Cat 🐱", color: "text-orange-500" },
    { min: 300, name: "Smarty Fox 🦊", color: "text-red-500" },
    { min: 500, name: "Brainy Badger 🦡", color: "text-purple-500" },
    { min: 800, name: "Genius Giraffe 🦒", color: "text-yellow-500" },
    { min: 1200, name: "Einstein Elephant 🐘", color: "text-cyan-500" },
    { min: 2000, name: "Wizard Whale 🐳", color: "text-blue-500" },
    { min: 3500, name: "Magic Mastermind 🧙‍♂️", color: "text-pink-500" }
];

const getRankInfo = (xp) => {
    let currentRank = RANK_THRESHOLDS[0];
    let nextRank = RANK_THRESHOLDS[1];

    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
        if (xp >= RANK_THRESHOLDS[i].min) {
            currentRank = RANK_THRESHOLDS[i];
            nextRank = RANK_THRESHOLDS[i + 1] || RANK_THRESHOLDS[i]; // Cap at max
        }
    }

    const xpNeeded = nextRank.min === currentRank.min ? 0 : nextRank.min - xp;
    const progress = nextRank.min === currentRank.min ? 100 : ((xp - currentRank.min) / (nextRank.min - currentRank.min)) * 100;

    return { currentRank, nextRank, xpNeeded, progress };
};

const generateQuizWithAI = async (topic, difficulty, numQuestions, previousQuestions = []) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const systemInstruction = `You are a fun, cheerful, and educational quiz generator for children. Generate exactly ${numQuestions} multiple-choice questions about the given topic.`;

    let exclusionPrompt = "";
    if (previousQuestions.length > 0) {
        exclusionPrompt = `\nCRITICAL: DO NOT generate any of the following questions. The user has already answered them:\n${previousQuestions.map(q => `- ${q}`).join('\n')}\n`;
    }

    const promptText = `
    Topic: "${topic}"
    Difficulty: "${difficulty}"
    ${exclusionPrompt}
    
    Guidelines:
    1. The language must be suitable for kids, engaging, and easy to read.
    2. Exactly 4 options per question.
    3. If difficulty is "Medium" or "Hard", make the incorrect options (distractors) plausible and not totally obvious, requiring them to think a bit more!
    4. Provide a fun, educational explanation for the answer that teaches them something cool about the topic.

    Return ONLY a valid JSON object following this exact schema:
    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctIndex": number (0-3),
          "explanation": "string (a fun fact explaining the answer)"
        }
      ]
    }
  `;

    const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" }
    };

    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("Invalid response structure from AI");
            const parsedData = JSON.parse(textResponse);
            if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
                throw new Error("Missing questions array in JSON");
            }
            return parsedData.questions;
        } catch (error) {
            if (attempt === delays.length) throw new Error("Failed to generate quiz after multiple attempts.");
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
    }
};

// --- UI Components ---

const CartoonButton = ({ children, onClick, colorClass = "bg-yellow-400 hover:bg-yellow-300", className = "", disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
      relative px-8 py-4 font-black text-2xl tracking-wide text-black
      border-4 border-black rounded-3xl
      shadow-[4px_6px_0px_0px_rgba(0,0,0,1)]
      active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] active:translate-y-[6px]
      transition-all duration-150 ease-in-out
      flex items-center justify-center gap-3
      ${colorClass}
      ${disabled ? 'opacity-50 cursor-not-allowed transform-none shadow-none translate-y-[6px]' : ''}
      ${className}
    `}
    >
        {children}
    </button>
);

const AccordionItem = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-4 border-black rounded-2xl mb-4 overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 bg-cyan-200 hover:bg-cyan-300 font-bold text-2xl flex justify-between items-center text-left transition-colors"
            >
                <span className="uppercase">{title}</span>
                {isOpen ? <ChevronUp className="w-8 h-8" /> : <ChevronDown className="w-8 h-8" />}
            </button>
            {isOpen && <div className="p-4 bg-white border-t-4 border-black">{children}</div>}
        </div>
    );
};

export default function App() {
    // Navigation & Data States
    const [step, setStep] = useState('home');
    const [difficulty, setDifficulty] = useState('');
    const [topic, setTopic] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);

    // Game Session States
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [onlyNewQuestions, setOnlyNewQuestions] = useState(true);
    const [sessionHistory, setSessionHistory] = useState([]);

    // Firebase & Profile States
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState({ xp: 0, lastMonthRank: "None", currentMonth: new Date().toISOString().slice(0, 7) });
    const [history, setHistory] = useState([]);

    // Setup Firebase Auth
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                console.error("Auth error", e);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // Fetch Data when Authed
    useEffect(() => {
        if (!user) return;

        // Profile Listener
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
            const nowMonth = new Date().toISOString().slice(0, 7);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.currentMonth !== nowMonth) {
                    // Monthly Reset Logic
                    const lastRank = getRankInfo(data.xp).currentRank.name;
                    const resetData = { xp: 0, lastMonthRank: lastRank, currentMonth: nowMonth };
                    setDoc(profileRef, resetData, { merge: true }).catch(console.error);
                    setProfile(resetData);
                } else {
                    setProfile(data);
                }
            } else {
                // First time setup
                const initialData = { xp: 0, lastMonthRank: "None", currentMonth: nowMonth };
                setDoc(profileRef, initialData).catch(console.error);
                setProfile(initialData);
            }
        }, (err) => console.error("Profile listen error:", err));

        // History Listener
        const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
        const unsubHistory = onSnapshot(historyRef, (snap) => {
            const histData = [];
            snap.forEach(d => histData.push({ id: d.id, ...d.data() }));
            setHistory(histData.sort((a, b) => b.timestamp - a.timestamp)); // Sort newest first in memory
        }, (err) => console.error("History listen error:", err));

        return () => {
            unsubProfile();
            unsubHistory();
        };
    }, [user]);

    // Actions
    const handleStart = () => {
        setScore(0);
        setCurrentQIndex(0);
        setQuestions([]);
        setFeedback(null);
        setSessionHistory([]);
        setTopic("");
        setStep('difficulty');
    };

    const handleSelectDifficulty = (diff) => {
        setDifficulty(diff);
        setStep('topic');
    };

    const handleGenerateQuiz = async () => {
        if (!topic.trim()) return;
        setStep('loading');
        setErrorMsg("");

        try {
            let exclusions = [];
            if (onlyNewQuestions) {
                // Find questions asked before for this exact topic
                exclusions = history
                    .filter(h => h.topic.toLowerCase() === topic.toLowerCase())
                    .map(h => h.question);
            }

            let numQuestions = 10;
            if (difficulty === 'Easy') numQuestions = 5;
            if (difficulty === 'Medium') numQuestions = 8;
            if (difficulty === 'Hard') numQuestions = 10;

            const generatedQuestions = await generateQuizWithAI(topic, difficulty, numQuestions, exclusions);
            setQuestions(generatedQuestions.slice(0, numQuestions));
            setStep('quiz');
        } catch (err) {
            console.error(err);
            setErrorMsg("Oops! The magic quiz machine had a hiccup. Let's try again!");
            setStep('error');
        }
    };

    const handleAnswer = (index) => {
        if (feedback) return;
        const currentQ = questions[currentQIndex];
        const isCorrect = index === currentQ.correctIndex;

        if (isCorrect) setScore(prev => prev + 1);

        setFeedback({
            isCorrect,
            explanation: currentQ.explanation,
            selectedIndex: index,
            correctIndex: currentQ.correctIndex
        });

        // Save answer locally for this session
        setSessionHistory(prev => [...prev, {
            topic: topic,
            question: currentQ.question,
            userAnswer: currentQ.options[index],
            correctAnswer: currentQ.options[currentQ.correctIndex],
            isCorrect: isCorrect,
            timestamp: Date.now()
        }]);
    };

    const handleNextQuestion = async () => {
        setFeedback(null);
        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        } else {
            // Quiz Finished! Process XP and save to Firestore
            setStep('loading'); // Brief loading state while saving

            if (user) {
                try {
                    // 1. Calculate and save XP
                    const isPerfect = score === questions.length;
                    const earnedXP = (score * 10) + (isPerfect ? 50 : 0); // 10 XP per right answer, 50 bonus for perfect
                    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
                    await setDoc(profileRef, { xp: profile.xp + earnedXP }, { merge: true });

                    // 2. Save session history
                    const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
                    const promises = sessionHistory.map(item => addDoc(historyRef, item));
                    await Promise.all(promises);
                } catch (err) {
                    console.error("Error saving progress:", err);
                }
            }

            setStep('results');
        }
    };

    // --- Views ---

    const renderTopBar = () => (
        <div className="absolute top-4 right-4 z-20 flex gap-4">
            {step === 'home' && (
                <button
                    onClick={() => setStep('settings')}
                    className="bg-purple-500 hover:bg-purple-400 p-3 border-4 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] transition-all"
                >
                    <Settings className="w-8 h-8 text-white animate-spin-slow" />
                </button>
            )}
        </div>
    );

    const renderHome = () => {
        const rankInfo = getRankInfo(profile.xp);
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative mb-6">
                    <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_8px_0_rgba(0,0,0,1)] text-center rotate-[-2deg] animate-bounce">
                        Magic Quiz <br /> Adventure!
                    </h1>
                    <Sparkles className="absolute -top-6 -right-6 w-16 h-16 text-yellow-300 animate-pulse" />
                    <Star className="absolute -bottom-4 -left-8 w-12 h-12 text-pink-400 animate-spin-slow" />
                </div>

                {/* Player Mini Profile Card */}
                <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center max-w-sm w-full">
                    <div className="flex items-center gap-3 mb-2">
                        <Medal className="w-8 h-8 text-yellow-500" />
                        <span className="text-2xl font-black">Current Rank</span>
                    </div>
                    <span className={`text-3xl font-black ${rankInfo.currentRank.color} mb-4 text-center drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]`}>
                        {rankInfo.currentRank.name}
                    </span>

                    <div className="w-full bg-gray-200 border-2 border-black rounded-full h-6 mb-2 overflow-hidden relative">
                        <div
                            className="bg-green-400 h-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.max(5, rankInfo.progress)}%` }}
                        />
                    </div>
                    <p className="font-bold text-gray-600">
                        {profile.xp} XP - {rankInfo.xpNeeded > 0 ? `${rankInfo.xpNeeded} XP to next rank!` : "Max Rank!"}
                    </p>

                    {profile.lastMonthRank !== "None" && (
                        <div className="mt-4 p-3 bg-blue-100 border-2 border-black rounded-xl w-full text-center">
                            <span className="font-bold text-sm text-gray-600 uppercase">Last Month's Trophy</span><br />
                            <span className="font-black text-blue-700">{profile.lastMonthRank}</span>
                        </div>
                    )}
                </div>

                <CartoonButton onClick={handleStart} colorClass="bg-green-400 hover:bg-green-300 text-3xl px-12 py-6">
                    <Play className="w-10 h-10 fill-current" />
                    Start Quiz
                </CartoonButton>
            </div>
        );
    };

    const renderSettings = () => {
        // Group history by topic
        const historyByTopic = history.reduce((acc, curr) => {
            const topicLower = curr.topic.toLowerCase();
            if (!acc[topicLower]) acc[topicLower] = { display: curr.topic, questions: [] };
            acc[topicLower].questions.push(curr);
            return acc;
        }, {});

        return (
            <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-8 animate-in slide-in-from-bottom-8 relative">
                <button
                    onClick={() => setStep('home')}
                    className="absolute top-0 left-4 bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none"
                >
                    &larr; Back
                </button>

                <div className="text-center mt-12 mb-8">
                    <History className="w-20 h-20 mx-auto text-yellow-300 drop-shadow-[0_4px_0_rgba(0,0,0,1)] mb-4" />
                    <h2 className="text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                        Magic Memory Vault
                    </h2>
                    <p className="text-xl font-bold text-white mt-2 bg-black/30 rounded-full inline-block px-4 py-1">
                        Look back at all the amazing things you've learned!
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-4">
                    {Object.keys(historyByTopic).length === 0 ? (
                        <div className="bg-white border-4 border-black rounded-3xl p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <p className="text-2xl font-bold text-gray-500">No memories yet! Go play a quiz to fill the vault.</p>
                        </div>
                    ) : (
                        Object.values(historyByTopic).map((group, idx) => (
                            <AccordionItem key={idx} title={group.display}>
                                <div className="space-y-4">
                                    {group.questions.map((q, qIdx) => (
                                        <div key={qIdx} className={`p-4 border-4 border-black rounded-xl ${q.isCorrect ? 'bg-green-100' : 'bg-red-50'}`}>
                                            <p className="font-bold text-xl mb-3">{q.question}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white p-3 rounded-lg border-2 border-black">
                                                    <span className="text-xs font-black uppercase text-gray-500 block mb-1">Your Answer</span>
                                                    <div className="flex items-center gap-2">
                                                        {q.isCorrect ? <Check className="w-5 h-5 text-green-600" /> : <X className="w-5 h-5 text-red-600" />}
                                                        <span className={`font-bold ${q.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{q.userAnswer}</span>
                                                    </div>
                                                </div>
                                                {!q.isCorrect && (
                                                    <div className="bg-green-200 p-3 rounded-lg border-2 border-black">
                                                        <span className="text-xs font-black uppercase text-green-800 block mb-1">Right Answer</span>
                                                        <span className="font-bold text-green-900 flex items-center gap-2">
                                                            <Check className="w-5 h-5" /> {q.correctAnswer}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionItem>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderDifficulty = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 max-w-2xl mx-auto text-center animate-in slide-in-from-bottom-8">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                Choose Your Challenge!
            </h2>
            <div className="flex flex-col gap-6 w-full px-4">
                <CartoonButton onClick={() => handleSelectDifficulty('Easy')} colorClass="bg-green-400 hover:bg-green-300">
                    🟢 Easy Peasy
                </CartoonButton>
                <CartoonButton onClick={() => handleSelectDifficulty('Medium')} colorClass="bg-orange-400 hover:bg-orange-300">
                    🟠 A Little Tricky
                </CartoonButton>
                <CartoonButton onClick={() => handleSelectDifficulty('Hard')} colorClass="bg-red-400 hover:bg-red-300 text-white">
                    🔴 Super Brainiac
                </CartoonButton>
            </div>
        </div>
    );

    const renderTopic = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 max-w-2xl mx-auto text-center px-4 animate-in slide-in-from-right-8">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                What do you want to learn about?
            </h2>
            <p className="text-xl font-bold text-black bg-white/80 p-4 rounded-2xl border-2 border-black">
                Dinosaurs, Space, Animals, Minecraft, Pizza... anything!
            </p>

            <div className="w-full relative">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Type a topic here!"
                    className="w-full text-3xl font-bold p-6 rounded-3xl border-4 border-black shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[2px] focus:shadow-[2px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-center mb-6"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && topic.trim()) handleGenerateQuiz();
                    }}
                />

                <label className="flex items-center justify-center gap-3 bg-yellow-200 border-4 border-black p-4 rounded-2xl cursor-pointer shadow-[2px_4px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-y-[2px] active:shadow-none hover:bg-yellow-300 w-full mb-6">
                    <div className="relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={onlyNewQuestions}
                            onChange={(e) => setOnlyNewQuestions(e.target.checked)}
                            className="appearance-none w-8 h-8 border-4 border-black rounded-lg bg-white checked:bg-green-400 outline-none cursor-pointer"
                        />
                        {onlyNewQuestions && <Check className="w-6 h-6 absolute text-black pointer-events-none" />}
                    </div>
                    <span className="font-bold text-xl select-none">
                        Sparkle filter! ✨ Only give me brand NEW questions!
                    </span>
                </label>
            </div>

            <CartoonButton
                onClick={handleGenerateQuiz}
                disabled={!topic.trim()}
                colorClass="bg-cyan-400 hover:bg-cyan-300 w-full"
            >
                <Sparkles className="w-8 h-8" />
                Create Magic Quiz!
            </CartoonButton>
        </div>
    );

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 text-center animate-pulse">
            <div className="relative">
                <Brain className="w-32 h-32 text-pink-400 animate-bounce" />
                <Sparkles className="absolute top-0 right-0 w-12 h-12 text-yellow-300" />
            </div>
            <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                Sprinkling Magic Dust...<br />
                <span className="text-2xl">Preparing your magic!</span>
            </h2>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 text-center px-4">
            <AlertCircle className="w-32 h-32 text-red-500 animate-bounce" />
            <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                {errorMsg}
            </h2>
            <CartoonButton onClick={() => setStep('topic')} colorClass="bg-yellow-400 hover:bg-yellow-300">
                <RefreshCw className="w-8 h-8" />
                Try Again!
            </CartoonButton>
        </div>
    );

    const renderQuiz = () => {
        const question = questions[currentQIndex];
        if (!question) return null;

        const colors = ["bg-pink-400", "bg-cyan-400", "bg-yellow-400", "bg-lime-400"];
        const progressPercent = (currentQIndex / questions.length) * 100;

        return (
            <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-6 relative pt-10">
                {/* Pinned Progress Bar */}
                <div className="fixed top-0 left-0 right-0 h-4 md:h-6 bg-white/50 border-b-4 border-black z-50">
                    <div
                        className="h-full bg-green-400 transition-all duration-500 ease-out border-r-4 border-black shadow-[4px_0_0_rgba(0,0,0,0.5)]"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                <div className="flex justify-between items-center mb-8 bg-white border-4 border-black rounded-3xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-4">
                    <div className="text-2xl font-black flex items-center gap-2">
                        Question: <span className="text-purple-600">{currentQIndex + 1} / {questions.length}</span>
                    </div>
                    <div className="text-3xl font-black flex items-center gap-2">
                        <Star className="w-8 h-8 text-yellow-500 fill-current" />
                        Score: <span className="text-green-600">{score}</span>
                    </div>
                </div>

                <div className="bg-white border-4 border-black rounded-[2rem] p-8 mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center animate-in slide-in-from-bottom-4">
                    <h2 className="text-3xl md:text-4xl font-black text-black leading-tight">
                        {question.question}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {question.options.map((opt, idx) => {
                        let stateClass = "";
                        let Icon = null;

                        if (feedback) {
                            if (idx === feedback.correctIndex) {
                                stateClass = "bg-green-400 border-green-600 !shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] translate-y-[6px]";
                                Icon = <Check className="w-8 h-8 text-black" />;
                            } else if (idx === feedback.selectedIndex) {
                                stateClass = "bg-red-400 border-red-600 !shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] translate-y-[6px] opacity-70";
                                Icon = <X className="w-8 h-8 text-black" />;
                            } else {
                                stateClass = "opacity-50 grayscale";
                            }
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={feedback !== null}
                                className={`
                  relative p-6 border-4 border-black rounded-[2rem]
                  text-2xl md:text-3xl font-bold text-black
                  shadow-[4px_6px_0px_0px_rgba(0,0,0,1)]
                  active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] active:translate-y-[6px]
                  transition-all duration-200 ease-in-out
                  flex items-center justify-between
                  ${feedback ? stateClass : `${colors[idx % colors.length]} hover:brightness-110`}
                `}
                            >
                                <span className="text-left flex-1">{opt}</span>
                                {Icon && <span>{Icon}</span>}
                            </button>
                        )
                    })}
                </div>

                {feedback && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className={`
              border-8 border-black rounded-[3rem] p-8 max-w-2xl w-full text-center
              shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]
              ${feedback.isCorrect ? 'bg-green-300' : 'bg-rose-300'}
              animate-in zoom-in-95 duration-300
            `}>
                            <div className="flex justify-center mb-6">
                                {feedback.isCorrect ? (
                                    <div className="bg-green-500 rounded-full p-4 border-4 border-black animate-bounce">
                                        <Check className="w-16 h-16 text-white" />
                                    </div>
                                ) : (
                                    <div className="bg-red-500 rounded-full p-4 border-4 border-black animate-bounce">
                                        <X className="w-16 h-16 text-white" />
                                    </div>
                                )}
                            </div>

                            <h3 className="text-4xl font-black mb-4 uppercase drop-shadow-[0_2px_0_rgba(255,255,255,1)]">
                                {feedback.isCorrect ? "Awesome Job! +1 Point!" : "Oops! Not quite!"}
                            </h3>

                            {!feedback.isCorrect && (
                                <div className="bg-red-100 border-4 border-red-500 rounded-2xl p-4 mb-4 text-xl md:text-2xl font-black text-red-700 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                                    Right Answer: <span className="text-black">{questions[currentQIndex].options[feedback.correctIndex]}</span>
                                </div>
                            )}

                            <div className="bg-white border-4 border-black rounded-2xl p-6 mb-8 text-xl font-bold">
                                <p className="flex items-start gap-3 text-left">
                                    <HelpCircle className="w-8 h-8 shrink-0 text-blue-500" />
                                    <span>{feedback.explanation}</span>
                                </p>
                            </div>

                            <CartoonButton onClick={handleNextQuestion} colorClass="bg-cyan-400 w-full text-3xl">
                                {currentQIndex < questions.length - 1 ? "Next Question" : "Finish Quiz!"}
                                <ArrowRight className="w-8 h-8" />
                            </CartoonButton>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderResults = () => {
        const isPerfect = score === questions.length;
        const earnedXP = (score * 10) + (isPerfect ? 50 : 0);
        const newXP = profile.xp; // It was updated in Firestore and picked up by snapshot, or we just display the end state.
        const rankInfo = getRankInfo(newXP);

        let title = "Great Try!";
        let color = "text-yellow-300";

        if (isPerfect) {
            title = "Perfect Score Bonus!";
            color = "text-yellow-400 animate-pulse";
        } else if (score >= questions.length * 0.7) {
            title = "Quiz Genius!";
            color = "text-green-300";
        }

        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center animate-in zoom-in duration-500 px-4">
                <Trophy className={`w-32 h-32 ${color} drop-shadow-[0_8px_0_rgba(0,0,0,1)]`} />

                <h2 className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_6px_0_rgba(0,0,0,1)]">
                    {title}
                </h2>

                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
                    <p className="text-2xl font-bold mb-2">Final Score</p>
                    <p className="text-8xl font-black text-purple-600 drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]">
                        {score}/{questions.length}
                    </p>
                    <div className="mt-6 bg-cyan-100 border-4 border-cyan-500 rounded-2xl p-4 animate-bounce">
                        <span className="text-2xl font-black text-cyan-800">+{earnedXP} XP Earned!</span>
                        {isPerfect && <p className="text-sm font-bold mt-1 text-cyan-600">Includes 50 XP Perfect Bonus!</p>}
                    </div>
                </div>

                <div className="bg-black/40 p-6 rounded-3xl backdrop-blur-sm border-4 border-white/20 w-full max-w-md">
                    <p className="text-xl font-bold text-white mb-2">You are a...</p>
                    <p className={`text-4xl font-black ${rankInfo.currentRank.color} drop-shadow-[0_2px_0_rgba(0,0,0,1)]`}>
                        {rankInfo.currentRank.name}
                    </p>
                </div>

                <CartoonButton onClick={() => setStep('home')} colorClass="bg-pink-400 hover:bg-pink-300 text-3xl px-12 py-6">
                    <RefreshCw className="w-10 h-10" />
                    Main Menu
                </CartoonButton>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-blue-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 to-blue-600 font-sans selection:bg-pink-400 overflow-x-hidden relative">
            <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff33 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

            {renderTopBar()}

            <main className="relative z-10 container mx-auto h-screen flex flex-col p-4 md:p-8">
                {step === 'home' && renderHome()}
                {step === 'settings' && renderSettings()}
                {step === 'difficulty' && renderDifficulty()}
                {step === 'topic' && renderTopic()}
                {step === 'loading' && renderLoading()}
                {step === 'error' && renderError()}
                {step === 'quiz' && renderQuiz()}
                {step === 'results' && renderResults()}
            </main>
        </div>
    );
}