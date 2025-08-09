import React, { useState, useEffect, useRef } from "react";
import { collection, doc, getDoc, setDoc, query, orderBy, limit, getDocs, deleteDoc, where } from "firebase/firestore";
import { StyledButton } from "./UIComponents";
import { calculateAverageStatsFromSubmissions, calculateWeightedRating, RATING_WEIGHTINGS } from '@shared/utils/ratingUtils';

export default function LogTab({
    currentLeagueId,
    currentSet,
    isAdmin,
    db,
    user,
    updatePlayers,
    setToastMessage,
    updateMatchHistory,
    shareDailyMatchLogs,
}) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [showConfirmDelete, setShowConfirmDelete] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [logToDelete, setLogToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [logsPerPage] = useState(10);
    const [totalLogs, setTotalLogs] = useState(0);
    const [hasMoreLogs, setHasMoreLogs] = useState(true);
    const [shareDateFilter, setShareDateFilter] = useState(new Date().toISOString().split('T')[0]);

    const teamARef = useRef(null);
    const teamBRef = useRef(null);

    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };

    const fetchLogs = async (page = 1, reset = false) => {
        setLoading(true);
        try {
            const logsRef = collection(db, "leagues", currentLeagueId, "logs");

            // Build query constraints based on current filter
            let queryConstraints = [orderBy("timestamp", "desc")];

            // Add filter constraints for specific filters (these work well with Firestore)
            if (filter === "players") {
                const playerActions = ["player_added", "player_updated", "player_deleted", "player_rating_changed", "player_rating_updated", "player_rating_added"];
                queryConstraints.push(where("action", "in", playerActions));
                queryConstraints.push(limit(logsPerPage * page));

                const q = query(logsRef, ...queryConstraints);
                const querySnapshot = await getDocs(q);

                const logsData = [];
                querySnapshot.forEach((doc) => {
                    const logData = { id: doc.id, ...doc.data() };
                    // Additional filter to exclude rating changes that came from match results
                    if (!logData.details?.fromMatch) { // Assuming you have a way to identify match-related ratings
                        logsData.push(logData);
                    }
                });

                // Check for more logs
                const checkMoreQuery = query(logsRef, ...queryConstraints.slice(0, -1), limit(logsPerPage * page + 1));
                const checkMoreSnapshot = await getDocs(checkMoreQuery);
                setHasMoreLogs(checkMoreSnapshot.docs.length > logsData.length);

                setLogs(logsData);
                setTotalLogs(logsData.length);

            } else if (filter === "matches") {
                queryConstraints.push(where("action", "==", "match_result_saved"));
                queryConstraints.push(limit(logsPerPage * page));

                const q = query(logsRef, ...queryConstraints);
                const querySnapshot = await getDocs(q);

                const logsData = [];
                querySnapshot.forEach((doc) => {
                    logsData.push({ id: doc.id, ...doc.data() });
                });

                // Check for more logs
                const checkMoreQuery = query(logsRef, ...queryConstraints.slice(0, -1), limit(logsPerPage * page + 1));
                const checkMoreSnapshot = await getDocs(checkMoreQuery);
                setHasMoreLogs(checkMoreSnapshot.docs.length > logsData.length);

                setLogs(logsData);
                setTotalLogs(logsData.length);

            } else if (filter === "admin") {
                const adminActions = ["leaderboard_reset", "log_deleted", "schema_initialized", "user_joined_league"];
                queryConstraints.push(where("action", "in", adminActions));
                queryConstraints.push(limit(logsPerPage * page));

                const q = query(logsRef, ...queryConstraints);
                const querySnapshot = await getDocs(q);

                const logsData = [];
                querySnapshot.forEach((doc) => {
                    logsData.push({ id: doc.id, ...doc.data() });
                });

                // Check for more logs
                const checkMoreQuery = query(logsRef, ...queryConstraints.slice(0, -1), limit(logsPerPage * page + 1));
                const checkMoreSnapshot = await getDocs(checkMoreQuery);
                setHasMoreLogs(checkMoreSnapshot.docs.length > logsData.length);

                setLogs(logsData);
                setTotalLogs(logsData.length);

            } else {
                // For "all" filter, fetch more logs and filter client-side (since we can't do NOT IN efficiently)
                const excludedActions = ["match_completed", "teams_generated", "rematch_created"];

                // Keep fetching until we have enough filtered logs for this page
                let allFilteredLogs = [];
                let fetchLimit = logsPerPage * page * 2; // Start with 2x
                let hasMore = true;

                while (allFilteredLogs.length < logsPerPage * page && hasMore) {
                    queryConstraints = [orderBy("timestamp", "desc"), limit(fetchLimit)];
                    const q = query(logsRef, ...queryConstraints);
                    const querySnapshot = await getDocs(q);

                    const tempLogs = [];
                    querySnapshot.forEach((doc) => {
                        const logData = { id: doc.id, ...doc.data() };
                        if (!excludedActions.includes(logData.action)) {
                            tempLogs.push(logData);
                        }
                    });

                    allFilteredLogs = tempLogs;

                    // If we got fewer docs than requested, we've reached the end
                    if (querySnapshot.docs.length < fetchLimit) {
                        hasMore = false;
                    } else {
                        // Double the fetch limit for next iteration if we still don't have enough
                        fetchLimit *= 2;
                    }

                    // Safety break to avoid infinite loop
                    if (fetchLimit > 10000) break;
                }

                setLogs(allFilteredLogs);

                // Check if there are more logs by trying to fetch just a bit more
                if (hasMore && allFilteredLogs.length >= logsPerPage * page) {
                    const checkQuery = query(logsRef, orderBy("timestamp", "desc"), limit(fetchLimit + 50));
                    const checkSnapshot = await getDocs(checkQuery);

                    const checkFiltered = [];
                    checkSnapshot.forEach((doc) => {
                        const logData = { id: doc.id, ...doc.data() };
                        if (!excludedActions.includes(logData.action)) {
                            checkFiltered.push(logData);
                        }
                    });

                    setHasMoreLogs(checkFiltered.length > allFilteredLogs.length);
                } else {
                    setHasMoreLogs(false);
                }

                setTotalLogs(allFilteredLogs.length);
            }

            if (reset) {
                setCurrentPage(1);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentLeagueId) return;
        fetchLogs(1, true);
    }, [currentLeagueId, currentSet, filter]);

    const handleDeleteLog = async (logId) => {
        if (!currentLeagueId || !isAdmin) return;

        try {
            // First, get the log details to determine what action needs to be reversed
            const logRef = doc(db, "leagues", currentLeagueId, "logs", logId);
            const logSnap = await getDoc(logRef);

            if (!logSnap.exists()) {
                console.error("Log entry not found");
                return;
            }

            const logData = logSnap.data();

            // Get the player name from the log details
            const playerName = logData.details?.playerName ||
                logData.details?.name ||
                logData.details?.player;

            // Prepare log details for the new log entry about the deletion
            let logDetails = {
                logId,
                deletedAction: logData.action,
                message: "Log entry was deleted"
            };

            // For player-related logs, include player name
            if (["player_added", "player_updated", "player_deleted", "player_rating_changed",
                "player_rating_updated", "player_rating_added"].includes(logData.action) && playerName) {
                logDetails.playerName = playerName;
                logDetails.message = "Rating change was reversed";
            }

            // For match-related logs, include match-specific details
            if (["match_result_saved", "match_completed"].includes(logData.action)) {
                logDetails.scoreA = logData.details?.scoreA;
                logDetails.scoreB = logData.details?.scoreB;
                logDetails.message = "Match result was deleted";
            }

            // Handle reversion based on log action type
            if (logData.action === "player_added" && playerName) {
                // If this was a player addition, delete the player
                await deletePlayer(playerName);
            }
            else if (["player_rating_changed", "player_rating_updated", "player_rating_added"].includes(logData.action)) {
                await reversePlayerRating(logData);
            }
            else if (["match_result_saved", "match_completed"].includes(logData.action)) {
                // Add this to handle match result reversals
                await reverseMatchResult(logData);
            }

            // Delete the log entry only after successfully reversing the action
            await deleteDoc(logRef);

            // Add a new log entry about the deletion
            const newLogRef = doc(collection(db, "leagues", currentLeagueId, "logs"));
            await setDoc(newLogRef, {
                action: "log_deleted",
                details: logDetails,
                userId: user?.uid || "unknown",
                userName: user?.displayName || user?.email || "Admin",
                timestamp: new Date(),
                undoable: false
            });

            // Update the local state
            setLogs(logs.filter(log => log.id !== logId));
            setShowConfirmDelete(null);

            if (["player_rating_changed", "player_rating_updated", "player_rating_added"].includes(logData.action)) {
                // Force refresh the data by dispatching a custom event or calling a refresh function
                if (window.refreshPlayersData) {
                    window.refreshPlayersData();
                } else {
                    // Alternative: reload the page to ensure fresh data
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            }

            // Show success message
            setToastMessage("Log entry deleted and action reversed");
            setTimeout(() => setToastMessage(""), 3000);
        } catch (error) {
            console.error("Error deleting log:", error);
            setToastMessage("Error deleting log: " + error.message);
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    const reverseMatchResult = async (logData) => {
        // Match logs might not have all the same fields, but we'll try to extract useful info
        if (!logData.details) {
            console.error("Cannot reverse match result: missing details");
            return;
        }

        // For match reversal, we primarily need to update the leaderboard
        // by removing wins, losses, and MVPs that this match caused

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error("Set data not found");
            return;
        }

        const data = docSnap.data();

        // Make a copy of the current leaderboard
        let updatedLeaderboard = { ...data.leaderboard };

        // Try to get team data from the log
        const teamA = logData.details.teamA || logData.details.teams?.[0] || [];
        const teamB = logData.details.teamB || logData.details.teams?.[1] || [];
        const scoreA = parseInt(logData.details.scoreA) || 0;
        const scoreB = parseInt(logData.details.scoreB) || 0;
        const mvp = logData.details.mvp;

        // Determine winner and loser teams
        const teamAWon = scoreA > scoreB;
        const winningTeam = teamAWon ? teamA : teamB;
        const losingTeam = teamAWon ? teamB : teamA;

        // Remove wins from winners and losses from losers
        if (winningTeam && winningTeam.length > 0) {
            winningTeam.forEach(playerName => {
                if (typeof playerName === 'string' && updatedLeaderboard[playerName]) {
                    // Decrement win count
                    updatedLeaderboard[playerName]._w = Math.max(0, (updatedLeaderboard[playerName]._w || 0) - 1);
                } else if (playerName.name && updatedLeaderboard[playerName.name]) {
                    // Decrement win count (object format)
                    updatedLeaderboard[playerName.name]._w = Math.max(0, (updatedLeaderboard[playerName.name]._w || 0) - 1);
                }
            });
        }

        if (losingTeam && losingTeam.length > 0) {
            losingTeam.forEach(playerName => {
                if (typeof playerName === 'string' && updatedLeaderboard[playerName]) {
                    // Decrement loss count
                    updatedLeaderboard[playerName]._l = Math.max(0, (updatedLeaderboard[playerName]._l || 0) - 1);
                } else if (playerName.name && updatedLeaderboard[playerName.name]) {
                    // Decrement loss count (object format)
                    updatedLeaderboard[playerName.name]._l = Math.max(0, (updatedLeaderboard[playerName.name]._l || 0) - 1);
                }
            });
        }

        // Remove MVP if applicable
        if (mvp && updatedLeaderboard[mvp]) {
            updatedLeaderboard[mvp].MVPs = Math.max(0, (updatedLeaderboard[mvp].MVPs || 0) - 1);
        }

        // NEW: Also remove this match from matchHistory
        let updatedMatchHistory = [...(data.matchHistory || [])];

        // Find and remove the matching game from match history
        // We'll match based on teams, score, and MVP
        const matchIndex = updatedMatchHistory.findIndex(match => {
            // Extract team data from history match
            let historyTeamA = [];
            let historyTeamB = [];

            if (Array.isArray(match.teams) && match.teams.length >= 2) {
                historyTeamA = match.teams[0].map(p => typeof p === 'string' ? p : p.name);
                historyTeamB = match.teams[1].map(p => typeof p === 'string' ? p : p.name);
            } else if (match.teamA && match.teamB) {
                historyTeamA = match.teamA.map(p => typeof p === 'string' ? p : p.name);
                historyTeamB = match.teamB.map(p => typeof p === 'string' ? p : p.name);
            }

            // Extract log team names
            const logTeamANames = teamA.map(p => typeof p === 'string' ? p : p);
            const logTeamBNames = teamB.map(p => typeof p === 'string' ? p : p);

            // Check if teams match (in either order)
            const teamsMatch = (
                (arraysEqual(historyTeamA.sort(), logTeamANames.sort()) &&
                    arraysEqual(historyTeamB.sort(), logTeamBNames.sort())) ||
                (arraysEqual(historyTeamA.sort(), logTeamBNames.sort()) &&
                    arraysEqual(historyTeamB.sort(), logTeamANames.sort()))
            );

            // Check if scores match
            const scoresMatch = match.score &&
                parseInt(match.score.a) === scoreA &&
                parseInt(match.score.b) === scoreB;

            // Check if MVP matches (if provided)
            const mvpMatches = !mvp || match.mvp === mvp;

            return teamsMatch && scoresMatch && mvpMatches;
        });

        if (matchIndex !== -1) {
            // Instead of removing, mark as deleted/void to preserve chronological order
            // Use the date from the log entry instead of current time
            const originalMatchDate = logData.details?.date || logData.details?.matchDate || updatedMatchHistory[matchIndex].date;

            updatedMatchHistory[matchIndex] = {
                ...updatedMatchHistory[matchIndex],
                isDeleted: true,
                deletedDate: new Date().toISOString(),
                deletedBy: user?.uid || "unknown",
                deletionReason: "Match result deleted from logs",
                originalDate: originalMatchDate // Preserve the original match date
            };

            console.log("Marked match as deleted at index:", matchIndex, "with original date:", originalMatchDate);

            // NEW: Update local state immediately
            if (typeof updateMatchHistory === 'function') {
                // Convert to app format for local state
                const appFormatHistory = updatedMatchHistory.map(match => {
                    if (match.teams) {
                        return match; // Already in app format
                    }
                    // Convert from Firestore format
                    return {
                        teams: [match.teamA || [], match.teamB || []],
                        score: match.score,
                        mvp: match.mvp || "",
                        date: match.originalDate || match.date, // Use original date if available
                        isDeleted: match.isDeleted || false // Include deletion status
                    };
                });
                updateMatchHistory(appFormatHistory);
            }
        } else {
            console.warn("Could not find matching match in history to remove");
        }

        // Save the updated leaderboard AND match history
        await setDoc(docRef, {
            ...data,
            leaderboard: updatedLeaderboard,
            matchHistory: updatedMatchHistory
        });

        console.log("Reversed match result in leaderboard and removed from match history");
    };
    // Add this function to LogTab.jsx or your admin tools
    const restoreMatchFromLog = async (logData) => {
        if (!logData.details) return;

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const data = docSnap.data();
        let updatedMatchHistory = [...(data.matchHistory || [])];

        // Find the deleted match and restore it
        const matchIndex = updatedMatchHistory.findIndex(match => {
            // Same matching logic as before
            // ... (use the existing team matching logic)
        });

        if (matchIndex !== -1 && updatedMatchHistory[matchIndex].isDeleted) {
            // Restore the match by removing the deletion flags
            const restoredMatch = { ...updatedMatchHistory[matchIndex] };
            delete restoredMatch.isDeleted;
            delete restoredMatch.deletedDate;
            delete restoredMatch.deletedBy;
            delete restoredMatch.deletionReason;

            // Use the original date from when the match was played
            restoredMatch.date = restoredMatch.originalDate || logData.details.date || logData.details.matchDate;

            updatedMatchHistory[matchIndex] = restoredMatch;

            // Update Firestore
            await setDoc(docRef, {
                ...data,
                matchHistory: updatedMatchHistory
            });

            console.log("Restored match with original date:", restoredMatch.date);
        }
    };
    const reversePlayerRating = async (logData) => {
        // Skip if essential data is missing
        if (!logData.details?.playerName && !logData.details?.name) {
            console.error("Cannot reverse rating: player name missing");
            return;
        }

        if (!logData.userId) {
            console.error("Cannot reverse rating: user ID missing");
            return;
        }

        const playerName = logData.details?.playerName || logData.details?.name;
        const userId = logData.userId;

        // Get the current set data
        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error("Set data not found");
            return;
        }

        const data = docSnap.data();
        const updatedPlayers = [...data.players];

        // Find the player
        const playerIndex = updatedPlayers.findIndex(
            (p) => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (playerIndex === -1) {
            console.error("Player not found:", playerName);
            return;
        }

        const player = updatedPlayers[playerIndex];

        // Handle different scenarios based on the action
        if (logData.action === "player_rating_added") {
            // If this was the first rating, remove the player entirely
            if (player.submissions.length === 1 &&
                player.submissions[0].submittedBy === logData.userId) {
                updatedPlayers.splice(playerIndex, 1);
            } else {
                // Remove just this user's submission
                const updatedSubmissions = player.submissions.filter(
                    (s) => s.submittedBy !== logData.userId
                );

                // Recalculate ALL individual stats from remaining submissions
                let newPlayerData = {
                    ...player,
                    submissions: updatedSubmissions
                };

                if (updatedSubmissions.length > 0) {
                    // Calculate averages for each individual stat
                    const averageStats = calculateAverageStatsFromSubmissions(updatedSubmissions);

                    newPlayerData = {
                        ...newPlayerData,
                        ...averageStats,
                        rating: calculateWeightedRating(averageStats)
                    };
                } else {
                    // Default values if no submissions
                    newPlayerData = {
                        ...newPlayerData,
                        scoring: 5,
                        defense: 5,
                        rebounding: 5,
                        playmaking: 5,
                        stamina: 5,
                        physicality: 5,
                        xfactor: 5,
                        rating: 5
                    };
                }
                updatedPlayers[playerIndex] = newPlayerData;
            }
        } else {
            // For updated ratings, remove this user's submission
            const updatedSubmissions = player.submissions.filter(
                (s) => s.submittedBy !== logData.userId
            );

            // Recalculate ALL individual stats from remaining submissions
            let newPlayerData = {
                ...player,
                submissions: updatedSubmissions
            };

            if (updatedSubmissions.length > 0) {
                // Calculate averages for each individual stat
                const totals = { scoring: 0, defense: 0, rebounding: 0, playmaking: 0, stamina: 0, physicality: 0, xfactor: 0 };

                updatedSubmissions.forEach(sub => {
                    totals.scoring += sub.scoring || 5;
                    totals.defense += sub.defense || 5;
                    totals.rebounding += sub.rebounding || 5;
                    totals.playmaking += sub.playmaking || 5;
                    totals.stamina += sub.stamina || 5;
                    totals.physicality += sub.physicality || 5;
                    totals.xfactor += sub.xfactor || 5;
                });

                const len = updatedSubmissions.length;
                newPlayerData.scoring = parseFloat((totals.scoring / len).toFixed(2));
                newPlayerData.defense = parseFloat((totals.defense / len).toFixed(2));
                newPlayerData.rebounding = parseFloat((totals.rebounding / len).toFixed(2));
                newPlayerData.playmaking = parseFloat((totals.playmaking / len).toFixed(2));
                newPlayerData.stamina = parseFloat((totals.stamina / len).toFixed(2));
                newPlayerData.physicality = parseFloat((totals.physicality / len).toFixed(2));
                newPlayerData.xfactor = parseFloat((totals.xfactor / len).toFixed(2));

                // Calculate weighted rating
                const weightings = { scoring: 0.25, defense: 0.2, rebounding: 0.15, playmaking: 0.15, stamina: 0.1, physicality: 0.1, xfactor: 0.05 };
                newPlayerData.rating = parseFloat((
                    newPlayerData.scoring * weightings.scoring +
                    newPlayerData.defense * weightings.defense +
                    newPlayerData.rebounding * weightings.rebounding +
                    newPlayerData.playmaking * weightings.playmaking +
                    newPlayerData.stamina * weightings.stamina +
                    newPlayerData.physicality * weightings.physicality +
                    newPlayerData.xfactor * weightings.xfactor
                ).toFixed(2));
            } else {
                // Default values if no submissions
                newPlayerData.scoring = 5;
                newPlayerData.defense = 5;
                newPlayerData.rebounding = 5;
                newPlayerData.playmaking = 5;
                newPlayerData.stamina = 5;
                newPlayerData.physicality = 5;
                newPlayerData.xfactor = 5;
                newPlayerData.rating = 5;
            }

            updatedPlayers[playerIndex] = newPlayerData;
        }

        // Save the updated player data
        await setDoc(docRef, { ...data, players: updatedPlayers });

        // Update local state to reflect changes
        if (typeof updatePlayers === 'function') {
            updatePlayers(updatedPlayers);
        }

        console.log(`Rating submission for ${playerName} by user ${logData.userId} was reversed`);
    };

    const deletePlayer = async (playerName) => {
        if (!playerName) return;

        console.log("Deleting player:", playerName);

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error("Set data not found");
            return;
        }

        const data = docSnap.data();

        // Check if player exists
        const playerIndex = data.players.findIndex(
            p => p && p.name && p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (playerIndex === -1) {
            console.log("Player not found:", playerName);
            return;
        }

        // Store the player data for logging
        const playerData = data.players[playerIndex];

        // Remove the player
        const updatedPlayers = data.players.filter(
            (p, idx) => idx !== playerIndex
        );

        // Also update leaderboard if needed
        let updatedLeaderboard = { ...data.leaderboard };
        if (updatedLeaderboard[playerName]) {
            delete updatedLeaderboard[playerName];
        }

        // Save to Firestore
        await setDoc(docRef, {
            ...data,
            players: updatedPlayers,
            leaderboard: updatedLeaderboard
        });

        // Update local state
        if (typeof updatePlayers === 'function') {
            updatePlayers(updatedPlayers);
        }

        console.log(`Player ${playerName} was deleted as a result of log deletion`);
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "Unknown date";

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionText = (log) => {
        // Helper function to get the player name from different possible fields
        const getPlayerName = (details) => {
            if (!details) return "Unknown Player";
            return details.playerName || details.name || details.player || "Unknown Player";
        };

        switch (log.action) {
            case "player_added":
                return `Added player: ${getPlayerName(log.details)}`;
            case "player_updated":
                return `Updated player: ${getPlayerName(log.details)}`;
            case "player_deleted":
                return `Deleted player: ${getPlayerName(log.details)}`;
            case "player_rating_changed":
            case "player_rating_updated":
            case "player_rating_added": {
                const playerName = getPlayerName(log.details);
                const overallRating = log.details?.overallRating ? `(${log.details.overallRating})` : '';


                if (log.details?.changedValues) {
                    // Get names of changed ratings
                    const changedRatings = Object.keys(log.details.changedValues);

                    if (changedRatings.length === 1) {
                        // If only one rating changed, show it specifically
                        const ratingName = changedRatings[0];
                        const change = log.details.changedValues[ratingName];
                        return `Updated ${ratingName} rating for ${playerName} from ${change.from} to ${change.to} ${overallRating}`;
                    } else if (changedRatings.length <= 3) {
                        // If 2-3 ratings changed, list them all
                        const ratingsList = changedRatings.join(', ');
                        return `Updated ratings (${ratingsList}) for ${playerName} ${overallRating}`;
                    }
                }

                // Default message if no specifics or too many changes
                return `Updated rating for ${playerName} ${overallRating}`;
            }
            case "match_result_saved": {
                const gameType = log.details?.gameType || `${log.details?.teamSize || "?"}v${log.details?.teamSize || "?"}`;
                return `Saved ${gameType} match result`;
            }
            case "match_completed": {
                const gameType = log.details?.gameType || `${log.details?.teamSize || "?"}v${log.details?.teamSize || "?"}`;
                const scoreA = log.details?.scoreA || 0;
                const scoreB = log.details?.scoreB || 0;
                const teamARating = log.details?.teamARating ? ` (${log.details.teamARating})` : '';
                const teamBRating = log.details?.teamBRating ? ` (${log.details.teamBRating})` : '';

                // Get team names if available
                const teamAName = log.details?.teamA?.[0] || "Team A";
                const teamBName = log.details?.teamB?.[0] || "Team B";

                const scoreDisplay = `${teamAName}${teamARating} ${scoreA} - ${scoreB} ${teamBName}${teamBRating}`;
                const mvp = log.details?.mvp ? `MVP: ${log.details.mvp}` : 'No MVP selected';
                return `Completed ${gameType} match: ${scoreDisplay} (${mvp})`;
            }
            case "rematch_created": {
                return `Created rematch with the same teams`;
            }
            case "teams_generated": {
                return `Generated ${log.details?.teamCount || 0} teams (${log.details?.teamSize || "unknown"}v${log.details?.teamSize || "unknown"})`;
            }
            case "leaderboard_reset":
                return "Reset leaderboard";
            case "log_deleted": {
                const target = getPlayerName(log.details) || log.details?.deletedAction || "entry";
                return `Deleted log and reversed ${target}`;
            }
            case "schema_initialized":
                return "Log system initialized";
            case "user_joined_league":
                return `User ${log.userName} joined the league`;
            case "rematch_created":
                return `Created rematch with same teams`;
            default:
                return log.action?.replace(/_/g, " ") || "Unknown action";
        }
    };

    const renderMatchDetails = (log) => {
        // Helper function to abbreviate long names
        const abbreviateName = (fullName) => {
            if (!fullName) return fullName;
            const nameParts = fullName.trim().split(/\s+/);
            // If only one name (or empty), return it
            if (nameParts.length <= 1) return fullName;
            const firstName = nameParts[0];
            // Get last name and abbreviate if needed
            let lastName = nameParts[nameParts.length - 1];
            let lastInitial = lastName[0] || '';
            // Add a period to the initial
            return `${firstName} ${lastInitial}.`;
        };

        // Helper function to check if text fits in container
        const getDisplayName = (playerName, containerRef) => {
            if (!playerName || !containerRef?.current) return playerName;

            // Create a temporary span to measure text width
            const tempSpan = document.createElement('span');
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.position = 'absolute';
            tempSpan.style.fontSize = '0.75rem'; // text-xs
            tempSpan.style.fontFamily = window.getComputedStyle(containerRef.current).fontFamily;
            tempSpan.textContent = playerName;

            document.body.appendChild(tempSpan);
            const textWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);

            // Get available width (subtract some padding)
            const availableWidth = containerRef.current.offsetWidth - 16; // 16px for padding

            if (textWidth > availableWidth) {
                return abbreviateName(playerName);
            }

            return playerName;
        };

        // Only render for match-related logs
        if (!["match_result_saved", "match_completed"].includes(log.action)) {
            return null;
        }

        // Get team data from the appropriate location in details
        const teamA = log.details?.teams?.[0] || log.details?.teamA || [];
        const teamB = log.details?.teams?.[1] || log.details?.teamB || [];
        const scoreA = parseInt(log.details?.scoreA) || 0;  // Make sure it's a number
        const scoreB = parseInt(log.details?.scoreB) || 0;  // Make sure it's a number
        const mvp = log.details?.mvp || "";

        // Determine which team won
        const teamAWon = scoreA > scoreB;
        const teamBWon = scoreB > scoreA;
        const isTie = scoreA === scoreB;

        // Helper function to get team display name
        const getTeamDisplayName = (team, teamLetter) => {
            if (!team || team.length === 0) return `Team ${teamLetter}`;

            // For 1v1 matches, return the player's name
            if (team.length === 1) {
                const playerName = typeof team[0] === 'string' ? team[0] : team[0].name;
                return playerName || `Team ${teamLetter}`;
            }

            // For multi-player teams, return "Team [Letter]"
            return `Team ${teamLetter}`;
        };

        // Get display names
        const teamAName = getTeamDisplayName(teamA, "A");
        const teamBName = getTeamDisplayName(teamB, "B");

        // Check if this is a 1v1 match
        const is1v1 = teamA.length === 1 && teamB.length === 1;

        return (
            <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                    {/* Team A */}
                    <div className={`p-2 rounded ${teamAWon ? 'bg-green-900 bg-opacity-20' : teamBWon ? 'bg-red-900 bg-opacity-20' : 'bg-gray-900 bg-opacity-20'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center flex-1">
                                <span className="text-sm font-medium text-gray-300">{teamAName}</span>
                                {log.details?.teamARating && (
                                    <span className="text-xs text-white ml-2">({log.details.teamARating})</span>
                                )}
                            </div>
                            <span className="text-sm font-bold text-white ml-2">{scoreA}</span>
                        </div>

                        {/* Only show player list for multi-player teams */}
                        {!is1v1 && (
                            <div className="space-y-1" ref={teamARef}>
                                {Array.isArray(teamA) ? (
                                    teamA.map((player, idx) => {
                                        const playerName = typeof player === 'string' ? player : player.name;
                                        const isMVP = mvp === playerName;
                                        return (
                                            <div key={idx} className="text-xs flex items-center w-full">
                                                <span className={`${isMVP ? 'text-yellow-400 font-medium' : 'text-gray-300'} truncate flex-1 mr-1`}>
                                                    {playerName}
                                                </span>
                                                {isMVP && <span className="text-yellow-400 flex-shrink-0">👑</span>}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400">No players listed</div>
                                )}
                            </div>
                        )}

                        {/* Show MVP indicator for 1v1 if this player is MVP */}
                        {is1v1 && mvp === (typeof teamA[0] === 'string' ? teamA[0] : teamA[0].name) && (
                            <div className="text-yellow-400 text-xs">👑 MVP</div>
                        )}
                    </div>

                    {/* Team B */}
                    <div className={`p-2 rounded ${teamBWon ? 'bg-green-900 bg-opacity-20' : teamAWon ? 'bg-red-900 bg-opacity-20' : 'bg-gray-900 bg-opacity-20'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center flex-1">
                                <span className="text-sm font-medium text-gray-300">{teamBName}</span>
                                {log.details?.teamBRating && (
                                    <span className="text-xs text-white ml-2">({log.details.teamBRating})</span>
                                )}
                            </div>
                            <span className="text-sm font-bold text-white ml-2">{scoreB}</span>
                        </div>

                        {/* Only show player list for multi-player teams */}
                        {!is1v1 && (
                            <div className="space-y-1" ref={teamBRef}>
                                {Array.isArray(teamB) ? (
                                    teamB.map((player, idx) => {
                                        const playerName = typeof player === 'string' ? player : player.name;
                                        const isMVP = mvp === playerName;
                                        return (
                                            <div key={idx} className="text-xs flex items-center w-full">
                                                <span className={`${isMVP ? 'text-yellow-400 font-medium' : 'text-gray-300'} truncate flex-1 mr-1`}>
                                                    {playerName}
                                                </span>
                                                {isMVP && <span className="text-yellow-400 flex-shrink-0">👑</span>}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400">No players listed</div>
                                )}
                            </div>
                        )}

                        {/* Show MVP indicator for 1v1 if this player is MVP */}
                        {is1v1 && mvp === (typeof teamB[0] === 'string' ? teamB[0] : teamB[0].name) && (
                            <div className="text-yellow-400 text-xs">👑 MVP</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    const renderRatingDetails = (log) => {
        // For rating changes, the data is stored in log.details.ratingData
        const ratings = log.details?.ratingData || log.details?.ratings || log.details?.playerData;

        if (!ratings) return null;

        // Check if we have information about what changed
        const changedValues = log.details?.changedValues;
        const previousRating = log.details?.previousRating;

        return (
            <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex flex-wrap gap-2 text-xs mt-2">
                    {Object.entries(ratings).map(([key, value]) => {
                        // Skip non-rating properties
                        if (["name", "player", "playerName", "submittedBy", "active", "rating", "submissions"].includes(key)) {
                            return null;
                        }

                        // Create shortened key name (first 3 chars)
                        const shortKey = key.substring(0, 3);

                        // Get previous value from either changedValues or previousRating
                        let previousValue = null;
                        if (changedValues && changedValues[key]) {
                            previousValue = changedValues[key].from;
                        } else if (previousRating && previousRating[key] !== undefined) {
                            previousValue = previousRating[key];
                        }

                        // Determine color based on change direction
                        let textColorClass = "text-blue-400"; // Default

                        if (previousValue !== null && value !== previousValue) {
                            if (value > previousValue) {
                                textColorClass = "text-green-400";
                            } else if (value < previousValue) {
                                textColorClass = "text-red-400";
                            }
                        }

                        return (
                            <div key={key} className="px-2 py-1 rounded-md bg-gray-800 flex items-center">
                                <span className="capitalize mr-1">{shortKey}:</span>
                                <span className={textColorClass}>{value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const getIconForAction = (action) => {
        switch (action) {
            case "player_added":
                return "👤+";
            case "player_updated":
                return "👤✏️";
            case "player_deleted":
                return "👤🗑️";
            case "player_rating_changed":
                return "👤⭐";
            case "match_result_saved":
                return "🏀✓";
            case "match_completed":
                return "🏆";
            case "rematch_created":
                return "🔄";
            case "leaderboard_reset":
                return "🏆🗑️";
            case "log_deleted":
                return "📜🗑️";
            case "schema_initialized":
                return "🔧";
            default:
                return "📝";
            case "user_joined_league":
                return "👋";
        }
    };

    const getColorForAction = (action) => {
        switch (action) {
            case "player_added":
                return "bg-green-900 bg-opacity-30 text-green-400";
            case "player_updated":
            case "player_rating_changed":
                return "bg-blue-900 bg-opacity-30 text-blue-400";
            case "player_deleted":
                return "bg-red-900 bg-opacity-30 text-red-400";
            case "match_result_saved":
                return "bg-yellow-900 bg-opacity-30 text-yellow-400";
            case "teams_generated":
                return "bg-indigo-900 bg-opacity-30 text-indigo-400";
            case "leaderboard_reset":
                return "bg-purple-900 bg-opacity-30 text-purple-400";
            case "log_deleted":
                return "bg-gray-800 text-gray-400";
            case "schema_initialized":
                return "bg-gray-800 text-gray-400";
            default:
                return "bg-gray-800 text-gray-400";
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMoreLogs) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            fetchLogs(nextPage);
        }
    };

    const handleRefresh = () => {
        fetchLogs(1, true);
    };

    const getFilteredLogs = () => {
        const endIndex = Math.min(currentPage * logsPerPage, logs.length);
        return logs.slice(0, endIndex);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Activity Log</h2>

                <div className="flex space-x-3">
                    <select
                        className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-3 py-1.5 text-sm"
                        value={filter}
                        onChange={(e) => {
                            setFilter(e.target.value);
                            setCurrentPage(1); // Reset to first page when filter changes
                        }}
                    >
                        <option value="all">All Activities</option>
                        <option value="players">Players</option>
                        <option value="matches">Matches</option>
                        <option value="admin">Admin Actions</option>
                    </select>
                </div>
            </div>

            {loading && currentPage === 1 ? (
                <div className="flex justify-center py-8">
                    <div className="animate-pulse text-gray-400">Loading logs...</div>
                </div>
            ) : getFilteredLogs().length === 0 ? (
                <div className="bg-gray-800 rounded p-6 text-center text-gray-400">
                    {filter !== "all" ? "No logs found for this filter." : "No logs found."}
                </div>
            ) : (
                <div className="space-y-3">
                            {/* Status and refresh controls */}
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-sm text-gray-400">
                                    Showing {Math.min(getFilteredLogs().length, currentPage * logsPerPage)} of {getFilteredLogs().length} logs
                                    {filter !== "all" && ` (filtered: ${filter})`}
                                </div>
                                <button
                                    onClick={handleRefresh}
                                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                    disabled={loading}
                                >
                                    🔄 Refresh
                                </button>
                            </div>

                            {/* Daily Share Section - Only show when filter is "matches" */}
                            {filter === "matches" && (
                                <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                                    <h3 className="text-sm font-semibold text-white mb-2">📱 Share Daily Matches</h3>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={shareDateFilter}
                                            onChange={(e) => setShareDateFilter(e.target.value)}
                                            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={() => shareDailyMatchLogs(logs, shareDateFilter)}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
                                        >
                                            📤 Share Matches
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-blue-400">
                                            {(() => {
                                                // Debug: Show all match logs and their dates
                                                const matchLogs = logs.filter(log => ["match_result_saved", "match_completed"].includes(log.action));

                                                // Parse the selected date properly to avoid timezone issues
                                                const [year, month, day] = shareDateFilter.split('-').map(Number);

                                                const matchesOnDate = matchLogs.filter(log => {
                                                    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                                    const logYear = logDate.getFullYear();
                                                    const logMonth = logDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
                                                    const logDay = logDate.getDate();

                                                    return logYear === year && logMonth === month && logDay === day;
                                                });

                                                // Debug info
                                                console.log('Debug Share Filter:');
                                                console.log('Selected date:', shareDateFilter);
                                                console.log('Parsed date:', year, month, day);
                                                console.log('Total match logs:', matchLogs.length);
                                                console.log('Match logs with dates:', matchLogs.map(log => ({
                                                    action: log.action,
                                                    timestamp: log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp),
                                                    year: (log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp)).getFullYear(),
                                                    month: (log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp)).getMonth() + 1,
                                                    day: (log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp)).getDate()
                                                })));
                                                console.log('Matches on selected date:', matchesOnDate.length);

                                                return `${matchesOnDate.length} match${matchesOnDate.length !== 1 ? 'es' : ''} on this date`;
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            )}

                    {/* Logs display */}
                    {getFilteredLogs().map(log => (
                        <div key={log.id}
                            className={`rounded p-3 border border-gray-800 ${getColorForAction(log.action)}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-start space-x-3">
                                    <div className="text-xl">{getIconForAction(log.action)}</div>
                                    <div className="flex-grow">
                                        <div className="font-medium">{getActionText(log)}</div>
                                        <div className="text-xs text-gray-400">{formatTimestamp(log.timestamp)}</div>
                                        {log.userName && isAdmin && (
                                            <div className="text-xs mt-1 text-gray-300">
                                                By: {log.userName}
                                            </div>
                                        )}

                                        {/* This is the key part - render rating details for ALL player-related actions */}
                                        {["player_rating_changed", "player_rating_updated", "player_rating_added",
                                            "player_added", "player_updated"].includes(log.action) &&
                                            renderRatingDetails(log)
                                        }
                                        {["match_result_saved", "match_completed"].includes(log.action) &&
                                            renderMatchDetails(log)
                                        }
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center space-x-2">
                                        {showConfirmDelete === log.id ? (
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => {
                                                        // Show confirmation modal for player and match operations
                                                        if (["player_rating_changed", "player_rating_updated", "player_rating_added", "player_added",
                                                            "match_result_saved", "match_completed"].includes(log.action)) {
                                                            setLogToDelete(log);
                                                            setShowDeleteModal(true);
                                                            setShowConfirmDelete(null);
                                                        } else {
                                                            // For other logs, delete immediately
                                                            handleDeleteLog(log.id);
                                                        }
                                                    }}
                                                    className="text-red-500 hover:text-red-400 text-xs font-bold"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmDelete(null)}
                                                    className="text-gray-400 hover:text-gray-300 text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowConfirmDelete(log.id)}
                                                className="text-gray-500 hover:text-red-400"
                                                title="Delete log entry"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showDeleteModal && logToDelete && (
                                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                                    <div className="bg-gray-800 p-4 rounded-lg max-w-md w-full">
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            {logToDelete.action === "player_added"
                                                ? "Confirm Player Deletion"
                                                : ["match_result_saved", "match_completed"].includes(logToDelete.action)
                                                    ? "Confirm Match Result Deletion"
                                                    : "Confirm Rating Reversal"}
                                        </h3>
                                        <p className="text-gray-300 mb-4">
                                            {logToDelete.action === "player_added"
                                                ? `This will delete player ${logToDelete.details?.playerName || logToDelete.details?.name} completely from the league.`
                                                : ["match_result_saved", "match_completed"].includes(logToDelete.action)
                                                    ? `This will remove this match result and update the leaderboard accordingly.`
                                                    : `This will delete the rating submission for ${logToDelete.details?.playerName || logToDelete.details?.name} by ${logToDelete.userName}.`
                                            }
                                        </p>
                                        <p className="text-yellow-400 text-sm mb-4">
                                            {logToDelete.action === "player_added"
                                                ? "All player data and ratings will be permanently removed. This action cannot be undone."
                                                : ["match_result_saved", "match_completed"].includes(logToDelete.action)
                                                    ? "Player win/loss records and MVP counts will be adjusted. This action cannot be undone."
                                                    : "This will recalculate the player's rating based on other submissions. This action cannot be undone."
                                            }
                                        </p>
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => setShowDeleteModal(false)}
                                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleDeleteLog(logToDelete.id);
                                                    setShowDeleteModal(false);
                                                }}
                                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                            >
                                                {logToDelete.action === "player_added"
                                                    ? "Delete Player"
                                                    : ["match_result_saved", "match_completed"].includes(logToDelete.action)
                                                        ? "Delete Match Result"
                                                        : "Delete & Revert Rating"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {log.details &&
                                Object.keys(log.details).length > 0 &&
                                !["player_rating_changed", "player_rating_updated", "player_rating_added"].includes(log.action) &&
                                !["name", "playerName", "userId", "scoreA", "scoreB", "teamCount"].some(key => key in log.details) && (
                                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs">
                                        <details>
                                            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                                                Details
                                            </summary>
                                            <pre className="mt-2 p-2 bg-gray-900 rounded overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                )}
                        </div>
                    ))}

                    {/* Load More button */}
                    {hasMoreLogs && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleLoadMore}
                                disabled={loading}
                                className={`px-6 py-2 rounded transition-colors ${loading
                                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                    }`}
                            >
                                {loading ? "Loading..." : "Load More"}
                            </button>
                        </div>
                    )}

                    {!hasMoreLogs && logs.length > 0 && (
                        <div className="text-center text-gray-400 text-sm mt-6">
                            End of logs
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}