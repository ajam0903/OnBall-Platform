import { log, logWarn, logError } from "@shared/utils/logger";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    setDoc as firestoreSetDoc,
    getDocs,
    updateDoc, 
    arrayUnion,
} from "firebase/firestore";
import { StyledButton } from "./components/UIComponents";
import RankingTab from "./components/RankingTab";
import TeamsTab from "./components/TeamsTab";
import LeaderboardTab from "./components/LeaderboardTab";
import { DarkContainer } from "./components/UIComponents";
import EditPlayerModal from "./components/EditPlayerModal";
import LeagueLandingPage from "./components/LeagueLandingPage";
import UserMenu from "./components/UserMenu";
import ConfirmationModal from "./components/ConfirmationModal";
import { auth, db } from "@shared/firebase/firebase";
import MatchResultsModal from "./components/MatchResultsModal";
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    GoogleAuthProvider,
    signOut,
} from "firebase/auth";
import ErrorBoundary from '@shared/components/ErrorBoundary';
import LogTab from "./components/LogTab";
import logActivity from "@shared/utils/logActivity";
import { ensureSchemaExists } from "@shared/utils/schemaMigration";
import BeltsTab from "./components/BeltsTab";
import PlayerBeltIcons from "./components/PlayerBeltIcons";
import { calculateBeltStandings, beltCategories } from "./components/BeltsSystem";
import AwardsTab from "./components/awardsTab";
import PlayerDetailModal from "./components/playerDetailModal";
import PlayerBadges from "./components/playerBadges";
import LeagueSelector from "./components/LeagueSelector";
import PlayerNameMatcher from './components/PlayerNameMatcher';
import AdminNotifications from './components/AdminNotifications';
import PlayerCardClaimModal from './components/PlayerCardClaimModal';
import { calculateAverageStatsFromSubmissions, calculateWeightedRating, RATING_WEIGHTINGS } from '@shared/utils/ratingUtils';

// This helps hide the default scrollbar while maintaining scroll functionality
const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }
`;
export default function App() {

    const [activeTab, setActiveTab] = useState("players");
    const [players, setPlayers] = useState([]);
    const [newRating, setNewRating] = useState({
        name: "",
        scoring: 5,
        defense: 5,
        rebounding: 5,
        playmaking: 5,
        stamina: 5,
        physicality: 5,
        xfactor: 5,
    });
    const [hasPendingMatchups, setHasPendingMatchups] = useState(false);
    const [pendingTabChange, setPendingTabChange] = useState(null);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [editPlayerModalOpen, setEditPlayerModalOpen] = useState(false);
    const [selectedPlayerToEdit, setSelectedPlayerToEdit] = useState(null);
    const [teamSize, setTeamSize] = useState(3);
    const [teams, setTeams] = useState([]);
    const [matchups, setMatchups] = useState([]);
    const [mvpVotes, setMvpVotes] = useState([]);
    const [scores, setScores] = useState([]);
    const [leaderboard, setLeaderboard] = useState({});
    const [currentSet, setCurrentSet] = useState("default");
    const [user, setUser] = useState(null);
    const [toastMessage, setToastMessage] = useState("");
    const [teamRankings, setTeamRankings] = useState([]);
    const [currentLeagueId, setCurrentLeagueId] = useState(null);
    const pendingTabRef = useRef(null);
    const [currentLeague, setCurrentLeague] = useState(null);
    const weightings = RATING_WEIGHTINGS;
    const [showRematchPrompt, setShowRematchPrompt] = useState(false);
    const [matchHistory, setMatchHistory] = useState([]);
    const [hasGeneratedTeams, setHasGeneratedTeams] = useState(false);
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    const [isEditingLeagueName, setIsEditingLeagueName] = useState(false);
    const [editedLeagueName, setEditedLeagueName] = useState("");
    const [showMatchResultsModal, setShowMatchResultsModal] = useState(false);
    const [forceTabChange, setForceTabChange] = useState(false);
    const [completedMatchResults, setCompletedMatchResults] = useState([]);
    const [beltVotes, setBeltVotes] = useState({});
    const [currentBelts, setCurrentBelts] = useState({});
    const [playersSubTab, setPlayersSubTab] = useState("rankings");
    const [showPlayerDetailModal, setShowPlayerDetailModal] = useState(false);
    const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState(null);
    const [showReviewerNames, setShowReviewerNames] = useState(false);
    const [isAdminEdit, setIsAdminEdit] = useState(false);
    const [userLeagues, setUserLeagues] = useState([]);
    const [showPlayerClaimModal, setShowPlayerClaimModal] = useState(false);
    const [selectedPlayerToClaim, setSelectedPlayerToClaim] = useState(null);
    const [enhancedPlayers, setEnhancedPlayers] = useState([]);
    const [minGamesFilter, setMinGamesFilter] = useState(0);
    const [userPlayerPreferences, setUserPlayerPreferences] = useState({});
    const [waitingTeam, setWaitingTeam] = useState(null);
    const [isFirstRound, setIsFirstRound] = useState(false);
    const [tournamentResults, setTournamentResults] = useState([]);
    const [showTournamentComplete, setShowTournamentComplete] = useState(false);
    const [currentRematchTeams, setCurrentRematchTeams] = useState(null);
    const [showProfilePhotoNotification, setShowProfilePhotoNotification] = useState(false);

    const handleLogin = () => {
        const provider = new GoogleAuthProvider();
        // ADD THIS: Force account selection to avoid state issues
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        signInWithPopup(auth, provider)
            .catch((error) => {
                console.error("Login failed:", error);
                // ADD THIS: If popup fails, try redirect as fallback
                if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                    console.log('Popup blocked, trying redirect...');
                    signInWithRedirect(auth, provider);
                }
            });
    };

    const isRematch = (teamA, teamB) => {
        if (!matchHistory || matchHistory.length === 0) return false;

        // Convert teams to player name arrays for comparison
        const teamANames = teamA.map(p => p.name).sort();
        const teamBNames = teamB.map(p => p.name).sort();

        // Look through match history to find matching matchups
        return matchHistory.some(match => {
            // Handle different data formats
            let historyTeamA = [];
            let historyTeamB = [];

            // Check if the match has teams array (app format) or teamA/teamB properties (Firestore format)
            if (Array.isArray(match.teams) && match.teams.length >= 2) {
                // App format
                historyTeamA = match.teams[0].map(p => p.name).sort();
                historyTeamB = match.teams[1].map(p => p.name).sort();
            } else if (match.teamA && match.teamB) {
                // Firestore format
                historyTeamA = match.teamA.map(p => p.name).sort();
                historyTeamB = match.teamB.map(p => p.name).sort();
            } else {
                // Unknown format, skip this match
                return false;
            }

            // Check if current matchup matches historical matchup (in either order)
            const matchesExactly =
                (arraysEqual(teamANames, historyTeamA) && arraysEqual(teamBNames, historyTeamB)) ||
                (arraysEqual(teamANames, historyTeamB) && arraysEqual(teamBNames, historyTeamA));

            return matchesExactly;
        });
    };

    const handleMinGamesFilterChange = (newValue) => {
        setMinGamesFilter(newValue);
    };

    const handleLogout = () => {
        signOut(auth);
    };
    // Helper function to check if arrays are equal
    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };
    const calculatePlayerScore = (player) => {
        return (
            player.scoring * weightings.scoring +
            player.defense * weightings.defense +
            player.rebounding * weightings.rebounding +
            player.playmaking * weightings.playmaking +
            player.stamina * weightings.stamina +
            player.physicality * weightings.physicality +
            player.xfactor * weightings.xfactor
        );
    };
    const getPreviousResults = (teamA, teamB) => {
        if (!matchHistory || matchHistory.length === 0) return [];

        const teamANames = teamA.map(p => p.name).sort();
        const teamBNames = teamB.map(p => p.name).sort();

        return matchHistory.filter(match => {
            // Handle different data formats
            let historyTeamA = [];
            let historyTeamB = [];

            // Check if the match has teams array (app format) or teamA/teamB properties (Firestore format)
            if (Array.isArray(match.teams) && match.teams.length >= 2) {
                // App format
                historyTeamA = match.teams[0].map(p => p.name).sort();
                historyTeamB = match.teams[1].map(p => p.name).sort();
            } else if (match.teamA && match.teamB) {
                // Firestore format
                historyTeamA = match.teamA.map(p => p.name).sort();
                historyTeamB = match.teamB.map(p => p.name).sort();
            } else {
                // Unknown format, skip this match
                return false;
            }

            // Check if this history match involves the same teams
            return (arraysEqual(teamANames, historyTeamA) && arraysEqual(teamBNames, historyTeamB)) ||
                (arraysEqual(teamANames, historyTeamB) && arraysEqual(teamBNames, historyTeamA));
        }).map(match => {
            // Convert any Firestore format matches to the app format for consistency
            if (!match.teams && match.teamA && match.teamB) {
                return {
                    teams: [match.teamA, match.teamB],
                    score: match.score,
                    mvp: match.mvp || "",
                    date: match.date
                };
            }
            return match;
        });
    }

    const handleToggleReviewerVisibility = async () => {
        if (!currentLeagueId || !isAdmin) return;

        try {
            const leagueRef = doc(db, "leagues", currentLeagueId);
            const leagueDoc = await getDoc(leagueRef);

            if (leagueDoc.exists()) {
                const leagueData = leagueDoc.data();
                const newValue = !showReviewerNames;

                await firestoreSetDoc(leagueRef, {
                    ...leagueData,
                    preferences: {
                        ...leagueData.preferences,
                        showReviewerNames: newValue
                    }
                });

                setShowReviewerNames(newValue);
                setToastMessage(`Reviewer names ${newValue ? 'enabled' : 'disabled'}`);
                setTimeout(() => setToastMessage(""), 3000);
            }
        } catch (error) {
            console.error("Error updating preferences:", error);
            setToastMessage("Error updating preferences");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    const handleCancelTabChange = () => {
        setPendingTabChange(null);
        setShowUnsavedModal(false);
    };

    const calculateTeamStrength = (team) => {
        if (!team || team.length === 0) return 0;

        const totalScore = team.reduce((sum, player) => {
            return sum + calculatePlayerScore(player);
        }, 0);

        // Average score per player (to account for teams with different sizes)
        return totalScore / team.length;
    };


    const generateBalancedTeams = async () => {
        log("Starting generateBalancedTeams...");

        if (!currentLeagueId) {
            console.error("No currentLeagueId set");
            return;
        }

        // Only show confirmation if there are actual unsaved match results (scores entered)
        // AND we're not in team selection mode
        const hasUnsavedScores = scores.some(score =>
            score && (score.a || score.b) && !score.processed
        );

        // Don't show modal if we're in team selection mode or if no actual scores exist
        if (hasUnsavedScores && hasGeneratedTeams) {
            setPendingTabChange('generate-teams');
            setShowUnsavedModal(true);
            return;
        }

        // Replace the local algorithm call with API call
        await generateBalancedTeamsInternal();
    };

    const generateBalancedTeamsInternal = async () => {
        if (!currentLeagueId) {
            console.error("No currentLeagueId set");
            return;
        }

        try {
            log("Starting API-based team generation...");
            log("Players:", players.length, "active players");
            log("Team size:", teamSize);

            // Prepare player data for API (only send what's needed)
            const activePlayersData = players
                .filter(p => getUserPlayerPreference(p.name))
                .map(player => ({
                    name: player.name,
                    scoring: player.scoring || 5,
                    defense: player.defense || 5,
                    rebounding: player.rebounding || 5,
                    playmaking: player.playmaking || 5,
                    stamina: player.stamina || 5,
                    physicality: player.physicality || 5,
                    xfactor: player.xfactor || 5
                }));

            // Call your protected API
            const response = await fetch('https://simple-api-self.vercel.app/api/generate-teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Remove Authorization for now since the API doesn't handle it yet
                    // 'Authorization': `Bearer ${await user?.getIdToken()}` 
                },
                body: JSON.stringify({
                    players: activePlayersData,
                    teamSize,
                    leagueId: currentLeagueId,
                    weightings: weightings
                })
            });

            // Add response handling
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate teams');
            }

            // Use the generated teams and matchups
            const generatedTeams = data.teams;
            const generatedMatchups = data.matchups;

            log("Generated teams:", generatedTeams);
            log("Generated matchups:", generatedMatchups);

            setTeams(generatedTeams);
            setMatchups(generatedMatchups);
            setHasPendingMatchups(false);
            setHasGeneratedTeams(true);

            // Create MVP votes and scores arrays based on matchup count
            const newMvpVotes = Array(generatedMatchups.length).fill("");
            const newScores = Array(generatedMatchups.length).fill({ a: "", b: "" });

            setMvpVotes(newMvpVotes);
            setScores(newScores);

            // Update Firestore
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const firestoreData = prepareDataForFirestore({
                    ...data,
                    teams: generatedTeams,
                    matchups: generatedMatchups,
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
                    teamCount: generatedTeams.length,
                    matchupCount: generatedMatchups.length,
                    teamSize: teamSize,
                    source: "protected_api"
                },
                user,
                false
            );

        } catch (error) {
            console.error("Error in API team generation:", error);

            // Development fallback (remove in production)
            if (process.env.NODE_ENV === 'development') {
                console.warn("API failed, using local fallback for development");
                return await generateBalancedTeamsLocalFallback();
            } else {
                alert("Team generation is temporarily unavailable. Please try again later.");
            }
        }
    };

    // Keep this for development only - remove in production
    const generateBalancedTeamsLocalFallback = async () => {
        if (!currentLeagueId) {
            console.error("No currentLeagueId set");
            return;
        }

        // Only allow local fallback in development
        if (process.env.NODE_ENV !== 'development') {
            console.error("Local algorithm not available in production");
            alert("Team generation service is unavailable. Please try again later.");
            return;
        }

        try {
            log("Using local fallback algorithm...");
            log("Players:", players);
            log("Team size:", teamSize);

            // Use the imported function to generate teams and matchups
            const result = balanceTeams(players, teamSize, calculatePlayerScore);
            log("Balance teams result:", result);

            const generatedTeams = result.teams;
            const generatedMatchups = result.matchups;

            log("Generated teams:", generatedTeams);
            log("Generated matchups:", generatedMatchups);

            setTeams(generatedTeams);
            setMatchups(generatedMatchups);
            setHasPendingMatchups(false);
            setHasGeneratedTeams(true);

            // Create MVP votes and scores arrays based on matchup count
            const newMvpVotes = Array(generatedMatchups.length).fill("");
            const newScores = Array(generatedMatchups.length).fill({ a: "", b: "" });

            setMvpVotes(newMvpVotes);
            setScores(newScores);

            // Update Firestore
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const firestoreData = prepareDataForFirestore({
                    ...data,
                    teams: generatedTeams,
                    matchups: generatedMatchups,
                    mvpVotes: newMvpVotes,
                    scores: newScores,
                    leaderboard: data.leaderboard || {}
                });
                await firestoreSetDoc(docRef, firestoreData);
            }

            await logActivity(
                db,
                currentLeagueId,
                "teams_generated",
                {
                    teamCount: generatedTeams.length,
                    matchupCount: generatedMatchups.length,
                    teamSize: teamSize,
                    source: "local_fallback"
                },
                user,
                false
            );

        } catch (error) {
            console.error("Error in local fallback team generation:", error);
            alert("An error occurred while generating teams. Check the console for details.");
        }
    };



    const calculateLeaderboard = async () => {
        if (!currentLeagueId || !matchups || matchups.length === 0) {
            log("No matchups data to calculate leaderboard or no league selected");
            return;
        }

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        let existingLeaderboard = {};
        if (docSnap.exists() && docSnap.data().leaderboard) {
            existingLeaderboard = docSnap.data().leaderboard;
        }

        const currentTally = {};

        matchups.forEach(([teamA, teamB], i) => {
            if (!scores[i] || scores[i].processed) return;
            const score = scores[i];
            const mvp = mvpVotes[i] || "";

            if (!score?.a || !score?.b) return;

            const teamAPlayers = teamA.map((p) => p.name).filter(name => name && name.trim() !== "");
            const teamBPlayers = teamB.map((p) => p.name).filter(name => name && name.trim() !== "");

            const scoreA = parseInt(score?.a);
            const scoreB = parseInt(score?.b);

            if (!isNaN(scoreA) && !isNaN(scoreB)) {
                const winnerTeam = scoreA > scoreB ? teamAPlayers : teamBPlayers;
                const loserTeam = scoreA > scoreB ? teamBPlayers : teamAPlayers;

                [...teamAPlayers, ...teamBPlayers].forEach(name => {
                    if (name && name.trim() !== "" && !currentTally[name]) {
                        currentTally[name] = { _w: 0, _l: 0, MVPs: 0 };
                    }
                });

                winnerTeam.forEach((name) => {
                    if (name && name.trim() !== "") {
                        currentTally[name]._w += 1;
                    }
                });

                loserTeam.forEach((name) => {
                    if (name && name.trim() !== "") {
                        currentTally[name]._l += 1;
                    }
                });
            }

            if (mvp && mvp.trim() !== "") {
                if (!currentTally[mvp]) {
                    currentTally[mvp] = { _w: 0, _l: 0, MVPs: 0 };
                }
                currentTally[mvp].MVPs += 1;
            }

            scores[i].processed = true;
        });

        const updatedLeaderboard = { ...existingLeaderboard };

        Object.keys(currentTally).forEach(player => {
            if (!updatedLeaderboard[player]) {
                updatedLeaderboard[player] = { _w: 0, _l: 0, MVPs: 0 };
            }

            updatedLeaderboard[player]._w += currentTally[player]._w;
            updatedLeaderboard[player]._l += currentTally[player]._l;
            updatedLeaderboard[player].MVPs += currentTally[player].MVPs;
        });

        log("Final leaderboard to be saved:", updatedLeaderboard);
        setLeaderboard(updatedLeaderboard);

        if (docSnap.exists()) {
            const data = docSnap.data();
            await firestoreSetDoc(docRef, {
                ...data,
                leaderboard: updatedLeaderboard,
                scores: scores
            });
        }
    };

    const prepareDataForFirestore = (data) => {
        // Convert matchups for Firestore
        if (data.matchups) {
            data.matchups = data.matchups.map((matchup, index) => {
                if (!matchup || !matchup[0]) {
                    return {
                        id: index,
                        teamA: [],
                        teamB: []
                    };
                }
                return {
                    id: index,
                    teamA: matchup[0].map(player => ({
                        name: player.name || "",
                        active: player.active !== undefined ? player.active : true,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })),
                    teamB: matchup[1] ? matchup[1].map(player => ({
                        name: player.name || "",
                        active: player.active !== undefined ? player.active : true,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })) : []
                };
            });
        }

        // Convert teams for Firestore
        if (data.teams) {
            log("Teams data:", data.teams);
            data.teams = data.teams.map((team, index) => {
                if (!team || !Array.isArray(team)) {
                    return {
                        id: index,
                        players: []
                    };
                }
                return {
                    id: index,
                    players: team.map(player => {
                        if (!player) return {};
                        return {
                            name: player.name || "",
                            active: player.active !== undefined ? player.active : true,
                            scoring: player.scoring || 0,
                            defense: player.defense || 0,
                            rebounding: player.rebounding || 0,
                            playmaking: player.playmaking || 0,
                            stamina: player.stamina || 0,
                            physicality: player.physicality || 0,
                            xfactor: player.xfactor || 0
                        };
                    })
                };
            });
        }

        // Convert matchHistory for Firestore
        if (data.matchHistory) {
            data.matchHistory = data.matchHistory.map((match, index) => {
                // Handle array format (from app state)
                if (Array.isArray(match.teams)) {
                    return {
                        id: index,
                        teamA: match.teams[0].map(player => ({
                            name: player.name || "",
                            active: player.active !== undefined ? player.active : true,
                            scoring: player.scoring || 0,
                            defense: player.defense || 0,
                            rebounding: player.rebounding || 0,
                            playmaking: player.playmaking || 0,
                            stamina: player.stamina || 0,
                            physicality: player.physicality || 0,
                            xfactor: player.xfactor || 0
                        })),
                        teamB: match.teams[1] ? match.teams[1].map(player => ({
                            name: player.name || "",
                            active: player.active !== undefined ? player.active : true,
                            scoring: player.scoring || 0,
                            defense: player.defense || 0,
                            rebounding: player.rebounding || 0,
                            playmaking: player.playmaking || 0,
                            stamina: player.stamina || 0,
                            physicality: player.physicality || 0,
                            xfactor: player.xfactor || 0
                        })) : [],
                        score: match.score,
                        mvp: match.mvp || "",
                        date: match.date
                    };
                }
                // Handle object format (already in Firestore format)
                return match;
            });
        }

        return data;
    };
    const handleBatchPlayerActiveToggle = async (updates) => {
        console.log("=== BATCH UPDATE DEBUG ===");
        console.log("Received updates:", updates);
        console.log("Current players before update:", players.map(p => ({ name: p.name, active: p.active })));

        // Update local state
        const updatedPlayers = players.map((player) => {
            const update = updates.find(u => u.name === player.name);
            if (update) {
                console.log(`Updating ${player.name}: ${player.active} → ${update.active}`);
                return { ...player, active: update.active };
            }
            return player;
        });

        console.log("Updated players after mapping:", updatedPlayers.map(p => ({ name: p.name, active: p.active })));

        setPlayers(updatedPlayers);
        console.log("Called setPlayers with updatedPlayers");

        // Then save to Firestore
        if (currentLeagueId) {
            console.log("Saving to Firestore...");
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const firestoreUpdatedPlayers = data.players.map((player) => {
                    const update = updates.find(u => u.name === player.name);
                    if (update) {
                        return { ...player, active: update.active };
                    }
                    return player;
                });
                await firestoreSetDoc(docRef, { ...data, players: firestoreUpdatedPlayers });
                console.log("Firestore update completed");
            }
        }
        console.log("=== END BATCH UPDATE DEBUG ===");
    };

    // Updated function that will save the active state to the database
    const handlePlayerActiveToggle = async (name, value) => {
        // Update local state immediately for responsive UI
        setPlayers(prevPlayers =>
            prevPlayers.map(player =>
                player.name === name
                    ? { ...player, active: value }
                    : player
            )
        );

        // Update database
        await updateUserPlayerPreference(name, value);
    };

    const convertFirestoreDataToAppFormat = (data) => {
        // Handle matchups conversion (from Firestore object format to arrays)
        if (data.matchups) {
            const matchupsArray = data.matchups.map(matchup => [
                matchup.teamA || [],
                matchup.teamB || []
            ]);
            data.matchups = matchupsArray;
        }
        // Handle teams conversion
        if (data.teams) {
            const teamsArray = data.teams.map(team => team.players || []);
            data.teams = teamsArray;
        }
        // Handle matchHistory conversion from Firestore format to app format
        if (data.matchHistory) {
            data.matchHistory = data.matchHistory.map(match => {
                // Infer teamSize if it's missing
                let inferredTeamSize = match.teamSize;
                if (!inferredTeamSize) {
                    const teamASize = match.teamA?.length || 0;
                    const teamBSize = match.teamB?.length || 0;
                    const maxTeamSize = Math.max(teamASize, teamBSize);

                    // If there are more than 5 players, infer it was a 5v5 game
                    inferredTeamSize = maxTeamSize > 5 ? 5 : maxTeamSize;
                }

                return {
                    teams: [
                        match.teamA || [],
                        match.teamB || []
                    ],
                    score: match.score,
                    mvp: match.mvp || "",
                    date: match.date,
                    teamSize: inferredTeamSize
                };
            });
        }
        return data;
    };

    // Modified to use league structure
    const handleDeletePlayer = async (playerName) => {
        if (!currentLeagueId) return;

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const playerToDelete = data.players.find(
                (p) => p.name.toLowerCase() === playerName.toLowerCase()
            );

            const updatedPlayers = data.players.filter(
                (p) => p.name.toLowerCase() !== playerName.toLowerCase()
            );

            await firestoreSetDoc(docRef, { ...data, players: updatedPlayers });

            // Log the player deletion
            await logActivity(
                db,
                currentLeagueId,
                "player_deleted",
                {
                    name: playerName,
                    playerData: playerToDelete
                },
                user,
                true // Undoable
            );

            setPlayers(updatedPlayers);
            setToastMessage("🗑️ Player deleted!");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    // Modified to use league structure
    const handleRematchNo = () => {
        // Get all matches that have scores (not just processed ones)
        // This captures the entire series including all rematches
        const completedMatchIndices = scores.map((score, idx) => {
            // Include a match if it has both scores filled out
            return (score && score.a && score.b) ? idx : null;
        }).filter(idx => idx !== null);

        // Only show match results modal if there are multiple completed matches
        if (completedMatchIndices.length > 1) {
            // Prepare ALL completed match results for the celebration modal
            const matchResultsToShow = completedMatchIndices.map(idx => {
                return {
                    teams: matchups[idx],
                    score: scores[idx],
                    mvp: mvpVotes[idx] || "",
                    date: new Date().toISOString()
                };
            });

            // Save completed matches to show in the modal
            setCompletedMatchResults(matchResultsToShow);

            // Show the match results modal
            setShowMatchResultsModal(true);
        }
        // If we have any completed matches, we want to archive just those
        if (completedMatchIndices.length > 0) {
            // First, archive the completed matches to match history
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            getDoc(docRef).then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Extract ALL the completed matches to archive
                    // Convert the nested arrays to a structure that Firestore can handle
                    const completedMatches = completedMatchIndices.map(idx => {
                        // Create a Firestore-compatible format for team data
                        return {
                            teamA: matchups[idx][0].map(player => ({
                                name: player.name,
                                active: player.active !== undefined ? player.active : true,
                                isBench: player.isBench || false,
                                scoring: player.scoring || 0,
                                defense: player.defense || 0,
                                rebounding: player.rebounding || 0,
                                playmaking: player.playmaking || 0,
                                stamina: player.stamina || 0,
                                physicality: player.physicality || 0,
                                xfactor: player.xfactor || 0
                            })),
                            teamB: matchups[idx][1].map(player => ({
                                name: player.name,
                                active: player.active !== undefined ? player.active : true,
                                isBench: player.isBench || false,
                                scoring: player.scoring || 0,
                                defense: player.defense || 0,
                                rebounding: player.rebounding || 0,
                                playmaking: player.playmaking || 0,
                                stamina: player.stamina || 0,
                                physicality: player.physicality || 0,
                                xfactor: player.xfactor || 0
                            })),
                            score: scores[idx],
                            mvp: mvpVotes[idx] || "",
                            date: scores[idx].customDate || new Date().toISOString(),
                            teamSize: teamSize
                        };
                    });
                    // Log completing matches
                    for (const match of completedMatches) {
                        logActivity(
                            db,
                            currentLeagueId,
                            "match_completed",
                            {
                                teamA: match.teamA.map(p => p.name),
                                teamB: match.teamB.map(p => p.name),
                                scoreA: match.score.a,
                                scoreB: match.score.b,
                                mvp: match.mvp || "",
                                teamSize: match.teamSize || teamSize,
                                gameType: `${match.teamSize || teamSize}v${match.teamSize || teamSize}`,
                                teamARating: calculateTeamStrength(match.teamA).toFixed(1),
                                teamBRating: calculateTeamStrength(match.teamB).toFixed(1),
                                date: match.date
                            },
                            user,
                            false
                        ).catch(err => logWarn("Error logging match completion:", err));
                    }
                    const existingHistory = data.matchHistory || [];
                    const updatedHistory = [...existingHistory, ...completedMatches];

                    // Now, filter out the completed matches from the current state
                    const remainingMatchups = matchups.filter((_, idx) => !completedMatchIndices.includes(idx));
                    const remainingScores = scores.filter((_, idx) => !completedMatchIndices.includes(idx));
                    const remainingMvpVotes = mvpVotes.filter((_, idx) => !completedMatchIndices.includes(idx));

                    // Update local state
                    setMatchups(remainingMatchups);
                    setScores(remainingScores);
                    setMvpVotes(remainingMvpVotes);
                    setMatchHistory(updatedHistory);

                    // If no matches left, reset teams too
                    if (remainingMatchups.length === 0) {
                        setTeams([]);
                        setHasGeneratedTeams(false);
                    }

                    // Use arrayUnion to safely add completed matches to history
                    const addMatchesToHistory = completedMatches.map(match =>
                        updateDoc(docRef, {
                            matchHistory: arrayUnion(match)
                        })
                    );

                    Promise.all(addMatchesToHistory).then(() => {
                        // Clear the current matchups using updateDoc
                        return updateDoc(docRef, {
                            matchups: [],
                            scores: [],
                            mvpVotes: []
                        });
                    })
                        .then(() => {
                        // If there are remaining matchups, save them in the proper format
                        if (remainingMatchups.length > 0) {
                            const firestoreData = prepareDataForFirestore({
                                ...data,
                                matchHistory: updatedHistory,
                                matchups: remainingMatchups,
                                scores: remainingScores,
                                mvpVotes: remainingMvpVotes
                            });

                            return firestoreSetDoc(docRef, firestoreData);
                        }
                    });
                }
            });
        } else {
            // If all matches are unsaved, just clear the rematch prompt
            setToastMessage("No completed matches to archive");
            setTimeout(() => setToastMessage(""), 3000);
        }

        setShowRematchPrompt(false);
    };

    const calculatePlayerOVR = (playerName) => {
        // Find player in players array to get their abilities
        const playerData = players.find(p => p.name === playerName) || {};
        const playerStats = leaderboard[playerName] || { _w: 0, _l: 0, MVPs: 0 };

        // Base rating from user submissions (weighted average)
        const baseRating = (
            (playerData.scoring || 5) * 0.25 +
            (playerData.defense || 5) * 0.2 +
            (playerData.rebounding || 5) * 0.15 +
            (playerData.playmaking || 5) * 0.15 +
            (playerData.stamina || 5) * 0.1 +
            (playerData.physicality || 5) * 0.1 +
            (playerData.xfactor || 5) * 0.05
        );

        // Performance metrics
        const wins = playerStats._w || 0;
        const losses = playerStats._l || 0;
        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : 0.5;
        const mvps = playerStats.MVPs || 0;
        const mvpPerGame = totalGames > 0 ? mvps / totalGames : 0;

        // Performance adjustments (scale to be more subtle for 1-10 rating)
        // Win percentage adjustment: -0.3 to +0.3
        const winPctAdjustment = (winPct - 0.5) * 0.6;

        // MVP adjustment: 0 to +0.3 (based on MVP rate)
        const mvpAdjustment = Math.min(mvpPerGame * 0.8, 0.3);

        // For simplicity, we'll skip streak calculation here since it requires match history
        // You could pass matchHistory to this function if needed
        const streakAdjustment = 0;

        // Calculate final rating with adjustments
        const finalRating = baseRating + winPctAdjustment + mvpAdjustment + streakAdjustment;

        // Clamp to realistic range (1-10) and round to 1 decimal
        return parseFloat(Math.min(Math.max(finalRating, 1), 10).toFixed(1));
    };

    const playerOVRs = useMemo(() => {
        const ovrs = {};
        players.forEach(player => {
            ovrs[player.name] = calculatePlayerOVR(player.name);
        });
        return ovrs;
    }, [players, leaderboard, weightings]);

    // Memoize computeRating function
    const computeRating = useCallback((player) => {
        return (
            player.scoring * weightings.scoring +
            player.defense * weightings.defense +
            player.rebounding * weightings.rebounding +
            player.playmaking * weightings.playmaking +
            player.stamina * weightings.stamina +
            player.physicality * weightings.physicality +
            player.xfactor * weightings.xfactor
        );
    }, [weightings]);

    const handleCloseMatchResultsModal = () => {
        setShowMatchResultsModal(false);
    };

    const calculateMatchLeaderboard = async (matchIndex) => {
        if (!currentLeagueId || !matchups || matchups.length === 0 || matchIndex >= matchups.length) {
            return;
        }

        // Check if this match has already been processed
        if (scores[matchIndex].processed) {
            log("Match already processed, skipping leaderboard calculation");
            return;
        }

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        let existingLeaderboard = {};
        if (docSnap.exists() && docSnap.data().leaderboard) {
            existingLeaderboard = docSnap.data().leaderboard;
        }

        // Process only the specified match
        const [teamA, teamB] = matchups[matchIndex];
        const score = scores[matchIndex];
        const mvp = mvpVotes[matchIndex] || "";

        if (!score?.a || !score?.b) return;

        const teamAPlayers = teamA.map((p) => p.name).filter(name => name && name.trim() !== "");
        const teamBPlayers = teamB.map((p) => p.name).filter(name => name && name.trim() !== "");

        const scoreA = parseInt(score?.a);
        const scoreB = parseInt(score?.b);

        if (!isNaN(scoreA) && !isNaN(scoreB)) {
            const winnerTeam = scoreA > scoreB ? teamAPlayers : teamBPlayers;
            const loserTeam = scoreA > scoreB ? teamBPlayers : teamAPlayers;

            // Create updated leaderboard
            const updatedLeaderboard = { ...existingLeaderboard };

            // Initialize players if they don't exist
            [...teamAPlayers, ...teamBPlayers].forEach(name => {
                if (name && name.trim() !== "" && !updatedLeaderboard[name]) {
                    updatedLeaderboard[name] = { _w: 0, _l: 0, MVPs: 0 };
                }
            });

            // Update wins for winners
            winnerTeam.forEach((name) => {
                if (name && name.trim() !== "") {
                    updatedLeaderboard[name]._w = (updatedLeaderboard[name]._w || 0) + 1;
                }
            });

            // Update losses for losers
            loserTeam.forEach((name) => {
                if (name && name.trim() !== "") {
                    updatedLeaderboard[name]._l = (updatedLeaderboard[name]._l || 0) + 1;
                }
            });

            // Update MVP
            if (mvp && mvp.trim() !== "" && updatedLeaderboard[mvp]) {
                updatedLeaderboard[mvp].MVPs = (updatedLeaderboard[mvp].MVPs || 0) + 1;
            }

            log("Updated leaderboard after match:", updatedLeaderboard);
            setLeaderboard(updatedLeaderboard);

            // Save to Firestore
            if (docSnap.exists()) {
                const data = docSnap.data();
                await updateDoc(docRef, {
                    leaderboard: updatedLeaderboard
                });
            }
        }
    };

    const handleRematchYes = async () => {
        // Create a new match with the same teams
        const newMatchup = [currentRematchTeams]; // Use the teams that triggered the rematch
        const newScore = [{ a: "", b: "" }];
        const newMvpVote = [""];

        // Add the new match to existing matches
        setMatchups([...matchups, ...newMatchup]);
        setScores([...scores, ...newScore]);
        setMvpVotes([...mvpVotes, ...newMvpVote]);

        setShowRematchPrompt(false);
        setCurrentRematchTeams(null); // Clear the rematch teams

        // Save to Firestore
        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const firestoreData = prepareDataForFirestore({
                    ...data,
                    matchups: [...matchups, ...newMatchup],
                    scores: [...scores, ...newScore],
                    mvpVotes: [...mvpVotes, ...newMvpVote]
                });
                firestoreSetDoc(docRef, firestoreData);
            }
        });

        // Add this: Log rematch creation
        await logActivity(
            db,
            currentLeagueId,
            "rematch_created",
            {
                teamA: newMatchup[0][0].map(p => p.name),
                teamB: newMatchup[0][1].map(p => p.name),
                originalScoreA: scores[scores.length - 1]?.a,
                originalScoreB: scores[scores.length - 1]?.b,
                date: new Date().toISOString()
            },
            user,
            false
        );

        // Clear the rematch prompt
        setShowRematchPrompt(false);
        setToastMessage("🔄 Rematch created! Play again with the same teams.");
        setTimeout(() => setToastMessage(""), 3000);
    };

    const handleRatingSubmit = async () => {
        if (!user) {
            setToastMessage("⚠️ Please sign in to submit a rating.");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        if (!currentLeagueId) {
            setToastMessage("⚠️ No league selected.");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        // Get previous rating if it exists
        const playerData = players.find(p => p.name === newRating.name);
        let previousRatingValue = null;

        if (playerData) {
            // Use default values of 5 for any missing attributes
            const scoring = playerData.scoring || 5;
            const defense = playerData.defense || 5;
            const rebounding = playerData.rebounding || 5;
            const playmaking = playerData.playmaking || 5;
            const stamina = playerData.stamina || 5;
            const physicality = playerData.physicality || 5;
            const xfactor = playerData.xfactor || 5;

            previousRatingValue = (
                scoring * weightings.scoring +
                defense * weightings.defense +
                rebounding * weightings.rebounding +
                playmaking * weightings.playmaking +
                stamina * weightings.stamina +
                physicality * weightings.physicality +
                xfactor * weightings.xfactor
            ).toFixed(2);
        }

        // MAIN FUNCTIONALITY SECTION - Core rating submission
        try {
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);
            const data = docSnap.exists() ? docSnap.data() : { players: [] };
            const updatedPlayers = [...data.players];
            const index = updatedPlayers.findIndex(
                (p) => p.name.toLowerCase() === newRating.name.toLowerCase()
            );

            const submission = {
                ...newRating,
                submittedBy: user.email,
                submittedByName: user.displayName || user.email,
                userName: user.displayName || user.email,
                submissionDate: new Date().toISOString(),
            };

            let isNewRating = false;
            let actionType = "player_rating_changed";

            // Store previous rating values for logging (if player exists)
            let previousRating = null;
            let previousSubmission = null;

            if (index > -1) {
                const existing = updatedPlayers[index];
                // Find user's previous submission if it exists
                previousSubmission = existing.submissions?.find(s => s.submittedBy === user.email);

                if (previousSubmission) {
                    // Store previous values for logging
                    previousRating = {
                        scoring: previousSubmission.scoring,
                        defense: previousSubmission.defense,
                        rebounding: previousSubmission.rebounding,
                        playmaking: previousSubmission.playmaking,
                        stamina: previousSubmission.stamina,
                        physicality: previousSubmission.physicality,
                        xfactor: previousSubmission.xfactor
                    };
                }

                const updatedSubmissions = (existing.submissions || []).filter(
                    (s) => s.submittedBy !== user.email
                );

                const wasUpdate = updatedSubmissions.length < (existing.submissions?.length || 0);

                updatedSubmissions.push(submission);

                const total = updatedSubmissions.reduce((sum, sub) => {
                    const { name, submittedBy, ...scores } = sub;
                    const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 7;
                    return sum + avg;
                }, 0);
                const newAvg = total / updatedSubmissions.length;

                updatedPlayers[index] = {
                    ...existing,
                    submissions: updatedSubmissions,
                    rating: newAvg,
                    // Ensure individual stat properties are updated too
                    scoring: submission.scoring,
                    defense: submission.defense,
                    rebounding: submission.rebounding,
                    playmaking: submission.playmaking,
                    stamina: submission.stamina,
                    physicality: submission.physicality,
                    xfactor: submission.xfactor
                };

                actionType = wasUpdate ? "player_rating_updated" : "player_rating_added";
            } else {
                updatedPlayers.push({
                    name: newRating.name,
                    active: true,
                    submissions: [submission],
                    rating: calculateWeightedRating(submission),
                    // Add individual stats explicitly
                    scoring: submission.scoring,
                    defense: submission.defense,
                    rebounding: submission.rebounding,
                    playmaking: submission.playmaking,
                    stamina: submission.stamina,
                    physicality: submission.physicality,
                    xfactor: submission.xfactor
                });
                isNewRating = true;
                actionType = "player_rating_added";
            }

            // Complete database update first
            await firestoreSetDoc(docRef, { ...data, players: updatedPlayers });

            // Calculate the new rating after submission with safety checks
            const updatedPlayerData = updatedPlayers.find(p => p.name === newRating.name);
            let newRatingValue = null;

            if (updatedPlayerData && updatedPlayerData.submissions) {
                const total = updatedPlayerData.submissions.reduce((sum, sub) => {
                    const { name, submittedBy, ...scores } = sub;
                    const weightedAvg = (
                        (scores.scoring || 5) * weightings.scoring +
                        (scores.defense || 5) * weightings.defense +
                        (scores.rebounding || 5) * weightings.rebounding +
                        (scores.playmaking || 5) * weightings.playmaking +
                        (scores.stamina || 5) * weightings.stamina +
                        (scores.physicality || 5) * weightings.physicality +
                        (scores.xfactor || 5) * weightings.xfactor
                    );
                    return sum + weightedAvg;
                }, 0);
                newRatingValue = (total / updatedPlayerData.submissions.length).toFixed(2);
            }

            // ONLY SET ONE TOAST MESSAGE - with rating change info if available
            const messagePrefix = isNewRating ? "✅ Rating submitted!" : "✏️ Rating updated!";
            if (previousRatingValue && newRatingValue && !isNaN(parseFloat(newRatingValue))) {
                setToastMessage(`${messagePrefix} ${previousRatingValue} → ${newRatingValue}`);
            } else {
                setToastMessage(messagePrefix);
            }
            setTimeout(() => setToastMessage(""), 4000);

            // Update local state
            setPlayers(updatedPlayers.map(player => {
                // Check if player has valid structure
                if (!player) return {
                    name: "Unknown",
                    active: true,
                    submissions: [],
                    scoring: 5,
                    defense: 5,
                    rebounding: 5,
                    playmaking: 5,
                    stamina: 5,
                    physicality: 5,
                    xfactor: 5
                };

                // If player has submissions, calculate averages
                if (player.submissions && Array.isArray(player.submissions) && player.submissions.length > 0) {
                    const avgStats = {
                        name: player.name || "Unknown",
                        active: player.active !== undefined ? player.active : true,
                        scoring: 0,
                        defense: 0,
                        rebounding: 0,
                        playmaking: 0,
                        stamina: 0,
                        physicality: 0,
                        xfactor: 0,
                        submissions: player.submissions
                    };

                    // Safely calculate averages
                    player.submissions.forEach(sub => {
                        if (sub) {
                            avgStats.scoring += sub.scoring || 0;
                            avgStats.defense += sub.defense || 0;
                            avgStats.rebounding += sub.rebounding || 0;
                            avgStats.playmaking += sub.playmaking || 0;
                            avgStats.stamina += sub.stamina || 0;
                            avgStats.physicality += sub.physicality || 0;
                            avgStats.xfactor += sub.xfactor || 0;
                        }
                    });

                    const len = player.submissions.length;
                    Object.keys(avgStats).forEach(key => {
                        if (typeof avgStats[key] === "number") {
                            avgStats[key] = parseFloat((avgStats[key] / len).toFixed(2));
                        }
                    });

                    return avgStats;
                }

                // Return player with default values if no submissions
                return {
                    ...player,
                    name: player.name || "Unknown",
                    active: player.active !== undefined ? player.active : true,
                    scoring: player.scoring || 5,
                    defense: player.defense || 5,
                    rebounding: player.rebounding || 5,
                    playmaking: player.playmaking || 5,
                    stamina: player.stamina || 5,
                    physicality: player.physicality || 5,
                    xfactor: player.xfactor || 5,
                    submissions: player.submissions || []
                };
            }));

            // Now log the activity with comprehensive information
            setTimeout(() => {
                try {
                    log("Logging rating submission for player:", newRating.name);

                    // Current rating data
                    const ratingData = {
                        scoring: newRating.scoring,
                        defense: newRating.defense,
                        rebounding: newRating.rebounding,
                        playmaking: newRating.playmaking,
                        stamina: newRating.stamina,
                        physicality: newRating.physicality,
                        xfactor: newRating.xfactor
                    };

                    // Calculate overall rating
                    const overallRating = calculateWeightedRating(ratingData).toFixed(1);

                    // Get previous rating from the player's current data BEFORE the update
                    let previousRatingForLog = null;
                    if (!isNewRating && index > -1) {
                        const existingPlayer = players.find(p => p.name === newRating.name);
                        if (existingPlayer) {
                            previousRatingForLog = {
                                scoring: existingPlayer.scoring || 5,
                                defense: existingPlayer.defense || 5,
                                rebounding: existingPlayer.rebounding || 5,
                                playmaking: existingPlayer.playmaking || 5,
                                stamina: existingPlayer.stamina || 5,
                                physicality: existingPlayer.physicality || 5,
                                xfactor: existingPlayer.xfactor || 5
                            };
                        }
                    }

                    // Prepare log details with multiple ways to identify the player
                    const logDetails = {
                        playerName: newRating.name, // Primary field
                        name: newRating.name,       // Secondary field (for compatibility)
                        player: newRating.name,     // Tertiary field (for compatibility)
                        isNewSubmission: isNewRating,
                        ratingData: ratingData,
                        overallRating: overallRating
                    };

                    // Add previous rating data if we have it
                    if (previousRatingForLog) {
                        logDetails.previousRating = previousRatingForLog;

                        // Also include what specific ratings changed
                        logDetails.changedValues = {};
                        Object.keys(ratingData).forEach(key => {
                            if (ratingData[key] !== previousRatingForLog[key]) {
                                logDetails.changedValues[key] = {
                                    from: previousRatingForLog[key],
                                    to: ratingData[key]
                                };
                            }
                        });
                    }

                    // Log the activity with explicit debugging
                    log("About to log activity with player name:", newRating.name);
                    log("Log details:", logDetails);

                    logActivity(
                        db,
                        currentLeagueId,
                        actionType,
                        logDetails,
                        user,
                        true
                    ).catch(err => {
                        logWarn("Non-critical logging error:", err);
                    });
                } catch (e) {
                    logWarn("Failed to log activity (non-critical):", e);
                }
            }, 100);

        } catch (error) {
            console.error("Error in handleRatingSubmit:", error);
            setToastMessage("❌ Error saving rating: " + error.message);
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    // Modified to use league structure
    const archiveCompletedMatches = async () => {
        if (!currentLeagueId) return;

        // Check for unsaved matches before archiving
        if (hasPendingMatchups) {
            setToastMessage("⚠️ Please save all match results before archiving!");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Prepare matches in Firestore-compatible format (without nested arrays)
            const completedMatches = matchups.map((matchup, index) => {
                if (scores[index] && scores[index].a && scores[index].b) {
                    return {
                        teamA: matchup[0].map(player => ({
                            name: player.name || "",
                            active: player.active !== undefined ? player.active : true,
                            scoring: player.scoring || 0,
                            defense: player.defense || 0,
                            rebounding: player.rebounding || 0,
                            playmaking: player.playmaking || 0,
                            stamina: player.stamina || 0,
                            physicality: player.physicality || 0,
                            xfactor: player.xfactor || 0
                        })),
                        teamB: matchup[1] ? matchup[1].map(player => ({
                            name: player.name || "",
                            active: player.active !== undefined ? player.active : true,
                            scoring: player.scoring || 0,
                            defense: player.defense || 0,
                            rebounding: player.rebounding || 0,
                            playmaking: player.playmaking || 0,
                            stamina: player.stamina || 0,
                            physicality: player.physicality || 0,
                            xfactor: player.xfactor || 0
                        })) : [],
                        score: scores[index],
                        mvp: mvpVotes[index] || "",
                        date: scores[index].customDate || new Date().toISOString(),
                        teamSize: teamSize
                    };
                }
                return null;
            }).filter(match => match !== null);

            // Get existing history and merge with new completed matches
            const existingHistory = data.matchHistory || [];
            const updatedHistory = [...existingHistory, ...completedMatches];

            // Update Firestore with the new history
            await firestoreSetDoc(docRef, {
                ...data,
                matchHistory: updatedHistory,
                // Clear current data
                matchups: [],
                scores: [],
                mvpVotes: [],
                teams: []
            });

            // Add this: Log archiving matches
            for (const match of completedMatches) {
                await logActivity(
                    db,
                    currentLeagueId,
                    "match_completed",
                    {
                        teamA: match.teamA.map(p => p.name),
                        teamB: match.teamB.map(p => p.name),
                        scoreA: match.score.a,
                        scoreB: match.score.b,
                        mvp: match.mvp || "",
                        teamSize: match.teamSize || teamSize,
                        gameType: `${match.teamSize || teamSize}v${match.teamSize || teamSize}`,
                        teamARating: calculateTeamStrength(match.teamA).toFixed(1),
                        teamBRating: calculateTeamStrength(match.teamB).toFixed(1),
                        date: match.date
                    },
                    user,
                    false
                );
            }

            // Update local state with the converted format
            setMatchHistory(updatedHistory);
            setMatchups([]);
            setScores([]);
            setMvpVotes([]);
            setTeams([]);
            setHasPendingMatchups(false);
            setHasGeneratedTeams(false);

            setToastMessage("🏆 Matches have been archived successfully!");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    const resetLeaderboardData = async () => {
        if (!currentLeagueId) return;

        const confirmText = "⚠️ DANGER: Reset All Stats\n\n" +
            "This will permanently delete:\n" +
            "• All match history\n" +
            "• All player win/loss records\n" +
            "• All MVP counts\n" +
            "• All team matchups\n\n" +
            "THIS ACTION CANNOT BE UNDONE!\n\n" +
            "Type 'RESET' to confirm:";

        const userInput = prompt(confirmText);

        if (userInput === "RESET") {
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const clearedData = {
                    ...data,
                    mvpVotes: [],
                    scores: [],
                    matchups: [],
                    teams: [],
                    leaderboard: {},
                    matchHistory: []
                };
                await firestoreSetDoc(docRef, clearedData);
                setMvpVotes([]);
                setScores([]);
                setMatchups([]);
                setTeams([]);
                setLeaderboard({});
                setMatchHistory([]); // Add this line that was missing

                setToastMessage("⚠️ All stats have been reset");
                setTimeout(() => setToastMessage(""), 5000);

                // Log the activity only if the reset actually happened
                await logActivity(
                    db,
                    currentLeagueId,
                    "leaderboard_reset",
                    {},
                    user,
                    false
                );
            }
        } else if (userInput !== null) {
            // User typed something other than "RESET"
            alert("Reset cancelled. You must type 'RESET' exactly to confirm.");
        }
        // If userInput is null, user clicked Cancel, so do nothing
    };

    const openEditModal = (player, isEdit = true, isAdminEdit = false) => {
        // Store the original name as a separate property
        if (player && isEdit) {
            player.originalName = player.name;
        }
        setSelectedPlayerToEdit(player);
        setIsEditingExisting(isEdit);
        setIsAdminEdit(isAdminEdit);
        setEditPlayerModalOpen(true);
    };

    const closeEditModal = () => {
        setEditPlayerModalOpen(false);
        setSelectedPlayerToEdit(null);
    };

    const isAdmin = currentLeague && (
        currentLeague.createdBy === user?.uid ||
        (currentLeague.admins && currentLeague.admins.includes(user?.uid))
    );

    // Add this function to App.jsx (before saveEditedPlayerFromModal)
    const updatePlayerNameInClaims = async (oldName, newName) => {
        if (!currentLeagueId || !oldName || !newName || oldName === newName) return;

        try {
            // Get all users
            const allUsersSnapshot = await getDocs(collection(db, "users"));

            for (const userDoc of allUsersSnapshot.docs) {
                const userData = userDoc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                // Find and update claims that match the old name
                const updatedClaimedPlayers = claimedPlayers.map(claim => {
                    if (claim.leagueId === currentLeagueId &&
                        claim.playerName.toLowerCase() === oldName.toLowerCase()) {
                        return { ...claim, playerName: newName };
                    }
                    return claim;
                });

                // Only update if there were changes
                const hasChanges = claimedPlayers.some((claim, index) =>
                    claim.playerName !== updatedClaimedPlayers[index].playerName
                );

                if (hasChanges) {
                    await setDoc(userDoc.ref, {
                        ...userData,
                        claimedPlayers: updatedClaimedPlayers
                    });
                }
            }

            // Also update notifications if any exist
            const notificationsRef = collection(db, "leagues", currentLeagueId, "notifications");
            const notificationsSnapshot = await getDocs(notificationsRef);

            for (const notificationDoc of notificationsSnapshot.docs) {
                const notificationData = notificationDoc.data();
                if (notificationData.type === 'player_claim_request' &&
                    notificationData.playerName.toLowerCase() === oldName.toLowerCase()) {
                    await setDoc(notificationDoc.ref, {
                        ...notificationData,
                        playerName: newName
                    });
                }
            }
        } catch (error) {
            console.error("Error updating player name in claims:", error);
        }
    };

    // Modified to use league structure
    const saveEditedPlayerFromModal = async (updatedPlayer, originalName) => {
        if (!currentLeagueId) return;

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const updatedPlayers = [...data.players];

            // Find the player by the original name that was passed to the modal
            const index = updatedPlayers.findIndex(
                (p) => p.name.toLowerCase() === originalName.toLowerCase()
            );

            if (index > -1) {
                // Get existing submissions before replacing the player
                const existingSubmissions = updatedPlayers[index].submissions || [];

                // Create a completely new player object with the updated stats
                updatedPlayers[index] = {
                    name: updatedPlayer.name, // This can be different from the original name
                    active: updatedPlayer.active !== undefined ? updatedPlayer.active : true,
                    scoring: updatedPlayer.scoring,
                    defense: updatedPlayer.defense,
                    rebounding: updatedPlayer.rebounding,
                    playmaking: updatedPlayer.playmaking,
                    stamina: updatedPlayer.stamina,
                    physicality: updatedPlayer.physicality,
                    xfactor: updatedPlayer.xfactor,
                    submissions: existingSubmissions, // Preserve the existing submissions
                    rating: calculateWeightedRating(updatedPlayer)
                };

                // Handle name change in leaderboard
                let updatedLeaderboard = { ...data.leaderboard };
                if (originalName !== updatedPlayer.name && updatedLeaderboard[originalName]) {
                    // Copy the stats to the new name
                    updatedLeaderboard[updatedPlayer.name] = { ...updatedLeaderboard[originalName] };
                    // Delete the old name entry
                    delete updatedLeaderboard[originalName];

                    log("Updated leaderboard after name change:", updatedLeaderboard);
                }

                // Handle name change in belt votes
                let updatedBeltVotes = { ...data.beltVotes };
                let updatedBeltHolders = { ...data.beltHolders };

                if (originalName !== updatedPlayer.name && data.beltVotes) {
                    // Update belt votes
                    Object.values(updatedBeltVotes).forEach(userVotes => {
                        Object.keys(userVotes).forEach(beltId => {
                            if (userVotes[beltId] === originalName) {
                                userVotes[beltId] = updatedPlayer.name;
                            }
                        });
                    });

                    // Update belt holders
                    Object.keys(updatedBeltHolders).forEach(beltId => {
                        if (updatedBeltHolders[beltId] && updatedBeltHolders[beltId].playerName === originalName) {
                            updatedBeltHolders[beltId].playerName = updatedPlayer.name;
                        }
                    });
                }

                // Handle name change in match history
                let updatedMatchHistory = [...(data.matchHistory || [])];

                if (originalName !== updatedPlayer.name && data.matchHistory) {
                    updatedMatchHistory = data.matchHistory.map(match => {
                        const updatedMatch = { ...match };

                        // Handle different match formats
                        if (Array.isArray(match.teams) && match.teams.length >= 2) {
                            // App format: teams array
                            updatedMatch.teams = match.teams.map(team =>
                                team.map(player => {
                                    if (player.name === originalName) {
                                        return { ...player, name: updatedPlayer.name };
                                    }
                                    return player;
                                })
                            );
                        } else if (match.teamA && match.teamB) {
                            // Firestore format: teamA/teamB properties
                            updatedMatch.teamA = match.teamA.map(player => {
                                if (player.name === originalName) {
                                    return { ...player, name: updatedPlayer.name };
                                }
                                return player;
                            });

                            updatedMatch.teamB = match.teamB.map(player => {
                                if (player.name === originalName) {
                                    return { ...player, name: updatedPlayer.name };
                                }
                                return player;
                            });
                        }

                        // Update MVP if it matches the old name
                        if (match.mvp === originalName) {
                            updatedMatch.mvp = updatedPlayer.name;
                        }

                        return updatedMatch;
                    });

                    // Update local match history state
                    setMatchHistory(updatedMatchHistory);
                }

                // Save to Firestore
                await firestoreSetDoc(docRef, {
                    ...data,
                    players: updatedPlayers,
                    leaderboard: updatedLeaderboard,
                    beltVotes: updatedBeltVotes,
                    beltHolders: updatedBeltHolders,
                    matchHistory: updatedMatchHistory,
                });

                await logActivity(
                    db,
                    currentLeagueId,
                    "player_updated",
                    {
                        name: updatedPlayer.name,
                        originalName: originalName,
                        playerData: updatedPlayer
                    },
                    user,
                    true
                );

                // Handle name change: update claims FIRST, then enhance players
                if (originalName !== updatedPlayer.name) {
                    // Update player name in all claims to preserve profile data
                    await updatePlayerNameInClaims(originalName, updatedPlayer.name);

                    // Wait a moment for the database updates to propagate
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Re-enhance players with updated claim data
                    const enhancedPlayers = await enhancePlayersWithClaimData(updatedPlayers);

                    // Update local state with enhanced data
                    setPlayers(enhancedPlayers);
                    setLeaderboard(updatedLeaderboard);
                } else {
                    // No name change, just enhance and update normally
                    const enhancedPlayers = await enhancePlayersWithClaimData(updatedPlayers);
                    setPlayers(enhancedPlayers);
                    setLeaderboard(updatedLeaderboard);
                }

                setToastMessage("✅ Player completely updated!");
                setTimeout(() => setToastMessage(""), 3000);
            } else {
                // Handle adding a new player (when originalName is empty/null)

                // Check if player name already exists
                const existingPlayer = updatedPlayers.find(
                    p => p.name && p.name.toLowerCase() === updatedPlayer.name.toLowerCase()
                );

                if (existingPlayer) {
                    setToastMessage("⚠️ Player name already exists");
                    setTimeout(() => setToastMessage(""), 3000);
                    return;
                }

                // Create new player object
                // Create new player object
                const newPlayer = {
                    name: updatedPlayer.name,
                    active: updatedPlayer.active !== undefined ? updatedPlayer.active : true,
                    submissions: [],
                    rating: calculateWeightedRating(updatedPlayer),
                    scoring: updatedPlayer.scoring,
                    defense: updatedPlayer.defense,
                    rebounding: updatedPlayer.rebounding,
                    playmaking: updatedPlayer.playmaking,
                    stamina: updatedPlayer.stamina,
                    physicality: updatedPlayer.physicality,
                    xfactor: updatedPlayer.xfactor
                };

                // ADD THIS: Create a rating submission if user provided ratings different from default (5)
                if (user && user.email) {
                    const hasCustomRatings = updatedPlayer.scoring !== 5 ||
                        updatedPlayer.defense !== 5 ||
                        updatedPlayer.rebounding !== 5 ||
                        updatedPlayer.playmaking !== 5 ||
                        updatedPlayer.stamina !== 5 ||
                        updatedPlayer.physicality !== 5 ||
                        updatedPlayer.xfactor !== 5;

                    if (hasCustomRatings) {
                        const ratingSubmission = {
                            submittedBy: user.email,
                            submittedAt: new Date(),
                            scoring: updatedPlayer.scoring,
                            defense: updatedPlayer.defense,
                            rebounding: updatedPlayer.rebounding,
                            playmaking: updatedPlayer.playmaking,
                            stamina: updatedPlayer.stamina,
                            physicality: updatedPlayer.physicality,
                            xfactor: updatedPlayer.xfactor
                        };

                        newPlayer.submissions = [ratingSubmission];
                    }
                }

                updatedPlayers.push(newPlayer);

                await firestoreSetDoc(docRef, { ...data, players: updatedPlayers });

                // Enhance players with claim data
                const enhancedPlayers = await enhancePlayersWithClaimData(updatedPlayers);
                setPlayers(enhancedPlayers);

                // Log player addition
                await logActivity(
                    db,
                    currentLeagueId,
                    "player_added",
                    {
                        playerName: updatedPlayer.name,
                        name: updatedPlayer.name,
                        playerData: {
                            scoring: updatedPlayer.scoring,
                            defense: updatedPlayer.defense,
                            rebounding: updatedPlayer.rebounding,
                            playmaking: updatedPlayer.playmaking,
                            stamina: updatedPlayer.stamina,
                            physicality: updatedPlayer.physicality,
                            xfactor: updatedPlayer.xfactor
                        }
                    },
                    user,
                    true // Undoable
                );

                setToastMessage("✅ Player added!");
                setTimeout(() => setToastMessage(""), 3000);
            }
        }

        // Close the modal
        closeEditModal();
    };

    const enhancePlayersWithClaimData = async (players) => {
        if (!players || players.length === 0) return players;

        try {
            const allUsersSnapshot = await getDocs(collection(db, "users"));
            const claimMap = new Map();

            allUsersSnapshot.forEach(doc => {
                const userData = doc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                claimedPlayers.forEach(claim => {
                    if (claim.leagueId === currentLeagueId && claim.status === 'approved') {
                        claimMap.set(claim.playerName.toLowerCase(), {
                            isCardClaimed: true,
                            claimedByName: userData.displayName || userData.email,
                            preferredName: userData.profile?.preferredName || userData.displayName,
                            customPhotoURL: claim.customPhotoURL,
                            height: claim.height,
                            weight: claim.weight
                        });
                    }
                });
            });

            const enhancedPlayers = players.map(player => {
                const claimData = claimMap.get(player.name.toLowerCase());

                return {
                    ...player,
                    displayName: claimData?.preferredName || player.name,
                    isCardClaimed: claimMap.has(player.name.toLowerCase()),
                    customPhotoURL: claimData?.customPhotoURL,
                    height: claimData?.height,
                    weight: claimData?.weight
                };
            });

            return enhancedPlayers;
        } catch (error) {
            console.error("Error enhancing players with claim data:", error);
            return players;
        }
    };
    const handlePlayerClaimRequest = (playerName) => {
        setSelectedPlayerToClaim(playerName);
        setShowPlayerClaimModal(true);
    };

    const openPlayerDetailModal = (player) => {
        setSelectedPlayerForDetail(player);
        setShowPlayerDetailModal(true);
    };

    // Get user's preference for a specific player
    const getUserPlayerPreference = (playerName, userId = user?.uid) => {
        if (!userId) return false; // Default to inactive if no user
        return userPlayerPreferences[userId]?.[playerName] || false;
    };

    // Update user's preference for a specific player
    const updateUserPlayerPreference = async (playerName, isActive, userId = user?.uid) => {
        if (!userId || !currentLeagueId) return;

        try {
            const docRef = doc(db, "leagues", currentLeagueId, "userPreferences", userId);

            // Update local state first
            setUserPlayerPreferences(prev => ({
                ...prev,
                [userId]: {
                    ...prev[userId],
                    [playerName]: isActive
                }
            }));

            // Save to Firestore using updateDoc for atomic operation
            await updateDoc(docRef, {
                [`playerPreferences.${playerName}`]: isActive
            });

        } catch (error) {
            // If document doesn't exist, create it with setDoc
            if (error.code === 'not-found') {
                const docRef = doc(db, "leagues", currentLeagueId, "userPreferences", userId);
                await setDoc(docRef, {
                    playerPreferences: {
                        [playerName]: isActive
                    }
                });

                // Update local state
                setUserPlayerPreferences(prev => ({
                    ...prev,
                    [userId]: {
                        ...prev[userId],
                        [playerName]: isActive
                    }
                }));
            } else {
                console.error("Error updating player preference:", error);
            }
        }
    };

    // Batch update for select all functionality
    const updateUserPlayerPreferencesBatch = async (updates, userId = user?.uid) => {
        if (!userId || !currentLeagueId) return;

        try {
            const docRef = doc(db, "leagues", currentLeagueId, "userPreferences", userId);

            // Create update object for Firestore
            const firestoreUpdates = {};
            updates.forEach(update => {
                firestoreUpdates[`playerPreferences.${update.name}`] = update.active;
            });

            // Update local state
            const newUserPrefs = { ...userPlayerPreferences[userId] };
            updates.forEach(update => {
                newUserPrefs[update.name] = update.active;
            });

            setUserPlayerPreferences(prev => ({
                ...prev,
                [userId]: newUserPrefs
            }));

            // Save to Firestore
            await updateDoc(docRef, firestoreUpdates);

        } catch (error) {
            if (error.code === 'not-found') {
                const docRef = doc(db, "leagues", currentLeagueId, "userPreferences", userId);
                const playerPreferences = {};
                updates.forEach(update => {
                    playerPreferences[update.name] = update.active;
                });

                await setDoc(docRef, { playerPreferences });
            } else {
                console.error("Error batch updating player preferences:", error);
            }
        }
    };

    const checkForMissingProfilePhoto = async () => {
        if (!user || !currentLeagueId) {
            setShowProfilePhotoNotification(false);
            return;
        }

        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                // Check if user has approved claims in current league without photos
                const claimsWithoutPhoto = claimedPlayers.filter(
                    claim => claim.leagueId === currentLeagueId &&
                        claim.status === 'approved' &&
                        !claim.customPhotoURL
                );

                setShowProfilePhotoNotification(claimsWithoutPhoto.length > 0);
            }
        } catch (error) {
            console.error("Error checking for missing photos:", error);
            setShowProfilePhotoNotification(false);
        }
    };

    useEffect(() => {
        checkForMissingProfilePhoto();
    }, [user, currentLeagueId]);

    useEffect(() => {
        if (!currentLeagueId) return;

        const fetchLeaguePreferences = async () => {
            try {
                const leagueRef = doc(db, "leagues", currentLeagueId);
                const leagueDoc = await getDoc(leagueRef);

                if (leagueDoc.exists()) {
                    const leagueData = leagueDoc.data();
                    setShowReviewerNames(leagueData.preferences?.showReviewerNames || false);
                    setMinGamesFilter(leagueData.preferences?.minGamesFilter || 0);  // Add this line
                }
            } catch (error) {
                console.error("Error fetching league preferences:", error);
            }
        };

        fetchLeaguePreferences();
    }, [currentLeagueId]);

    // Modified to use league structure
    useEffect(() => {
        if (!currentLeagueId) return;

        const fetchMatchHistory = async () => {
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Load belt votes (always needed for player icons)
                if (data.beltVotes) {
                    setBeltVotes(data.beltVotes);
                    const calculatedBelts = calculateBeltStandings(data.beltVotes);
                    setCurrentBelts(calculatedBelts);
                }

                // Only load match history for tabs that need it
                if (["leaderboard", "awards"].includes(activeTab) &&
                    data.matchHistory && data.matchHistory.length > 0) {

                    log("Loaded match history:", data.matchHistory.length, "matches");

                    const convertedHistory = data.matchHistory.map(match => {
                        if (match.teams) {
                            return match;
                        }
                        if (match.teamA || match.teamB) {
                            return {
                                teams: [match.teamA || [], match.teamB || []],
                                score: match.score,
                                mvp: match.mvp || "",
                                date: match.date
                            };
                        }
                        return match;
                    });
                    setMatchHistory(convertedHistory);
                }
            }
        };

        fetchMatchHistory();
    }, [currentLeagueId, currentSet, activeTab]); // Add activeTab dependency

    useEffect(() => {
        // Check for last used league on app startup
        const lastUsedLeagueId = localStorage.getItem("lastUsedLeagueId");
        if (lastUsedLeagueId && !currentLeagueId) {
            setCurrentLeagueId(lastUsedLeagueId);
        }
    }, []);

    useEffect(() => {
        // Add the styles to the document
        const styleElement = document.createElement('style');
        styleElement.innerHTML = scrollbarHideStyles;
        document.head.appendChild(styleElement);

        // Clean up function to remove styles when component unmounts
        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    // Fetch match history when the app loads
    useEffect(() => {
        if (!currentLeagueId) return;

        const fetchMatchHistory = async () => {
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.matchHistory) {
                    log("Loaded match history:", data.matchHistory.length, "matches");
                    setMatchHistory(data.matchHistory);
                }
            }
        };

        fetchMatchHistory();
    }, [currentLeagueId, currentSet]);

    // Modified to use league structure
    useEffect(() => {
        if (!currentLeagueId) return;

        const autoSaveMatchData = async () => {
            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const firestoreData = prepareDataForFirestore({
                    ...data,
                    mvpVotes,
                    scores,
                    matchups,
                    teams
                });

                await firestoreSetDoc(docRef, firestoreData);
            }
        };

        if (matchups.length > 0 && scores.length > 0) {
            autoSaveMatchData();
        }
    }, [currentLeagueId, scores, mvpVotes, matchups]);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            log("Auth change:", currentUser ? 'signed in' : 'signed out');
            setUser(currentUser);

            // If user logs out, redirect to league landing page
            if (!currentUser && currentLeagueId) {
                // Clear any stored league data
                localStorage.removeItem("lastUsedLeagueId");
                setCurrentLeagueId(null);
                setCurrentLeague(null);
            }
        });
        auth.onAuthStateChanged((user) => {
            if (!user) {
                // Clear any authentication state that might be corrupted
                try {
                    sessionStorage.removeItem('firebase:authUser:' + auth.app.options.apiKey + ':[DEFAULT]');
                } catch (e) {
                    console.warn('Could not clear auth session storage:', e);
                }
            }
        });
        return () => unsubscribe();
    }, [currentLeagueId]); // Add currentLeagueId as dependency

    // Modified to use league structure
    useEffect(() => {
        if (!currentLeagueId) return;

        const fetchLeagueDetails = async () => {
            try {
                const leagueRef = doc(db, "leagues", currentLeagueId);
                const leagueDoc = await getDoc(leagueRef);

                if (leagueDoc.exists()) {
                    setCurrentLeague({
                        id: currentLeagueId,
                        ...leagueDoc.data()
                    });
                    await ensureSchemaExists(db, currentLeagueId);
                }
            } catch (error) {
                console.error("Error fetching league details:", error);
            }
        };

        fetchLeagueDetails();
    }, [currentLeagueId]);

    // Effect to detect unsaved matchups
    useEffect(() => {
        // Don't check for pending matchups if we're forcing a tab change
        if (forceTabChange) return;

        // Don't check for pending matchups if we're in the process of changing tabs
        if (pendingTabChange) return;

        if (matchups.length > 0) {
            const hasIncompleteScores = scores.some(score =>
                !score.processed && (!score.a || !score.b || score.a === "" || score.b === "")
            );
            setHasPendingMatchups(hasIncompleteScores);
        } else {
            setHasPendingMatchups(false);
        }
    }, [matchups, scores, pendingTabChange, forceTabChange]);

    // Modify the tab switching function to check for pending matchups
    const handleTabChange = (newTab) => {

        // If we're forcing a tab change, just do it
        if (forceTabChange) {
            setActiveTab(newTab);
            setForceTabChange(false);
            return;
        }

        // Reset sub-tab when switching to rankings/players tab
        if (newTab === "rankings") {
            setPlayersSubTab("rankings");
        }

        // Users should be able to switch tabs freely
        setActiveTab(newTab);
    };

    // Replace the handleConfirmTabChange function:
    const handleConfirmTabChange = async () => {
        log("handleConfirmTabChange called:", { pendingTabChange });

        if (pendingTabChange === 'generate-teams') {
            // Special case for generating teams
            setShowUnsavedModal(false);
            setPendingTabChange(null);
            setHasPendingMatchups(false);
            await generateBalancedTeamsInternal();
        } else if (pendingTabChange) {
            // Normal tab change - user wants to leave anyway
            const targetTab = pendingTabChange;
            log("User confirmed tab change to:", targetTab);

            // Clear the modal and states
            setShowUnsavedModal(false);
            setPendingTabChange(null);
            setHasPendingMatchups(false);

            // Force the tab change
            setForceTabChange(true);

            // Use setTimeout to ensure the force flag is set before changing tabs
            setTimeout(() => {
                handleTabChange(targetTab);
            }, 0);
        } else {
            setShowUnsavedModal(false);
        }
    };

    // Modified to use league structure
    useEffect(() => {
        if (!currentLeagueId || !user) return;

        const fetchSet = async () => {
            console.log("=== fetchSet START ===");
            console.log("fetchSet running for league:", currentLeagueId, "user:", user.uid);

            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = convertFirestoreDataToAppFormat(docSnap.data());

                // ALWAYS load preferences fresh for the current league
                console.log("Loading user preferences for current league:", currentLeagueId);
                let userPrefs = {};

                try {
                    const prefsDocRef = doc(db, "leagues", currentLeagueId, "userPreferences", user.uid);
                    const prefsDocSnap = await getDoc(prefsDocRef);
                    if (prefsDocSnap.exists()) {
                        userPrefs = prefsDocSnap.data().playerPreferences || {};
                        console.log("Loaded fresh userPrefs from Firestore:", userPrefs);

                        // Update state for other components
                        setUserPlayerPreferences({
                            [user.uid]: userPrefs
                        });
                    } else {
                        console.log("No user preferences found, using empty object");
                        userPrefs = {};
                        setUserPlayerPreferences({
                            [user.uid]: {}
                        });
                    }
                } catch (error) {
                    console.error("Error loading user preferences in fetchSet:", error);
                    userPrefs = {};
                }

                console.log("About to process", data.players?.length || 0, "players");

                const averagedPlayers = (data.players || []).map((player) => {
                    const submissions = player.submissions || [];
                    const isActive = userPrefs[player.name] || false;

                    const avgStats = {
                        name: player.name,
                        active: isActive,
                        scoring: 0,
                        defense: 0,
                        rebounding: 0,
                        playmaking: 0,
                        stamina: 0,
                        physicality: 0,
                        xfactor: 0,
                    };

                    if (isActive) {
                        console.log("Setting player", player.name, "to active");
                    }

                    submissions.forEach((s) => {
                        avgStats.scoring += s.scoring;
                        avgStats.defense += s.defense;
                        avgStats.rebounding += s.rebounding;
                        avgStats.playmaking += s.playmaking;
                        avgStats.stamina += s.stamina;
                        avgStats.physicality += s.physicality;
                        avgStats.xfactor += s.xfactor;
                    });
                    const len = submissions.length || 1;
                    Object.keys(avgStats).forEach((key) => {
                        if (typeof avgStats[key] === "number") {
                            avgStats[key] = parseFloat((avgStats[key] / len).toFixed(2));
                        }
                    });
                    avgStats.submissions = submissions;
                    return avgStats;
                });

                const enhancedPlayers = await enhancePlayersWithClaimData(averagedPlayers);
                const finalActivePlayers = enhancedPlayers.filter(p => p.active).map(p => p.name);
                console.log("Final active players being set:", finalActivePlayers);

                setPlayers(enhancedPlayers);
                setMvpVotes(data.mvpVotes || []);
                setScores(data.scores || []);
                if (data.leaderboard && Object.keys(data.leaderboard).length > 0) {
                    setLeaderboard(data.leaderboard);
                } else if ((data.scores?.length || 0) > 0 && (data.matchups?.length || 0) > 0) {
                    setTimeout(() => calculateLeaderboard(), 100);
                }
            }
            console.log("=== fetchSet END ===");
        };
        fetchSet();
    }, [currentLeagueId, currentSet, user]);

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

    useEffect(() => {
        const fetchUserLeagues = async () => {
            if (!user) {
                setUserLeagues([]);
                return;
            }

            try {
                // Get user document
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userLeagueIds = userData.leagues || [];

                    if (userLeagueIds.length === 0) {
                        setUserLeagues([]);
                        return;
                    }

                    // Fetch league details for each league ID
                    const leagueDetails = await Promise.all(
                        userLeagueIds.map(async (leagueId) => {
                            const leagueDocRef = doc(db, "leagues", leagueId);
                            const leagueDoc = await getDoc(leagueDocRef);

                            if (leagueDoc.exists()) {
                                return {
                                    id: leagueId,
                                    ...leagueDoc.data()
                                };
                            }
                            return null;
                        })
                    );

                    // Filter out any null values (leagues that don't exist)
                    setUserLeagues(leagueDetails.filter(league => league !== null));
                }
            } catch (error) {
                console.error("Error fetching user leagues:", error);
            }
        };

        fetchUserLeagues();
    }, [user, currentLeagueId]); // Re-fetch when user or currentLeagueId changes

    useEffect(() => {
        const enhanceAndSetPlayers = async () => {
            if (players.length > 0 && currentLeagueId) {
                const enhanced = await enhancePlayersWithClaimData(players);
                setEnhancedPlayers(enhanced);
            } else {
                setEnhancedPlayers(players);
            }
        };

        enhanceAndSetPlayers();
    }, [players, currentLeagueId]); // Re-run when players or league changes

    useEffect(() => {
        // Create a global refresh function that can be called from LogTab
        window.refreshPlayersData = async () => {
            if (currentLeagueId) {
                const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Process players the same way as in the original fetch
                    const averagedPlayers = (data.players || []).map((player) => {
                        const submissions = Array.isArray(player.submissions) ? player.submissions : [];
                        if (submissions.length === 0) {
                            return {
                                ...player,
                                submissions: []
                            };
                        }
                        // Calculate averages from submissions
                        const avgStats = {
                            name: player.name || "Unknown",
                            active: player.active !== undefined ? player.active : true,
                            scoring: 0,
                            defense: 0,
                            rebounding: 0,
                            playmaking: 0,
                            stamina: 0,
                            physicality: 0,
                            xfactor: 0,
                        };
                        submissions.forEach((s) => {
                            avgStats.scoring += s.scoring;
                            avgStats.defense += s.defense;
                            avgStats.rebounding += s.rebounding;
                            avgStats.playmaking += s.playmaking;
                            avgStats.stamina += s.stamina;
                            avgStats.physicality += s.physicality;
                            avgStats.xfactor += s.xfactor;
                        });
                        const len = submissions.length || 1;
                        Object.keys(avgStats).forEach((key) => {
                            if (typeof avgStats[key] === "number") {
                                avgStats[key] = parseFloat((avgStats[key] / len).toFixed(2));
                            }
                        });
                        avgStats.submissions = submissions;
                        return avgStats;
                    });

                    // ADD THIS: Enhance players with claim data (photos, etc.)
                    const enhancedPlayers = await enhancePlayersWithClaimData(averagedPlayers);

                    setPlayers(enhancedPlayers);
                    setEnhancedPlayers(enhancedPlayers); // Also update enhancedPlayers state
                }
            }
        };

        // Cleanup
        return () => {
            delete window.refreshPlayersData;
        };
    }, [currentLeagueId, currentSet]);

    useEffect(() => {
        const loadUserPlayerPreferences = async () => {
            console.log("=== loadUserPlayerPreferences START ===");
            console.log("user:", user?.uid);
            console.log("currentLeagueId:", currentLeagueId);

            if (!user || !currentLeagueId) {
                console.log("Missing user or leagueId, clearing preferences");
                setUserPlayerPreferences({});
                return;
            }

            try {
                const docRef = doc(db, "leagues", currentLeagueId, "userPreferences", user.uid);
                console.log("Fetching preferences from:", `leagues/${currentLeagueId}/userPreferences/${user.uid}`);

                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const prefs = data.playerPreferences || {};
                    console.log("Found preferences:", prefs);
                    console.log("Active players from prefs:", Object.keys(prefs).filter(key => prefs[key]));

                    // Clear previous league's preferences and set only the current league's
                    setUserPlayerPreferences({
                        [user.uid]: prefs
                    });

                    // If we have players but they don't have the right active states, update them
                    if (players.length > 0) {
                        console.log("Updating", players.length, "players with preferences");
                        const updatedPlayers = players.map(player => ({
                            ...player,
                            active: prefs[player.name] || false
                        }));
                        const activePlayers = updatedPlayers.filter(p => p.active).map(p => p.name);
                        console.log("Setting these players to active:", activePlayers);
                        setPlayers(updatedPlayers);
                    }
                } else {
                    console.log("No preferences document found, initializing empty");
                    // Initialize empty preferences for this user, clearing any previous data
                    setUserPlayerPreferences({
                        [user.uid]: {}
                    });
                }
            } catch (error) {
                console.error("Error loading user player preferences:", error);
            }
            console.log("=== loadUserPlayerPreferences END ===");
        };
        loadUserPlayerPreferences();
    }, [user, currentLeagueId]);

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

    const handleManualLeaderboardUpdate = async (updatedLeaderboard) => {
        if (!currentLeagueId) return;

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            await firestoreSetDoc(docRef, {
                ...data,
                leaderboard: updatedLeaderboard
            });

            setLeaderboard(updatedLeaderboard);

            setToastMessage("✅ Player stats updated!");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    const handlePlayerSaveFromModal = async (playerData, originalName = "") => {
        if (!user) {
            setToastMessage("⚠️ Please sign in to submit a rating.");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        if (!currentLeagueId) {
            setToastMessage("⚠️ No league selected.");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : { players: [] };
        const updatedPlayers = [...data.players];

        // Use the original name as lookup if provided, otherwise use the current name
        const nameToFind = originalName || playerData.name;

        const index = updatedPlayers.findIndex(
            (p) => p.name.toLowerCase() === nameToFind.toLowerCase()
        );

        // Determine if this is a new player or an update
        const isNewPlayer = index === -1;

        if (index > -1) {
            // For existing players
            const existingSubmissions = updatedPlayers[index].submissions || [];

            updatedPlayers[index] = {
                name: playerData.name, // This can be different from originalName
                active: playerData.active !== undefined ? playerData.active : true,
                scoring: playerData.scoring,
                defense: playerData.defense,
                rebounding: playerData.rebounding,
                playmaking: playerData.playmaking,
                stamina: playerData.stamina,
                physicality: playerData.physicality,
                xfactor: playerData.xfactor,
                submissions: existingSubmissions,
                rating: (
                    playerData.scoring +
                    playerData.defense +
                    playerData.rebounding +
                    playerData.playmaking +
                    playerData.stamina +
                    playerData.physicality +
                    playerData.xfactor
                ) / 7,
            };

            // Handle name change in leaderboard for regular player editing
            let updatedLeaderboard = { ...data.leaderboard };
            if (originalName && originalName !== playerData.name && updatedLeaderboard[originalName]) {
                // Copy the stats to the new name
                updatedLeaderboard[playerData.name] = { ...updatedLeaderboard[originalName] };
                // Delete the old name entry
                delete updatedLeaderboard[originalName];

                log("Updated leaderboard after name change:", updatedLeaderboard);
            }

            await firestoreSetDoc(docRef, {
                ...data,
                players: updatedPlayers,
                leaderboard: updatedLeaderboard
            });

            setPlayers(updatedPlayers);
            setLeaderboard(updatedLeaderboard);

            // ADD THIS: Log player update
            await logActivity(
                db,
                currentLeagueId,
                "player_updated",
                {
                    playerName: playerData.name,
                    originalName: originalName || playerData.name,
                    playerData: {
                        scoring: playerData.scoring,
                        defense: playerData.defense,
                        rebounding: playerData.rebounding,
                        playmaking: playerData.playmaking,
                        stamina: playerData.stamina,
                        physicality: playerData.physicality,
                        xfactor: playerData.xfactor
                    }
                },
                user,
                true // Undoable
            );
        } else {
            // New player creation
            const newPlayer = {
                name: playerData.name,
                active: true,
                submissions: [
                    {
                        submittedBy: user.email,
                        submittedByName: user.displayName || user.email,
                        submissionDate: new Date().toISOString(),
                        ...playerData,
                    }
                ],
                rating:
                    (playerData.scoring +
                        playerData.defense +
                        playerData.rebounding +
                        playerData.playmaking +
                        playerData.stamina +
                        playerData.physicality +
                        playerData.xfactor) / 7,
                scoring: playerData.scoring,
                defense: playerData.defense,
                rebounding: playerData.rebounding,
                playmaking: playerData.playmaking,
                stamina: playerData.stamina,
                physicality: playerData.physicality,
                xfactor: playerData.xfactor
            };

            updatedPlayers.push(newPlayer);

            await firestoreSetDoc(docRef, { ...data, players: updatedPlayers });
            setPlayers(updatedPlayers);

            // ADD THIS: Log player addition
            await logActivity(
                db,
                currentLeagueId,
                "player_added",
                {
                    playerName: playerData.name,
                    name: playerData.name,
                    playerData: {
                        scoring: playerData.scoring,
                        defense: playerData.defense,
                        rebounding: playerData.rebounding,
                        playmaking: playerData.playmaking,
                        stamina: playerData.stamina,
                        physicality: playerData.physicality,
                        xfactor: playerData.xfactor
                    }
                },
                user,
                true // Undoable
            );
        }

        setToastMessage(isNewPlayer ? "✅ Player added!" : "✅ Player updated!");
        setTimeout(() => setToastMessage(""), 3000);
        closeEditModal();
    };

    // Function to handle selecting a league
    const handleLeagueSelect = (leagueId) => {
        setCurrentLeagueId(leagueId);
        // Reset the current tab to players
        setActiveTab("players");
    };
    // Function to handle going back to leagues page
    const handleBackToLeagues = () => {
        // Remove the league ID from localStorage first
        localStorage.removeItem("lastUsedLeagueId");
        // Then update the state
        setCurrentLeagueId(null);
        setCurrentLeague(null);
    };


    const saveMatchResults = async (matchIndex, customDate = null) => {
        if (!currentLeagueId) return;

        // Validate the match index exists and has score data
        if (matchIndex === undefined || !scores[matchIndex] || !scores[matchIndex].a || !scores[matchIndex].b) {
            setToastMessage("⚠️ Please enter scores for both teams!");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        const matchDate = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

        // Check if this match has already been processed
        if (scores[matchIndex].processed) {
            setToastMessage("⚠️ This match has already been saved!");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);

        try {
            // Use updateDoc for atomic field updates
            await updateDoc(docRef, {
                [`scores.${matchIndex}.processed`]: true,
                [`scores.${matchIndex}.teamSize`]: teamSize,
                [`scores.${matchIndex}.customDate`]: matchDate,
                [`scores.${matchIndex}.a`]: scores[matchIndex].a,
                [`scores.${matchIndex}.b`]: scores[matchIndex].b,
                [`mvpVotes.${matchIndex}`]: mvpVotes[matchIndex] || ""
            });

            // Update local state
            const updatedScores = [...scores];
            updatedScores[matchIndex] = {
                ...updatedScores[matchIndex],
                processed: true,
                teamSize: teamSize,
                customDate: matchDate,
            };
            setScores(updatedScores);

            // Check if all matches with scores are processed now
            const allProcessed = updatedScores.every(score =>
                !score.a || !score.b || score.processed
            );

            if (allProcessed) {
                setHasPendingMatchups(false);
            }

            // Calculate leaderboard updates from this match only AFTER saving
            await calculateMatchLeaderboard(matchIndex);

            // Tournament logic
            if (isFirstRound && waitingTeam) {
                // This is the first round - automatically create championship match
                const teamAScore = parseInt(scores[matchIndex].a) || 0;
                const teamBScore = parseInt(scores[matchIndex].b) || 0;
                const winnerTeam = teamAScore > teamBScore ? matchups[matchIndex][0] : matchups[matchIndex][1];
                const loserTeam = teamAScore > teamBScore ? matchups[matchIndex][1] : matchups[matchIndex][0];

                // Store the first round result
                const firstRoundResult = {
                    round: "Semi-Final",
                    teamA: matchups[matchIndex][0],
                    teamB: matchups[matchIndex][1],
                    scoreA: scores[matchIndex].a,
                    scoreB: scores[matchIndex].b,
                    mvp: mvpVotes[matchIndex] || "",
                    winner: winnerTeam
                };

                setTournamentResults([firstRoundResult]);

                // ONLY FOR TOURNAMENT: Add to match history since tournament matches don't go through normal flow
                const matchHistoryEntry = {
                    teamA: matchups[matchIndex][0].map(player => ({
                        name: player.name,
                        active: player.active !== undefined ? player.active : true,
                        isBench: player.isBench || false,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })),
                    teamB: matchups[matchIndex][1].map(player => ({
                        name: player.name,
                        active: player.active !== undefined ? player.active : true,
                        isBench: player.isBench || false,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })),
                    score: {
                        a: parseInt(scores[matchIndex].a),
                        b: parseInt(scores[matchIndex].b)
                    },
                    mvp: mvpVotes[matchIndex] || "",
                    date: matchDate,
                    teamSize: teamSize
                };

                // Add to match history in Firestore
                await updateDoc(docRef, {
                    matchHistory: arrayUnion(matchHistoryEntry)
                });

                // Update local match history
                setMatchHistory(prev => [...prev, {
                    teams: [matchups[matchIndex][0], matchups[matchIndex][1]],
                    score: { a: parseInt(scores[matchIndex].a), b: parseInt(scores[matchIndex].b) },
                    mvp: mvpVotes[matchIndex] || "",
                    date: matchDate,
                    teamSize: teamSize
                }]);

                // Create championship matchup
                const championshipMatchup = [winnerTeam, waitingTeam];

                setMatchups([championshipMatchup]);
                setMvpVotes([""]);
                setScores([{ a: "", b: "" }]);
                setIsFirstRound(false);

                const waitingTeamName = waitingTeam.length === 1 ? waitingTeam[0]?.name : getTeamName(waitingTeam, calculatePlayerScore || computeRating1to10);
                const winnerTeamName = winnerTeam.length === 1 ? winnerTeam[0]?.name : getTeamName(winnerTeam, calculatePlayerScore || computeRating1to10);

                setToastMessage(`Championship match: ${winnerTeamName} vs ${waitingTeamName}!`);
                setTimeout(() => setToastMessage(""), 5000);

            } else if (!isFirstRound && tournamentResults.length > 0) {
                // This is the championship match
                const championshipResult = {
                    round: "Championship",
                    teamA: matchups[matchIndex][0],
                    teamB: matchups[matchIndex][1],
                    scoreA: scores[matchIndex].a,
                    scoreB: scores[matchIndex].b,
                    mvp: mvpVotes[matchIndex] || "",
                    winner: scores[matchIndex].a > scores[matchIndex].b ? matchups[matchIndex][0] : matchups[matchIndex][1]
                };

                setTournamentResults(prev => [...prev, championshipResult]);

                // ONLY FOR TOURNAMENT: Add championship match to history
                const championshipHistoryEntry = {
                    teamA: matchups[matchIndex][0].map(player => ({
                        name: player.name,
                        active: player.active !== undefined ? player.active : true,
                        isBench: player.isBench || false,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })),
                    teamB: matchups[matchIndex][1].map(player => ({
                        name: player.name,
                        active: player.active !== undefined ? player.active : true,
                        isBench: player.isBench || false,
                        scoring: player.scoring || 0,
                        defense: player.defense || 0,
                        rebounding: player.rebounding || 0,
                        playmaking: player.playmaking || 0,
                        stamina: player.stamina || 0,
                        physicality: player.physicality || 0,
                        xfactor: player.xfactor || 0
                    })),
                    score: {
                        a: parseInt(scores[matchIndex].a),
                        b: parseInt(scores[matchIndex].b)
                    },
                    mvp: mvpVotes[matchIndex] || "",
                    date: matchDate,
                    teamSize: teamSize
                };

                // Add to match history in Firestore
                await updateDoc(docRef, {
                    matchHistory: arrayUnion(championshipHistoryEntry)
                });

                // Update local match history
                setMatchHistory(prev => [...prev, {
                    teams: [matchups[matchIndex][0], matchups[matchIndex][1]],
                    score: { a: parseInt(scores[matchIndex].a), b: parseInt(scores[matchIndex].b) },
                    mvp: mvpVotes[matchIndex] || "",
                    date: matchDate,
                    teamSize: teamSize
                }]);

                setShowTournamentComplete(true);
                setToastMessage("🏆 Tournament Complete!");
                setTimeout(() => setToastMessage(""), 3000);

            } else {
                // Regular match - check for rematch logic (NO MATCH HISTORY ADDITION - already handled by existing system)
                const currentMatchupTeams = JSON.stringify(matchups[matchIndex].map(team => team.map(p => p.name).sort()));
                const allMatchesForTheseTeams = matchups
                    .map((matchup, idx) => ({
                        index: idx,
                        teams: JSON.stringify(matchup.map(team => team.map(p => p.name).sort()))
                    }))
                    .filter(m => m.teams === currentMatchupTeams);

                const allMatchesCompleted = allMatchesForTheseTeams.every(m =>
                    updatedScores[m.index]?.processed
                );

                if (allMatchesCompleted) {
                    setCurrentRematchTeams(matchups[matchIndex]);
                    setShowRematchPrompt(true);
                }

                setToastMessage("✅ Match result saved!");
                setTimeout(() => setToastMessage(""), 3000);
            }

            // Log the activity
            await logActivity(
                db,
                currentLeagueId,
                "match_result_saved",
                {
                    matchIndex,
                    scoreA: scores[matchIndex].a,
                    scoreB: scores[matchIndex].b,
                    mvp: mvpVotes[matchIndex] || "",
                    teamSize: teamSize,
                    gameType: `${teamSize}v${teamSize}`,
                    teamA: matchups[matchIndex][0].map(player => player.name),
                    teamB: matchups[matchIndex][1].map(player => player.name),
                    teamARating: calculateTeamStrength(matchups[matchIndex][0]).toFixed(1),
                    teamBRating: calculateTeamStrength(matchups[matchIndex][1]).toFixed(1),
                    teamsFlat: {
                        team0: matchups[matchIndex][0].map(player => player.name),
                        team1: matchups[matchIndex][1].map(player => player.name)
                    },
                    date: matchDate
                },
                user,
                true
            );

        } catch (error) {
            console.error("Error saving match result:", error);
            setToastMessage("❌ Error saving match result");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    const getTeamName = (team, calculatePlayerScoreFn = null) => {
        if (!team || team.length === 0) return "Team";

        // For 1v1 matches, just return the player's name directly
        if (team.length === 1) {
            return team[0].name || "Player";
        }

        // For multi-player teams, find the best player
        const scoreFn = calculatePlayerScoreFn || calculatePlayerScore;
        const bestPlayer = team.reduce((best, current) => {
            try {
                const bestScore = scoreFn(best);
                const currentScore = scoreFn(current);
                return currentScore > bestScore ? current : best;
            } catch (e) {
                console.error("Error calculating player score:", e);
                return best;
            }
        }, team[0]);

        if (!bestPlayer) return "Team";

        // Format the player name (capitalize first letter of each word)
        const formatName = (name) => {
            return name.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        };

        return formatName(bestPlayer.name);
    };

    // Function to copy invite code to clipboard
    const copyInviteCodeToClipboard = () => {
        if (currentLeague?.inviteCode) {
            navigator.clipboard.writeText(currentLeague.inviteCode)
                .then(() => {
                    setToastMessage("📋 Invite code copied to clipboard!");
                    setTimeout(() => setToastMessage(""), 3000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    setToastMessage("❌ Failed to copy invite code");
                    setTimeout(() => setToastMessage(""), 3000);
                });
        }
    };

    // Function to copy daily matches to clipboard
    const shareDailyMatches = (targetDate) => {
        const matches = getMatchesFromDate(targetDate);
        const shareText = formatMatchesForSharing(matches, targetDate);

        navigator.clipboard.writeText(shareText)
            .then(() => {
                setToastMessage("📋 Daily matches copied to clipboard!");
                setTimeout(() => setToastMessage(""), 3000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                setToastMessage("❌ Failed to copy matches");
                setTimeout(() => setToastMessage(""), 3000);
            });
    };


    // Function to get matches from logs for a specific date (timezone-safe)
    const getMatchLogsFromDate = (logs, targetDate) => {
        if (!logs || logs.length === 0) return [];

        // Parse the date string properly to avoid timezone issues
        const [year, month, day] = targetDate.split('-').map(Number);

        console.log('Filtering for date:', year, month, day);

        return logs.filter(log => {
            if (!["match_result_saved", "match_completed"].includes(log.action)) return false;

            const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            const logYear = logDate.getFullYear();
            const logMonth = logDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
            const logDay = logDate.getDate();

            console.log('Log date:', logYear, logMonth, logDay, 'Match:', logYear === year && logMonth === month && logDay === day);

            return logYear === year && logMonth === month && logDay === day;
        }).sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return dateA - dateB; // Sort chronologically (oldest to newest)
        });
    };

    // Function to format match logs for sharing
    const formatMatchLogsForSharing = (matchLogs, shareDate) => {
        if (!matchLogs || matchLogs.length === 0) {
            return `No matches found for ${new Date(shareDate).toLocaleDateString()} 🏀`;
        }

        const dateStr = new Date(shareDate).toLocaleDateString();
        let shareText = `🏀 *${currentLeague?.name || 'Basketball'} Matches - ${dateStr}*\n\n`;

        // Track player stats for biggest winner/loser
        const playerStats = {};

        // First pass: collect all player stats
        matchLogs.forEach((log) => {
            const details = log.details || {};
            const scoreA = parseInt(details.scoreA) || 0;
            const scoreB = parseInt(details.scoreB) || 0;
            const teamAWon = scoreA > scoreB;
            const teamBWon = scoreB > scoreA;

            const teamA = details.teamA || [];
            const teamB = details.teamB || [];

            // Track player wins/losses for stats
            teamA.forEach(player => {
                const playerName = typeof player === 'string' ? player : player.name || 'Player';
                if (!playerStats[playerName]) {
                    playerStats[playerName] = { wins: 0, losses: 0, mvps: 0 };
                }
                if (teamAWon) {
                    playerStats[playerName].wins++;
                } else if (teamBWon) {
                    playerStats[playerName].losses++;
                }
                if (details.mvp === playerName) {
                    playerStats[playerName].mvps++;
                }
            });

            teamB.forEach(player => {
                const playerName = typeof player === 'string' ? player : player.name || 'Player';
                if (!playerStats[playerName]) {
                    playerStats[playerName] = { wins: 0, losses: 0, mvps: 0 };
                }
                if (teamBWon) {
                    playerStats[playerName].wins++;
                } else if (teamAWon) {
                    playerStats[playerName].losses++;
                }
                if (details.mvp === playerName) {
                    playerStats[playerName].mvps++;
                }
            });
        });

        // Find biggest winner and loser
        let biggestWinner = null;
        let biggestLoser = null;
        let mostWins = 0;
        let mostLosses = 0;
        let mostMVPs = 0;
        let mvpKing = null;

        Object.entries(playerStats).forEach(([playerName, stats]) => {
            const totalGames = stats.wins + stats.losses;
            if (totalGames > 0) {
                if (stats.wins > mostWins) {
                    mostWins = stats.wins;
                    biggestWinner = playerName;
                }
                if (stats.losses > mostLosses) {
                    mostLosses = stats.losses;
                    biggestLoser = playerName;
                }
                if (stats.mvps > mostMVPs) {
                    mostMVPs = stats.mvps;
                    mvpKing = playerName;
                }
            }
        });

        // Add daily summary at the top
        shareText += `📊 *DAILY SUMMARY*\n`;
        shareText += `🎮 ${matchLogs.length} games played\n`;

        if (biggestWinner && mostWins > 0) {
            const winnerStats = playerStats[biggestWinner];
            const winRate = Math.round((winnerStats.wins / (winnerStats.wins + winnerStats.losses)) * 100);
            shareText += `🔥 *Hot Hand:* ${biggestWinner} (${mostWins}W-${winnerStats.losses}L, ${winRate}%)\n`;
        }

        if (biggestLoser && mostLosses > 0 && biggestLoser !== biggestWinner) {
            const loserStats = playerStats[biggestLoser];
            shareText += `❄️ *Tough Day:* ${biggestLoser} (${loserStats.wins}W-${mostLosses}L)\n`;
        }

        if (mvpKing && mostMVPs > 0) {
            shareText += `👑 *MVP Leader:* ${mvpKing} (${mostMVPs} MVP${mostMVPs !== 1 ? 's' : ''})\n`;
        }

        shareText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Second pass: format each game
        matchLogs.forEach((log, index) => {
            const details = log.details || {};
            const scoreA = parseInt(details.scoreA) || 0;
            const scoreB = parseInt(details.scoreB) || 0;
            const teamAWon = scoreA > scoreB;
            const teamBWon = scoreB > scoreA;

            const teamA = details.teamA || [];
            const teamB = details.teamB || [];

            // Format match time
            const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            const matchTime = logDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            // Game header
            shareText += `*Game ${index + 1}* (${matchTime})\n`;

            // Score line with indicators
            const teamAIndicator = teamAWon ? '🟢' : teamBWon ? '🔴' : '🤝';
            const teamBIndicator = teamBWon ? '🟢' : teamAWon ? '🔴' : '🤝';

            shareText += `Team A ${teamAIndicator} *${scoreA}* - *${scoreB}* Team B ${teamBIndicator}\n\n`;

            // Team A players
            shareText += `🔵 *Team A:*\n`;
            teamA.forEach(player => {
                const playerName = typeof player === 'string' ? player : player.name || 'Player';
                const mvpIndicator = details.mvp === playerName ? ' 👑' : '';
                shareText += `   • ${playerName}${mvpIndicator}\n`;
            });

            shareText += `\n🟠 *Team B:*\n`;
            teamB.forEach(player => {
                const playerName = typeof player === 'string' ? player : player.name || 'Player';
                const mvpIndicator = details.mvp === playerName ? ' 👑' : '';
                shareText += `   • ${playerName}${mvpIndicator}\n`;
            });

            shareText += `\n`;
        });

        return shareText;
    };

    // Function to share daily match logs with native share or fallback to clipboard
    const shareDailyMatchLogs = async (logs, targetDate) => {
        const matchLogs = getMatchLogsFromDate(logs, targetDate);
        const shareText = formatMatchLogsForSharing(matchLogs, targetDate);

        // Check if native sharing is supported
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${currentLeague?.name || 'Basketball'} Matches - ${new Date(targetDate).toLocaleDateString()}`,
                    text: shareText,
                });
                setToastMessage("📱 Matches shared successfully!");
                setTimeout(() => setToastMessage(""), 3000);
            } catch (err) {
                // User cancelled or error occurred
                if (err.name !== 'AbortError') {
                    console.error('Error sharing:', err);
                    // Fallback to clipboard
                    fallbackToCopy(shareText);
                }
            }
        } else {
            // Fallback to clipboard for unsupported browsers
            fallbackToCopy(shareText);
        }
    };

    // Fallback function for clipboard copy
    const fallbackToCopy = (shareText) => {
        navigator.clipboard.writeText(shareText)
            .then(() => {
                setToastMessage("📋 Daily matches copied to clipboard!");
                setTimeout(() => setToastMessage(""), 3000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                setToastMessage("❌ Failed to copy matches");
                setTimeout(() => setToastMessage(""), 3000);
            });
    };

    // If no league is selected, show the LeagueLandingPage
    if (!currentLeagueId) {
        return (
            <div className="bg-gray-900 min-h-screen">
                {/* Update this section to include Squad Sync text */}
                <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
                    <h1 className="text-2xl font-bold text-white">WEEKEND BALLERS</h1>
                    {user && <UserMenu user={user} />}
                </div>

                <div className="p-6">
                    <LeagueLandingPage user={user} onSelectLeague={handleLeagueSelect} />
                </div>
            </div>
        );
    }

    const handleBeltVote = async (beltId, playerName) => {
        if (!user || !currentLeagueId) {
            setToastMessage("You must be signed in to vote for belts");
            setTimeout(() => setToastMessage(""), 3000);
            return;
        }

        try {

            const docRef = doc(db, "leagues", currentLeagueId, "sets", currentSet);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const currentVotes = data.beltVotes || {};

                // Update user's vote with the canonical name
                const updatedVotes = {
                    ...currentVotes,
                    [user.uid]: {
                        ...(currentVotes[user.uid] || {}),
                        [beltId]: playerName
                    }
                };

                // Recalculate belt holders using current holders and new votes
                const updatedBelts = calculateBeltStandings(updatedVotes, currentBelts);

                // Save both votes and belt holders to Firestore
                await firestoreSetDoc(docRef, {
                    ...data,
                    beltVotes: updatedVotes,
                    beltHolders: updatedBelts // Store belt holders separately
                });

                // Update local state
                setBeltVotes(updatedVotes);
                setCurrentBelts(updatedBelts);

                setToastMessage(`Vote for ${beltCategories[beltId].name} recorded!`);
                setTimeout(() => setToastMessage(""), 3000);
            }
        } catch (error) {
            console.error("Error saving belt vote:", error);
            setToastMessage("Error saving vote");
            setTimeout(() => setToastMessage(""), 3000);
        }
    };

    // Otherwise show the team generator app
    return (
        <DarkContainer className="pt-1">
            <div className="mb-2">
                {/* Top navigation bar */}
                <div className="mb-4">
                    {/* League name and user menu */}
                    <div className="flex items-center justify-between py-1.5 mb-2 border-b border-gray-800">
                        {/* Left side: League selector */}
                        <div className="flex items-center">
                            <LeagueSelector
                                currentLeague={currentLeague}
                                userLeagues={userLeagues}
                                onLeagueSelect={handleLeagueSelect}
                                onBackToLeagues={handleBackToLeagues}
                            />
                        </div>

                        {/* Right side: User menu */}
                        <UserMenu
                            user={user}
                            currentLeague={currentLeague}
                            handleBackToLeagues={handleBackToLeagues}
                            showReviewerNames={showReviewerNames}
                            onToggleReviewerVisibility={handleToggleReviewerVisibility}
                            isAdmin={isAdmin}
                            resetLeaderboardData={resetLeaderboardData}
                            db={db}
                            players={players}
                            onPlayerClaimRequest={handlePlayerClaimRequest}
                            minGamesFilter={minGamesFilter}
                            onMinGamesFilterChange={handleMinGamesFilterChange}
                        />
                    </div>
 {user && currentLeague && (
    <PlayerNameMatcher
        user={user}
        players={players}
        currentLeagueId={currentLeagueId}
        db={db}
        onPlayerClaimRequest={handlePlayerClaimRequest}
    />
)} 

 {user && currentLeague && (
    <AdminNotifications
        user={user}
        currentLeague={currentLeague}
        currentLeagueId={currentLeagueId}
        db={db}
    />
                    )}

                    {/* Profile Photo Notification */}
                    {showProfilePhotoNotification && user && currentLeague && (
                        <div className="bg-purple-900 bg-opacity-20 border border-purple-500 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="mr-2 text-purple-400">📸</span>
                                    <div>
                                        <h3 className="text-purple-400 font-medium">
                                            Add Profile Photo
                                        </h3>
                                        <p className="text-sm text-gray-300">
                                            Hey, You're not that ugly. Why not add a profile photo?
                                        </p>
                                    </div>
                                </div>
                                <StyledButton
                                    onClick={() => {
                                        // Find first claim without photo and open modal for it
                                        const userRef = doc(db, "users", user.uid);
                                        getDoc(userRef).then(userDoc => {
                                            if (userDoc.exists()) {
                                                const userData = userDoc.data();
                                                const claimedPlayers = userData.claimedPlayers || [];
                                                const claimWithoutPhoto = claimedPlayers.find(
                                                    claim => claim.leagueId === currentLeagueId &&
                                                        claim.status === 'approved' &&
                                                        !claim.customPhotoURL
                                                );

                                                if (claimWithoutPhoto) {
                                                    handlePlayerClaimRequest(claimWithoutPhoto.playerName);
                                                }
                                            }
                                        });
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-sm px-4 py-2"
                                >
                                    Add Profile Photo
                                </StyledButton>
                            </div>
                        </div>
                    )}

                    {/* Rematch Prompt */}
                    {showRematchPrompt && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                            <div className="bg-gray-800 rounded-lg p-6 w-80 text-center">
                                <h3 className="text-white text-lg mb-4">Play Rematch?</h3>
                                <p className="text-gray-300 mb-6">Would you like to play again with the same teams?</p>
                                <div className="flex justify-center space-x-4">
                                    <button
                                        onClick={handleRematchNo}
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        No, New Teams
                                    </button>
                                    <button
                                        onClick={handleRematchYes}
                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                        Yes, Rematch
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add the ConfirmationModal */}
                    <ConfirmationModal
                        isOpen={showUnsavedModal}
                        onClose={handleCancelTabChange}
                        onConfirm={handleConfirmTabChange}
                        title="Unsaved Match Results"
                        message="You have unsaved match results. Leaving this screen will discard your current matchups. Do you want to continue?"
                        confirmText="Leave Anyway"
                        cancelText="Stay Here"
                        isDestructive={true}
                    />

                    {toastMessage && (
                        <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
                            <div className="bg-gray-800 text-white px-6 py-3 rounded shadow-lg pointer-events-auto">
                                {toastMessage}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tournament Complete Modal */}
                {showTournamentComplete && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">🏆 Tournament Complete!</h3>
                                <button
                                    onClick={() => {
                                        setShowTournamentComplete(false);
                                        setTournamentResults([]);
                                        setWaitingTeam(null);
                                        setIsFirstRound(false);
                                    }}
                                    className="text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {tournamentResults.map((result, index) => {
                                    const teamAName = result.teamA.length === 1 ? result.teamA[0]?.name : `Team ${getTeamName(result.teamA)}`;
                                    const teamBName = result.teamB.length === 1 ? result.teamB[0]?.name : `Team ${getTeamName(result.teamB)}`;
                                    const winnerName = result.winner.length === 1 ? result.winner[0]?.name : `Team ${getTeamName(result.winner)}`;

                                    return (
                                        <div key={index} className="bg-gray-700 rounded-lg p-4">
                                            <div className="text-center mb-3">
                                                <h4 className="text-lg font-semibold text-white">{result.round}</h4>
                                            </div>

                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-center flex-1">
                                                    <div className="text-sm text-gray-300">{teamAName}</div>
                                                    <div className="text-2xl font-bold text-white">{result.scoreA}</div>
                                                </div>

                                                <div className="text-gray-500 font-medium px-4">VS</div>

                                                <div className="text-center flex-1">
                                                    <div className="text-sm text-gray-300">{teamBName}</div>
                                                    <div className="text-2xl font-bold text-white">{result.scoreB}</div>
                                                </div>
                                            </div>

                                            <div className="text-center">
                                                <div className="text-green-400 font-semibold">Winner: {winnerName}</div>
                                                {result.mvp && (
                                                    <div className="text-yellow-400 text-sm mt-1">MVP: {result.mvp} 👑</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 text-center">
                                <div className="text-2xl font-bold text-yellow-400 mb-2">
                                    🏆 Champion: {tournamentResults[tournamentResults.length - 1]?.winner.length === 1
                                        ? tournamentResults[tournamentResults.length - 1]?.winner[0]?.name
                                        : `Team ${getTeamName(tournamentResults[tournamentResults.length - 1]?.winner)}`}
                                </div>
                                <button
                                    onClick={() => {
                                        setShowTournamentComplete(false);
                                        setTournamentResults([]);
                                        setWaitingTeam(null);
                                        setIsFirstRound(false);
                                        // Reset to team selection
                                        setHasGeneratedTeams(false);
                                        setMatchups([]);
                                        setTeams([]);
                                        setScores([]);
                                        setMvpVotes([]);
                                    }}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                >
                                    Start New Tournament
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main content area with bottom padding to prevent content being hidden behind nav */}
                <div className="pb-20">
                    {activeTab === "players" && (
                        <div className="mb-6">
                            <ErrorBoundary>
                                <TeamsTab
                                    players={players}
                                    teams={teams}
                                    setTeams={setTeams}
                                    matchups={matchups}
                                    setMatchups={setMatchups}
                                    mvpVotes={mvpVotes}
                                    setMvpVotes={setMvpVotes}
                                    scores={scores}
                                    setScores={setScores}
                                    teamSize={teamSize}
                                    setTeamSize={setTeamSize}
                                    generateBalancedTeams={generateBalancedTeams}
                                    handlePlayerActiveToggle={handlePlayerActiveToggle}
                                    handleBatchPlayerActiveToggle={handleBatchPlayerActiveToggle}
                                    weightings={weightings}
                                    saveMatchResults={saveMatchResults}
                                    archiveCompletedMatches={archiveCompletedMatches}
                                    hasGeneratedTeams={hasGeneratedTeams}
                                    setHasGeneratedTeams={setHasGeneratedTeams}
                                    isRematch={isRematch}
                                    getPreviousResults={getPreviousResults}
                                    hasPendingMatchups={hasPendingMatchups}
                                    playerOVRs={playerOVRs}
                                    calculatePlayerScore={calculatePlayerScore}
                                    currentBelts={currentBelts}
                                    leaderboard={leaderboard}
                                    matchHistory={matchHistory}
                                    onPlayerClick={openPlayerDetailModal}
                                    currentLeagueId={currentLeagueId}
                                    currentSet={currentSet}
                                    db={db}
                                    user={user}
                                    logActivity={logActivity}
                                    setToastMessage={setToastMessage}
                                    prepareDataForFirestore={prepareDataForFirestore}
                                    setHasPendingMatchups={setHasPendingMatchups}
                                    getUserPlayerPreference={getUserPlayerPreference}
                                    isFirstRound={isFirstRound}
                                    setIsFirstRound={setIsFirstRound}
                                    tournamentResults={tournamentResults}
                                    setTournamentResults={setTournamentResults}
                                    showTournamentComplete={showTournamentComplete}
                                    setShowTournamentComplete={setShowTournamentComplete}
                                    waitingTeam={waitingTeam}
                                    setWaitingTeam={setWaitingTeam}

                                />
                            </ErrorBoundary>
                        </div>
                    )}

                    {activeTab === "rankings" && (
                        <div className="space-y-4">
                            {playersSubTab === "rankings" && (
                                <RankingTab
                                    players={enhancedPlayers}
                                    newRating={newRating}
                                    setNewRating={setNewRating}
                                    handleRatingSubmit={handleRatingSubmit}
                                    handleDeletePlayer={handleDeletePlayer}
                                    openEditModal={openEditModal}
                                    isAdmin={isAdmin}
                                    user={user}
                                    toastMessage={toastMessage}
                                    setToastMessage={setToastMessage}
                                    currentBelts={currentBelts}
                                    leaderboard={leaderboard}
                                    matchHistory={matchHistory}
                                    onPlayerClick={openPlayerDetailModal}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === "leaderboard" && (
                        <LeaderboardTab
                            leaderboard={leaderboard}
                            resetLeaderboardData={resetLeaderboardData}
                            isAdmin={isAdmin}
                            matchHistory={matchHistory}
                            players={players}
                            playerOVRs={playerOVRs}
                            onUpdateLeaderboard={handleManualLeaderboardUpdate}
                            openPlayerDetailModal={openPlayerDetailModal}
                            minGamesFilter={minGamesFilter}
                        />
                    )}
                    {activeTab === "awards" && (
                        <AwardsTab
                            players={players}
                            leaderboard={leaderboard}
                            matchHistory={matchHistory}
                            currentBelts={currentBelts}
                            userVotes={user ? beltVotes[user.uid] || {} : {}}
                            onVote={handleBeltVote}
                            user={user}
                            beltVotes={beltVotes}
                        />
                    )}
                    {activeTab === "logs" && (
                        <LogTab
                            currentLeagueId={currentLeagueId}
                            currentSet={currentSet}
                            isAdmin={isAdmin}
                            db={db}
                            user={user}
                            updatePlayers={setPlayers}
                            setToastMessage={setToastMessage}
                            updateMatchHistory={setMatchHistory}
                            shareDailyMatchLogs={shareDailyMatchLogs}
                        />
                    )}
                </div>

                {editPlayerModalOpen && (
                    <EditPlayerModal
                        player={selectedPlayerToEdit}
                        onSave={saveEditedPlayerFromModal}
                        onClose={closeEditModal}
                        isAdminEdit={isAdminEdit}
                    />
                )}

                {showMatchResultsModal && (
                    <MatchResultsModal
                        isOpen={showMatchResultsModal}
                        onClose={handleCloseMatchResultsModal}
                        matchResults={completedMatchResults}
                        teams={teams}
                    />
                )}
                {showPlayerDetailModal && (
                    <PlayerDetailModal
                        isOpen={showPlayerDetailModal}
                        onClose={() => setShowPlayerDetailModal(false)}
                        player={selectedPlayerForDetail}
                        leaderboard={leaderboard}
                        matchHistory={matchHistory}
                        playerOVRs={playerOVRs}
                        showReviewerNames={showReviewerNames}
                        isAdmin={isAdmin}
                        currentLeagueId={currentLeagueId} 
                        db={db} 
                        user={user}
                    />
                )}
                {/* Player Claim Modal here */}
                <PlayerCardClaimModal
                    isOpen={showPlayerClaimModal}
                    onClose={() => {
                        setShowPlayerClaimModal(false);
                        setSelectedPlayerToClaim(null);
                    }}
                    playerName={selectedPlayerToClaim}
                    user={user}
                    currentLeagueId={currentLeagueId}
                    currentLeague={currentLeague}
                    db={db}
                    onClaimSuccess={() => {
                        // Refresh player data to show updated claim status
                        window.location.reload();

                        // Refresh the profile photo notification
                        checkForMissingProfilePhoto();
                    }}
                />

                {/* Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-10">
                    <div className="flex justify-between items-center px-4 py-3">
                        <div
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => handleTabChange("players")}
                        >
                            <div className={`text-${activeTab === "players" ? "blue-400" : "gray-400"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6.5V19c0 1 1 2 2 2h14c1 0 2-1 2-2V6.5" />
                                    <path d="m7.9 4.8 2.5-1.6a4 4 0 0 1 3.2 0l2.5 1.6" />
                                    <path d="m4.5 10.6 4.8-3" />
                                    <path d="m14.7 7.6 4.8 3" />
                                    <path d="M12 22v-8" />
                                    <path d="M12 14c-1.1 0-2-.9-2-2v-1h4v1c0 1.1-.9 2-2 2z" />
                                </svg>
                            </div>
                            <span className={`text-xs mt-1 text-${activeTab === "players" ? "blue-400" : "gray-400"}`}>
                                Teams
                            </span>
                            {hasPendingMatchups && (
                                <span className="absolute top-2 right-12 h-2 w-2 rounded-full bg-red-500"></span>
                            )}
                        </div>
                        <div
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => handleTabChange("rankings")}
                        >
                            <div className={`text-${activeTab === "rankings" ? "blue-400" : "gray-400"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <span className={`text-xs mt-1 text-${activeTab === "rankings" ? "blue-400" : "gray-400"}`}>
                                Players
                            </span>
                        </div>

                        <div
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => handleTabChange("leaderboard")}
                        >
                            <div className={`text-${activeTab === "leaderboard" ? "blue-400" : "gray-400"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <path d="M12 18v-6"></path>
                                    <path d="M8 18v-1"></path>
                                    <path d="M16 18v-3"></path>
                                </svg>
                            </div>
                            <span className={`text-xs mt-1 text-${activeTab === "leaderboard" ? "blue-400" : "gray-400"}`}>
                                Stats
                            </span>
                        </div>
                        <div
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => handleTabChange("awards")}
                        >
                            <div className={`text-${activeTab === "awards" ? "blue-400" : "gray-400"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
                                </svg>
                            </div>
                            <span className={`text-xs mt-1 text-${activeTab === "awards" ? "blue-400" : "gray-400"}`}>
                                Awards
                            </span>
                        </div>
                        <div
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => handleTabChange("logs")}
                        >
                            <div className={`text-${activeTab === "logs" ? "blue-400" : "gray-400"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                    <path d="M9 12h6"></path>
                                    <path d="M9 16h6"></path>
                                    <path d="M9 8h6"></path>
                                </svg>
                            </div>
                            <span className={`text-xs mt-1 text-${activeTab === "logs" ? "blue-400" : "gray-400"}`}>
                                Logs
                            </span>

                        </div>
                    </div>
                </div>
            </div>

        </DarkContainer>
    );
}