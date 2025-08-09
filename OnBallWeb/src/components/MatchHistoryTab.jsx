import React, { useState } from "react";

const [shareDateFilter, setShareDateFilter] = useState(new Date().toISOString().split('T')[0]);
// Add team naming utility functions
const getFormattedPlayerName = (fullName) => {
    if (!fullName) return "Team";

    const nameParts = fullName.trim().split(' ');

    // If only one name (or empty), return it
    if (nameParts.length <= 1) return fullName;

    // Get first name
    const firstName = nameParts[0];

    // Get last initial (from the last part)
    const lastInitial = nameParts[nameParts.length - 1][0] || '';

    return `${firstName} ${lastInitial}.`;
};

const findBestPlayer = (team, calculatePlayerScore) => {
    if (!team || team.length === 0) return null;

    return team.reduce((best, current) => {
        if (!best) return current;
        if (!current) return best;

        const bestScore = calculatePlayerScore ? calculatePlayerScore(best) : 0;
        const currentScore = calculatePlayerScore ? calculatePlayerScore(current) : 0;
        return currentScore > bestScore ? current : best;
    }, team[0]);
};

const getTeamName = (team, calculatePlayerScore) => {
    if (!team || team.length === 0) return "Team";

    const bestPlayer = findBestPlayer(team, calculatePlayerScore);
    if (!bestPlayer || !bestPlayer.name) return "Team";

    return getFormattedPlayerName(bestPlayer.name);
};

const updateMatchHistoryNames = async () => {
    // Fetch all matches
    const matchesRef = collection(db, "leagues", currentLeagueId, "matches");
    const snapshot = await getDocs(matchesRef);

    for (const doc of snapshot.docs) {
        const match = doc.data();
        let updated = false;

        // Update team names
        if (match.teams) {
            // Handle your team format
        } else if (match.teamA && match.teamB) {
            const updatedTeamA = match.teamA.map(p => ({
                ...p,
                name: getCanonicalName(p.name)
            }));
            const updatedTeamB = match.teamB.map(p => ({
                ...p,
                name: getCanonicalName(p.name)
            }));

            if (JSON.stringify(updatedTeamA) !== JSON.stringify(match.teamA) ||
                JSON.stringify(updatedTeamB) !== JSON.stringify(match.teamB)) {
                updated = true;
                await updateDoc(doc.ref, {
                    teamA: updatedTeamA,
                    teamB: updatedTeamB,
                    mvp: getCanonicalName(match.mvp)
                });
            }
        }
    }
};

export default function MatchHistoryTab({ matchHistory, calculatePlayerScore, weightings, shareDailyMatches, }) {
    const [filter, setFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Calculate player rating from stats
    const calculatePlayerRating = (player) => {
        return (
            player.scoring * weightings.scoring +
            player.defense * weightings.defense +
            player.rebounding * weightings.rebounding +
            player.playmaking * weightings.playmaking +
            player.stamina * weightings.stamina +
            player.physicality * weightings.physicality +
            player.xfactor * weightings.xfactor
        ).toFixed(1);
    };

    // Sort history by date (most recent first)
    const sortedHistory = [...(matchHistory || [])].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    // Filter history based on search term
    const filteredHistory = sortedHistory.filter(match => {
        if (!searchTerm) return true;

        // Search in player names
        const allPlayers = [...match.teams[0], ...match.teams[1]].map(p => p.name.toLowerCase());
        const searchLower = searchTerm.toLowerCase();

        // Return matches that contain the search term in any player name
        return allPlayers.some(name => name.includes(searchLower));
    });

    return (
        <div className="space-y-6">
            {/* Filter controls - unchanged */}
            {/* ... */}

            {filteredHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    {searchTerm ? "No matches found for your search." : "No match history available."}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredHistory.map((match, index) => {
                        const teamA = match.teams[0];
                        const teamB = match.teams[1];
                        const scoreA = parseInt(match.score?.a);
                        const scoreB = parseInt(match.score?.b);
                        const teamAWon = scoreA > scoreB;
                        const matchDate = new Date(match.date);

                        // Get team names based on best players
                        const teamAName = getTeamName(teamA, calculatePlayerScore);
                        const teamBName = getTeamName(teamB, calculatePlayerScore);

                        return (
                            <div key={index} className="border border-gray-800 rounded-lg overflow-hidden">
                                {/* Match header */}
                                <div className="bg-gray-800 p-3 flex justify-between items-center">
                                    <div className="text-sm text-gray-300">
                                        <span className="font-medium">{matchDate.toLocaleDateString()}</span>
                                        <span className="text-xs ml-2 text-gray-400">
                                            {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="text-sm">
                                        <span className="font-bold text-white mr-1">
                                            {scoreA} - {scoreB}
                                        </span>
                                    </div>
                                </div>

                                {/* Match details */}
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Team A - use team name instead of "Team A" */}
                                        <div className={`p-3 rounded ${teamAWon ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-gray-300">Team {teamAName}</span>
                                                <span className={`text-sm font-bold ${teamAWon ? 'text-green-400' : 'text-red-400'}`}>
                                                    {teamAWon ? 'WIN' : 'LOSS'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {teamA.map((player, playerIndex) => (
                                                    <div key={playerIndex} className="flex justify-between items-center">
                                                        <span className="text-sm text-white">
                                                            {player.name}
                                                            {match.mvp === player.name && (
                                                                <span className="ml-2 text-xs text-yellow-400">MVP</span>
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-blue-400">
                                                            {calculatePlayerRating(player)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Team B - use team name instead of "Team B" */}
                                        <div className={`p-3 rounded ${!teamAWon ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-gray-300">Team {teamBName}</span>
                                                <span className={`text-sm font-bold ${!teamAWon ? 'text-green-400' : 'text-red-400'}`}>
                                                    {!teamAWon ? 'WIN' : 'LOSS'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {teamB.map((player, playerIndex) => (
                                                    <div key={playerIndex} className="flex justify-between items-center">
                                                        <span className="text-sm text-white">
                                                            {player.name}
                                                            {match.mvp === player.name && (
                                                                <span className="ml-2 text-xs text-yellow-400">MVP</span>
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-blue-400">
                                                            {calculatePlayerRating(player)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}