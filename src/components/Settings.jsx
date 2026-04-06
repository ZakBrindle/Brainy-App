import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Settings, UserPlus, Save, CheckCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import AdminPanel from './AdminPanel';

export default function SettingsScreen({ user, userRole, onBack }) {
  const [childrenList, setChildrenList] = useState([]);
  const [newChildName, setNewChildName] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [shareFriends, setShareFriends] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    if (userRole === 'parent') {
      loadParentSettings();
    }
  }, [userRole]);

  const loadParentSettings = async () => {
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setShareFriends(data.shareFriends || false);
      if (data.children) setChildrenList(data.children);
    }
  };

  const generateChildCode = async () => {
    if (!newChildName.trim()) return;
    setLoading(true);
    
    // Generate simple 6 char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const childId = 'child_' + Date.now();
    
    try {
      // Create code entry
      await addDoc(collection(db, 'loginCodes'), {
        code,
        parentUid: user.uid,
        childId,
        childName: newChildName,
        createdAt: new Date().toISOString()
      });

      // Update parent document
      const docRef = doc(db, 'users', user.uid);
      const newChildren = [...childrenList, { id: childId, name: newChildName, activeCode: code }];
      await updateDoc(docRef, { children: newChildren });
      
      setChildrenList(newChildren);
      setGeneratedCode(code);
      setNewChildName('');
    } catch (e) {
      console.error(e);
      alert('Failed to generate code.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateCode = async (childId, childName) => {
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      await addDoc(collection(db, 'loginCodes'), {
        code,
        parentUid: user.uid,
        childId,
        childName,
        createdAt: new Date().toISOString()
      });

      const docRef = doc(db, 'users', user.uid);
      const newChildren = childrenList.map(c => c.id === childId ? { ...c, activeCode: code } : c);
      await updateDoc(docRef, { children: newChildren });
      
      setChildrenList(newChildren);
      setGeneratedCode(code);
    } catch (e) {
      console.error(e);
      alert('Failed to regenerate code.');
    } finally {
      setLoading(false);
    }
  };

  const toggleShareFriends = async () => {
    const newVal = !shareFriends;
    setShareFriends(newVal);
    await updateDoc(doc(db, 'users', user.uid), { shareFriends: newVal });
  };

  if (showAdmin) {
      return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="absolute inset-0 bg-blue-500 overflow-y-auto p-4 md:p-8 z-50">
      <button 
        onClick={onBack}
        className="bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-2xl mx-auto bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-4xl font-black mb-8 flex items-center gap-3">
          <Settings className="w-10 h-10 text-purple-500" />
          Settings
        </h2>

        {user?.email === 'z4kbrindle@gmail.com' && (
           <div className="border-4 border-black p-6 rounded-3xl bg-slate-800 text-white flex flex-col md:flex-row justify-between items-center mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4">
               <div>
                   <h3 className="text-2xl font-black flex items-center gap-2"><ShieldAlert className="text-yellow-400" /> Admin Controls</h3>
                   <p className="font-bold text-slate-300">Access user usage stats and configure AI model fallbacks.</p>
               </div>
               <button 
                  onClick={() => setShowAdmin(true)}
                  className="bg-yellow-400 text-black font-black border-4 border-black px-6 py-3 rounded-xl hover:bg-yellow-300 active:translate-y-[2px]"
               >
                   Open Admin Panel
               </button>
           </div>
        )}

        {userRole === 'parent' ? (
          <div className="space-y-8">
            <div className="border-4 border-black p-6 rounded-3xl bg-cyan-50">
              <h3 className="text-2xl font-black mb-4">Add a Child Profile</h3>
              <div className="flex gap-2 mb-4">
                <input 
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  placeholder="Child's Name"
                  className="flex-1 border-4 border-black rounded-xl p-3 font-bold text-lg"
                />
                <button 
                  onClick={generateChildCode}
                  disabled={loading || !newChildName.trim()}
                  className="bg-green-400 border-4 border-black rounded-xl px-4 font-black flex items-center gap-2 hover:bg-green-300 disabled:opacity-50"
                >
                  <UserPlus className="w-6 h-6" /> Create
                </button>
              </div>

              {generatedCode && (
                <div className="bg-yellow-200 border-4 border-black p-4 rounded-xl text-center mb-6">
                  <p className="font-bold">Here is the Magic Login Code:</p>
                  <p className="text-4xl font-black tracking-widest text-black my-2">{generatedCode}</p>
                  <p className="text-sm">Write this down! They will need it to play. Valid for 60 minutes.</p>
                </div>
              )}

              {childrenList.length > 0 && (
                <div>
                  <h4 className="font-black text-lg mb-2">Your Children</h4>
                  <ul className="space-y-2">
                    {childrenList.map(c => (
                      <li key={c.id} className="bg-white border-2 border-black p-3 rounded-lg flex justify-between items-center font-bold">
                        <span>{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 font-mono">{c.activeCode}</span>
                          <button
                            onClick={() => regenerateCode(c.id, c.name)}
                            disabled={loading}
                            className="bg-yellow-400 border-2 border-black rounded-lg px-3 py-1 text-sm font-black hover:bg-yellow-300 disabled:opacity-50"
                          >
                            New Code
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-4 border-black p-6 rounded-3xl bg-pink-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black">Share Friends</h3>
                <p className="font-bold text-gray-600">Your children will automatically be friends with your friends.</p>
              </div>
              <button 
                onClick={toggleShareFriends}
                className={`w-16 h-8 rounded-full border-4 border-black flex items-center p-1 transition-colors ${shareFriends ? 'bg-green-400' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-black rounded-full transition-transform ${shareFriends ? 'translate-x-8' : ''}`} />
              </button>
            </div>
            
            <button 
              onClick={() => auth.signOut()}
              className="w-full bg-red-400 hover:bg-red-300 border-4 border-black p-4 rounded-2xl font-black text-white text-xl active:translate-y-[2px]"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="font-bold text-xl">Ask your parents if you need help with settings!</p>
            <button 
              onClick={() => auth.signOut()}
              className="w-full bg-red-400 hover:bg-red-300 border-4 border-black p-4 rounded-2xl font-black text-white text-xl active:translate-y-[2px]"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
