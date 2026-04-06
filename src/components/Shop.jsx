import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ShoppingBag, Sparkles, Eye, ArrowLeft, Gem, AlertCircle, CheckCircle2 } from 'lucide-react';

const SHOP_ITEMS = [
    {
        id: 'items5050',
        name: '50 / 50',
        description: 'Remove 2 wrong answers from any question!',
        icon: <Sparkles className="w-10 h-10 text-yellow-400" />,
        price: 50,
        max: 3,
        color: 'bg-yellow-100',
        borderColor: 'border-yellow-400'
    },
    {
        id: 'itemsPeek',
        name: 'Answer Peek',
        description: 'See what the previous player picked in a Quest!',
        icon: <Eye className="w-10 h-10 text-cyan-400" />,
        price: 100,
        max: 3,
        color: 'bg-cyan-100',
        borderColor: 'border-cyan-400'
    }
];

export default function Shop({ user, profile, onBack }) {
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }

    const buyItem = async (item) => {
        if ((profile?.crystals || 0) < item.price) {
            setStatus({ type: 'error', message: "Not enough Crystals! Go play some quizzes! 💎" });
            return;
        }

        const currentCount = profile?.[item.id] || 0;
        if (currentCount >= item.max) {
            setStatus({ type: 'error', message: `You already have the max (${item.max}) of these!` });
            return;
        }

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                crystals: (profile?.crystals || 0) - item.price,
                [item.id]: currentCount + 1
            });
            setStatus({ type: 'success', message: `Yay! You got a ${item.name}! 🎉` });
        } catch (e) {
            console.error(e);
            setStatus({ type: 'error', message: "Oops! Something went wrong with the shop magic." });
        }
    };

    return (
        <div className="absolute inset-0 bg-blue-500 overflow-y-auto p-4 md:p-8 z-50 animate-in slide-in-from-bottom-8">
            <button 
                onClick={onBack}
                className="bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2"
            >
                <ArrowLeft className="w-5 h-5" /> Back
            </button>

            <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center relative overflow-hidden">
                    <ShoppingBag className="w-20 h-20 text-pink-500 mx-auto mb-4" />
                    <h2 className="text-5xl font-black text-black mb-2">Magic Shop</h2>
                    <div className="inline-flex items-center gap-3 bg-blue-100 border-4 border-black px-6 py-2 rounded-full font-black text-2xl text-blue-600">
                        <Gem className="w-8 h-8" /> {profile?.crystals || 0} Crystals
                    </div>
                </div>

                {status && (
                    <div className={`p-4 border-4 border-black rounded-2xl font-bold flex items-center gap-3 animate-in fade-in zoom-in ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        {status.message}
                        <button onClick={() => setStatus(null)} className="ml-auto text-xl font-black">X</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {SHOP_ITEMS.map((item) => {
                        const count = profile?.[item.id] || 0;
                        const isMax = count >= item.max;
                        
                        return (
                            <div key={item.id} className={`border-8 border-black rounded-[2.5rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center transition-transform hover:scale-105 bg-white`}>
                                <div className={`p-6 rounded-3xl border-4 border-black mb-4 ${item.color}`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-3xl font-black mb-2">{item.name}</h3>
                                <p className="font-bold text-gray-500 mb-6 leading-tight">{item.description}</p>
                                
                                <div className="mt-auto w-full space-y-4">
                                    <div className="flex justify-between font-black text-lg px-2">
                                        <span>Inventory:</span>
                                        <span className={isMax ? 'text-red-500' : 'text-green-600'}>{count} / {item.max}</span>
                                    </div>
                                    
                                    <button
                                        onClick={() => buyItem(item)}
                                        disabled={isMax || (profile?.crystals || 0) < item.price}
                                        className={`w-full p-4 border-4 border-black rounded-2xl font-black text-2xl flex items-center justify-center gap-3 shadow-[0px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[6px] transition-all ${isMax || (profile?.crystals || 0) < item.price ? 'bg-gray-200 grayscale opacity-50' : 'bg-green-400 hover:bg-green-300'}`}
                                    >
                                        <Gem className="w-6 h-6" /> {item.price}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="bg-yellow-200 border-4 border-black p-6 rounded-3xl text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-black text-xl italic text-yellow-800">
                        "Spend crystals to gain magical advantages in your quizzes and quests!" 🧙‍♂️
                    </p>
                </div>
            </div>
        </div>
    );
}
