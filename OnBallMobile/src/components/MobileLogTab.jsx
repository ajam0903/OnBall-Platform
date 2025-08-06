import React from 'react';

export default function MobileLogTab({ matchHistory, user }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Match Logs</h3>
            <p className="text-center">Game history and activity</p>
            <p className="text-sm text-gray-500 mt-2">Coming soon to mobile</p>
        </div>
    );
}