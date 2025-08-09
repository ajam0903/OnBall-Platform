import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";

export default function LeagueSelector({ 
    currentLeague, 
    userLeagues, 
    onLeagueSelect, 
    onBackToLeagues 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLeagueChange = (leagueId) => {
        onLeagueSelect(leagueId);
        setIsOpen(false);
    };

    const handleManageLeagues = () => {
        onBackToLeagues();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 group cursor-pointer"
            >
                <span className="text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                    {currentLeague?.name}
                </span>
                <div className="text-gray-400 group-hover:text-white transition-colors">
                    {isOpen ? (
                        <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                    )}
                </div>
                <div className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 group-hover:w-full"></div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                        {/* Current League Header */}
                        <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                            Your Leagues
                        </div>

                        {/* League List */}
                        {userLeagues && userLeagues.length > 0 ? (
                            userLeagues.map((league) => (
                                <button
                                    key={league.id}
                                    onClick={() => handleLeagueChange(league.id)}
                                    className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors ${
                                        currentLeague?.id === league.id 
                                            ? 'bg-blue-600 bg-opacity-20 text-blue-400' 
                                            : 'text-gray-300'
                                    }`}
                                >
                                    <div className="font-medium">{league.name}</div>
                                    <div className="text-xs text-gray-500">
                                        Code: {league.inviteCode}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                                No leagues found
                            </div>
                        )}

                        {/* Divider and Manage Option */}
                        <div className="border-t border-gray-700 mt-1">
                            <button
                                onClick={handleManageLeagues}
                                className="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center space-x-2">
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        className="h-4 w-4" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                                        />
                                    </svg>
                                    <span className="text-sm">Manage Leagues</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}