import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { Settings, UserPlus, Save, CheckCircle, ArrowLeft, ShieldAlert, Check, X } from 'lucide-react';
import AdminPanel from './AdminPanel';

export default function SettingsScreen({ user, userRole, profile, onBack }) {
  const [childrenList, setChildrenList] = useState([]);
  const [liveChildren, setLiveChildren] = useState([]);
  const [newChildName, setNewChildName] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [shareFriends, setShareFriends] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    if (userRole === 'parent') {
      loadParentSettings();
      
      const q = query(collection(db, 'users'), where('parentUid', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
          const stats = [];
          snap.forEach(d => stats.push({ id: d.id, ...d.data() }));
          setLiveChildren(stats);
      });
      return () => unsub();
    }
  }, [userRole, user.uid]);

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

  const approveFriendRequest = async (request) => {
    try {
      const { arrayUnion, arrayRemove } = await import('firebase/firestore');
      
      // 1. Remove from parent's pending list
      await updateDoc(doc(db, 'users', user.uid), {
         pendingFriendRequests: arrayRemove(request)
      });
      
      // 2. Add to Child's friends
      await updateDoc(doc(db, 'users', request.childUid), {
         friends: arrayUnion({ uid: request.requesterUid, type: 'child', name: request.requesterName })
      });
      
      // 3. Add to Requester's friends
      await updateDoc(doc(db, 'users', request.requesterUid), {
         friends: arrayUnion({ uid: request.childUid, type: 'child', name: request.childName })
      });
      
      alert("Friend request approved!");
    } catch(e) {
      console.error(e);
      alert("Failed to approve friend.");
    }
  };

  const denyFriendRequest = async (request) => {
    const { arrayRemove } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', user.uid), {
       pendingFriendRequests: arrayRemove(request)
    });
  };

  if (showAdmin) {
      return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  const isParent = userRole === 'parent' || userRole === 'admin' || user?.email;

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

        {isParent ? (
          <div className="space-y-8">
            {user?.email && (
                <div className="bg-slate-100 border-4 border-black p-4 rounded-2xl font-bold flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-8 h-8"/>
                    <div>
                        <div className="text-slate-500 text-sm">Signed in with Google</div>
                        <div className="text-lg text-slate-800">{user.email}</div>
                    </div>
                </div>
            )}

            <div className="border-4 border-black p-6 rounded-3xl bg-cyan-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
                  <ul className="space-y-4">
                    {childrenList.map(c => {
                      const stats = liveChildren.find(lc => lc.id === c.id || lc.childId === c.id);
                      return (
                        <li key={c.id} className="bg-white border-4 border-black p-4 rounded-2xl flex flex-col gap-3 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <div className="flex justify-between items-center bg-cyan-100 p-2 rounded-xl border-2 border-black">
                            <span className="text-xl font-black">{c.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 font-mono tracking-widest bg-white px-2 py-1 border-2 border-black rounded-md">{c.activeCode}</span>
                              <button
                                onClick={() => regenerateCode(c.id, c.name)}
                                disabled={loading}
                                className="bg-yellow-400 border-2 border-black rounded-lg px-3 py-1 text-sm font-black hover:bg-yellow-300 disabled:opacity-50 active:translate-y-[2px]"
                              >
                                New Code
                              </button>
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Are you sure you want to delete this child profile?")) return;
                                  setLoading(true);
                                  try {
                                    const { updateDoc } = await import('firebase/firestore');
                                    const newChildren = childrenList.filter(child => child.id !== c.id);
                                    await updateDoc(doc(db, 'users', user.uid), { children: newChildren });
                                    setChildrenList(newChildren);
                                    setGeneratedCode(null);
                                  } catch (e) {
                                    console.error(e);
                                    alert('Failed to remove child.');
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                disabled={loading}
                                className="bg-red-400 border-2 border-black rounded-lg p-1 font-black hover:bg-red-300 disabled:opacity-50 active:translate-y-[2px] text-white"
                                title="Delete Profile"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Live Stats */}
                          {stats ? (
                              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                  <div className="bg-slate-100 rounded-lg p-2 border-2 border-black">
                                      <div className="font-black text-lg">{stats.totalQuizzes || 0}</div>
                                      <div className="text-slate-500">Quizzes</div>
                                  </div>
                                  <div className="bg-slate-100 rounded-lg p-2 border-2 border-black">
                                      <div className="font-black text-lg">{stats.totalQuestsStarted || 0}</div>
                                      <div className="text-slate-500">Quests</div>
                                  </div>
                                  <div className="bg-slate-100 rounded-lg p-2 border-2 border-black">
                                      <div className="font-black text-lg">{stats.totalSessions || 0}</div>
                                      <div className="text-slate-500">Sessions</div>
                                  </div>
                                  <div className="bg-slate-100 rounded-lg p-2 border-2 border-black">
                                      <div className="font-black text-lg text-purple-600">{stats.xp || 0}</div>
                                      <div className="text-slate-500">XP</div>
                                  </div>
                              </div>
                          ) : (
                              <div className="text-slate-400 italic text-center p-2">Child hasn't logged in yet.</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Pending Friend Requests */}
            {profile?.pendingFriendRequests?.length > 0 && (
                <div className="border-4 border-black p-6 rounded-3xl bg-yellow-50">
                    <h3 className="text-2xl font-black mb-4 flex items-center gap-2 text-yellow-800">
                       <UserPlus className="w-6 h-6" /> Pending Friend Approvals
                    </h3>
                    <div className="space-y-4">
                        {profile.pendingFriendRequests.map((req, i) => (
                            <div key={i} className="bg-white border-4 border-black p-4 rounded-xl flex items-center justify-between font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div>
                                    <span className="text-xl font-black text-purple-600">{req.requesterName}</span> wants to be friends with <span className="text-xl font-black text-cyan-600">{req.childName}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => approveFriendRequest(req)}
                                        className="bg-green-400 border-4 border-black p-2 rounded-xl hover:bg-green-300"
                                    >
                                        <Check className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => denyFriendRequest(req)}
                                        className="bg-red-400 border-4 border-black p-2 rounded-xl hover:bg-red-300"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
