import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Users, UserPlus, Search, Shield, ArrowLeft, Trophy, Flame, Check, X } from 'lucide-react';

export default function FriendsList({ user, userRole, parentUid, profile, onBack }) {
  const [friends, setFriends] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFriends();
  }, [user, userRole, parentUid]);

  const loadFriends = async () => {
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    let friendList = data.friends || [];

    // If child and parent shares friends
    if (userRole === 'child' && parentUid) {
      const parentDoc = await getDoc(doc(db, 'users', parentUid));
      if (parentDoc.exists() && parentDoc.data().shareFriends) {
        const parentFriends = parentDoc.data().friends || [];
        // merge unique
        const allIds = new Set([...friendList.map(f => f.uid), ...parentFriends.map(f => f.uid)]);
        friendList = Array.from(allIds).map(id => {
          return friendList.find(f => f.uid === id) || parentFriends.find(f => f.uid === id);
        });
      }
    }

    setFriends(friendList);
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setLoading(true);

    try {
      const q = query(collection(db, 'users'), where('friendCode', '==', searchCode.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert("Friend code not found!");
        setLoading(false);
        return;
      }

      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data();
      const targetUid = targetDoc.id;

      if (targetUid === user.uid) {
         alert("You can't add yourself!");
         setLoading(false); return;
      }

      if (profile?.friends?.some(f => f.uid === targetUid)) {
         alert("You are already friends!");
         setLoading(false); return;
      }

      await updateDoc(doc(db, 'users', targetUid), {
          incomingFriendRequests: arrayUnion({
              requesterUid: user.uid,
              requesterName: profile?.displayName || 'Unknown',
              requesterCode: profile?.friendCode || ''
          })
      });
      
      alert("Friend request sent to " + (targetData.displayName || 'friend') + "!");
      setSearchCode('');
    } catch (e) {
      console.error(e);
      alert("Error adding friend.");
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (req) => {
      try {
          await updateDoc(doc(db, 'users', user.uid), {
             incomingFriendRequests: arrayRemove(req),
             friends: arrayUnion({ uid: req.requesterUid, type: 'friend', name: req.requesterName })
          });
          
          await updateDoc(doc(db, 'users', req.requesterUid), {
             friends: arrayUnion({ uid: user.uid, type: 'friend', name: profile?.displayName || 'Unknown' })
          });
          
          alert("Friend added!");
          loadFriends();
      } catch (e) {
         alert("Error accepting friend");
      }
  };

  const declineRequest = async (req) => {
      try {
          await updateDoc(doc(db, 'users', user.uid), {
             incomingFriendRequests: arrayRemove(req)
          });
          loadFriends();
      } catch (e) {}
  };

  return (
    <div className="absolute inset-0 bg-blue-500 overflow-y-auto p-4 md:p-8 z-40">
      <button 
        onClick={onBack}
        className="bg-white border-4 border-black rounded-2xl px-4 py-2 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none mb-6 flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative overflow-hidden">
          <Users className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <h2 className="text-5xl font-black text-black">Friends List</h2>
        </div>

        <div className="bg-yellow-200 border-4 border-black p-4 rounded-3xl text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
            <span className="font-bold text-gray-700">Your Magic Friend Code:</span>
            <span className="text-4xl font-black tracking-widest text-black mt-2 bg-white px-6 py-2 rounded-2xl border-4 border-black">{profile?.friendCode || 'Loading...'}</span>
            <span className="text-sm font-bold text-gray-600 mt-3">Share this code so friends can send you a request!</span>
        </div>

        <div className="bg-cyan-100 border-4 border-black p-6 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-cyan-800">
            <UserPlus className="w-6 h-6" /> Add a Friend
          </h3>
          <form onSubmit={addFriend} className="flex flex-col sm:flex-row gap-3">
            <input 
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              placeholder="e.g. ZAK-TIGER"
              className="flex-1 min-w-0 border-4 border-black rounded-xl p-3 font-black text-lg uppercase placeholder:font-bold focus:outline-none focus:ring-4 focus:ring-cyan-300"
            />
            <button 
              disabled={loading}
              className="bg-green-400 border-4 border-black rounded-xl p-3 px-6 font-black hover:bg-green-300 disabled:opacity-50 active:translate-y-[2px] shrink-0"
            >
              Add
            </button>
          </form>
        </div>

        {profile?.incomingFriendRequests?.length > 0 && (
            <div className="bg-orange-100 border-4 border-black p-6 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black mb-4 text-orange-800">Incoming Requests!</h3>
                <div className="space-y-3">
                    {profile.incomingFriendRequests.map((req, idx) => (
                        <div key={idx} className="bg-white border-2 border-black rounded-xl p-3 flex justify-between items-center font-bold">
                            <div>
                                <div className="text-lg font-black text-black">{req.requesterName}</div>
                                <div className="text-xs text-gray-500 font-mono tracking-widest">{req.requesterCode}</div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => acceptRequest(req)}
                                    className="bg-green-400 border-2 border-black p-2 rounded-lg hover:bg-green-300"
                                >
                                    <Check className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => declineRequest(req)}
                                    className="bg-red-400 border-2 border-black p-2 rounded-lg hover:bg-red-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {friends.length === 0 ? (
            <div className="col-span-full bg-white border-4 border-black rounded-3xl p-8 text-center text-xl font-bold text-gray-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              No friends yet! Ask them for their magic code!
            </div>
          ) : (
            friends.map((f, i) => (
              <div key={i} className="bg-white border-4 border-black rounded-2xl p-4 flex flex-col shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                {f.type === 'parent' && (
                  <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 text-xs font-black px-2 py-1 border-2 border-black rounded-lg">PARENT</div>
                )}
                <div className="text-xl font-black mb-1">{f.name}</div>
                <div className="flex gap-4 mt-4">
                   {/* In a complete implementation we would query their specific stats from their user profile or subcollection. Simulated UI here. */}
                   <div className="bg-yellow-100 rounded-lg p-2 flex items-center gap-2 border-2 border-black flex-1 text-sm font-bold">
                     <Trophy className="w-4 h-4 text-yellow-600" /> Rank: Star
                   </div>
                   <div className="bg-orange-100 rounded-lg p-2 flex items-center gap-2 border-2 border-black flex-1 text-sm font-bold">
                     <Flame className="w-4 h-4 text-orange-600" /> Day 2
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
