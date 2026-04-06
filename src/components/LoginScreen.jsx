import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Sparkles, Key, UserCheck, AlertCircle } from 'lucide-react';

const provider = new GoogleAuthProvider();

export default function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, 'users', result.user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          role: 'parent',
          displayName: result.user.displayName,
          email: result.user.email,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
      setError('Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeLogin = async (e) => {
    e.preventDefault();
    if (!code || code.length < 5) return;
    setLoading(true);
    setError('');
    
    try {
      const q = query(collection(db, 'loginCodes'), where('code', '==', code.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Invalid code. Please try again!');
        setLoading(false);
        return;
      }
      
      const codeData = querySnapshot.docs[0].data();
      
      const createdAt = new Date(codeData.createdAt).getTime();
      const now = new Date().getTime();
      const ageInMinutes = (now - createdAt) / (1000 * 60);
      
      if (ageInMinutes > 60) {
        setError('This code has expired. Please ask your parent for a new one!');
        setLoading(false);
        return;
      }
      
      // Sign in anonymously for child session
      const { user } = await signInAnonymously(auth);
      
      // Link this anonymous session to the child profile
      await setDoc(doc(db, 'users', user.uid), {
        role: 'child',
        parentUid: codeData.parentUid,
        childId: codeData.childId,
        displayName: codeData.childName,
        createdAt: new Date().toISOString(),
        friends: [{ uid: codeData.parentUid, type: 'parent', name: 'Parent' }]
      }, { merge: true });
      
      // Auto-add child to parent
      const { updateDoc, arrayUnion } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', codeData.parentUid), {
        friends: arrayUnion({ uid: user.uid, type: 'child', name: codeData.childName })
      });

    } catch (err) {
      console.error(err);
      setError('Failed to login with code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 to-blue-600 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff33 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
      
      <div className="bg-white border-8 border-black rounded-[3rem] p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-xl w-full z-10 animate-in zoom-in-95">
        <div className="text-center mb-10">
          <Sparkles className="w-16 h-16 text-yellow-400 mx-auto animate-spin-slow mb-4" />
          <h1 className="text-5xl font-black text-black drop-shadow-[0_2px_0_rgba(255,255,255,1)]">
            Welcome to Brainy!
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-2">Get ready to learn and play!</p>
        </div>

        {error && (
          <div className="bg-red-100 border-4 border-red-500 text-red-700 p-4 rounded-2xl font-bold flex items-center gap-2 mb-6">
            <AlertCircle className="w-6 h-6 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-8">
          <div className="border-4 border-black rounded-3xl p-6 bg-cyan-100 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-cyan-400 border-4 border-black px-4 py-1 rounded-full font-black text-xl">
              Parents
            </div>
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border-4 border-black font-black text-xl p-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 active:translate-y-[2px] transition-all disabled:opacity-50"
            >
              <UserCheck className="w-6 h-6 text-blue-500" />
              Sign in with Google
            </button>
          </div>

          <div className="border-4 border-black rounded-3xl p-6 bg-pink-100 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-pink-400 border-4 border-black px-4 py-1 rounded-full font-black text-xl">
              Kids
            </div>
            <form onSubmit={handleCodeLogin} className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="MAGIC CODE" 
                className="flex-1 min-w-0 border-4 border-black rounded-2xl p-3 font-black text-xl md:text-2xl text-center uppercase focus:outline-none focus:ring-4 ring-pink-400"
              />
              <button 
                type="submit"
                disabled={loading}
                className="bg-yellow-400 border-4 border-black rounded-2xl p-4 hover:bg-yellow-300 active:translate-y-[2px] transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
              >
                <Key className="w-8 h-8" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
