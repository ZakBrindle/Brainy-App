import React, { useState, useEffect } from 'react';
import { Play, Star, HelpCircle, Check, X, Sparkles, Brain, Trophy, ArrowRight, RefreshCw, AlertCircle, History, Medal, ArrowLeft, Eye } from 'lucide-react';
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, arrayUnion } from 'firebase/firestore';
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

const generateQuizWithAI = async (topic, difficulty, numQuestions, previousQuestions = [], aiModels = [""]) => {
    const validModels = aiModels.filter(m => m && m.trim().length > 0);
    if (validModels.length === 0) validModels.push("gemini-2.5-flash-preview-09-2025");

    const systemInstruction = `You are a fun, cheerful, and educational quiz generator for children. Generate exactly ${numQuestions} multiple-choice questions about the given topic.`;

    let exclusionPrompt = "";
    if (previousQuestions.length > 0) {
        exclusionPrompt = `\nCRITICAL: DO NOT generate any of the following questions. The user has already answered them:\n${previousQuestions.map(q => `- ${q}`).join('\n')}\n`;
    }

    let promptText = "";
    if (difficulty === 'Mastery') {
        promptText = `
    Topic: "${topic}"
    Mode: "Mastery Challenge"
    ${exclusionPrompt}
    
    Guidelines:
    1. The language must be suitable for kids, engaging, and easy to read.
    2. Exactly 4 options per question.
    3. Generate exactly ${numQuestions} questions.
    4. Questions 1 to 4 must be Easy difficulty.
    5. Questions 5 to 9 must be Medium difficulty (incorrect options plausible).
    6. Questions 10 to 15 must be Hard difficulty (challenging for the age group).
    7. Provide a fun, educational explanation for the answer that teaches them something cool about the topic.

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
    } else {
        promptText = `
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
    }

    const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" }
    };

    let lastError = null;

    for (let i = 0; i < validModels.length; i++) {
        const modelName = validModels[i].trim();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} from model ${modelName}`);
            
            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("Invalid response structure from AI");
            
            const parsedData = JSON.parse(textResponse);
            if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
                throw new Error("Missing questions array in JSON");
            }
            return parsedData.questions;
        } catch (error) {
            console.warn(`Model ${modelName} failed:`, error);
            lastError = error;
            // Short delay before trying the next fallback
            if (i < validModels.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    throw lastError || new Error("All configured models failed.");
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

export default function QuizApp({ user, onBack, questMode = false, difficulty: forcedDifficulty = '', forcedTopic = '', onQuestComplete, peekOption = false, masteryMode = false }) {
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
    const [aiModels, setAiModels] = useState(["", "", ""]);

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

        const configRef = doc(db, 'config', 'gemini');
        const unsubConfig = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAiModels([data.model1 || "", data.model2 || "", data.model3 || ""]);
            }
        });

        if (questMode && forcedTopic) {
            handleGenerateQuiz(forcedTopic, forcedDifficulty);
        }

        return () => {
            unsubProfile();
            unsubHistory();
            unsubConfig();
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
        if (masteryMode) {
            setDifficulty('Mastery');
            setStep('topic');
        } else {
            setStep('difficulty');
        }
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
            if (d === 'Mastery') numQuestions = 15;

            const generatedQuestions = await generateQuizWithAI(t, d, numQuestions, exclusions, aiModels);
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
            if (masteryMode && currentQIndex === 3) {
                setStep('masteryTransitionMedium');
                return;
            }
            if (masteryMode && currentQIndex === 8) {
                setStep('masteryTransitionHard');
                return;
            }
            setCurrentQIndex(prev => prev + 1);
        } else {
            if (questMode && onQuestComplete) {
                onQuestComplete(score, sessionHistory);
                return;
            }

            setStep('loading');

            if (user) {
                try {
                    const profileRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(profileRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();

                        const isPerfect = score === questions.length;
                        let earnedXP = (score * 10) + (isPerfect ? 50 : 0);
                        let earnedCrystals = calculateCrystals(difficulty, score, questions.length);
                        
                        let cTotal = userData.currentQuizStreak || 0;
                        let mTotal = userData.maxQuizStreak || 0;
                        let cEasy = userData.currentEasyStreak || 0;
                        let mEasy = userData.maxEasyStreak || 0;
                        let cMed = userData.currentMediumStreak || 0;
                        let mMed = userData.maxMediumStreak || 0;
                        let cHard = userData.currentHardStreak || 0;
                        let mHard = userData.maxHardStreak || 0;

                        if (isPerfect) {
                            cTotal++;
                            if (cTotal > mTotal) mTotal = cTotal;
                            
                            if (difficulty === 'Easy') {
                                cEasy++;
                                if (cEasy > mEasy) mEasy = cEasy;
                            } else if (difficulty === 'Medium') {
                                cMed++;
                                if (cMed > mMed) mMed = cMed;
                            } else if (difficulty === 'Hard') {
                                cHard++;
                                if (cHard > mHard) mHard = cHard;
                            }
                        } else {
                            cTotal = 0;
                            cEasy = 0;
                            cMed = 0;
                            cHard = 0;
                        }
                        
                        let updates = {};
                        if (masteryMode) {
                            if (score >= 13) {
                                // Mastered! 
                                updates.masteryList = arrayUnion(topic.trim());
                                // Extra rewards for mastery!
                                earnedXP += 100;
                                earnedCrystals += 50;
                            }
                        }

                        await setDoc(profileRef, { 
                            xp: (userData.xp || 0) + earnedXP,
                            crystals: (userData.crystals || 0) + earnedCrystals,
                            totalQuizzes: (userData.totalQuizzes || 0) + 1,
                            currentQuizStreak: cTotal,
                            maxQuizStreak: mTotal,
                            currentEasyStreak: cEasy,
                            maxEasyStreak: mEasy,
                            currentMediumStreak: cMed,
                            maxMediumStreak: mMed,
                            currentHardStreak: cHard,
                            maxHardStreak: mHard,
                            ...updates
                        }, { merge: true });
                    }

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
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-500 relative w-full">
                {/* Dynamic Floating Decorations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <Star className="absolute top-24 left-[10%] w-16 h-16 text-yellow-300 fill-current animate-bounce" style={{ animationDuration: '2.5s' }} />
                    <Sparkles className="absolute top-40 right-[15%] w-20 h-20 text-yellow-200 animate-pulse" style={{ animationDuration: '1.5s' }} />
                    <Brain className="absolute bottom-48 left-[15%] w-20 h-20 text-pink-300 animate-bounce" style={{ animationDuration: '3.5s' }} />
                    <Trophy className="absolute bottom-32 right-[12%] w-16 h-16 text-orange-300 animate-pulse" style={{ animationDuration: '2s' }} />
                    <HelpCircle className="absolute top-1/3 left-1/4 w-32 h-32 text-white/20 -rotate-12" />
                    <HelpCircle className="absolute bottom-1/3 right-1/4 w-48 h-48 text-white/20 rotate-12" />
                </div>

                <button 
                  onClick={onBack}
                  className="absolute top-4 left-4 bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2 z-50"
                >
                  <ArrowLeft className="w-5 h-5" /> Dashboard
                </button>
                <div className="relative mb-6 text-center mt-12 z-10">
                    <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_8px_0_rgba(0,0,0,1)] rotate-[-2deg] animate-bounce" style={{ animationDuration: '2s' }}>
                        Magic Quiz <br /> Adventure!
                    </h1>
                </div>

                <div className="z-10">
                    <CartoonButton onClick={handleStart} colorClass="bg-green-400 hover:bg-green-300 text-3xl px-12 py-6">
                        <Play className="w-10 h-10 fill-current" />
                        Start Quiz
                    </CartoonButton>
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
        const progress = (currentQIndex / questions.length) * 100;
        const isSparkling = progress >= 80;

        return (
            <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-6 relative pt-16">
                
                {/* Fixed Progress Bar */}
                <div className="fixed top-0 left-0 right-0 h-8 bg-blue-900 border-b-4 border-black z-40 overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.5)]">
                    <div 
                        className={`h-full transition-all duration-700 ease-out relative flex items-center justify-end pr-2 border-r-4 border-black ${isSparkling ? 'bg-gradient-to-r from-yellow-300 to-orange-400' : 'bg-green-400'}`}
                        style={{ width: `${Math.max(progress, 2)}%` }}
                    >
                        {isSparkling && (
                            <div className="flex gap-1 animate-pulse">
                                <Sparkles className="w-5 h-5 text-white" />
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                    {/* Mastery Checkpoints */}
                    {masteryMode && questions.length === 15 && (
                        <>
                            <div className="absolute top-0 bottom-0 left-[26.66%] w-2 bg-black border-l-2 border-r-2 border-black"></div>
                            <div className="absolute top-0 bottom-0 left-[60%] w-2 bg-black border-l-2 border-r-2 border-black"></div>
                        </>
                    )}
                </div>

                <div className="bg-white border-4 border-black rounded-[2rem] p-8 mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative mt-6">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 border-4 border-black px-4 py-1 rounded-full font-black text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {currentQIndex + 1} / {questions.length}
                    </div>
                    <h2 className="text-3xl font-black mt-2">{question.question}</h2>
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
        const masteryWon = masteryMode && score >= 13;
        let earnedXP = (score * 10) + (score === questions.length ? 50 : 0);
        let earnedCrystals = calculateCrystals(difficulty, score, questions.length);
        
        if (masteryWon) {
            earnedXP += 100;
            earnedCrystals += 50;
        }
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in zoom-in duration-500 max-w-2xl mx-auto w-full px-4 text-center">
                <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-[0_8px_0_rgba(0,0,0,1)] animate-bounce" />
                <h2 className="text-5xl md:text-6xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)] mb-4">Quiz Complete!</h2>
                
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 w-full shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
                    {masteryMode && (
                        <div className={`w-full p-6 mb-6 border-4 border-black rounded-3xl ${masteryWon ? 'bg-yellow-200' : 'bg-red-100'} flex flex-col items-center animate-pulse`}>
                            {masteryWon ? (
                                <>
                                    <Medal className="w-16 h-16 text-yellow-600 mb-2" />
                                    <h3 className="text-3xl font-black text-yellow-800">MASTERY GRANTED!</h3>
                                    <p className="font-bold mt-2">You achieved Mastery in "{topic}"!</p>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
                                    <h3 className="text-3xl font-black text-red-800">NOT QUITE!</h3>
                                    <p className="font-bold mt-2">You needed 13/15. You got {score}. Try again!</p>
                                </>
                            )}
                        </div>
                    )}

                    <div className="text-8xl font-black text-green-500 drop-shadow-[0_4px_0_rgba(0,0,0,1)] tracking-widest mb-2">
                        {score}/{questions.length}
                    </div>
                    <p className="text-2xl font-black text-cyan-800 mt-4">+{earnedXP} XP Earned!</p>
                    {earnedCrystals > 0 && (
                        <p className="text-2xl font-black text-orange-500 mt-2">+{earnedCrystals} Crystals! 💎</p>
                    )}
                </div>
                <CartoonButton onClick={() => setStep('home')} colorClass="bg-pink-400 text-3xl"><RefreshCw className="w-10 h-10"/> Finish</CartoonButton>
            </div>
        );
    };

    const renderMasteryTransition = (level) => {
        const isHard = level === 'hard';
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in slide-in-from-bottom-8 max-w-2xl mx-auto text-center px-4">
                <Brain className={`w-32 h-32 animate-bounce ${isHard ? 'text-red-400' : 'text-orange-400'}`} />
                <h2 className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                    LEVEL UP!
                </h2>
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                    <p className={`text-4xl font-black ${isHard ? 'text-red-600' : 'text-orange-500'} mb-4`}>
                        {isHard ? 'HARD MODE ACTIVATED' : 'MEDIUM QUESTIONS AHEAD'}
                    </p>
                    <p className="text-xl font-bold text-gray-500">
                        {isHard ? "Only 6 questions left to achieve Mastery. You can do this!" : "Things are getting trickier. Keep your focus up!"}
                    </p>
                </div>
                <CartoonButton 
                    onClick={() => {
                        setCurrentQIndex(prev => prev + 1);
                        setStep('quiz');
                    }} 
                    colorClass={`text-3xl px-12 ${isHard ? 'bg-red-400' : 'bg-orange-400'}`}
                >
                    Continue <ArrowRight className="w-8 h-8"/>
                </CartoonButton>
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
             {step === 'masteryTransitionMedium' && renderMasteryTransition('medium')}
             {step === 'masteryTransitionHard' && renderMasteryTransition('hard')}
             {step === 'results' && renderResults()}
        </div>
    );
}
