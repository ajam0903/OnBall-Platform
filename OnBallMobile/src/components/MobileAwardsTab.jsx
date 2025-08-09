import React from 'react';

export default function MobileAwardsTab({ players, user, currentLeagueId }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707L18 6M21 12h-1M4 12H3m3.343-5.657l-.707-.707L6 6m2.5 7a4.5 4.5 0 11-4.5-4.5 4.5 4.5 0 014.5 4.5z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Awards</h3>
            <p className="text-center">Belts and badges system</p>
            <p className="text-sm text-gray-500 mt-2">Coming soon to mobile</p>
        </div>
    );
}