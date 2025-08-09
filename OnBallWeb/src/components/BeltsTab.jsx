// BeltsTab.jsx
import React, { useState } from "react";
import { beltCategories } from "./BeltsSystem";
import BeltVotingModal from "./BeltVotingModal";
import { StyledButton } from "./UIComponents";

export default function BeltsTab({
    players = [],
    currentBelts = {},
    userVotes = {},
    onVote,
    user,
    beltVotes = {} // Add this prop to get all votes for detailed view
}) {
    const [showVotingModal, setShowVotingModal] = useState(false);
    const [showBeltDetails, setShowBeltDetails] = useState(false);
    const [selectedBeltForDetails, setSelectedBeltForDetails] = useState(null);
    const [showQuickVote, setShowQuickVote] = useState(false);
    const [selectedBeltForVote, setSelectedBeltForVote] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(""); // Move this to top level

    const positiveBelts = Object.entries(beltCategories)
        .filter(([_, belt]) => !belt.isNegative)
        .map(([id, belt]) => ({ id, ...belt }));

    const negativeBelts = Object.entries(beltCategories)
        .filter(([_, belt]) => belt.isNegative)
        .map(([id, belt]) => ({ id, ...belt }));

    const handleVote = (beltId, playerName) => {
        onVote(beltId, playerName);
        setShowVotingModal(false);
    };

    const handleBeltClick = (beltId) => {
        if (!user) {
            setShowVotingModal(true); // Show sign in message
            return;
        }

        // Pre-populate the selected player with user's current vote
        setSelectedPlayer(userVotes[beltId] || "");

        // Open quick vote modal instead of details
        setSelectedBeltForVote(beltId);
        setShowQuickVote(true);
    };

    // Calculate vote breakdown for a specific belt
    const getBeltVoteBreakdown = (beltId) => {
        const votes = {};

        // Count all votes for this belt
        Object.values(beltVotes).forEach(userVotesObj => {
            const vote = userVotesObj[beltId];
            if (vote) {
                // Just use the vote directly
                votes[vote] = (votes[vote] || 0) + 1;
            }
        });

        // Sort by vote count (descending)
        return Object.entries(votes)
            .map(([playerName, count]) => ({ playerName, count }))
            .sort((a, b) => b.count - a.count);
    };

    const migrateBeltVotes = async (db, currentLeagueId, currentSet) => {
        console.log("Starting belt votes migration...");

        try {
            // Get the current document
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.log("No document found");
                return;
            }

            const data = docSnap.data();
            const beltVotes = data.beltVotes || {};

            // Create normalized version of votes
            const normalizedBeltVotes = {};
            let changesCount = 0;

            Object.entries(beltVotes).forEach(([userId, userVotes]) => {
                normalizedBeltVotes[userId] = {};

                Object.entries(userVotes).forEach(([beltId, playerName]) => {
                    const canonicalName = getCanonicalName(playerName);
                    normalizedBeltVotes[userId][beltId] = canonicalName;

                    if (canonicalName !== playerName) {
                        console.log(`Migrating vote: "${playerName}" → "${canonicalName}" (${beltId})`);
                        changesCount++;
                    }
                });
            });

            // Also normalize current belt holders
            const currentBelts = data.currentBelts || {};
            const normalizedCurrentBelts = {};

            Object.entries(currentBelts).forEach(([beltId, holder]) => {
                if (holder && holder.playerName) {
                    const canonicalName = getCanonicalName(holder.playerName);
                    normalizedCurrentBelts[beltId] = {
                        ...holder,
                        playerName: canonicalName
                    };

                    if (canonicalName !== holder.playerName) {
                        console.log(`Migrating belt holder: "${holder.playerName}" → "${canonicalName}" (${beltId})`);
                        changesCount++;
                    }
                }
            });

            if (changesCount > 0) {
                // Save the normalized data
                await setDoc(docRef, {
                    ...data,
                    beltVotes: normalizedBeltVotes,
                    currentBelts: normalizedCurrentBelts
                });

                console.log(`✅ Belt votes migration completed! ${changesCount} changes made.`);
            } else {
                console.log("✅ No belt vote migrations needed - all names already canonical");
            }

        } catch (error) {
            console.error("Error migrating belt votes:", error);
        }
    };

    const BeltCard = ({ belt }) => {
        const holder = currentBelts[belt.id];

        // Get vote count for this belt to show even when there's no holder yet
        const voteBreakdown = getBeltVoteBreakdown(belt.id);
        const totalVotes = voteBreakdown.reduce((sum, vote) => sum + vote.count, 0);
        const topVoter = voteBreakdown[0]; // Player with most votes

        return (
            <div
                className={`border ${belt.isNegative ?
                    'border-red-800 bg-red-900 bg-opacity-10 hover:bg-opacity-20' :
                    'border-green-800 bg-green-900 bg-opacity-10 hover:bg-opacity-20'} 
            rounded-lg p-3 cursor-pointer transition-colors relative group`}
                onClick={() => handleBeltClick(belt.id)}
            >
                {/* Info icon for details */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBeltForDetails(belt.id);
                        setShowBeltDetails(true);
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="View details"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>

                <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">{belt.icon}</span>
                    <div>
                        <h3 className="text-sm font-medium text-white">{belt.name}</h3>
                    </div>
                </div>

                {holder ? (
                    // There's an official belt holder (someone reached 5+ votes)
                    <div className="bg-gray-800 bg-opacity-50 p-2 rounded">
                        <div className="text-center">
                            <span className="text-sm font-medium text-white block">{holder.playerName}</span>
                            <span className="text-xs bg-blue-900 bg-opacity-40 px-1 py-0.5 rounded text-blue-300 mt-1 inline-block">
                                👑 {holder.votes} votes
                            </span>
                        </div>

                        {userVotes[belt.id] === holder.playerName && (
                            <div className="text-xs text-yellow-400 mt-1 text-center">
                                Your vote
                            </div>
                        )}
                    </div>
                ) : totalVotes > 0 ? (
                    // No official holder yet, but there are votes
                    <div className="bg-gray-800 bg-opacity-50 p-2 rounded">
                        <div className="text-center">
                            <span className="text-sm font-medium text-white block">{topVoter.playerName}</span>
                            <span className="text-xs bg-gray-700 px-1 py-0.5 rounded text-gray-300 mt-1 inline-block">
                                {topVoter.count} votes (needs {5 - topVoter.count} more)
                            </span>
                        </div>

                        {userVotes[belt.id] === topVoter.playerName && (
                            <div className="text-xs text-yellow-400 mt-1 text-center">
                                Your vote
                            </div>
                        )}
                    </div>
                ) : (
                    // No votes at all
                    <div className="bg-gray-800 bg-opacity-50 p-2 rounded text-center text-gray-400 text-xs">
                        No votes yet
                    </div>
                )}

                {/* Click to vote hint */}
                <div className="text-xs text-center text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to vote
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Championship Belts</h2>

                <StyledButton
                    onClick={() => setShowVotingModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!user}
                >
                    {user ? "Vote for Belts" : "Sign in to Vote"}
                </StyledButton>
            </div>

            {/* Positive Belts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {positiveBelts.map(belt => (
                    <BeltCard key={belt.id} belt={belt} />
                ))}
            </div>

            {/* Separator */}
            <div className="border-t border-gray-600"></div>

            {/* Negative Belts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {negativeBelts.map(belt => (
                    <BeltCard key={belt.id} belt={belt} />
                ))}
            </div>

            {/* Voting modal */}
            <BeltVotingModal
                isOpen={showVotingModal}
                onClose={() => setShowVotingModal(false)}
                players={players}
                onVote={handleVote}
                currentBelts={currentBelts}
                userVotes={userVotes}
            />

            {/* Quick Vote Modal */}
            {showQuickVote && selectedBeltForVote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        {(() => {
                            const belt = beltCategories[selectedBeltForVote];
                            const holder = currentBelts[selectedBeltForVote];
                            const voteBreakdown = getBeltVoteBreakdown(selectedBeltForVote);

                            const handleQuickVote = () => {
                                if (selectedPlayer) {
                                    onVote(selectedBeltForVote, selectedPlayer);
                                    setShowQuickVote(false);
                                    setSelectedPlayer(""); // Reset after voting
                                }
                            };

                            return (
                                <>
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center">
                                            <span className="text-4xl mr-3">{belt.icon}</span>
                                            <div>
                                                <h2 className="text-xl font-bold text-white">{belt.name}</h2>
                                                <p className={`text-sm ${belt.isNegative ? 'text-red-400' : 'text-green-400'}`}>
                                                    {belt.isNegative ? 'Negative Belt' : 'Positive Belt'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowQuickVote(false)}
                                            className="text-gray-400 hover:text-white text-xl font-bold"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* Belt Description */}
                                    <p className="text-gray-300 mb-4">{belt.description}</p>

                                    {/* Current Holder Info */}
                                    {holder && (
                                        <div className={`p-4 rounded-lg mb-4 ${belt.isNegative ?
                                            'bg-red-900 bg-opacity-20 border border-red-700' :
                                            'bg-green-900 bg-opacity-20 border border-green-700'}`}>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-white mb-1">
                                                    👑 Current Champion
                                                </div>
                                                <div className="text-xl font-bold text-white">{holder.playerName}</div>
                                                <div className="text-sm text-gray-300">{holder.votes} votes</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vote Breakdown */}
                                    {voteBreakdown.length > 0 && (
                                        <div className="mb-4">
                                            <h3 className="text-sm font-medium text-gray-300 mb-2">Vote Breakdown:</h3>
                                            <div className="space-y-1">
                                                {voteBreakdown.map(({ playerName, count }) => (
                                                    <div key={playerName} className="flex justify-between items-center text-sm">
                                                        <span className="text-white">{playerName}</span>
                                                        <span className="text-gray-400">{count} vote{count !== 1 ? 's' : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Voting Section */}
                                    <div className="border-t border-gray-600 pt-4">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Select a Player:
                                        </label>
                                        <select
                                            value={selectedPlayer}
                                            onChange={(e) => setSelectedPlayer(e.target.value)}
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white mb-4"
                                        >
                                            <option value="">-- Select a player --</option>
                                            {players.map(player => (
                                                <option key={player.name} value={player.name}>
                                                    {player.name}
                                                </option>
                                            ))}
                                        </select>

                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleQuickVote}
                                                disabled={!selectedPlayer}
                                                className={`px-4 py-2 text-white rounded ${!selectedPlayer
                                                    ? "bg-gray-600 cursor-not-allowed"
                                                    : "bg-blue-600 hover:bg-blue-700"
                                                    }`}
                                            >
                                                {userVotes[selectedBeltForVote] ? "Change Vote" : "Vote"}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Belt Details Modal */}
            {showBeltDetails && selectedBeltForDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        {(() => {
                            const belt = beltCategories[selectedBeltForDetails];
                            const holder = currentBelts[selectedBeltForDetails];
                            const voteBreakdown = getBeltVoteBreakdown(selectedBeltForDetails);

                            return (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center">
                                            <span className="text-4xl mr-3">{belt.icon}</span>
                                            <div>
                                                <h2 className="text-xl font-bold text-white">{belt.name}</h2>
                                                <p className={`text-sm ${belt.isNegative ? 'text-red-400' : 'text-green-400'}`}>
                                                    {belt.isNegative ? 'Negative Belt' : 'Positive Belt'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowBeltDetails(false)}
                                            className="text-gray-400 hover:text-white text-xl font-bold"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <p className="text-gray-300 mb-6">{belt.description}</p>

                                    {holder && (
                                        <div className={`p-4 rounded-lg mb-6 ${belt.isNegative ? 'bg-red-900 bg-opacity-20' : 'bg-green-900 bg-opacity-20'
                                            }`}>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-white">Current Holder</div>
                                                <div className="text-2xl font-bold text-white mt-2">{holder.playerName}</div>
                                                <div className="text-sm text-gray-300 mt-1">{holder.votes} votes</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold text-white mb-3">Vote Breakdown</h3>
                                        {voteBreakdown.length > 0 ? (
                                            <div className="space-y-2">
                                                {voteBreakdown.map(({ playerName, count }, index) => (
                                                    <div key={playerName} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                                        <span className="text-white">{playerName}</span>
                                                        <div className="flex items-center">
                                                            <span className="text-gray-300 mr-2">{count} votes</span>
                                                            {index === 0 && holder?.playerName === playerName && (
                                                                <span className="text-yellow-400">👑</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 text-center py-4">
                                                No votes yet for this belt
                                            </div>
                                        )}
                                    </div>

                                    {userVotes[selectedBeltForDetails] && (
                                        <div className="bg-blue-900 bg-opacity-20 p-3 rounded mb-4">
                                            <div className="text-sm text-blue-400">Your vote:</div>
                                            <div className="text-white font-medium">{userVotes[selectedBeltForDetails]}</div>
                                        </div>
                                    )}

                                    <div className="flex justify-center">
                                        <StyledButton
                                            onClick={() => {
                                                setShowBeltDetails(false);
                                                setShowVotingModal(true);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700"
                                            disabled={!user}
                                        >
                                            {userVotes[selectedBeltForDetails] ? 'Change Vote' : 'Vote for This Belt'}
                                        </StyledButton>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}