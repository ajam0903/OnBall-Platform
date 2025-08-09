import React, { useState, useEffect } from "react";
import { getFirestore, collection, doc, getDoc, setDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { DarkContainer, StyledButton, StyledInput } from "../components/UIComponents";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import logActivity from "../utils/logActivity";

const db = getFirestore();

export default function LeagueLandingPage({ user, onSelectLeague }) {
    const [leagues, setLeagues] = useState([]);
    const [newLeagueName, setNewLeagueName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [leagueToDelete, setLeagueToDelete] = useState(null);

    // Load user's leagues when component mounts or user changes
    useEffect(() => {
        if (!user) {
            setLeagues([]);
            setIsLoading(false);
            return;
        }

        const fetchUserLeagues = async () => {
            try {
                setIsLoading(true);
                // Get user document
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    // Create user document if it doesn't exist
                    await setDoc(userDocRef, {
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        leagues: [],
                        // NEW: Add player card claiming fields
                        claimedPlayers: [], // Array of { leagueId, playerName, claimedAt, status, height, weight }
                        profile: {
                            height: "", // e.g., "6'2\"" or "188 cm"
                            weight: "", // e.g., "185 lbs" or "84 kg"
                            customPhotoURL: null
                        }
                    });
                    setLeagues([]);
                    setIsLoading(false);
                    return;
                }
                const userData = userDoc.data();
                const userLeagueIds = userData.leagues || [];
                // If user has no leagues, return empty array
                if (userLeagueIds.length === 0) {
                    setLeagues([]);
                    setIsLoading(false);
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
                setLeagues(leagueDetails.filter(league => league !== null));
                // Auto-select the last used league if available
                const lastUsedLeagueId = localStorage.getItem("lastUsedLeagueId");
                if (lastUsedLeagueId && leagueDetails.some(league => league?.id === lastUsedLeagueId)) {
                    onSelectLeague(lastUsedLeagueId);
                }
            } catch (error) {
                console.error("Error fetching leagues:", error);
                setErrorMessage("Failed to load your leagues. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserLeagues();
    }, [user, onSelectLeague]);

    const handleCreateLeague = async () => {
        if (!user) {
            setErrorMessage("You must be logged in to create a league");
            return;
        }

        if (!newLeagueName.trim()) {
            setErrorMessage("Please enter a league name");
            return;
        }

        try {
            setIsLoading(true);

            // Generate a unique invite code (6 characters, alphanumeric)
            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            // Create a new league document
            const leaguesCollectionRef = collection(db, "leagues");
            const newLeagueRef = doc(leaguesCollectionRef);

            await setDoc(newLeagueRef, {
                name: newLeagueName.trim(),
                inviteCode: inviteCode,
                createdAt: new Date(),
                createdBy: user.uid,
                members: [user.uid],
                admins: [user.uid]
            });

            // Add league to user's leagues
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const updatedLeagues = [...(userData.leagues || []), newLeagueRef.id];

                await setDoc(userDocRef, {
                    ...userData,
                    leagues: updatedLeagues
                });

                // Create default set for this league
                const defaultSetDocRef = doc(db, "leagues", newLeagueRef.id, "sets", "default");
                await setDoc(defaultSetDocRef, {
                    players: [],
                    teams: [],
                    matchups: [],
                    scores: [],
                    mvpVotes: [],
                    leaderboard: {},
                    matchHistory: []
                });

                // Update leagues state
                const newLeague = {
                    id: newLeagueRef.id,
                    name: newLeagueName.trim(),
                    inviteCode: inviteCode
                };

                setLeagues([...leagues, newLeague]);
                setNewLeagueName("");
                setSuccessMessage("League created successfully!");

                // Auto-select the new league
                onSelectLeague(newLeagueRef.id);
                localStorage.setItem("lastUsedLeagueId", newLeagueRef.id);
            }
        } catch (error) {
            console.error("Error creating league:", error);
            setErrorMessage("Failed to create league. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinLeague = async () => {
        if (!user) {
            setErrorMessage("You must be logged in to join a league");
            return;
        }

        if (!joinCode.trim()) {
            setErrorMessage("Please enter an invite code");
            return;
        }

        try {
            setIsLoading(true);

            // Find league with matching invite code
            const leaguesCollectionRef = collection(db, "leagues");
            const leagueQuery = query(leaguesCollectionRef, where("inviteCode", "==", joinCode.trim().toUpperCase()));
            const querySnapshot = await getDocs(leagueQuery);

            if (querySnapshot.empty) {
                setErrorMessage("Invalid invite code. Please check and try again.");
                return;
            }

            const leagueDoc = querySnapshot.docs[0];
            const leagueData = leagueDoc.data();
            const leagueId = leagueDoc.id;

            // Check if user is already a member
            if (leagueData.members.includes(user.uid)) {
                setErrorMessage("You are already a member of this league");
                return;
            }

            // Add user to league members
            await setDoc(doc(db, "leagues", leagueId), {
                ...leagueData,
                members: [...leagueData.members, user.uid]
            });

            // Add league to user's leagues
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userLeagues = userData.leagues || [];

                // Check if league is already in user's leagues
                if (!userLeagues.includes(leagueId)) {
                    const updatedLeagues = [...userLeagues, leagueId];

                    await setDoc(userDocRef, {
                        ...userData,
                        leagues: updatedLeagues
                    });
                }

                // Update leagues state
                const newLeague = {
                    id: leagueId,
                    name: leagueData.name,
                    inviteCode: leagueData.inviteCode
                };

                setLeagues([...leagues, newLeague]);
                setJoinCode("");
                setSuccessMessage("Successfully joined the league!");
                await logActivity(
                    db,
                    leagueId,
                    "user_joined_league",
                    {
                        userId: user.uid,
                        userName: user.displayName || user.email,
                        leagueName: leagueData.name,
                        inviteCode: leagueData.inviteCode
                    },
                    user,
                    false // Not undoable
                );
                // Auto-select the joined league
                onSelectLeague(leagueId);
                localStorage.setItem("lastUsedLeagueId", leagueId);
            }
        } catch (error) {
            console.error("Error joining league:", error);
            setErrorMessage("Failed to join league. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectLeague = (leagueId) => {
        onSelectLeague(leagueId);
        localStorage.setItem("lastUsedLeagueId", leagueId);
    };

    const handleDeleteLeague = async (leagueId, leagueName, isCreator) => {
        try {
            setIsLoading(true);

            if (isCreator) {
                // If user is the creator, delete the entire league
                await deleteDoc(doc(db, "leagues", leagueId));
                await logActivity(
                    db,
                    leagueId,
                    "league_deleted",
                    {
                        leagueName: leagueName,
                        deletedBy: user.displayName || user.email
                    },
                    user,
                    false
                );
            } else {
                // If user is not the creator, just remove them from the league
                const leagueRef = doc(db, "leagues", leagueId);
                const leagueDoc = await getDoc(leagueRef);

                if (leagueDoc.exists()) {
                    const leagueData = leagueDoc.data();
                    const updatedMembers = leagueData.members.filter(memberId => memberId !== user.uid);
                    const updatedAdmins = leagueData.admins?.filter(adminId => adminId !== user.uid) || [];

                    await setDoc(leagueRef, {
                        ...leagueData,
                        members: updatedMembers,
                        admins: updatedAdmins
                    });
                }
            }

            // Remove league from user's leagues
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const updatedLeagues = userData.leagues.filter(id => id !== leagueId);

                await setDoc(userDocRef, {
                    ...userData,
                    leagues: updatedLeagues
                });
            }

            // Update local state
            setLeagues(leagues.filter(league => league.id !== leagueId));

            // Clear last used league if it was this one
            if (localStorage.getItem("lastUsedLeagueId") === leagueId) {
                localStorage.removeItem("lastUsedLeagueId");
            }

            setSuccessMessage(isCreator ? "League deleted successfully!" : "Left league successfully!");
            setShowDeleteModal(false);
            setLeagueToDelete(null);

        } catch (error) {
            console.error("Error deleting/leaving league:", error);
            setErrorMessage("Failed to " + (isCreator ? "delete" : "leave") + " league. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DarkContainer className="bg-gray-900">

            {successMessage && (
                <div className="bg-green-800 text-green-100 p-4 rounded mb-6">
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="bg-red-800 text-red-100 p-4 rounded mb-6">
                    {errorMessage}
                </div>
            )}

            {/* Sign In Prompt for Unauthenticated Users */}
            {!user && (
                <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-4">Welcome to RecBall</h2>

                        <button
                            onClick={() => {
                                const provider = new GoogleAuthProvider();
                                // ADD THESE LINES:
                                provider.setCustomParameters({
                                    prompt: 'select_account'
                                });

                                signInWithPopup(auth, provider).catch((error) => {
                                    console.error("Login failed:", error);
                                    setErrorMessage("Failed to sign in. Please try again.");

                                    // ADD THIS: Clear any corrupted auth state
                                    try {
                                        sessionStorage.clear();
                                        localStorage.removeItem("lastUsedLeagueId");
                                    } catch (e) {
                                        console.warn('Could not clear storage:', e);
                                    }
                                });
                            }}
                            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center mx-auto"
                        >
                            Sign In to Create or Join League
                        </button>
                    </div>
                </div>
            )}

            {user && leagues.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">Your Leagues</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {leagues.map((league) => (
                            <div key={league.id} className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition">
                                <div
                                    className="cursor-pointer"
                                    onClick={() => handleSelectLeague(league.id)}
                                >
                                    <h3 className="text-lg font-medium text-white">{league.name}</h3>
                                    <div className="text-sm text-gray-400 mt-2">
                                        Invite Code: <span className="text-gray-300">{league.inviteCode}</span>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLeagueToDelete({
                                                id: league.id,
                                                name: league.name,
                                                isCreator: league.createdBy === user?.uid
                                            });
                                            setShowDeleteModal(true);
                                        }}
                                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        {league.createdBy === user?.uid ? "Delete League" : "Leave League"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Existing Create/Join League Sections - Only show when authenticated */}
            {user && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Create League Section */}
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <h2 className="text-xl font-semibold text-white mb-4">Create New League</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-300 mb-2">League Name</label>
                                <StyledInput
                                    type="text"
                                    value={newLeagueName}
                                    onChange={(e) => setNewLeagueName(e.target.value)}
                                    placeholder="Enter league name"
                                    disabled={!user || isLoading}
                                />
                            </div>
                            <StyledButton
                                onClick={handleCreateLeague}
                                className={`w-full ${!user ? 'bg-gray-600' : 'bg-blue-600'}`}
                                disabled={!user || isLoading}
                            >
                                {isLoading ? "Creating..." : "Create League"}
                            </StyledButton>
                        </div>
                    </div>

                    {/* Join League Section */}
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <h2 className="text-xl font-semibold text-white mb-4">Join League</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-300 mb-2">Invite Code</label>
                                <StyledInput
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    placeholder="Enter invite code"
                                    disabled={!user || isLoading}
                                />
                            </div>
                            <StyledButton
                                onClick={handleJoinLeague}
                                className={`w-full ${!user ? 'bg-gray-600' : 'bg-green-600'}`}
                                disabled={!user || isLoading}
                            >
                                {isLoading ? "Joining..." : "Join League"}
                            </StyledButton>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete/Leave League Confirmation Modal */}
            {showDeleteModal && leagueToDelete && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-white mb-4">
                            {leagueToDelete.isCreator ? "Delete League" : "Leave League"}
                        </h3>
                        <p className="text-gray-300 mb-4">
                            {leagueToDelete.isCreator
                                ? `Are you sure you want to delete "${leagueToDelete.name}"? This will permanently remove the league and all its data for all members.`
                                : `Are you sure you want to leave "${leagueToDelete.name}"? You'll need an invite code to rejoin.`
                            }
                        </p>
                        <p className="text-yellow-400 text-sm mb-6">
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setLeagueToDelete(null);
                                }}
                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteLeague(leagueToDelete.id, leagueToDelete.name, leagueToDelete.isCreator)}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                disabled={isLoading}
                            >
                                {isLoading ? "Processing..." : (leagueToDelete.isCreator ? "Delete League" : "Leave League")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DarkContainer>
    );
}