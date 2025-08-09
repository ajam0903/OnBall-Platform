import React, { useEffect, useState, useRef } from "react";
import { StyledButton } from "./UIComponents";

export default function MatchResultsModal({
    isOpen,
    onClose,
    matchResults,
    teams
}) {
    const [animateIn, setAnimateIn] = useState(false);
    const confettiRef = useRef(null);
    const confettiContainerRef = useRef(null);

    const extractTeamData = (match) => {
        // Handle both formats of match data
        if (match.teams) {
            // App format (arrays)
            return {
                teamA: match.teams[0] || [],
                teamB: match.teams[1] || []
            };
        } else if (match.teamA) {
            // Firestore format (objects)
            return {
                teamA: match.teamA || [],
                teamB: match.teamB || []
            };
        }

        // Fallback for unexpected format
        return { teamA: [], teamB: [] };
    };

    const getTeamDisplayName = (team, teamLetter) => {
        if (!team || team.length === 0) return `Team ${teamLetter}`;

        // For 1v1 matches, return the player's name
        if (team.length === 1) {
            return team[0].name || `Team ${teamLetter}`;
        }

        // For multi-player teams, return "Team [Letter]"
        return `Team ${teamLetter}`;
    };

    useEffect(() => {
        // Trigger animation after component mounts
        if (isOpen) {
            setTimeout(() => {
                setAnimateIn(true);
                // Start confetti animation
                startConfetti();
            }, 100);
        } else {
            setAnimateIn(false);
        }

        // Cleanup function
        return () => {
            if (confettiRef.current) {
                clearInterval(confettiRef.current);
            }
        };
    }, [isOpen]);

    const startConfetti = () => {
        if (!confettiContainerRef.current) return;

        // Clear any existing interval
        if (confettiRef.current) {
            clearInterval(confettiRef.current);
        }

        // Create confetti pieces
        const colors = ['#FFD700', '#FF0000', '#0000FF', '#00FF00', '#FFFFFF', '#FFA500', '#9400D3'];
        const container = confettiContainerRef.current;

        // Function to create a single confetti element
        const createConfettiElement = () => {
            const confetti = document.createElement('div');
            const size = Math.floor(Math.random() * 10) + 5; // 5-15px

            // Styling the confetti piece
            confetti.style.position = 'absolute';
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'; // Circle or square
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-20px';
            confetti.style.opacity = Math.random() * 0.7 + 0.3; // 0.3-1.0 opacity
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            confetti.style.zIndex = '999';

            // Animation properties
            confetti.style.transition = `all ${Math.random() * 3 + 2}s ease-out`;

            // Append to container
            container.appendChild(confetti);

            // Animate falling
            setTimeout(() => {
                confetti.style.top = '100%';
                confetti.style.left = `${parseInt(confetti.style.left) + (Math.random() * 40 - 20)}%`;
                confetti.style.transform = `rotate(${Math.random() * 720}deg)`;
                confetti.style.opacity = '0';
            }, 10);

            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode === container) {
                    container.removeChild(confetti);
                }
            }, 5000);
        };

        // Create initial batch of confetti
        for (let i = 0; i < 50; i++) {
            createConfettiElement();
        }

        // Continue creating confetti at intervals
        confettiRef.current = setInterval(() => {
            for (let i = 0; i < 5; i++) {
                createConfettiElement();
            }
        }, 300);

        // Stop after 4 seconds
        setTimeout(() => {
            if (confettiRef.current) {
                clearInterval(confettiRef.current);
                confettiRef.current = null;
            }
        }, 4000);
    };

    if (!isOpen || !matchResults || matchResults.length === 0) return null;

    // Calculate total series results
    let teamAWins = 0;
    let teamBWins = 0;

    matchResults.forEach(match => {
        const scoreA = parseInt(match.score?.a) || 0;
        const scoreB = parseInt(match.score?.b) || 0;

        if (scoreA > scoreB) teamAWins++;
        else if (scoreB > scoreA) teamBWins++;
    });

    // Determine overall winner
    const teamAOverallWinner = teamAWins > teamBWins;
    const teamBOverallWinner = teamBWins > teamAWins;
    const isTie = teamAWins === teamBWins;

    // Get team names (letters)
    const firstMatch = matchResults[0];
    const { teamA: firstTeamA, teamB: firstTeamB } = extractTeamData(firstMatch);

    const teamAName = getTeamDisplayName(firstTeamA, "A");
    const teamBName = getTeamDisplayName(firstTeamB, "B");

    // Calculate total points
    const totalScoreA = matchResults.reduce((total, match) => total + (parseInt(match.score?.a) || 0), 0);
    const totalScoreB = matchResults.reduce((total, match) => total + (parseInt(match.score?.b) || 0), 0);

    // Find MVPs (frequency count)
    const mvpCounts = {};
    matchResults.forEach(match => {
        if (match.mvp) {
            mvpCounts[match.mvp] = (mvpCounts[match.mvp] || 0) + 1;
        }
    });

    // Get the top MVP(s)
    const maxMvpCount = Math.max(...Object.values(mvpCounts), 0);
    const topMvps = Object.keys(mvpCounts).filter(name => mvpCounts[name] === maxMvpCount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
            {/* Confetti container */}
            <div
                ref={confettiContainerRef}
                className="absolute inset-0 overflow-hidden pointer-events-none"
            />

            <div
                className={`w-full max-w-sm bg-gray-800 rounded-lg shadow-2xl overflow-hidden transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                    }`}
                style={{ maxHeight: '85vh' }}
            >
                {/* Trophy Banner */}
                <div className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 p-3 text-center relative overflow-hidden">
                    <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-lg relative z-10">
                        {isTie ? "It's a Tie!" : "Match Complete!"}
                    </h2>

                    {!isTie && (
                        <div className="text-lg font-bold text-white mb-2 relative z-10">
                            {teamAOverallWinner ? teamAName : teamBName} Wins!
                        </div>
                    )}

                    <div className="text-sm text-white opacity-80 relative z-10">
                        {isTie ? "Evenly matched!" : "Congratulations to the winners!"}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="p-3 space-y-3">
                    {/* Match Results */}
                    <div className="bg-gray-700 rounded-lg p-2">
                        <h3 className="text-sm font-semibold text-white mb-2">Match Results</h3>
                        <div className="flex justify-around items-center text-center">
                            <div className={`p-2 rounded-lg ${teamAOverallWinner ? 'bg-green-900 bg-opacity-40 ring-1 ring-green-500' : 'bg-gray-800'}`}>
                                <div className="text-xs font-bold text-white">{teamAName}</div>
                                <div className="text-xl font-bold text-white">{teamAWins}</div>
                                <div className="text-xs text-gray-300">Win{teamAWins !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="text-sm font-bold text-gray-500">VS</div>
                            <div className={`p-2 rounded-lg ${teamBOverallWinner ? 'bg-green-900 bg-opacity-40 ring-1 ring-green-500' : 'bg-gray-800'}`}>
                                <div className="text-xs font-bold text-white">{teamBName}</div>
                                <div className="text-xl font-bold text-white">{teamBWins}</div>
                                <div className="text-xs text-gray-300">Win{teamBWins !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    </div>

                    {/* Game Details - Show All Games */}
                    <div className="bg-gray-700 rounded-lg p-2">
                        <h3 className="text-sm font-semibold text-white mb-2">Match Details</h3>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {matchResults.map((match, index) => {
                                const { teamA, teamB } = extractTeamData(match);
                                return (
                                    <div key={index} className="flex justify-between items-center bg-gray-800 p-1 rounded text-xs">
                                        <span className="text-white">Game {index + 1}:</span>
                                        <span className="text-white">
                                            <span className={parseInt(match.score?.a) > parseInt(match.score?.b) ? 'text-green-400' : 'text-white'}>
                                                {match.score?.a || 0}
                                            </span>
                                            <span className="text-gray-400 mx-1">-</span>
                                            <span className={parseInt(match.score?.b) > parseInt(match.score?.a) ? 'text-green-400' : 'text-white'}>
                                                {match.score?.b || 0}
                                            </span>
                                        </span>
                                        {match.mvp && (
                                            <span className="text-yellow-400 text-xs">MVP: {match.mvp}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                            Total: {teamAName} {totalScoreA} - {totalScoreB} {teamBName}
                        </div>
                    </div>

                    {/* MVPs - Show All */}
                    {topMvps.length > 0 && (
                        <div className="bg-gray-700 rounded-lg p-2">
                            <h3 className="text-sm font-semibold text-white mb-2">Series MVP{topMvps.length > 1 ? 's' : ''}</h3>
                            <div className="flex flex-wrap justify-center gap-1">
                                {topMvps.map((name, index) => (
                                    <div key={index} className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded p-1 text-center">
                                        <div className="text-yellow-400 text-sm">🏅</div>
                                        <div className="text-white text-xs">{name}</div>
                                        <div className="text-yellow-400 text-xs">{mvpCounts[name]} MVP</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Single Continue Button */}
                    <div className="pt-2">
                        <StyledButton onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 py-2">
                            Continue
                        </StyledButton>
                    </div>
                </div>
            </div>

            <style jsx="true">{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}