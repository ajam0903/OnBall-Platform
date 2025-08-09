// BeltVotingModal.jsx
import React, { useState, useEffect } from "react";
import { beltCategories } from "./BeltsSystem";

export default function BeltVotingModal({ isOpen, onClose, players, onVote, currentBelts, userVotes = {} }) {
    const [selectedBelt, setSelectedBelt] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [activeTab, setActiveTab] = useState("positive"); // "positive" or "negative"

    useEffect(() => {
        if (isOpen) {
            // Reset selections when modal opens
            setSelectedBelt(null);
            setSelectedPlayer("");
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedBelt && hasVotedFor(selectedBelt)) {
            // Pre-select the player they previously voted for
            setSelectedPlayer(userVotes[selectedBelt] || "");
        } else if (selectedBelt) {
            // Reset player selection when switching belts
            setSelectedPlayer("");
        }
    }, [selectedBelt, userVotes]);

    if (!isOpen) return null;

    const filteredBelts = Object.entries(beltCategories)
        .filter(([_, belt]) => belt.isNegative === (activeTab === "negative"))
        .map(([id, belt]) => ({ id, ...belt }));

    const handleVote = () => {
        if (selectedBelt && selectedPlayer) {
            onVote(selectedBelt, selectedPlayer);
            setSelectedBelt(null);
            setSelectedPlayer("");
        }
    };

    // Get current holder for a belt
    const getCurrentHolder = (beltId) => {
        return currentBelts?.[beltId] || null;
    };

    // Check if user has already voted for a specific belt
    const hasVotedFor = (beltId) => {
        return userVotes?.[beltId] !== undefined;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-white">Vote for Championship Belts</h2>

                {/* Tabs for positive/negative belts */}
                <div className="flex mb-4 border-b border-gray-700">
                    <button
                        className={`px-4 py-2 ${activeTab === "positive" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400"}`}
                        onClick={() => setActiveTab("positive")}
                    >
                        Positive Belts
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === "negative" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400"}`}
                        onClick={() => setActiveTab("negative")}
                    >
                        Negative Belts
                    </button>
                </div>

                {/* Belt selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select a Belt:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredBelts.map(belt => {
                            const currentHolder = getCurrentHolder(belt.id);
                            const hasVoted = hasVotedFor(belt.id);
                            const userVotedForThis = userVotes?.[belt.id];

                            return (
                                <div
                                    key={belt.id}
                                    onClick={() => setSelectedBelt(belt.id)}
                                    className={`
                                        p-3 rounded border cursor-pointer transition-colors
                                        ${selectedBelt === belt.id ? 'border-blue-500 bg-blue-900 bg-opacity-20' : 'border-gray-700 bg-gray-700'}
                                        hover:bg-gray-600
                                    `}
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-2">{belt.icon}</span>
                                        <span className="font-medium">{belt.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{belt.description}</p>

                                    {currentHolder && (
                                        <div className="mt-2 text-xs">
                                            <span className="text-gray-400">Current holder: </span>
                                            <span className="text-white">{currentHolder.playerName}</span>
                                            <span className="text-gray-500 ml-1">({currentHolder.votes} votes)</span>
                                        </div>
                                    )}

                                    {hasVoted && (
                                        <div className="mt-1 text-xs">
                                            <span className="text-yellow-400">Your vote: </span>
                                            <span className="text-white">{userVotedForThis}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Player selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select a Player:
                    </label>
                    <select
                        value={selectedPlayer}
                        onChange={(e) => setSelectedPlayer(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!selectedBelt}
                    >
                        <option value="">-- Select a player --</option>
                        {players.map(player => (
                            <option key={player.name} value={player.name}>
                                {player.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleVote}
                        disabled={!selectedBelt || !selectedPlayer}
                        className={`px-4 py-2 text-white rounded ${!selectedBelt || !selectedPlayer
                                ? "bg-gray-600 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {hasVotedFor(selectedBelt) ? "Change Vote" : "Vote"}
                    </button>
                </div>
            </div>
        </div>
    );
}