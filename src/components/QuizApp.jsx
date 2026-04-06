import React, { useState, useEffect } from 'react';
import { Play, Star, HelpCircle, Check, X, Sparkles, Brain, Trophy, ArrowRight, RefreshCw, AlertCircle, History, Medal, ArrowLeft, Eye } from 'lucide-react';
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || ""; // Fallback
const appId = import.meta.env.VITE_FIREBASE_APP_ID || "default-app-id";

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

const calculateCrystals = (difficulty, score, total) => {
    const percent = (score / total) * 100;
    if (difficulty === 'Easy') {
        return percent === 100 ? 10 : 0;
    }
    if (difficulty === 'Medium') {
        if (percent === 100) return 20;
        if (score >= 5) return 10;
        return 0;
    }
    if (difficulty === 'Hard') {
        if (percent === 100) return 30;
        if (score >= 8) return 20;
        if (score >= 5) return 10;
        return 0;
    }
    return 0;
};

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

export default function QuizApp({ user, onBack, questMode = false, difficulty: forcedDifficulty = '', forcedTopic = '', onQuestComplete, peekOption = false }) {
    const [step, setStep] = useState(questMode ? 'loading' : 'home');
    const [difficulty, setDifficulty] = useState(forcedDifficulty);
    const [topic, setTopic] = useState(forcedTopic);
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);

    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [onlyNewQuestions, setOnlyNewQuestions] = useState(true);
    const [sessionHistory, setSessionHistory] = useState([]);

    const [profile, setProfile] = useState({ 
        xp: 0, 
        lastMonthRank: "None", 
        currentMonth: new Date().toISOString().slice(0, 7),
        crystals: 0,
        items5050: 0,
        itemsPeek: 0
    });
    const [history, setHistory] = useState([]);
    const [disabledOptions, setDisabledOptions] = useState([]);

    useEffect(() => {
        if (!user) return;
        
        const profileRef = doc(db, 'users', user.uid);
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
            const nowMonth = new Date().toISOString().slice(0, 7);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({
                   xp: data.xp || 0,
                   lastMonthRank: data.lastMonthRank || "None",
                   currentMonth: data.currentMonth || nowMonth,
                   crystals: data.crystals || 0,
                   items5050: data.items5050 || 0,
                   itemsPeek: data.itemsPeek || 0
                });
            }
        });

        const historyRef = collection(db, 'users', user.uid, 'history');
        const unsubHistory = onSnapshot(historyRef, (snap) => {
            const histData = [];
            snap.forEach(d => histData.push({ id: d.id, ...d.data() }));
            setHistory(histData.sort((a, b) => b.timestamp - a.timestamp));
        });

        if (questMode && forcedTopic) {
            handleGenerateQuiz(forcedTopic, forcedDifficulty);
        }

        return () => {
            unsubProfile();
            unsubHistory();
        };
    }, [user, forcedTopic, forcedDifficulty, questMode]);

    const handleStart = () => {
        setScore(0);
        setCurrentQIndex(0);
        setQuestions([]);
        setFeedback(null);
        setSessionHistory([]);
        setTopic("");
        setDisabledOptions([]);
        setStep('difficulty');
    };

    const handleSelectDifficulty = (diff) => {
        setDifficulty(diff);
        setStep('topic');
    };

    const handleGenerateQuiz = async (t = topic, d = difficulty) => {
        if (!t.trim()) return;
        setStep('loading');
        setErrorMsg("");

        try {
            let exclusions = [];
            if (onlyNewQuestions) {
                exclusions = history
                    .filter(h => h.topic.toLowerCase() === t.toLowerCase())
                    .map(h => h.question);
            }

            let numQuestions = 10;
            if (d === 'Easy') numQuestions = 5;
            if (d === 'Medium') numQuestions = 8;
            if (d === 'Hard') numQuestions = 10;

            const generatedQuestions = await generateQuizWithAI(t, d, numQuestions, exclusions);
            setQuestions(generatedQuestions.slice(0, numQuestions));
            setStep('quiz');
        } catch (err) {
            console.error(err);
            setErrorMsg("Oops! The magic quiz machine had a hiccup. let's try again!");
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
        setDisabledOptions([]);
        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        } else {
            if (questMode && onQuestComplete) {
                onQuestComplete(score, sessionHistory);
                return;
            }

            setStep('loading');

            if (user) {
                try {
                    const isPerfect = score === questions.length;
                    const earnedXP = (score * 10) + (isPerfect ? 50 : 0);
                    const earnedCrystals = calculateCrystals(difficulty, score, questions.length);
                    
                    const profileRef = doc(db, 'users', user.uid);
                    await setDoc(profileRef, { 
                        xp: profile.xp + earnedXP,
                        crystals: profile.crystals + earnedCrystals,
                        totalQuizzes: (profile.totalQuizzes || 0) + 1
                    }, { merge: true });

                    const historyRef = collection(db, 'users', user.uid, 'history');
                    const promises = sessionHistory.map(item => addDoc(historyRef, item));
                    await Promise.all(promises);
                } catch (err) {
                    console.error("Error saving progress:", err);
                }
            }

            setStep('results');
        }
    };

    const use5050 = async () => {
        if (profile.items5050 <= 0 || feedback || disabledOptions.length > 0) return;
        
        const currentQ = questions[currentQIndex];
        const correctIdx = currentQ.correctIndex;
        const incorrectIndices = [0, 1, 2, 3].filter(i => i !== correctIdx);
        
        // Pick 2 random incorrect ones to disable
        const toDisable = [];
        while (toDisable.length < 2) {
            const rand = incorrectIndices[Math.floor(Math.random() * incorrectIndices.length)];
            if (!toDisable.includes(rand)) toDisable.push(rand);
        }

        setDisabledOptions(toDisable);
        
        // Deduct from Firestore
        const profileRef = doc(db, 'users', user.uid);
        await setDoc(profileRef, { items5050: profile.items5050 - 1 }, { merge: true });
    };

    const renderHome = () => {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-500">
                <button 
                  onClick={onBack}
                  className="absolute top-4 left-4 bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2 z-50"
                >
                  <ArrowLeft className="w-5 h-5" /> Dashboard
                </button>
                <div className="relative mb-6 text-center mt-12">
                    <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_8px_0_rgba(0,0,0,1)] rotate-[-2deg] animate-bounce">
                        Magic Quiz <br /> Adventure!
                    </h1>
                </div>

                <CartoonButton onClick={handleStart} colorClass="bg-green-400 hover:bg-green-300 text-3xl px-12 py-6">
                    <Play className="w-10 h-10 fill-current" />
                    Start Quiz
                </CartoonButton>
            </div>
        );
    };

    const renderDifficulty = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 max-w-2xl mx-auto text-center animate-in slide-in-from-bottom-8">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                Choose Your Challenge!
            </h2>
            <div className="flex flex-col gap-6 w-full px-4">
                <CartoonButton onClick={() => handleSelectDifficulty('Easy')} colorClass="bg-green-400">🟢 Easy Peasy</CartoonButton>
                <CartoonButton onClick={() => handleSelectDifficulty('Medium')} colorClass="bg-orange-400">🟠 A Little Tricky</CartoonButton>
                <CartoonButton onClick={() => handleSelectDifficulty('Hard')} colorClass="bg-red-400 text-white">🔴 Super Brainiac</CartoonButton>
            </div>
        </div>
    );

    const renderTopic = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 max-w-2xl mx-auto text-center px-4 animate-in slide-in-from-right-8">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                What do you want to learn about?
            </h2>
            <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Type a topic here!"
                className="w-full text-3xl font-bold p-6 rounded-3xl border-4 border-black shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] transition-all text-center mb-6 focus:outline-none"
                autoFocus
            />
            <CartoonButton
                onClick={() => handleGenerateQuiz()}
                disabled={!topic.trim()}
                colorClass="bg-cyan-400 w-full"
            >
                <Sparkles className="w-8 h-8" /> Create Magic Quiz!
            </CartoonButton>
        </div>
    );

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 text-center animate-pulse">
            <Brain className="w-32 h-32 text-pink-400 animate-bounce" />
            <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">Sprinkling Magic Dust...</h2>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 text-center px-4">
            <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">{errorMsg}</h2>
            <CartoonButton onClick={() => setStep('topic')} colorClass="bg-yellow-400"><RefreshCw className="w-8 h-8" /> Try Again!</CartoonButton>
        </div>
    );

    const renderQuiz = () => {
        const question = questions[currentQIndex];
        if (!question) return null;

        const colors = ["bg-pink-400", "bg-cyan-400", "bg-yellow-400", "bg-lime-400"];
        return (
            <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-6 relative pt-10">
                <div className="bg-white border-4 border-black rounded-[2rem] p-8 mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
                    <h2 className="text-3xl font-black">{question.question}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {question.options.map((opt, idx) => {
                        const isDisabled = disabledOptions.includes(idx);
                        return (
                            <button 
                                key={idx} 
                                onClick={() => handleAnswer(idx)} 
                                disabled={feedback !== null || isDisabled} 
                                className={`p-6 border-4 border-black rounded-[2rem] text-2xl font-bold shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${isDisabled ? 'opacity-0 pointer-events-none' : colors[idx % colors.length]}`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* Power-ups Row */}
                {!feedback && (
                    <div className="mt-8 flex justify-center gap-4">
                        <button
                            onClick={use5050}
                            disabled={profile.items5050 <= 0 || disabledOptions.length > 0}
                            className={`p-4 border-4 border-black rounded-2xl font-black flex items-center gap-2 shadow-[2px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all ${profile.items5050 > 0 ? 'bg-yellow-400' : 'bg-gray-300 grayscale opacity-50'}`}
                        >
                            <Sparkles className="w-6 h-6" /> 50/50 ({profile.items5050})
                        </button>
                        
                        {questMode && peekOption && (
                            <button
                                onClick={() => alert("The last player picked Answer #" + (Math.floor(Math.random() * 4) + 1))} // Simulated Peek
                                disabled={profile.itemsPeek <= 0}
                                className={`p-4 border-4 border-black rounded-2xl font-black flex items-center gap-2 shadow-[2px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all ${profile.itemsPeek > 0 ? 'bg-cyan-400' : 'bg-gray-300 grayscale opacity-50'}`}
                            >
                                <Eye className="w-6 h-6" /> Answer Peek ({profile.itemsPeek})
                            </button>
                        )}
                    </div>
                )}

                {feedback && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className={`border-8 border-black rounded-[3rem] p-8 max-w-2xl w-full text-center shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${feedback.isCorrect ? 'bg-green-300' : 'bg-rose-300'}`}>
                            <h3 className="text-4xl font-black mb-4">{feedback.isCorrect ? "Awesome Job!" : "Oops! Not quite!"}</h3>
                            <div className="bg-white border-4 border-black rounded-2xl p-6 mb-8 text-xl font-bold">
                                {feedback.explanation}
                            </div>
                            <CartoonButton onClick={handleNextQuestion} colorClass="bg-cyan-400 w-full text-3xl">
                                Next <ArrowRight className="w-8 h-8"/>
                            </CartoonButton>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderResults = () => {
        const earnedXP = (score * 10) + (score === questions.length ? 50 : 0);
        const earnedCrystals = calculateCrystals(difficulty, score, questions.length);
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center animate-in zoom-in duration-500 px-4">
                <h2 className="text-5xl font-black text-white drop-shadow-[0_6px_0_rgba(0,0,0,1)]">Quiz Complete!</h2>
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
                    <p className="text-8xl font-black text-purple-600">{score}/{questions.length}</p>
                    <p className="text-2xl font-black text-cyan-800 mt-4">+{earnedXP} XP Earned!</p>
                    {earnedCrystals > 0 && (
                        <p className="text-2xl font-black text-orange-500 mt-2">+{earnedCrystals} Crystals! 💎</p>
                    )}
                </div>
                <CartoonButton onClick={() => setStep('home')} colorClass="bg-pink-400 text-3xl"><RefreshCw className="w-10 h-10"/> Finish</CartoonButton>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 bg-blue-500 overflow-y-auto w-full z-30">
             {step === 'home' && renderHome()}
             {step === 'difficulty' && renderDifficulty()}
             {step === 'topic' && renderTopic()}
             {step === 'loading' && renderLoading()}
             {step === 'error' && renderError()}
             {step === 'quiz' && renderQuiz()}
             {step === 'results' && renderResults()}
        </div>
    );
}
