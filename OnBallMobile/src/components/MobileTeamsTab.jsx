// OnBallMobile/src/components/MobileTeamsTab.jsx
import React, { useState, useEffect } from 'react';
import { takePicture, pickImage, isNativePlatform } from '../utils/capacitor';

export default function MobileTeamsTab({ 
    players = [], 
    teams = [], 
    matchups = [], 
    scores = [], 
    user, 
    currentLeagueId 
}) {
    const [activePlayerList, setActivePlayerList] = useState([]);
    const [showTeamSelector, setShowTeamSelector] = useState(false);
    const [teamSize, setTeamSize] = useState(5);
    const [selectedPlayers, setSelectedPlayers] = useState(new Set());

    // Filter active players
    useEffect(() => {
        const activePlayers = players.filter(p => p.active !== false);
        setActivePlayerList(activePlayers);
    }, [players]);

    const handlePlayerToggle = (playerName) => {
        const newSelected = new Set(selectedPlayers);
        if (newSelected.has(playerName)) {
            newSelected.delete(playerName);
        } else {
            newSelected.add(playerName);
        }
        setSelectedPlayers(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedPlayers.size === activePlayerList.length) {
            setSelectedPlayers(new Set());
        } else {
            setSelectedPlayers(new Set(activePlayerList.map(p => p.name)));
        }
    };

    const handleCapturePhoto = async (playerName) => {
        try {
            if (isNativePlatform()) {
                const imageUrl = await takePicture();
                console.log('Captured photo for', playerName, ':', imageUrl);
                // TODO: Upload to Firebase Storage and update player
            } else {
                // Web fallback - trigger file input
                console.log('Web photo capture not implemented yet');
            }
        } catch (error) {
            console.error('Error capturing photo:', error);
        }
    };

    const generateTeams = async () => {
        // TODO: Implement team generation logic
        console.log('Generate teams for', selectedPlayers.size, 'players');
        setShowTeamSelector(true);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* Header Section */}
            <div className="p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white">Teams</h2>
                    <span className="text-sm text-gray-300">
                        {selectedPlayers.size} of {activePlayerList.length} selected
                    </span>
                </div>

                {/* Team Size Selector */}
                <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm text-gray-300">Team Size:</label>
                    <select 
                        value={teamSize}
                        onChange={(e) => setTeamSize(Number(e.target.value))}
                        className="bg-gray-700 text-white rounded px-3 py-1 text-sm"
                    >
                        <option value={3}>3v3</option>
                        <option value={4}>4v4</option>
                        <option value={5}>5v5</option>
                        <option value={6}>6v6</option>
                    </select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button 
                        onClick={handleSelectAll}
                        className="btn-secondary flex-1 text-sm"
                    >
                        {selectedPlayers.size === activePlayerList.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button 
                        onClick={generateTeams}
                        disabled={selectedPlayers.size < teamSize * 2}
                        className="btn flex-1 text-sm"
                    >
                        Generate Teams
                    </button>
                </div>
            </div>

            {/* Players List */}
            <div className="flex-1 overflow-y-auto">
                {activePlayerList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p className="text-center">No active players found</p>
                        <p className="text-sm text-gray-500 mt-2">Add players to get started</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {activePlayerList.map((player) => (
                            <div key={player.name} className="p-4 flex items-center gap-3 hover:bg-gray-800 transition-colors">
                                {/* Checkbox */}
                                <div className="flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayers.has(player.name)}
                                        onChange={() => handlePlayerToggle(player.name)}
                                        className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                    />
                                </div>

                                {/* Player Photo */}
                                <div className="flex-shrink-0 relative">
                                    {player.photoURL ? (
                                        <img 
                                            src={player.photoURL} 
                                            alt={player.name}
                                            className="w-12 h-12 rounded-full object-cover bg-gray-700"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                    
                                    {/* Camera Button */}
                                    <button
                                        onClick={() => handleCapturePhoto(player.name)}
                                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Player Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-medium truncate">{player.name}</h3>
                                    <p className="text-sm text-gray-400">
                                        OVR: {(player.ovr || 0).toFixed(1)}
                                    </p>
                                </div>

                                {/* Stats Preview */}
                                <div className="flex-shrink-0 text-right">
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <div>W: {player.wins || 0} L: {player.losses || 0}</div>
                                        <div className="text-yellow-400">MVP: {player.mvps || 0}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Team Selector Modal */}
            {showTeamSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-700">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Generated Teams</h3>
                                <button
                                    onClick={() => setShowTeamSelector(false)}
                                    className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4">
                            <div className="text-center text-gray-400 py-8">
                                <p>Team generation coming soon!</p>
                                <p className="text-sm mt-2">This will show balanced teams based on player ratings.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}