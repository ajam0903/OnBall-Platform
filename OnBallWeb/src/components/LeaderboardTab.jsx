// Updated LeaderboardTab.jsx with just number values for abilities
import React, { useState, useEffect } from "react";
import { StyledButton, StyledInput } from "./UIComponents";



export default function LeaderboardTab({ leaderboard, resetLeaderboardData, isAdmin, matchHistory, players, playerOVRs, onUpdateLeaderboard, openPlayerDetailModal, minGamesFilter = 0, }) {
    const [sortBy, setSortBy] = useState("ovr");
    const [sortDirection, setSortDirection] = useState("desc");
    const [scrollPosition, setScrollPosition] = useState(0);
    const [editingPlayer, setEditingPlayer] = useState(null);
    const [editedStats, setEditedStats] = useState({ wins: 0, losses: 0, mvps: 0 });

    // Helper function to format player name with last name initial
    const formatPlayerName = (fullName) => {
        if (!fullName) return "Unknown";

        const nameParts = fullName.trim().split(' ');

        // If only one name, return it as is
        if (nameParts.length <= 1) return fullName;

        // Get first name and last initial
        const firstName = nameParts[0];
        const lastInitial = nameParts[nameParts.length - 1][0];

        return `${firstName} ${lastInitial}.`;
    };

    // Calculate streak bonus based on recent form
    const getStreakBonus = (recentForm) => {
        if (recentForm.length === 0) return 0;

        // Get different game ranges
        const last3Games = recentForm.slice(0, 3);
        const last5Games = recentForm.slice(0, 5);
        const last10Games = recentForm.slice(0, 10);

        // Calculate wins and MVPs for different ranges
        const winsInLast3 = last3Games.filter(game => game.won).length;
        const winsInLast5 = last5Games.filter(game => game.won).length;
        const winsInLast10 = last10Games.filter(game => game.won).length;

        const mvpsInLast3 = last3Games.filter(game => game.isMVP).length;
        const mvpsInLast5 = last5Games.filter(game => game.isMVP).length;
        const mvpsInLast10 = last10Games.filter(game => game.isMVP).length;

        // Maximum bonus: +5 for exceptional performance
        // Hot streak: perfect last 5 games
        if (winsInLast5 === 5 && last5Games.length === 5) return 5;

        // Elite form: 9+ wins in last 10 games
        if (winsInLast10 >= 9 && last10Games.length >= 9) return 4;

        // Hot streak: 3 wins in last 3 games
        if (winsInLast3 === 3 && last3Games.length === 3) return 3;

        // Great form: 8 wins in last 10 games OR 4 wins in last 5
        if ((winsInLast10 >= 8 && last10Games.length >= 8) || (winsInLast5 >= 4 && last5Games.length >= 4)) return 2;

        // MVP streak: 3+ MVPs in last 5 games
        if (mvpsInLast5 >= 3 && last5Games.length >= 3) return 2;

        // Good form: 7 wins in last 10 games OR 3 wins in last 5
        if ((winsInLast10 >= 7 && last10Games.length >= 7) || (winsInLast5 >= 3 && last5Games.length >= 3)) return 1;

        // MVP presence: 2+ MVPs in last 10 games
        if (mvpsInLast10 >= 2 && last10Games.length >= 5) return 1;

        // Neutral performance: 5-6 wins in last 10 games
        if (winsInLast10 >= 5 && winsInLast10 <= 6 && last10Games.length >= 8) return 0;

        // Poor form: 3-4 wins in last 10 games
        if (winsInLast10 >= 3 && winsInLast10 <= 4 && last10Games.length >= 8) return -1;

        // Cold streak: 0 wins in last 3 games
        if (winsInLast3 === 0 && last3Games.length === 3) return -2;

        // Very poor form: 2 or fewer wins in last 10 games
        if (winsInLast10 <= 2 && last10Games.length >= 5) return -3;

        // Terrible form: 0-1 wins in last 5 games
        if (winsInLast5 <= 1 && last5Games.length >= 4) return -3;

        return 0;
    };

    const [gameTypeFilter, setGameTypeFilter] = useState("all");
    const [filteredStats, setFilteredStats] = useState({});

    const getTeamSizeFromMatch = (match) => {
        // First, check if we have direct team size information
        if (match.teamSize) {
            return match.teamSize;
        }

        // Fallback to counting players if no direct team size is available
        if (!match || !match.teams) return 0;

        // Handle array format (from app state)
        if (Array.isArray(match.teams) && match.teams.length >= 1) {
            // Count non-bench players in first team
            return match.teams[0].filter(p => !p.isBench).length;
        }

        // Handle object format (from Firestore)
        if (match.teamA) {
            return match.teamA.filter(p => !p.isBench).length;
        }

        return 0;
    };

    const filterMatchHistoryByGameType = (history, gameType) => {
        if (!history || history.length === 0) return [];
        if (gameType === "all") return history;

        // Convert gameType string to number (e.g., "5v5" -> 5)
        const teamSize = parseInt(gameType.split('v')[0]);
        if (isNaN(teamSize)) return history;

        return history.filter(match => {
            const matchTeamSize = getTeamSizeFromMatch(match);
            return matchTeamSize === teamSize;
        });
        return filtered;
    };

    // Update getRecentForm to use consistent data source
    const getRecentForm = (playerName) => {
        if (!matchHistory || matchHistory.length === 0) return [];

        // Use the same filtering logic as the main stats
        let historyToUse;
        if (gameTypeFilter === "all") {
            historyToUse = matchHistory;
        } else {
            historyToUse = filterMatchHistoryByGameType(matchHistory, gameTypeFilter);
        }

        // Sort by most recent
        const sortedHistory = [...historyToUse].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // Get last 10 games where this player participated
        const playerGames = [];

        for (const match of sortedHistory) {
            // Check if match has teams data in either format
            let teamA = [];
            let teamB = [];

            if (match.teams && Array.isArray(match.teams) && match.teams.length >= 2) {
                // App format: teams[0] and teams[1] - NORMALIZE NAMES
                teamA = match.teams[0].map(p => p.name);
                teamB = match.teams[1].map(p => p.name);
            } else if (match.teamA && match.teamB) {
                // Firestore format: teamA and teamB - NORMALIZE NAMES
                teamA = match.teamA.map(p => p.name);
                teamB = match.teamB.map(p => p.name);
            } else {
                // Skip if no valid team data
                continue;
            }

            // Check if player is in either team
            const playerInTeamA = teamA.includes(playerName);
            const playerInTeamB = teamB.includes(playerName);

            const playerTeam = playerInTeamA ? 'A' : playerInTeamB ? 'B' : null;

            if (playerTeam) {
                const scoreA = parseInt(match.score?.a) || 0;
                const scoreB = parseInt(match.score?.b) || 0;
                const won = (playerTeam === 'A' && scoreA > scoreB) ||
                    (playerTeam === 'B' && scoreB > scoreA);

                // Check if player is MVP
                const normalizedMvp = match.mvp || '';
                const isMVP = normalizedMvp === playerName;

                playerGames.push({ won, isMVP });

                if (playerGames.length >= 10) break;
            }
        }

        return playerGames;
    };

    // Get trend (+1, -1, 0) based on recent games
    const getTrend = (playerName) => {
        const recentForm = getRecentForm(playerName);

        if (recentForm.length < 2) return 0;

        // Compare last 2 games to previous 2 games
        const recent = recentForm.slice(0, 2);
        const earlier = recentForm.slice(2, 4);

        if (recent.length < 2 || earlier.length < 2) return 0;

        const recentWins = recent.filter(game => game.won).length;
        const earlierWins = earlier.filter(game => game.won).length;

        if (recentWins > earlierWins) return +2;
        if (recentWins < earlierWins) return +1;

        const recentMVPs = recent.filter(game => game.isMVP).length;
        const earlierMVPs = earlier.filter(game => game.isMVP).length;

        if (recentMVPs > earlierMVPs) return +2;
        if (recentMVPs < earlierMVPs) return -1;

        return 0;
    };

    // Process leaderboard data for display
    const processedData = Object.entries(filteredStats || {})
        .filter(([name, stats]) => {
            // Add minimum games filter
            const totalGames = (stats._w || 0) + (stats._l || 0);
            return totalGames >= (minGamesFilter || 0);
        })
        .map(([name, stats]) => {
        // Find player data in players array
        const playerData = players.find(p => p.name === name) || {};
        // Get last 10 games record
        const recentForm = getRecentForm(name);
        const last10Wins = recentForm.filter(game => game.won).length;
        const last10Losses = recentForm.length - last10Wins;
        // If match history is incomplete compared to leaderboard, show total record
        const totalGamesFromLeaderboard = (stats._w || 0) + (stats._l || 0);
        const totalGamesFromHistory = recentForm.length;
        let last10Record;
        if (totalGamesFromHistory < totalGamesFromLeaderboard && totalGamesFromLeaderboard <= 10) {
            // Show total record if we have incomplete match history but ≤10 total games
            last10Record = `${stats._w || 0}-${stats._l || 0}`;
        } else {
            // Show last 10 from match history
            last10Record = (last10Wins + last10Losses) > 0 ? `${last10Wins}-${last10Losses}` : "0-0";
        }
        return {
            name,
            ovr: playerOVRs[name] || 5,
            trend: getTrend(name),
            wins: stats._w || 0,
            losses: stats._l || 0,
            mvps: stats.MVPs || 0,
            pct: stats._w + stats._l > 0 ? ((stats._w / (stats._w + stats._l)) * 100).toFixed(1) : "0.0",
            last10Record: last10Record,
            scoring: playerData.scoring || 5,
            defense: playerData.defense || 5,
            rebounding: playerData.rebounding || 5,
            playmaking: playerData.playmaking || 5,
            stamina: playerData.stamina || 5,
            physicality: playerData.physicality || 5,
            xfactor: playerData.xfactor || 5,
            totalGames: (stats._w || 0) + (stats._l || 0),
        };
    }).filter(player => player.totalGames >= minGamesFilter);

    // First, create OVR rankings (highest OVR = rank 1)
    const ovrRankedData = [...processedData].sort((a, b) => b.ovr - a.ovr);
    const dataWithOvrRank = ovrRankedData.map((player, index) => ({
        ...player,
        ovrRank: index + 1
    }));

    // Then sort by current sort criteria for display
    const sortedData = [...dataWithOvrRank].sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === "name") {
            return sortDirection === "asc"
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }

        // Special handling for last10Record (format: "X-Y")
        if (sortBy === "last10Record") {
            const [aWins] = aValue.split('-').map(Number);
            const [bWins] = bValue.split('-').map(Number);
            return sortDirection === "asc" ? aWins - bWins : bWins - aWins;
        }

        if (typeof aValue === "string") aValue = parseFloat(aValue);
        if (typeof bValue === "string") bValue = parseFloat(bValue);

        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    // Handle sorting change
    const handleSort = (column) => {
        if (sortBy === column) {
            // Toggle direction if clicking the same column
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            // Default to descending for new column
            setSortBy(column);
            setSortDirection("desc");
        }
    };


    const startEditing = (player) => {
        setEditingPlayer(player.name);
        setEditedStats({
            wins: player.wins,
            losses: player.losses,
            mvps: player.mvps
        });
    };

    const cancelEditing = () => {
        setEditingPlayer(null);
        setEditedStats({ wins: 0, losses: 0, mvps: 0 });
    };

    const saveEdits = () => {
        if (onUpdateLeaderboard) {
            const updatedLeaderboard = { ...leaderboard };

            if (!updatedLeaderboard[editingPlayer]) {
                updatedLeaderboard[editingPlayer] = { _w: 0, _l: 0, MVPs: 0 };
            }

            updatedLeaderboard[editingPlayer]._w = parseInt(editedStats.wins) || 0;
            updatedLeaderboard[editingPlayer]._l = parseInt(editedStats.losses) || 0;
            updatedLeaderboard[editingPlayer].MVPs = parseInt(editedStats.mvps) || 0;

            onUpdateLeaderboard(updatedLeaderboard);
        }

        setEditingPlayer(null);
        setEditedStats({ wins: 0, losses: 0, mvps: 0 });
    };

    // Handle horizontal scrolling
    const handleScroll = (direction) => {
        const scrollContainer = document.getElementById('stats-table-container');
        if (scrollContainer) {
            const scrollAmount = direction === 'left' ? -200 : 200;
            scrollContainer.scrollLeft += scrollAmount;
            setScrollPosition(scrollContainer.scrollLeft);
        }
    };

    useEffect(() => {
        if (!matchHistory || matchHistory.length === 0 || !leaderboard) {
            setFilteredStats(leaderboard || {});
            return;
        }

        // Always recalculate from match history to ensure accuracy
        const historyToUse = gameTypeFilter === "all" ? matchHistory : filterMatchHistoryByGameType(matchHistory, gameTypeFilter);

        // If no filtered matches, show empty stats
        if (historyToUse.length === 0) {
            setFilteredStats({});
            return;
        }

        // Create filtered stats based on the filtered match history
        const newStats = {};

        historyToUse.forEach(match => {
            let teamA = [];
            let teamB = [];
            let scoreA = 0;
            let scoreB = 0;
            let mvp = "";

            if (match.teams && Array.isArray(match.teams)) {
                teamA = match.teams[0].map(p => p.name);
                teamB = match.teams[1].map(p => p.name);
            } else if (match.teamA && match.teamB) {
                teamA = match.teamA.map(p => p.name);
                teamB = match.teamB.map(p => p.name);
            }

            if (match.score) {
                scoreA = parseInt(match.score.a) || 0;
                scoreB = parseInt(match.score.b) || 0;
            }

            mvp = match.mvp || "";

            // Initialize ALL players in this match
            [...teamA, ...teamB].forEach(playerName => {
                if (playerName && !newStats[playerName]) {
                    newStats[playerName] = { _w: 0, _l: 0, MVPs: 0 };  // Fixed: _w and _l
                }
            });

            // Process winners and losers
            if (scoreA !== scoreB) {
                const winners = scoreA > scoreB ? teamA : teamB;
                const losers = scoreA > scoreB ? teamB : teamA;

                winners.forEach(playerName => {
                    if (playerName && newStats[playerName]) {
                        newStats[playerName]._w += 1;
                    }
                });

                losers.forEach(playerName => {
                    if (playerName && newStats[playerName]) {
                        newStats[playerName]._l += 1;
                    }
                });
            }

            // Award MVP
            if (mvp && newStats[mvp]) {
                newStats[mvp].MVPs += 1;
            }
        });

        setFilteredStats(newStats);
    }, [gameTypeFilter, matchHistory, leaderboard]);

    return (

        <div className="space-y-6">

            {/* Minimum Games Filter Disclaimer - Small and subtle */}
            {minGamesFilter > 0 && (
                <div className="text-xs text-gray-500 italic text-center -mt-2 mb-4">
                    * Showing stats for players with at least {minGamesFilter} game{minGamesFilter !== 1 ? 's' : ''} played
                </div>
            )}
            <div className="flex items-center mb-4 overflow-x-auto scrollbar-hide pb-2 justify-center">
                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("all")}
                        className={`transition-colors ${gameTypeFilter === "all"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        All
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.length || 0}
                    </div>
                </div>

                <span className="text-gray-600">|</span>

                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("5v5")}
                        className={`transition-colors ${gameTypeFilter === "5v5"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        5v5
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.filter(match => getTeamSizeFromMatch(match) === 5).length || 0}
                    </div>
                </div>

                <span className="text-gray-600">|</span>

                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("4v4")}
                        className={`transition-colors ${gameTypeFilter === "4v4"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        4v4
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.filter(match => getTeamSizeFromMatch(match) === 4).length || 0}
                    </div>
                </div>

                <span className="text-gray-600">|</span>

                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("3v3")}
                        className={`transition-colors ${gameTypeFilter === "3v3"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        3v3
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.filter(match => getTeamSizeFromMatch(match) === 3).length || 0}
                    </div>
                </div>

                <span className="text-gray-600">|</span>

                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("2v2")}
                        className={`transition-colors ${gameTypeFilter === "2v2"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        2v2
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.filter(match => getTeamSizeFromMatch(match) === 2).length || 0}
                    </div>
                </div>

                <span className="text-gray-600">|</span>

                <div className="text-center px-3">
                    <button
                        onClick={() => setGameTypeFilter("1v1")}
                        className={`transition-colors ${gameTypeFilter === "1v1"
                            ? "text-blue-400 font-semibold"
                            : "text-gray-400 hover:text-gray-300"}`}
                    >
                        1v1
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                        {matchHistory?.filter(match => getTeamSizeFromMatch(match) === 1).length || 0}
                    </div>
                </div>
            </div>

            {Object.keys(leaderboard || {}).length === 0 ? (
                <p className="text-gray-400 text-center py-8">No leaderboard data available yet.</p>
            ) : (
                <div className="relative">

                    {/* Scrollable stats table */}
                    <div
                        id="stats-table-container"
                        className="overflow-x-auto scrollbar-hide pb-2"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800 sticky top-0 z-10">
                                    <tr>
                                        {/* New Rank column */}
                                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-800 border-r border-gray-700 z-20">
                                            #
                                        </th>
                                        {/* Fixed columns */}
                                        <th
                                            className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider sticky left-8 bg-gray-800 cursor-pointer border-r border-gray-700 z-10"
                                            onClick={() => handleSort("name")}
                                        >
                                            Player {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer min-w-[10px] whitespace-nowrap border-r border-gray-700"
                                            onClick={() => handleSort("ovr")}
                                        >
                                            <div className="flex items-center justify-center">
                                                <span>OVR</span>
                                                <span className="text-[9px] font-normal opacity-70 ml-1">(+/-)</span>
                                                {sortBy === "ovr" && <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>}
                                            </div>
                                        </th>

                                        {/* Record columns */}
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("wins")}
                                        >
                                            W {sortBy === "wins" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("losses")}
                                        >
                                            L {sortBy === "losses" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("pct")}
                                        >
                                            W% {sortBy === "pct" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("mvps")}
                                        >
                                            MVP {sortBy === "mvps" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("last10Record")}
                                        >
                                            L10 {sortBy === "last10Record" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>

                                        {/* Player abilities columns - abbreviated */}
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("scoring")}
                                        >
                                            SCR {sortBy === "scoring" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("defense")}
                                        >
                                            DEF {sortBy === "defense" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("rebounding")}
                                        >
                                            REB {sortBy === "rebounding" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("playmaking")}
                                        >
                                            PLY {sortBy === "playmaking" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("stamina")}
                                        >
                                            STM {sortBy === "stamina" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("physicality")}
                                        >
                                            PHY {sortBy === "physicality" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                        <th
                                            className="px-1 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer border-r border-gray-700"
                                            onClick={() => handleSort("xfactor")}
                                        >
                                            X-F {sortBy === "xfactor" && (sortDirection === "asc" ? "▲" : "▼")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-900 divide-y divide-gray-700">
                                    {sortedData.map((player, index) => (
                                        <tr key={player.name} className={`hover:bg-gray-600 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}`}>
                                            <td className={`px-2 py-3 whitespace-nowrap text-sm font-medium text-white sticky left-0 z-5 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'} text-center border-r border-gray-700`}>
                                                {player.ovrRank}
                                            </td>
                                            <td className={`px-2 py-3 whitespace-nowrap text-sm font-medium text-white sticky left-8 z-5 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'} text-left border-r border-gray-700`}>

                                                <button
                                                    onClick={() => openPlayerDetailModal(player)}
                                                >
                                                    {formatPlayerName(player.name)}
                                                </button>
                                            </td>

                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-white text-center border-r border-gray-700">
                                                <div className="flex justify-center">
                                                    <span className="w-7">{player.ovr}</span>
                                                    {player.trend !== 0 && (
                                                        <span className={`text-xs ${player.trend > 0 ? "text-green-400" :
                                                            player.trend < 0 ? "text-red-400" : ""}`}>
                                                            {player.trend > 0 ? `+${player.trend}` : player.trend}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {editingPlayer === player.name ? (
                                                <>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-center border-r border-gray-700">
                                                        <StyledInput
                                                            type="number"
                                                            value={editedStats.wins}
                                                            onChange={(e) => setEditedStats({ ...editedStats, wins: e.target.value })}
                                                            className="w-12 bg-gray-700 border-gray-600 text-center"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-center border-r border-gray-700">
                                                        <StyledInput
                                                            type="number"
                                                            value={editedStats.losses}
                                                            onChange={(e) => setEditedStats({ ...editedStats, losses: e.target.value })}
                                                            className="w-12 bg-gray-700 border-gray-600 text-center"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-blue-400 text-center border-r border-gray-700">
                                                        {((parseInt(editedStats.wins) / (parseInt(editedStats.wins) + parseInt(editedStats.losses))) * 100 || 0).toFixed(1)}%
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-center border-r border-gray-700">
                                                        <StyledInput
                                                            type="number"
                                                            value={editedStats.mvps}
                                                            onChange={(e) => setEditedStats({ ...editedStats, mvps: e.target.value })}
                                                            className="w-12 bg-gray-700 border-gray-600 text-center"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                        {player.last10Record}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-green-400 text-center border-r border-gray-700">
                                                        {player.wins}
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-red-400 text-center border-r border-gray-700">
                                                        {player.losses}
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-blue-400 text-center border-r border-gray-700">
                                                        {player.pct}%
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-yellow-400 text-center border-r border-gray-700">
                                                        {player.mvps}
                                                    </td>
                                                    <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                        {player.last10Record}
                                                    </td>
                                                </>
                                            )}

                                            {/* Player abilities - centered with borders */}
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.scoring}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.defense}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.rebounding}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.playmaking}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.stamina}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.physicality}
                                            </td>
                                            <td className="px-1 py-3 whitespace-nowrap text-sm text-gray-300 text-center border-r border-gray-700">
                                                {player.xfactor}
                                            </td>
                                            {isAdmin && editingPlayer === player.name && (
                                                <td className="px-1 py-3 whitespace-nowrap text-sm text-center">
                                                    <div className="flex gap-2">
                                                        <StyledButton
                                                            onClick={saveEdits}
                                                            className="bg-green-600 hover:bg-green-700 py-1 px-2 text-xs"
                                                        >
                                                            Save
                                                        </StyledButton>
                                                        <StyledButton
                                                            onClick={cancelEditing}
                                                            className="bg-gray-600 hover:bg-gray-700 py-1 px-2 text-xs"
                                                        >
                                                            Cancel
                                                        </StyledButton>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}