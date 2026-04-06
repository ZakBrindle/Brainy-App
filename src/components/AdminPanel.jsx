import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, Users, Settings, Database, Server, RefreshCw, Save } from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [view, setView] = useState('users'); // 'users' or 'config'
    
    // Users state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Config state
    const [config, setConfig] = useState(["", "", ""]);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
        if (view === 'users') {
            fetchUsers();
        } else if (view === 'config') {
            fetchConfig();
        }
    }, [view]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const snap = await getDocs(collection(db, 'users'));
            const data = [];
            snap.forEach(d => data.push({ id: d.id, ...d.data() }));
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchConfig = async () => {
        setLoadingConfig(true);
        try {
            const snap = await getDoc(doc(db, 'config', 'gemini'));
            if (snap.exists()) {
                const data = snap.data();
                setConfig([
                    data.model1 || "",
                    data.model2 || "",
                    data.model3 || ""
                ]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingConfig(false);
        }
    };

    const saveConfig = async () => {
        setSaveStatus("saving");
        try {
            await setDoc(doc(db, 'config', 'gemini'), {
                model1: config[0],
                model2: config[1],
                model3: config[2]
            }, { merge: true });
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (e) {
            console.error(e);
            setSaveStatus("error");
        }
    };

    const updateConfigField = (index, value) => {
        const next = [...config];
        next[index] = value;
        setConfig(next);
    };

    return (
        <div className="absolute inset-0 bg-slate-800 overflow-y-auto p-4 md:p-8 z-[100] text-slate-800">
            <div className="flex justify-between items-center mb-6">
                <button 
                    onClick={onBack}
                    className="bg-white border-4 border-slate-900 rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[4px] active:shadow-none flex items-center gap-2"
                >
                    <ArrowLeft className="w-5 h-5" /> Back to Settings
                </button>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setView('users')}
                        className={`border-4 border-slate-900 rounded-2xl px-6 py-2 font-black shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[4px] active:shadow-none flex items-center gap-2 ${view === 'users' ? 'bg-cyan-400' : 'bg-white'}`}
                    >
                        <Users className="w-5 h-5" /> Active Users
                    </button>
                    <button 
                        onClick={() => setView('config')}
                        className={`border-4 border-slate-900 rounded-2xl px-6 py-2 font-black shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[4px] active:shadow-none flex items-center gap-2 ${view === 'config' ? 'bg-pink-400' : 'bg-white'}`}
                    >
                        <Server className="w-5 h-5" /> AI Config
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto bg-white border-8 border-slate-900 rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] min-h-[70vh]">
                
                {view === 'users' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-4xl font-black flex items-center gap-3">
                                <Database className="w-10 h-10 text-cyan-500" />
                                Users Tracker
                            </h2>
                            <button onClick={fetchUsers} className="bg-slate-200 border-2 border-slate-900 p-2 rounded-xl hover:bg-slate-300">
                                <RefreshCw className={`w-6 h-6 ${loadingUsers ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto border-4 border-slate-900 rounded-2xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 border-b-4 border-slate-900">
                                    <tr>
                                        <th className="p-4 font-black border-r-4 border-slate-900">Name</th>
                                        <th className="p-4 font-black border-r-4 border-slate-900">Email / Parent</th>
                                        <th className="p-4 font-black border-r-4 border-slate-900">Role</th>
                                        <th className="p-4 font-black border-r-4 border-slate-900">Logins</th>
                                        <th className="p-4 font-black border-r-4 border-slate-900">Quizzes</th>
                                        <th className="p-4 font-black">Quests</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b-2 border-slate-300 hover:bg-slate-50 font-bold">
                                            <td className="p-4 border-r-4 border-slate-900">{u.displayName || 'Unknown'}</td>
                                            <td className="p-4 border-r-4 border-slate-900 text-sm">{u.email || (u.parentUid ? 'Child Account' : 'N/A')}</td>
                                            <td className="p-4 border-r-4 border-slate-900 capitalize">{u.role}</td>
                                            <td className="p-4 border-r-4 border-slate-900 text-center">{u.totalSessions || 0}</td>
                                            <td className="p-4 border-r-4 border-slate-900 text-center">{u.totalQuizzes || 0}</td>
                                            <td className="p-4 text-center">{u.totalQuestsStarted || 0}</td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && !loadingUsers && (
                                        <tr><td colSpan="6" className="p-8 text-center text-slate-500 font-bold">No users found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'config' && (
                    <div className="space-y-6 max-w-2xl">
                        <h2 className="text-4xl font-black flex items-center gap-3">
                            <Settings className="w-10 h-10 text-pink-500" />
                            Gemini Model Fallbacks
                        </h2>
                        <p className="font-bold text-slate-500 text-lg mb-8">
                            Configure up to 3 Gemini models. The app will attempt to generate quizzes sequentially. If model 1 fails, it tries model 2, etc.
                        </p>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-xl">1. Primary Model</label>
                                <input 
                                    className="border-4 border-slate-900 rounded-xl p-4 font-bold text-lg"
                                    value={config[0]}
                                    onChange={e => updateConfigField(0, e.target.value)}
                                    placeholder="e.g. gemini-2.5-flash-preview-09-2025"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-xl">2. Secondary Model (Fallback 1)</label>
                                <input 
                                    className="border-4 border-slate-900 rounded-xl p-4 font-bold text-lg"
                                    value={config[1]}
                                    onChange={e => updateConfigField(1, e.target.value)}
                                    placeholder="e.g. gemini-1.5-pro-latest"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-xl">3. Tertiary Model (Fallback 2)</label>
                                <input 
                                    className="border-4 border-slate-900 rounded-xl p-4 font-bold text-lg"
                                    value={config[2]}
                                    onChange={e => updateConfigField(2, e.target.value)}
                                    placeholder="e.g. gemini-1.5-flash"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={saveConfig}
                            className="mt-8 bg-green-400 hover:bg-green-300 border-4 border-slate-900 rounded-2xl px-8 py-4 font-black shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[4px] active:shadow-none flex items-center gap-2 text-xl"
                        >
                            <Save className="w-6 h-6" /> Save Models
                        </button>
                        {saveStatus === 'saved' && <p className="text-green-600 font-bold mt-2">Saved successfully!</p>}
                        {saveStatus === 'error' && <p className="text-red-600 font-bold mt-2">Error saving to config.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
