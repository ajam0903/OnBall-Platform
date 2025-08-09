import React, { useEffect, useState, useRef, useMemo } from "react";
import { StyledButton } from "./UIComponents";
import { StyledSelect } from "./UIComponents";
import PlayerBeltIcons from "./PlayerBeltIcons";
import PlayerBadges from "./playerBadges";
import { badgeCategories } from "./badgeSystem.jsx";
import { doc, getDoc, setDoc as firestoreSetDoc } from "firebase/firestore";

export default function TeamsTab({
    players = [],
    teams = [],
    setTeams,
    matchups = [],
    setMatchups,
    mvpVotes = [],
    setMvpVotes,
    scores = [],
    setScores,
    teamSize,
    setTeamSize,
    generateBalancedTeams,
    handlePlayerActiveToggle,
    handleBatchPlayerActiveToggle,
    weightings,
    saveMatchResults,
    archiveCompletedMatches,
    hasGeneratedTeams,
    setHasGeneratedTeams,
    isRematch = () => false,
    getPreviousResults = () => [],
    hasPendingMatchups = false,
    playerOVRs = {},
    calculatePlayerScore,
    currentBelts = {},
    leaderboard = {},
    matchHistory = [],
    onPlayerClick,
    currentLeagueId,
    currentSet,
    db,
    user,
    logActivity,
    setToastMessage,
    prepareDataForFirestore,
    setHasPendingMatchups,
    getUserPlayerPreference,
}) {
    const getActivePlayersForUser = () => {
        return players.filter(p => p.active);  // Use global active
    };

    const [teamGenerationMethod, setTeamGenerationMethod] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showTeamSelector, setShowTeamSelector] = useState(false);
    const [manualTeams, setManualTeams] = useState([[], []]);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const dropdownRef = useRef(null);
    const [playerSortBy, setPlayerSortBy] = useState("active");
    const [playerSortDirection, setPlayerSortDirection] = useState("desc");
    const [selectAll, setSelectAll] = useState(false);
    const [recentlyActivated, setRecentlyActivated] = useState(new Set());
    const playerListRef = useRef(null);
    const [matchDateTime, setMatchDateTime] = useState(new Date().toISOString().slice(0, 16));


    const validateMatchDate = (dateString) => {
        const selectedDate = new Date(dateString);
        const now = new Date();

        // Don't allow future dates
        if (selectedDate > now) {
            return "Match date cannot be in the future";
        }

        // Don't allow dates too far in the past (optional - adjust as needed)
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        if (selectedDate < thirtyDaysAgo) {
            return "Match date cannot be more than 30 days ago";
        }

        return null;
    };

    // Check for unsaved changes
    useEffect(() => {
        if (matchups.length > 0) {
            const hasIncompleteScores = scores.some(score =>
                !score.processed && (!score.a || !score.b || score.a === "" || score.b === "")
            );
            setUnsavedChanges(hasIncompleteScores);
        } else {
            setUnsavedChanges(false);
        }
    }, [matchups, scores]);

    // Function to get player's first name and last initial
    const getFormattedPlayerName = (fullName) => {
        if (!fullName) return "Team";

        // Clean up the name first
        const cleanedName = fullName.trim().replace(/\s+/g, ' ');
        const nameParts = cleanedName.split(' ');

        // If only one name (or empty), return it
        if (nameParts.length <= 1) return cleanedName;

        // Special handling for very short or hyphenated names
        const firstName = nameParts[0];

        // Get last name - handle hyphenated names properly
        let lastName = nameParts[nameParts.length - 1];
        let lastInitial = lastName[0] || '';

        // Add a period to the initial
        return `${firstName} ${lastInitial}.`;
    };

    // Function to find the best player on a team based on rating
    const findBestPlayer = (team, calculatePlayerScore) => {
        // Check for null or empty team
        if (!team || !Array.isArray(team) || team.length === 0) return null;

        // Filter out any invalid player objects
        const validPlayers = team.filter(p => p && typeof p === 'object' && p.name);
        if (validPlayers.length === 0) return null;

        // Only consider starters (non-bench players) if there are any
        const starters = validPlayers.filter(p => !p.isBench);
        const playersToConsider = starters.length > 0 ? starters : validPlayers;

        return playersToConsider.reduce((best, current) => {
            if (!best) return current;

            // Safely calculate scores, defaulting to computeRating1to10 if calculatePlayerScore is missing
            let bestScore = 0, currentScore = 0;
            try {
                bestScore = calculatePlayerScore ? calculatePlayerScore(best) : computeRating1to10(best);
                currentScore = calculatePlayerScore ? calculatePlayerScore(current) : computeRating1to10(current);
            } catch (e) {
                console.error("Error calculating player score:", e);
                // Fallback to internal rating
                bestScore = computeRating1to10(best);
                currentScore = computeRating1to10(current);
            }

            return currentScore > bestScore ? current : best;
        }, playersToConsider[0]);
    };



    const teamNameCache = new Map();

    const getTeamNameCached = (team, calculatePlayerScore) => {
        if (!team || team.length === 0) return "Team";

        // Create a unique key for this team (JSON string of player names)
        const teamKey = JSON.stringify(team.map(p => p.name).sort());

        // Return cached value if exists
        if (teamNameCache.has(teamKey)) {
            return teamNameCache.get(teamKey);
        }

        // Calculate name and cache it
        const teamName = getTeamName(team, calculatePlayerScore);
        teamNameCache.set(teamKey, teamName);

        return teamName;
    };

    const getTeamName = (team, calculatePlayerScore) => {
        if (!team || team.length === 0) return "Team";

        // For 1v1 matches, just return the player's name directly
        if (team.length === 1) {
            return team[0].name || "Player";
        }

        const bestPlayer = findBestPlayer(team, calculatePlayerScore);
        if (!bestPlayer) return "Team";

        return getFormattedPlayerName(bestPlayer.name);
    };

    // Input handlers that mark changes as unsaved
    const handleScoreChange = (index, team, value) => {
        const updated = [...scores];
        if (!updated[index]) {
            updated[index] = { a: "", b: "" };
        }
        updated[index] = {
            ...updated[index],
            [team]: value,
            processed: false // Mark as unprocessed when changed
        };
        setScores(updated);
    };

    const handleMvpChange = (index, value) => {
        const updated = [...mvpVotes];
        updated[index] = value;
        setMvpVotes(updated);
    };

    const handlePlayerSort = (column) => {
        if (playerSortBy === column) {
            setPlayerSortDirection(playerSortDirection === "asc" ? "desc" : "asc");
        } else {
            setPlayerSortBy(column);
            setPlayerSortDirection("desc");
        }
    };

    const handleSelectAll = () => {
        const newSelectAllState = !selectAll;
        console.log("=== SELECT ALL DEBUG ===");
        console.log("Current selectAll state:", selectAll);
        console.log("New selectAll state:", newSelectAllState);
        console.log("Number of players:", players.length);

        setSelectAll(newSelectAllState);

        // Create updates for all players
        const updates = players.map(player => ({
            name: player.name,
            active: newSelectAllState
        }));

        console.log("Updates being created:", updates);
        console.log("handleBatchPlayerActiveToggle function exists:", !!handleBatchPlayerActiveToggle);

        // Use batch update if available, otherwise fall back to individual updates
        if (handleBatchPlayerActiveToggle) {
            console.log("Calling handleBatchPlayerActiveToggle");
            handleBatchPlayerActiveToggle(updates);
        } else {
            console.log("Calling individual handlePlayerActiveToggle for each player");
            players.forEach(player => {
                handlePlayerActiveToggle(player.name, newSelectAllState);
            });
        }

        console.log("=== END SELECT ALL DEBUG ===");
    };

    // Helper function to get player OVR from leaderboard
    const getPlayerOVR = (playerName) => {
        // Since leaderboard isn't passed as a prop, we'll just use the playerOVRs prop
        const playerOVR = playerOVRs[playerName];

        // If we don't have an OVR, compute it
        if (!playerOVR) {
            const player = players.find(p => p.name === playerName);
            return player ? computeRating1to10(player) : 5; // default to 5 if player not found
        }

        return playerOVR;
    };

    // Rematch indicator component
    const RematchIndicator = ({ teamA, teamB, previousMatches }) => {
        if (!previousMatches || previousMatches.length === 0) return null;

        // Calculate the win-loss record between these teams
        let teamAWins = 0;
        let teamBWins = 0;

        previousMatches.forEach(match => {
            const matchTeamA = match.teams[0].map(p => p.name).sort().join(',');
            const matchTeamB = match.teams[1].map(p => p.name).sort().join(',');
            const currentTeamA = teamA.map(p => p.name).sort().join(',');
            const currentTeamB = teamB.map(p => p.name).sort().join(',');

            // Figure out which historical team corresponds to current teamA
            const isTeamAMatchesHistoryTeamA = matchTeamA === currentTeamA;

            if (match.score) {
                const scoreA = parseInt(match.score.a);
                const scoreB = parseInt(match.score.b);

                if (!isNaN(scoreA) && !isNaN(scoreB)) {
                    if (scoreA > scoreB) {
                        // History Team A won
                        isTeamAMatchesHistoryTeamA ? teamAWins++ : teamBWins++;
                    } else if (scoreB > scoreA) {
                        // History Team B won
                        isTeamAMatchesHistoryTeamA ? teamBWins++ : teamAWins++;
                    }
                }
            }
        });

        // Format date of last match
        const lastMatchDate = new Date(previousMatches[previousMatches.length - 1].date);
        const formattedDate = lastMatchDate.toLocaleDateString();

        return (
            <div className="bg-yellow-800 bg-opacity-30 p-2 rounded-md mb-3">
                <div className="flex items-center mb-1">
                    <span className="text-yellow-400 text-xs font-bold mr-2">⟳ REMATCH</span>
                    <span className="text-xs text-gray-300">
                        {previousMatches.length} previous {previousMatches.length === 1 ? 'game' : 'games'}
                    </span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-300">
                        Record: <span className="text-green-400">{teamAWins}</span>-<span className="text-red-400">{teamBWins}</span>
                    </span>
                    <span className="text-gray-400">Last played: {formattedDate}</span>
                </div>
            </div>
        );
    };

    // Compute rating 1–10 based on your skill weighting
    const computeRating1to10 = (player) => {
        const {
            scoring = 5,
            defense = 5,
            rebounding = 5,
            playmaking = 5,
            stamina = 5,
            physicality = 5,
            xfactor = 5,
        } = player;

        const raw =
            scoring * weightings.scoring +
            defense * weightings.defense +
            rebounding * weightings.rebounding +
            playmaking * weightings.playmaking +
            stamina * weightings.stamina +
            physicality * weightings.physicality +
            xfactor * weightings.xfactor;

        // clamp rating to 10
        const rating = Math.min(raw, 10);
        return rating;
    };


    const generateRandomTeams = async () => {
        if (!currentLeagueId) {
            console.error("No currentLeagueId set");
            return;
        }
        const activePlayers = getActivePlayersForUser();

        if (activePlayers.length < teamSize * 2) {
            alert(`Need at least ${teamSize * 2} active players for ${teamSize}v${teamSize} games`);
            return;
        }

        // Check for unsaved results
        const hasUnsavedScores = scores.some(score =>
            score && (score.a || score.b) && !score.processed
        );

        if (hasUnsavedScores && hasGeneratedTeams) {
            if (!confirm("You have unsaved match results. Creating new teams will discard these results. Continue?")) {
                return;
            }
        }

        // Calculate number of teams
        const numPossibleTeams = Math.floor(activePlayers.length / teamSize);
        const numTeams = Math.max(2, numPossibleTeams - (numPossibleTeams % 2)); // Ensure even number

        // Shuffle players randomly
        const shuffledPlayers = [...activePlayers].sort(() => Math.random() - 0.5);

        // Create teams
        const randomTeams = [];
        for (let i = 0; i < numTeams; i++) {
            randomTeams.push([]);
        }

        // Distribute players randomly to teams
        shuffledPlayers.forEach((player, index) => {
            const teamIndex = index % numTeams;
            const playerCopy = { ...player };

            // Mark as bench if team already has enough starters
            if (randomTeams[teamIndex].filter(p => !p.isBench).length >= teamSize) {
                playerCopy.isBench = true;
            } else {
                playerCopy.isBench = false;
            }

            randomTeams[teamIndex].push(playerCopy);
        });

        // Create random matchups
        const randomMatchups = [];
        for (let i = 0; i < randomTeams.length - 1; i += 2) {
            randomMatchups.push([randomTeams[i], randomTeams[i + 1] || []]);
        }

        // Update state
        setTeams(randomTeams);
        setMatchups(randomMatchups);
        setHasPendingMatchups(false);
        setHasGeneratedTeams(true);

        // Create MVP votes and scores arrays
        const newMvpVotes = Array(randomMatchups.length).fill("");
        const newScores = Array(randomMatchups.length).fill({ a: "", b: "" });

        setMvpVotes(newMvpVotes);
        setScores(newScores);

        // Update Firestore
        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const firestoreData = prepareDataForFirestore({
                ...data,
                teams: randomTeams,
                matchups: randomMatchups,
                mvpVotes: newMvpVotes,
                scores: newScores,
                leaderboard: data.leaderboard || {}
            });
            await firestoreSetDoc(docRef, firestoreData);
        }

        // Log the activity
        await logActivity(
            db,
            currentLeagueId,
            "teams_generated",
            {
                teamCount: randomTeams.length,
                matchupCount: randomMatchups.length,
                teamSize: teamSize,
                source: "random"
            },
            user,
            false
        );

        setToastMessage("🎲 Random teams generated!");
        setTimeout(() => setToastMessage(""), 3000);
    };

    // Calculate team strength based on player ratings
    const calculateTeamStrength = (team) => {
        if (!team || team.length === 0) return 0;

        const totalRating = team.reduce((sum, player) => {
            return sum + computeRating1to10(player);
        }, 0);

        // Average rating per player (to account for teams with different sizes)
        return totalRating / team.length;
    };

    const memoizedTeamStrength = useMemo(() => {
        return teams.map(team => calculateTeamStrength(team));
    }, [teams, calculatePlayerScore]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            if (a.active !== b.active) {
                return a.active ? -1 : 1;
            }

            let aValue, bValue;

            switch (playerSortBy) {
                case "name":
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case "ovr":
                    aValue = playerOVRs[a.name] || computeRating1to10(a);
                    bValue = playerOVRs[b.name] || computeRating1to10(b);
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }

            if (typeof aValue === 'string') {
                return playerSortDirection === "asc"
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return playerSortDirection === "asc" ? aValue - bValue : bValue - aValue;
        });
    }, [players, playerSortBy, playerSortDirection, playerOVRs]);;
    
    // Count active players
    const activePlayerCount = getActivePlayersForUser().length;
    const [teamRankings, setTeamRankings] = useState([]);



    // For the percentage-based bar
    const getPercentage = (rating) => {
        // rating is from 0–10, so rating=5 => 50%
        return (rating / 10) * 100;
    };

    const handlePlayerActiveToggleWithScrollPreservation = (playerName, isActive) => {
        const scrollPosition = playerListRef.current?.scrollTop || 0;

        // If player is being activated, add to recently activated set
        if (isActive) {
            setRecentlyActivated(prev => new Set([...prev, playerName]));
            // Remove from set after animation duration
            setTimeout(() => {
                setRecentlyActivated(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(playerName);
                    return newSet;
                });
            }, 2000);
        }

        // Call the SINGLE player toggle function
        handlePlayerActiveToggle(playerName, isActive);

        setTimeout(() => {
            if (playerListRef.current) {
                playerListRef.current.scrollTop = scrollPosition;
            }
        }, 0);
    };

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        // Reset generation method when teams are cleared
        if (teams.length === 0) {
            setTeamGenerationMethod(null);
        }
    }, [teams]);

    // Initialize manual teams when team size changes
    useEffect(() => {
        // Calculate required number of teams to fit all active players
        // For 2v2, we need a team for every 2 players
        const numTeams = Math.floor(activePlayerCount / teamSize);

        // Always ensure we have at least 2 teams for matchup creation
        const finalNumTeams = Math.max(2, numTeams);

        setManualTeams(Array.from({ length: finalNumTeams }, () => []));
    }, [teamSize, activePlayerCount]);

    useEffect(() => {
        const now = new Date();
        // Format for datetime-local input (YYYY-MM-DDTHH:MM in local time)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        setMatchDateTime(localDateTime);
    }, []);

    useEffect(() => {
        const allActive = players.every(p => p.active);
        const allInactive = players.every(p => !p.active);

        if (allActive) {
            setSelectAll(true);
        } else if (allInactive) {
            setSelectAll(false);
        } else {
            setSelectAll(false);
        }
    }, [players]);

    // Handle adding a player to a specific team
    const addPlayerToTeam = (player, teamIndex) => {
        // Check if player is already on any team
        let playerExistsOnTeam = false;
        const updatedTeams = manualTeams.map((team, idx) => {
            if (team.some(p => p.name === player.name)) {
                playerExistsOnTeam = true;
                return team.filter(p => p.name !== player.name);
            }
            return team;
        });

        // Add player to the selected team
        if (!playerExistsOnTeam) {
            // If team already has the required players, add as bench
            if (updatedTeams[teamIndex].filter(p => !p.isBench).length >= teamSize) {
                player.isBench = true;
            } else {
                player.isBench = false;
            }
            updatedTeams[teamIndex] = [...updatedTeams[teamIndex], player];
        }

        setManualTeams(updatedTeams);
    };

    // Fill partial teams with random players
    const fillTeamsRandomly = () => {
        const unassignedPlayers = getUnassignedPlayers();
        if (unassignedPlayers.length === 0) return;

        const shuffledPlayers = [...unassignedPlayers].sort(() => Math.random() - 0.5);
        const updatedTeams = [...manualTeams];

        shuffledPlayers.forEach(player => {
            // Find teams that need more players (prioritize teams with fewer players)
            const teamsNeedingPlayers = updatedTeams
                .map((team, index) => ({
                    index,
                    currentSize: team.filter(p => !p.isBench).length,
                    totalSize: team.length
                }))
                .filter(t => t.currentSize < teamSize)
                .sort((a, b) => a.totalSize - b.totalSize); // Fill teams with fewer total players first

            if (teamsNeedingPlayers.length > 0) {
                const targetTeam = teamsNeedingPlayers[0];
                const playerCopy = { ...player, isBench: false };
                updatedTeams[targetTeam.index].push(playerCopy);
            }
        });

        setManualTeams(updatedTeams);
        setToastMessage("🎲 Teams filled randomly!");
        setTimeout(() => setToastMessage(""), 3000);
    };

    // Fill partial teams with balanced players using existing balancing logic
    const fillTeamsBalanced = () => {
        const unassignedPlayers = getUnassignedPlayers();
        if (unassignedPlayers.length === 0) return;

        // Create a copy of current teams for manipulation
        const updatedTeams = [...manualTeams];

        // Add scores to unassigned players
        const scoredUnassigned = unassignedPlayers.map(player => ({
            ...player,
            score: calculatePlayerScore(player)
        }));

        // Sort unassigned players by score (highest to lowest) - same as generateBalancedTeams
        const sortedUnassigned = scoredUnassigned.sort((a, b) => b.score - a.score);

        // Function to calculate team strength (same logic as in generateBalancedTeams)
        const calculateCurrentTeamStrength = (team) => {
            if (!team || team.length === 0) return 0;

            const starters = team.filter(p => !p.isBench);
            const bench = team.filter(p => p.isBench);

            if (starters.length === 0) return 0;

            // Starters contribute 90% to team strength, bench 10%
            const starterScore = starters.reduce((sum, p) => sum + calculatePlayerScore(p), 0) / starters.length;
            const benchScore = bench.length > 0
                ? bench.reduce((sum, p) => sum + calculatePlayerScore(p), 0) / bench.length
                : 0;

            return (starterScore * 0.9) + (benchScore * 0.1);
        };

        // Assign each unassigned player using the same balancing logic
        sortedUnassigned.forEach(player => {
            // Find teams that need more starters
            const teamsNeedingStarters = updatedTeams
                .map((team, index) => ({
                    index,
                    currentStarterCount: team.filter(p => !p.isBench).length,
                    strength: calculateCurrentTeamStrength(team)
                }))
                .filter(t => t.currentStarterCount < teamSize);

            if (teamsNeedingStarters.length > 0) {
                // Sort by team strength (weakest first) - same strategy as generateBalancedTeams
                teamsNeedingStarters.sort((a, b) => a.strength - b.strength);

                const targetTeam = teamsNeedingStarters[0];
                const playerCopy = { ...player, isBench: false };
                updatedTeams[targetTeam.index].push(playerCopy);
            } else {
                // All teams are full of starters, add as bench to weakest team
                const teamStrengths = updatedTeams.map((team, index) => ({
                    index,
                    strength: calculateCurrentTeamStrength(team)
                }));

                teamStrengths.sort((a, b) => a.strength - b.strength);
                const weakestTeam = teamStrengths[0];
                const playerCopy = { ...player, isBench: true };
                updatedTeams[weakestTeam.index].push(playerCopy);
            }
        });

        setManualTeams(updatedTeams);
        setToastMessage("⚖️ Teams filled using balanced algorithm!");
        setTimeout(() => setToastMessage(""), 3000);
    };

    // Update team rankings whenever teams change
    useEffect(() => {
        if (teams && teams.length > 0) {
            const rankings = teams.map((team, index) => {
                const strength = calculateTeamStrength(team);
                return {
                    teamIndex: index,
                    strength: strength,
                    players: team
                };
            });

            // Sort by team strength (highest to lowest)
            setTeamRankings(rankings.sort((a, b) => b.strength - a.strength));
        }
    }, [teams]);


    // Generate matchups from manual teams
    const generateMatchupsFromManualTeams = () => {
        // If there are pending matchups with unsaved results, use browser confirm
        if (hasPendingMatchups) {
            if (confirm) {
                if (!confirm("You have unsaved match results. Creating new teams will discard these results. Continue?")) {
                    return;
                }
            }
        }

        // Create matchups from the manual teams
        const newMatchups = [];
        for (let i = 0; i < manualTeams.length - 1; i += 2) {
            newMatchups.push([manualTeams[i], manualTeams[i + 1] || []]);
        }

        setTeams(manualTeams);
        setMatchups(newMatchups);
        setMvpVotes(Array(newMatchups.length).fill(""));
        setScores(Array(newMatchups.length).fill({ a: "", b: "" }));
        setShowTeamSelector(false);
        setHasGeneratedTeams(true);
        setTeamGenerationMethod('custom');
    };

    // Check if an active player is not assigned to any team
    const getUnassignedPlayers = () => {
        const assignedPlayerNames = manualTeams.flat().map(p => p.name);
        return sortedPlayers.filter(p => p.active && !assignedPlayerNames.includes(p.name));
    };

    // Check if teams are valid based on team size
    const areTeamsValid = () => {
        const unassignedCount = getUnassignedPlayers().length;
        const teamsWithCorrectSize = manualTeams.filter(team =>
            team.filter(p => !p.isBench).length === teamSize
        ).length;

        // All active players should be assigned and most teams should have the correct size
        return unassignedCount === 0 && teamsWithCorrectSize >= manualTeams.length - 1;
    };

    const usedTeamNames = new Set();

    // Modified function to ensure unique names
    const getUniqueTeamName = (team, index, calculatePlayerScore) => {
        // Get the base name
        const baseName = getTeamName(team, calculatePlayerScore);

        // If this is the first use, just return the name
        if (!usedTeamNames.has(baseName)) {
            usedTeamNames.add(baseName);
            return baseName;
        }

        // Otherwise, add a suffix
        return `${baseName} (${index + 1})`;
    };


    // Get team rank string showing position out of total
    const getTeamRankString = (teamIndex) => {
        if (!teamRankings || teamRankings.length === 0) return "";

        const rankObj = teamRankings.find(rank => rank.teamIndex === teamIndex);
        if (!rankObj) return "";

        const rankPosition = teamRankings.indexOf(rankObj) + 1;
        return `Rank: ${rankPosition}/${teamRankings.length}`;
    };

    // Get color class based on rank
    const getRankColorClass = (teamIndex) => {
        if (!teamRankings || teamRankings.length === 0) return "text-gray-400";

        const rankObj = teamRankings.find(rank => rank.teamIndex === teamIndex);
        if (!rankObj) return "text-gray-400";

        const rankPosition = teamRankings.indexOf(rankObj) + 1;

        // Top team gets gold, second gets silver, third gets bronze
        if (rankPosition === 1) return "text-yellow-400";
        if (rankPosition === 2) return "text-gray-300";
        if (rankPosition === 3) return "text-yellow-600";
        return "text-gray-400";
    };

    useEffect(() => {
        // Reset generation method when teams are cleared
        if (teams.length === 0) {
            setTeamGenerationMethod(null);
        }
    }, [teams]);

    return (
        <div className="space-y-8">
            {/* Control Section with Dropdown */}
            <div className="flex items-center space-x-4">
                <label className="text-sm text-gray-400">Team Size:</label>
                <StyledSelect
                    value={teamSize}
                    onChange={(e) => setTeamSize(parseInt(e.target.value))}
                >
                    {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                            {n}v{n}
                        </option>
                    ))}
                </StyledSelect>

                {/* Generate Teams Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                    >
                        Generate Teams
                        <svg
                            className="ml-1 w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>

                    {dropdownOpen && (
                        <div className="absolute mt-2 w-48 bg-gray-800 rounded shadow-lg z-10">
                            <ul className="py-1">
                                <li>
                                    <button
                                        onClick={() => {
                                            setTeamGenerationMethod('balanced');
                                            generateBalancedTeams();
                                            setDropdownOpen(false);
                                            setShowTeamSelector(false);
                                        }}
                                        className="block px-4 py-2 text-sm text-white hover:bg-gray-700 w-full text-left"
                                    >
                                        Balanced
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => {
                                            setTeamGenerationMethod('random');
                                            generateRandomTeams();
                                            setDropdownOpen(false);
                                            setShowTeamSelector(false);
                                        }}
                                        className="block px-4 py-2 text-sm text-white hover:bg-gray-700 w-full text-left"
                                    >
                                        Random
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => {
                                            setTeamGenerationMethod('custom');
                                            setShowTeamSelector(true);
                                            setDropdownOpen(false);
                                        }}
                                        className="block px-4 py-2 text-sm text-white hover:bg-gray-700 w-full text-left"
                                    >
                                        Custom
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Team Selector UI */}
            {showTeamSelector && (
                <div className="space-y-4 border border-gray-700 rounded p-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-medium text-white">Choose Teams</h3>
                        <button
                            onClick={() => setShowTeamSelector(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Team containers */}
                        {manualTeams.map((team, teamIndex) => {
                            // Define an array of team colors
                            const teamColors = [
                                { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-600", hover: "bg-blue-500" },
                                { border: "border-green-500", text: "text-green-400", bg: "bg-green-600", hover: "bg-green-500" },
                                { border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-600", hover: "bg-purple-500" },
                                { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-600", hover: "bg-yellow-500" },
                                { border: "border-red-500", text: "text-red-400", bg: "bg-red-600", hover: "bg-red-500" },
                                { border: "border-pink-500", text: "text-pink-400", bg: "bg-pink-600", hover: "bg-pink-500" },
                            ];

                            // Get color for current team (cycle through colors if more teams than colors)
                            const colorIndex = teamIndex % teamColors.length;
                            const teamColor = teamColors[colorIndex];

                            return (
                                <div key={teamIndex} className={`border ${teamColor.border} rounded-lg p-3 bg-gray-800`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className={`font-medium ${teamColor.text}`}>Team {teamIndex + 1}</h3>
                                        <span className={`text-xs px-2 py-1 rounded-full ${team.filter(p => !p.isBench).length === teamSize
                                                ? "bg-green-900 text-green-400"
                                                : "bg-yellow-900 text-yellow-400"
                                            }`}>
                                            {team.filter(p => !p.isBench).length}/{teamSize} players
                                        </span>
                                    </div>

                                    {/* Selected players */}
                                    <div className="space-y-2 min-h-20 mb-3">
                                        {/* Regular players (non-bench) */}
                                        {team.filter(p => !p.isBench).map((player, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-gray-700 rounded px-2 py-1">
                                                <span className="text-sm text-white">{player.name}</span>
                                                <button
                                                    onClick={() => {
                                                        const updatedTeams = [...manualTeams];
                                                        updatedTeams[teamIndex] = team.filter((_, i) => i !== team.indexOf(player));
                                                        setManualTeams(updatedTeams);
                                                    }}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}

                                        {/* Bench players */}
                                        {team.filter(p => p.isBench).map((player, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-gray-600 rounded px-2 py-1 border-l-2 border-yellow-500">
                                                <span className="text-sm text-gray-300">
                                                    <span className="text-yellow-500 text-xs mr-1">Bench:</span>
                                                    {player.name}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const updatedTeams = [...manualTeams];
                                                        updatedTeams[teamIndex] = team.filter((_, i) => i !== team.indexOf(player));
                                                        setManualTeams(updatedTeams);
                                                    }}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}

                                        {/* No players message */}
                                        {team.length === 0 && (
                                            <div className="text-sm text-gray-500 italic">No players selected</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Available players */}
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Available Players</h4>
                        {getUnassignedPlayers().length === 0 ? (
                            <div className="text-sm text-gray-500 italic text-center py-4">All active players assigned</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {getUnassignedPlayers().map((player) => (
                                    <div key={player.name} className="bg-gray-800 rounded p-2">
                                        <div className="text-sm text-white mb-1">{player.name}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {manualTeams.map((team, teamIndex) => {
                                                const wouldBeBench = team.filter(p => !p.isBench).length >= teamSize;

                                                // Get color for current team (cycle through colors if more teams than colors)
                                                const teamColors = [
                                                    { bg: "bg-blue-600", hover: "bg-blue-500" },
                                                    { bg: "bg-green-600", hover: "bg-green-500" },
                                                    { bg: "bg-purple-600", hover: "bg-purple-500" },
                                                    { bg: "bg-yellow-600", hover: "bg-yellow-500" },
                                                    { bg: "bg-red-600", hover: "bg-red-500" },
                                                    { bg: "bg-pink-600", hover: "bg-pink-500" },
                                                ];
                                                const colorIndex = teamIndex % teamColors.length;
                                                const teamColor = teamColors[colorIndex];

                                                return (
                                                    <button
                                                        key={teamIndex}
                                                        onClick={() => addPlayerToTeam(player, teamIndex)}
                                                        className={`text-xs px-2 py-1 rounded ${wouldBeBench
                                                                ? 'bg-amber-600 hover:bg-amber-500'  // Bench styling
                                                                : `${teamColor.bg} hover:${teamColor.hover}`  // Regular styling with team color
                                                            }`}
                                                    >
                                                        {wouldBeBench
                                                            ? `Bench ${teamIndex + 1}`
                                                            : `Team ${teamIndex + 1}`
                                                        }
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-between items-center mt-4">
                        {/* Fill buttons on the left */}
                        <div className="flex space-x-2">
                            {getUnassignedPlayers().length > 0 &&
                                manualTeams.every(team => team.length > 0) && (
                                    <>
                                        <button
                                            onClick={fillTeamsRandomly}
                                            className="flex items-center px-2 py-1 text-xs text-white bg-purple-600 hover:bg-purple-500 rounded transition-colors"
                                            title="Fill incomplete teams with random unassigned players"
                                        >
                                            <span className="mr-1">🎲</span>
                                            Fill Random
                                        </button>
                                        <button
                                            onClick={fillTeamsBalanced}
                                            className="flex items-center px-2 py-1 text-xs text-white bg-green-600 hover:bg-green-500 rounded transition-colors"
                                            title="Fill incomplete teams with balanced unassigned players"
                                        >
                                            <span className="mr-1">⚖️</span>
                                            Fill Balanced
                                        </button>
                                    </>
                                )}
                        </div>

                        {/* Reset and Create buttons on the right */}
                        <div className="flex space-x-2">
                            <button
                                onClick={() => {
                                    // Calculate required number of teams to fit all active players
                                    const numTeams = Math.floor(activePlayerCount / teamSize);
                                    // Always ensure we have at least 2 teams for matchup creation  
                                    const finalNumTeams = Math.max(2, numTeams);
                                    setManualTeams(Array.from({ length: finalNumTeams }, () => []));
                                }}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition-colors"
                            >
                                Reset
                            </button>
                            <button
                                onClick={generateMatchupsFromManualTeams}
                                disabled={!areTeamsValid()}
                                className={`px-2 py-1 text-xs rounded transition-colors ${areTeamsValid()
                                    ? "text-white bg-blue-600 hover:bg-blue-500"
                                    : "text-gray-500 bg-gray-700 cursor-not-allowed opacity-60"
                                    }`}
                            >
                                Create Matchups
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Teams List */}
            {hasGeneratedTeams && teams.length > 0 && !showTeamSelector && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">Teams</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {teams.map((team, i) => {
                            const teamStrength = calculateTeamStrength(team).toFixed(1);
                            // For 1v1, use "Player 1", "Player 2", etc. instead of player name
                            const teamName = team.length === 1 ? `Player ${i + 1}` : getTeamName(team, calculatePlayerScore || computeRating1to10);

                            return (
                                <div key={i} className="border border-gray-800 p-3 rounded">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">
                                            {team.length === 1 ? teamName : `Team ${teamName}`}
                                        </span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-blue-400">
                                                Strength: {teamStrength}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {team.filter(p => !p.isBench).map((p) => (
                                            <div
                                                key={p.name}
                                                className="bg-gray-800 text-gray-100 px-3 py-1 rounded-md text-xs font-medium border border-gray-600 flex items-center"
                                            >
                                                <span>{p.name}</span>
                                                <PlayerBeltIcons playerName={p.name} currentBelts={currentBelts} size="xs" />
                                                <PlayerBadges
                                                    playerName={p.name}
                                                    leaderboard={leaderboard}
                                                    matchHistory={matchHistory}
                                                    size="xs"
                                                    maxDisplay={1}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* For bench players */}
                                    {team.some(p => p.isBench) && (
                                        <div className="mt-1">
                                            <span className="text-xs text-yellow-500 mb-1">Bench: </span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {team.filter(p => p.isBench).map(p => (
                                                    <div
                                                        key={p.name}
                                                        className="bg-gray-800 text-yellow-500 px-3 py-1 rounded-md text-xs font-sm border border-gray-600 flex items-center"
                                                    >
                                                        <span>{p.name}</span>
                                                        <PlayerBeltIcons playerName={p.name} currentBelts={currentBelts} size="xs" />
                                                        <PlayerBadges
                                                            playerName={p.name}
                                                            leaderboard={leaderboard}
                                                            matchHistory={matchHistory}
                                                            size="xs"
                                                            maxDisplay={1}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Randomize Again Button - only show if teams were generated randomly */}
            {hasGeneratedTeams && teams.length > 0 && !showTeamSelector && teamGenerationMethod === 'random' && (
                <div className="flex justify-center mb-4">
                    <button
                        onClick={generateRandomTeams}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        🎲 Randomize Again
                    </button>
                </div>
            )}

            {/* Matchups Section */}
            {hasGeneratedTeams && matchups.length > 0 && !showTeamSelector && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">Matchups</h2>
                        {unsavedChanges && (
                            <div className="text-yellow-400 text-xs flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Unsaved match results
                            </div>
                        )}
                    </div>

                    {matchups.map(([teamA, teamB], i) => {
                        // For 1v1, use player names directly, otherwise use team names
                        const teamAName = teamA.length === 1 ? teamA[0].name : getTeamName(teamA, calculatePlayerScore || computeRating1to10);
                        const teamBName = teamB.length === 1 ? teamB[0].name : getTeamName(teamB, calculatePlayerScore || computeRating1to10);

                        const teamAStrength = calculateTeamStrength(teamA).toFixed(1);
                        const teamBStrength = calculateTeamStrength(teamB).toFixed(1);

                        // Check if this match has unsaved/incomplete data
                        const matchIncomplete = !scores[i]?.processed && (!scores[i]?.a || !scores[i]?.b || scores[i]?.a === "" || scores[i]?.b === "");

                        return (
                            <div
                                key={i}
                                className={`border ${matchIncomplete ? 'border-yellow-600' : 'border-gray-800'} p-3 rounded`}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-gray-400">Match {i + 1}</span>
                                    {matchIncomplete && (
                                        <span className="text-xs text-yellow-400">Results not saved</span>
                                    )}
                                </div>

                                {scores[i]?.processed ? (
                                    // Read-only view for saved matches
                                    <div className="bg-gray-700 rounded-lg p-4 w-full">
                                        <div className="flex items-center justify-between">
                                            {/* Team A Score */}
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-300 mb-1">
                                                    {teamA.length === 1 ? teamAName : `Team ${teamAName}`}
                                                </div>
                                                <div className="text-3xl font-bold text-white">{scores[i]?.a || 0}</div>
                                            </div>

                                            {/* VS separator */}
                                            <div className="text-gray-500 font-medium px-4">VS</div>

                                            {/* Team B Score */}
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-300 mb-1">
                                                    {teamB.length === 1 ? teamBName : `Team ${teamBName}`}
                                                </div>
                                                <div className="text-3xl font-bold text-white">{scores[i]?.b || 0}</div>
                                            </div>
                                        </div>

                                        {/* MVP section */}
                                        {mvpVotes[i] && (
                                            <div className="mt-4 pt-3 border-t border-gray-600 text-center">
                                                <span className="text-sm text-gray-400">MVP: </span>
                                                <span className="text-yellow-400 font-medium">{mvpVotes[i]}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Editable view for unsaved matches - integrated team windows with scores
                                    <div className="bg-gray-700 rounded-lg p-4 w-full">
                                        <div className="flex items-center justify-between">
                                            {/* Team A with integrated score */}
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-300 mb-1 flex items-center justify-center">
                                                    <span>{teamA.length === 1 ? teamAName : `Team ${teamAName}`}</span>
                                                    <span className="text-xs text-blue-400 ml-2">(Str: {teamAStrength})</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    className={`w-16 h-12 text-2xl font-bold text-white bg-gray-600 border ${matchIncomplete ? 'border-yellow-600' : 'border-gray-500'} rounded text-center focus:outline-none focus:border-blue-500`}
                                                    value={scores[i]?.a || ""}
                                                    onChange={(e) => handleScoreChange(i, 'a', e.target.value)}
                                                />
                                            </div>

                                            {/* VS separator */}
                                            <div className="text-gray-500 font-medium px-4">VS</div>

                                            {/* Team B with integrated score */}
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-300 mb-1 flex items-center justify-center">
                                                    <span>{teamB.length === 1 ? teamBName : `Team ${teamBName}`}</span>
                                                    <span className="text-xs text-blue-400 ml-2">(Str: {teamBStrength})</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    className={`w-16 h-12 text-2xl font-bold text-white bg-gray-600 border ${matchIncomplete ? 'border-yellow-600' : 'border-gray-500'} rounded text-center focus:outline-none focus:border-blue-500`}
                                                    value={scores[i]?.b || ""}
                                                    onChange={(e) => handleScoreChange(i, 'b', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* MVP section and controls below the teams */}
                                        <div className="mt-4 pt-3 border-t border-gray-600">
                                            {/* MVP selection */}
                                            <div className="flex items-center justify-center space-x-3 mb-3">
                                                <label className="text-xs text-gray-400">MVP:</label>
                                                {teamA.length === 1 && teamB.length === 1 ? (
                                                    // 1v1 MVP logic
                                                    (() => {
                                                        const playerA = teamA[0];
                                                        const playerB = teamB[0];
                                                        const ovrA = playerOVRs[playerA.name] || computeRating1to10(playerA);
                                                        const ovrB = playerOVRs[playerB.name] || computeRating1to10(playerB);
                                                        const scoreA = parseInt(scores[i]?.a) || 0;
                                                        const scoreB = parseInt(scores[i]?.b) || 0;

                                                        // Determine MVP eligibility based purely on OVR difference
                                                        let eligibleMvp = null;
                                                        let eligibilityMessage = "";

                                                        const ovrDifference = Math.abs(ovrA - ovrB);

                                                        if (ovrDifference <= 1) {
                                                            eligibilityMessage = "Neither player eligible for MVP (OVR within 1 point)";
                                                        } else {
                                                            // The lower-rated player is eligible for MVP if they win
                                                            if (ovrA < ovrB) {
                                                                eligibleMvp = playerA.name;
                                                                eligibilityMessage = `${playerA.name} eligible for MVP if wins (${ovrA.toFixed(1)} vs ${ovrB.toFixed(1)})`;
                                                            } else {
                                                                eligibleMvp = playerB.name;
                                                                eligibilityMessage = `${playerB.name} eligible for MVP if wins (${ovrB.toFixed(1)} vs ${ovrA.toFixed(1)})`;
                                                            }
                                                        }

                                                        // Only auto-set MVP if eligible player actually wins
                                                        if (eligibleMvp && scoreA && scoreB && scoreA !== scoreB) {
                                                            const eligiblePlayerWon =
                                                                (eligibleMvp === playerA.name && scoreA > scoreB) ||
                                                                (eligibleMvp === playerB.name && scoreB > scoreA);

                                                            if (eligiblePlayerWon && mvpVotes[i] !== eligibleMvp) {
                                                                setTimeout(() => handleMvpChange(i, eligibleMvp), 0);
                                                            } else if (!eligiblePlayerWon && mvpVotes[i]) {
                                                                setTimeout(() => handleMvpChange(i, ""), 0);
                                                            }
                                                        }

                                                        return (
                                                            <div className="flex-grow">
                                                                <div className={`px-3 py-2 rounded text-sm ${eligibleMvp
                                                                    ? 'bg-blue-900 bg-opacity-30 text-blue-400'
                                                                    : 'bg-gray-700 text-gray-400'
                                                                    }`}>
                                                                    {eligibilityMessage}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    // Regular multi-player MVP selection
                                                    <StyledSelect
                                                        value={mvpVotes[i] || ""}
                                                        onChange={(e) => handleMvpChange(i, e.target.value)}
                                                        className="flex-grow"
                                                    >
                                                        <option value="">-- Select MVP --</option>
                                                        {[...teamA, ...teamB].map((p) => (
                                                            <option key={p.name} value={p.name}>
                                                                {p.name}
                                                            </option>
                                                        ))}
                                                    </StyledSelect>
                                                )}
                                            </div>

                                            {/* Date/Time Input */}
                                            <div className="flex items-center justify-center space-x-3 mb-3">
                                                <label className="text-xs text-gray-400">Match Date:</label>
                                                <input
                                                    type="datetime-local"
                                                    value={matchDateTime}
                                                    onChange={(e) => setMatchDateTime(e.target.value)}
                                                    className="px-2 py-1 bg-gray-600 text-white text-xs rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                                                />
                                                {(() => {
                                                    const dateError = validateMatchDate(matchDateTime);
                                                    return dateError && (
                                                        <p className="text-red-400 text-xs mt-1">{dateError}</p>
                                                    );
                                                })()}
                                            </div>

                                            {/* Save button centered */}
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => saveMatchResults(i, matchDateTime)}
                                                    className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-500 font-medium transition-colors"
                                                >
                                                    Save Result
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {unsavedChanges && (
                        <div className="bg-yellow-800 bg-opacity-20 border border-yellow-700 rounded p-3 mt-2">
                            <p className="text-yellow-400 text-sm">
                                Make sure to save match results before leaving this tab or generating new teams.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Player List */}
            {sortedPlayers.length > 0 && !showTeamSelector && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Player List</h2>
                        <div className="text-xs text-gray-400">
                            Active Players: <span className="text-gray-400">{activePlayerCount}</span>
                        </div>
                    </div>

                    {/* Column headers with sort controls */}
                    <div className="flex items-center mb-2 border-b border-gray-800 pb-2">
                        <div className="w-8 flex-shrink-0">
                            <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="form-checkbox h-4 w-4 text-blue-600"
                            />
                        </div>

                        <div className="flex-grow flex justify-between items-center ml-3 pr-4">
                            <button
                                onClick={() => handlePlayerSort("name")}
                                className={`text-xs font-medium flex items-center ${playerSortBy === "name" ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
                                    }`}
                            >
                                Name
                                {playerSortBy === "name" && (
                                    <span className="ml-1">
                                        {playerSortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                )}
                            </button>

                            <div className="flex justify-end min-w-[2rem]">
                                <button
                                    onClick={() => handlePlayerSort("ovr")}
                                    className={`text-xs font-medium text-right ${playerSortBy === "ovr" ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
                                        }`}
                                >
                                    OVR{playerSortBy === "ovr" && (
                                        <span className="ml-1">
                                            {playerSortDirection === "asc" ? "↑" : "↓"}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable player list */}
                    <div
                        ref={playerListRef}
                        className="space-y-0 scrollbar-hide pr-2"
                        style={{
                            maxHeight: 'calc(100vh - 300px)',
                            overflowY: 'auto',
                            paddingBottom: '100px' // Add bottom padding so list can scroll past bottom nav
                        }}
                    >
                        {sortedPlayers.map((player) => {
                            const ovrRating = playerOVRs[player.name] || computeRating1to10(player);
                            const ratingPercent = getPercentage(ovrRating);
                            const isRecentlyActivated = recentlyActivated.has(player.name) && player.active;

                            return (
                                <div
                                    key={player.name}
                                    className={`flex items-center border-b border-gray-800 py-2 cursor-pointer hover:bg-gray-700 transition-all duration-500 ${isRecentlyActivated ? 'bg-green-600 bg-opacity-20 border-green-500' : ''}`}
                                    onClick={() => onPlayerClick && onPlayerClick(player)}
                                >
                                    {/* Active checkbox */}
                                    <div className="w-8 flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="form-checkbox h-4 w-4 text-blue-600"
                                            checked={player.active}
                                            onChange={(e) => {
                                                const scrollPosition = playerListRef.current?.scrollTop || 0;

                                                // If player is being activated, add to recently activated set
                                                if (e.target.checked) {
                                                    setRecentlyActivated(prev => new Set([...prev, player.name]));
                                                    // Remove from set after animation duration
                                                    setTimeout(() => {
                                                        setRecentlyActivated(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(player.name);
                                                            return newSet;
                                                        });
                                                    }, 2000);
                                                }

                                                // Call the toggle function
                                                handlePlayerActiveToggle(player.name, e.target.checked);

                                                // Restore scroll position
                                                setTimeout(() => {
                                                    if (playerListRef.current) {
                                                        playerListRef.current.scrollTop = scrollPosition;
                                                    }
                                                }, 0);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    {/* Player name and rating */}
                                    <div className="flex-grow flex justify-between items-center ml-3 pr-4">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm text-white">{player.name}</span>
                                            {/* Add any badges/belts here */}
                                        </div>

                                        {/* Right-justify OVR numbers */}
                                        <div className="min-w-[2rem] text-right">
                                            <span className="text-sm text-gray-300 font-medium">
                                                {ovrRating.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Visual indicator for recently activated players */}
                                    {isRecentlyActivated && (
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10">
                                            <div className="flex items-center text-green-400 text-xs bg-gray-800 px-2 py-1 rounded">
                                                <span className="animate-pulse">✓ Added to Active</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}