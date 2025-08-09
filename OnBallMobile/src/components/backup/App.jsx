import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { isNativePlatform } from "./utils/capacitor";

// Import your mobile components (we'll create these)
import MobileTeamsTab from "./components/MobileTeamsTab";
import MobileRankingTab from "./components/MobileRankingTab";
import MobileLeaderboardTab from "./components/MobileLeaderboardTab";
import MobileAwardsTab from "./components/MobileAwardsTab";
import MobileLogTab from "./components/MobileLogTab";
import LeagueLandingPage from "./components/LeagueLandingPage";
import UserMenu from "./components/UserMenu";
import ErrorBoundary from "./components/ErrorBoundary";

import './App.css'

export default function OnBallMobile() {
    // Core state
    const [user, setUser] = useState(null);
    const [currentLeagueId, setCurrentLeagueId] = useState(null);
    const [currentLeague, setCurrentLeague] = useState(null);
    const [activeTab, setActiveTab] = useState("players");
    const [players, setPlayers] = useState([]);
    const [matchHistory, setMatchHistory] = useState([]);
    const [teams, setTeams] = useState([]);
    const [scores, setScores] = useState([]);
    const [matchups, setMatchups] = useState([]);
    const [mvpVotes, setMvpVotes] = useState({});

    // Mobile-specific state
    const [isMobile, setIsMobile] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        setIsMobile(isNativePlatform());
    }, []);

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("Auth change:", currentUser ? 'signed in' : 'signed out');
            setUser(currentUser);

            if (!currentUser && currentLeagueId) {
                localStorage.removeItem("lastUsedLeagueId");
                setCurrentLeagueId(null);
                setCurrentLeague(null);
            }
        });
        return () => unsubscribe();
    }, [currentLeagueId]);

    // Handle Google Sign In
    const handleGoogleSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in:", error);
        }
    };

    // Handle Sign Out
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setShowUserMenu(false);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // Tab change handler
    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
    };

    // If no league selected, show league landing page
    if (!currentLeagueId) {
        return (
            <ErrorBoundary>
                <div className="mobile-safe-area h-full">
                    <LeagueLandingPage
                        user={user}
                        onLeagueSelect={setCurrentLeagueId}
                        onGoogleSignIn={handleGoogleSignIn}
                    />
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="mobile-safe-area h-full flex flex-col bg-gray-900">
                {/* Mobile Header */}
                <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-white">OnBall</h1>
                        {isMobile && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Mobile</span>
                        )}
                    </div>

                    {user && (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium"
                            >
                                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </button>

                            {showUserMenu && (
                                <UserMenu
                                    user={user}
                                    onSignOut={handleSignOut}
                                    onClose={() => setShowUserMenu(false)}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === "players" && (
                        <MobileTeamsTab
                            players={players}
                            teams={teams}
                            matchups={matchups}
                            scores={scores}
                            user={user}
                            currentLeagueId={currentLeagueId}
                        />
                    )}

                    {activeTab === "rankings" && (
                        <MobileRankingTab
                            players={players}
                            user={user}
                            currentLeagueId={currentLeagueId}
                        />
                    )}

                    {activeTab === "leaderboard" && (
                        <MobileLeaderboardTab
                            players={players}
                            matchHistory={matchHistory}
                            user={user}
                        />
                    )}

                    {activeTab === "awards" && (
                        <MobileAwardsTab
                            players={players}
                            user={user}
                            currentLeagueId={currentLeagueId}
                        />
                    )}

                    {activeTab === "logs" && (
                        <MobileLogTab
                            matchHistory={matchHistory}
                            user={user}
                        />
                    )}
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="bg-gray-800 border-t border-gray-700 p-2">
                    <div className="flex justify-around items-center">
                        <button
                            onClick={() => handleTabChange("players")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "players" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-xs">Teams</span>
                        </button>

                        <button
                            onClick={() => handleTabChange("rankings")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "rankings" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-xs">Players</span>
                        </button>

                        <button
                            onClick={() => handleTabChange("leaderboard")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "leaderboard" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-xs">Stats</span>
                        </button>

                        <button
                            onClick={() => handleTabChange("awards")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "awards" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707L18 6M21 12h-1M4 12H3m3.343-5.657l-.707-.707L6 6m2.5 7a4.5 4.5 0 11-4.5-4.5 4.5 4.5 0 014.5 4.5z" />
                            </svg>
                            <span className="text-xs">Awards</span>
                        </button>

                        <button
                            onClick={() => handleTabChange("logs")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "logs" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs">Logs</span>
                        </button>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}