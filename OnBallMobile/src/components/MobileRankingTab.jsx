// OnBallMobile/src/components/MobileRankingTab.jsx
import React from 'react';

export default function MobileRankingTab({ players, user, currentLeagueId }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Player Rankings</h3>
            <p className="text-center">Rate and view player abilities</p>
            <p className="text-sm text-gray-500 mt-2">Coming soon to mobile</p>
        </div>
    );
}

// OnBallMobile/src/components/MobileLeaderboardTab.jsx
import React from 'react';

export function MobileLeaderboardTab({ players, matchHistory, user }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Leaderboard</h3>
            <p className="text-center">Player statistics and records</p>
            <p className="text-sm text-gray-500 mt-2">Coming soon to mobile</p>
        </div>
    );
}

// OnBallMobile/src/components/MobileAwardsTab.jsx
import React from 'react';

export function MobileAwardsTab({ players, user, currentLeagueId }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text