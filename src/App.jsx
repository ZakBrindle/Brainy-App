import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import SettingsScreen from './components/Settings';
import FriendsList from './components/FriendsList';
import QuizApp from './components/QuizApp';
import ShopScreen from './components/Shop';
import QuestLobby from './components/QuestLobby';
import QuestGameLoop from './components/QuestGameLoop';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [parentUid, setParentUid] = useState(null);
  
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, settings, friends, quiz, shop, questLobby, questGame
  const [activeQuest, setActiveQuest] = useState(null);
  const [activeQuestId, setActiveQuestId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to user document
        const unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            let r = data.role;
            
            // Auto-resolve legacy google accounts to parent
            if (!r && currentUser.email) {
                r = 'parent';
                import('firebase/firestore').then(({ updateDoc }) => {
                    updateDoc(doc(db, 'users', currentUser.uid), { role: 'parent' }).catch(console.error);
                });
            }

            setUserRole(r);
            setParentUid(data.parentUid || null);
            setProfileData({ ...data, role: r });
          }
          setLoading(false);
        });
        return () => unsubDoc();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-500 flex items-center justify-center text-white text-3xl font-black tracking-widest drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
        LOADING STARDUST...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-blue-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 to-blue-600 font-sans selection:bg-pink-400 overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff33 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
      
      {currentView === 'dashboard' && (
        <Dashboard 
          user={user} 
          userRole={userRole} 
          profile={profileData} 
          onNavigate={setCurrentView} 
        />
      )}
      
      {currentView === 'settings' && (
        <SettingsScreen 
          user={user} 
          userRole={userRole} 
          profile={profileData}
          onBack={() => setCurrentView('dashboard')} 
        />
      )}
      
      {currentView === 'friends' && (
        <FriendsList 
          user={user} 
          userRole={userRole} 
          parentUid={parentUid}
          profile={profileData}
          onBack={() => setCurrentView('dashboard')} 
        />
      )}
      
      {currentView === 'quiz' && (
        <QuizApp 
          user={user} 
          onBack={() => setCurrentView('dashboard')} 
        />
      )}

      {currentView === 'shop' && (
        <ShopScreen 
          user={user} 
          profile={profileData}
          onBack={() => setCurrentView('dashboard')} 
        />
      )}

      {currentView === 'questLobby' && (
        <QuestLobby 
          user={user} 
          profile={profileData}
          onBack={() => setCurrentView('dashboard')} 
          onStartQuest={(quest, id) => {
            setActiveQuest(quest);
            setActiveQuestId(id);
            setCurrentView('questGame');
          }}
        />
      )}

      {currentView === 'questGame' && (
        <QuestGameLoop 
          user={user} 
          profile={profileData}
          questId={activeQuestId}
          initialQuest={activeQuest}
          onBack={() => setCurrentView('dashboard')} 
        />
      )}
    </div>
  );
}
