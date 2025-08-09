// UserMenu.jsx
import React, { useState, useRef, useEffect } from "react";
import AdminNotifications from './AdminNotifications';
import { signOut } from "firebase/auth";
import { auth } from "@shared/firebase/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";

export default function UserMenu({
    user,
    currentLeague,
    handleBackToLeagues,
    showReviewerNames = false,
    onToggleReviewerVisibility,
    isAdmin = false,
    resetLeaderboardData,
    db,
    players = [],
    onPlayerClaimRequest,
    minGamesFilter,
    onMinGamesFilterChange,
    recalculateLeaderboardFromHistory,
    migrateBeltVotes,
}) {
    const currentLeagueId = currentLeague?.id;
    const [isOpen, setIsOpen] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [showUserManagement, setShowUserManagement] = useState(false);
    const [leagueUsers, setLeagueUsers] = useState([]);
    const [showAdminNotifications, setShowAdminNotifications] = useState(false);
    const menuRef = useRef(null);
    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };
    const copyInviteCodeToClipboard = (e) => {
        e.stopPropagation();
        if (currentLeague?.inviteCode) {
            navigator.clipboard.writeText(currentLeague.inviteCode)
                .then(() => {
                    alert("Invite code copied to clipboard!");
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                });
        }
    };

    const handleLogout = (e) => {
        e.stopPropagation();
        // Clear stored league data before signing out
        localStorage.removeItem("lastUsedLeagueId");
        signOut(auth);
    };

    const handlePermissionToggle = async (userId, permissionType) => {
        if (!currentLeague || !db) return;

        try {
            const leagueRef = doc(db, "leagues", currentLeague.id);
            const leagueDoc = await getDoc(leagueRef);

            if (leagueDoc.exists()) {
                const leagueData = leagueDoc.data();
                const currentPermissions = leagueData.userPermissions || {};
                const userPermissions = currentPermissions[userId] || {
                    canCreateGames: true,
                    canRatePlayers: true,
                    canVoteForBelts: true,
                    isAdmin: false
                };

                // Toggle the specific permission
                const updatedUserPermissions = {
                    ...userPermissions,
                    [permissionType]: !userPermissions[permissionType]
                };

                // Handle admin permission specially
                if (permissionType === 'isAdmin') {
                    const currentAdmins = leagueData.admins || [];
                    let updatedAdmins;

                    if (updatedUserPermissions.isAdmin) {
                        // Add to admins if not already there
                        updatedAdmins = currentAdmins.includes(userId)
                            ? currentAdmins
                            : [...currentAdmins, userId];
                    } else {
                        // Remove from admins
                        updatedAdmins = currentAdmins.filter(adminId => adminId !== userId);
                    }

                    await setDoc(leagueRef, {
                        ...leagueData,
                        admins: updatedAdmins,
                        userPermissions: {
                            ...currentPermissions,
                            [userId]: updatedUserPermissions
                        }
                    });
                } else {
                    // Update non-admin permissions
                    await setDoc(leagueRef, {
                        ...leagueData,
                        userPermissions: {
                            ...currentPermissions,
                            [userId]: updatedUserPermissions
                        }
                    });
                }

                // Update local state
                setLeagueUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.uid === userId
                            ? { ...user, permissions: updatedUserPermissions }
                            : user
                    )
                );

                // Log the permission change
                const targetUser = leagueUsers.find(u => u.uid === userId);
                const permissionName = permissionType.replace(/([A-Z])/g, ' $1').toLowerCase();

                console.log(`Permission ${permissionName} for ${targetUser?.displayName} set to ${updatedUserPermissions[permissionType]}`);
            }
        } catch (error) {
            console.error("Error updating user permissions:", error);
        }
    };

    const handleMinGamesFilterChange = async (newValue) => {
        if (!currentLeague?.id || !isAdmin) return;

        try {
            const leagueRef = doc(db, "leagues", currentLeague.id);
            const leagueDoc = await getDoc(leagueRef);

            if (leagueDoc.exists()) {
                const leagueData = leagueDoc.data();

                await setDoc(leagueRef, {
                    ...leagueData,
                    preferences: {
                        ...leagueData.preferences,
                        minGamesFilter: newValue
                    }
                });

                onMinGamesFilterChange(newValue);
            }
        } catch (error) {
            console.error("Error updating min games filter:", error);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Fetch league users when user management is opened
    useEffect(() => {
        if (showUserManagement && currentLeague && db) {
            const fetchLeagueUsers = async () => {
                try {
                    const leagueRef = doc(db, "leagues", currentLeague.id);
                    const leagueDoc = await getDoc(leagueRef);

                    if (leagueDoc.exists()) {
                        const leagueData = leagueDoc.data();
                        const memberIds = leagueData.members || [];

                        // Fetch user details for each member
                        const userPromises = memberIds.map(async (memberId) => {
                            try {
                                const userRef = doc(db, "users", memberId);
                                const userDoc = await getDoc(userRef);

                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    return {
                                        uid: memberId,
                                        displayName: userData.displayName || userData.email,
                                        email: userData.email,
                                        permissions: leagueData.userPermissions?.[memberId] || {
                                            canCreateGames: true,
                                            canRatePlayers: true,
                                            canVoteForBelts: true,
                                            isAdmin: leagueData.admins?.includes(memberId) || false
                                        }
                                    };
                                }
                                return {
                                    uid: memberId,
                                    displayName: "Unknown User",
                                    email: "",
                                    permissions: {
                                        canCreateGames: true,
                                        canRatePlayers: true,
                                        canVoteForBelts: true,
                                        isAdmin: false
                                    }
                                };
                            } catch (error) {
                                console.error("Error fetching user:", error);
                                return null;
                            }
                        });

                        const users = await Promise.all(userPromises);
                        setLeagueUsers(users.filter(user => user !== null));
                    }
                } catch (error) {
                    console.error("Error fetching league users:", error);
                }
            };

            fetchLeagueUsers();
        }
    }, [showUserManagement, currentLeague, db]);

    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            {/* Menu Button */}
            <button
                onClick={toggleMenu}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
                aria-label="User menu"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16m-7 6h7"
                    />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-1 w-60 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
                    <div className="py-1.5 px-2 border-b border-gray-700">
                        <p className="text-gray-200 font-medium truncate text-sm">{user.displayName}</p>
                        <p className="text-gray-400 text-xs truncate">{user.email}</p>
                    </div>

                    {currentLeague && (
                        <div className="py-1.5 px-2 border-b border-gray-700">
                            <p className="text-gray-300 text-xs font-medium">Current League</p>
                            <div className="flex items-center justify-between">
                                <p className="text-white text-sm">{currentLeague.name}</p>
                                <div className="flex items-center">
                                    <span className="text-gray-400 text-xs mr-1 truncate">
                                        {currentLeague.inviteCode}
                                    </span>
                                    <button
                                        onClick={copyInviteCodeToClipboard}
                                        className="text-blue-400 hover:text-blue-300"
                                        title="Copy invite code"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-3.5 w-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preferences Section - Only for Admins */}

                    {isAdmin && (
                        <>
                            <div className="py-0.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowPreferences(!showPreferences);
                                    }}
                                    className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-700 rounded flex items-center justify-between text-xs"
                                >
                                    <div className="flex items-center">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-3.5 w-3.5 mr-1.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                        </svg>
                                        Preferences
                                    </div>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-3 w-3 transform transition-transform ${showPreferences ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Preferences Submenu */}
                                {showPreferences && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-700 mb-2">
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleReviewerVisibility();
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-600 rounded text-xs flex items-center justify-between"
                                        >
                                            <span>Show Reviewer Names</span>
                                            <div className={`w-8 h-4 rounded-full transition-colors ${showReviewerNames ? 'bg-blue-600' : 'bg-gray-600'
                                                }`}>
                                                <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${showReviewerNames ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`} />
                                            </div>
                                        </button>
                                        <div className="px-2 py-1 text-xs text-gray-500">
                                            When enabled, reviewers' names are visible to admins in player reviews
                                        </div>

                                        {/* Minimum Games Filter */}
                                        <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-700 mb-2 mt-3">
                                        </div>
                                        <div className="px-2 py-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-300 text-xs">Stats Tab Min Games</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={minGamesFilter || 0}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        handleMinGamesFilterChange(value);
                                                    }}
                                                    className="w-12 h-6 px-1 text-xs bg-gray-700 border border-gray-600 rounded text-white text-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Only show players in Stats tab with at least this many games played
                                            </div>
                                        </div>

                                        {/* User Management Section */}
                                        <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-700 mb-2 mt-3">
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowUserManagement(true);
                                                setIsOpen(false); // Close the main menu
                                            }}
                                            className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-600 rounded text-xs flex items-center justify-between"
                                        >
                                            <div className="flex items-center">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-3.5 w-3.5 mr-1.5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.239"
                                                    />
                                                </svg>
                                                Manage User Permissions
                                            </div>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-3 w-3"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        {/* Admin Notifications Modal */}
                                        {showAdminNotifications && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                                                <div className="bg-gray-800 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-lg font-bold text-white">
                                                            Admin Notifications
                                                        </h3>
                                                        <button
                                                            onClick={() => setShowAdminNotifications(false)}
                                                            className="text-gray-400 hover:text-white"
                                                        >
                                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    <div className="bg-gray-700 p-4 rounded mb-4">
                                                        <h4 className="text-white mb-3">All Notifications</h4>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    // Find your user document and update the claim status
                                                                    const userRef = doc(db, "users", user.uid);
                                                                    const userDoc = await getDoc(userRef);

                                                                    if (userDoc.exists()) {
                                                                        const userData = userDoc.data();
                                                                        const claimedPlayers = userData.claimedPlayers || [];

                                                                        const updatedClaimedPlayers = claimedPlayers.map(claim => {
                                                                            if (claim.leagueId === currentLeague.id &&
                                                                                claim.playerName === "Ali Jamali") {
                                                                                return { ...claim, status: 'approved' };
                                                                            }
                                                                            return claim;
                                                                        });

                                                                        await setDoc(userRef, {
                                                                            ...userData,
                                                                            claimedPlayers: updatedClaimedPlayers
                                                                        });

                                                                        console.log("Updated claim status to approved");
                                                                    }
                                                                } catch (error) {
                                                                    console.error("Error updating claim:", error);
                                                                }
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                                                        >
                                                            Fix My Claim Status
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                console.log("Checking notifications...");
                                                                try {
                                                                    const notificationsRef = collection(db, "leagues", currentLeague.id, "notifications");
                                                                    const snapshot = await getDocs(notificationsRef);

                                                                    const allNotifications = [];
                                                                    snapshot.forEach(doc => {
                                                                        allNotifications.push({
                                                                            id: doc.id,
                                                                            ...doc.data()
                                                                        });
                                                                    });

                                                                    // Display notifications in the UI
                                                                    const notificationsList = document.getElementById('notifications-list');
                                                                    if (notificationsList) {
                                                                        notificationsList.innerHTML = allNotifications.map(notification => `
                        <div class="bg-gray-600 p-3 rounded mb-2">
                            <div class="text-white font-medium">${notification.claimedByName} → ${notification.playerName}</div>
                            <div class="text-sm text-gray-300">Status: ${notification.status}</div>
                            <div class="text-xs text-gray-400">Created: ${new Date(notification.createdAt).toLocaleDateString()}</div>
                        </div>
                    `).join('');
                                                                    }

                                                                } catch (error) {
                                                                    console.error("Database error:", error);
                                                                }
                                                            }}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-3"
                                                        >
                                                            Load All Notifications
                                                        </button>

                                                        <div id="notifications-list" className="space-y-2">
                                                            <div className="text-gray-400 text-sm">Click "Load All Notifications" to see the list</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/* Add a separator and new section for dangerous actions */}
                                        <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-700 mb-2 mt-3">
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (resetLeaderboardData) {
                                                    resetLeaderboardData();
                                                }
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-2 py-1 text-red-300 hover:bg-red-900/20 rounded text-xs flex items-center"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-3.5 w-3.5 mr-1.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                            Reset All Stats
                                        </button>
                                        <div className="px-2 py-1 text-xs text-gray-500">
                                            Permanently delete all match history and player statistics
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-gray-700 my-1"></div>
                        </>
                    )}

                    {/* Navigation Section */}
                    <div className="py-0.5">
                        {currentLeague && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleBackToLeagues();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-700 rounded flex items-center text-xs"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5 mr-1.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 17l-5-5m0 0l5-5m-5 5h12"
                                    />
                                </svg>
                                Back to Leagues
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-700 rounded flex items-center text-xs"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 mr-1.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                            </svg>
                            Log out
                        </button>
                    </div>
                </div>
            )}
            {/* User Permissions Modal */}
            {showUserManagement && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm max-h-[85vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">User Permissions</h2>
                            <button
                                onClick={() => setShowUserManagement(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-4 py-2 bg-gray-700/50 border-b border-gray-700">
                            <p className="text-sm text-gray-300">
                                <span className="font-medium">{leagueUsers.length}</span> member{leagueUsers.length !== 1 ? 's' : ''} in this league
                            </p>
                        </div>
                        {/* Modal Content */}
                        <div className="overflow-y-auto max-h-[70vh]">
                            {leagueUsers.length === 0 ? (
                                <div className="text-center text-gray-400 py-8 px-4">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-8 w-8 mx-auto mb-3 text-gray-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                    </svg>
                                    <p className="text-sm">Loading users...</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {leagueUsers.map((leagueUser, index) => (
                                        <div
                                            key={leagueUser.uid}
                                            className={`p-3 border-b border-gray-700 last:border-b-0 ${index % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-900/50'
                                                }`}
                                        >
                                            {/* User Info */}
                                            <div className="flex items-center mb-3">
                                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                                                    <span className="text-white text-xs font-medium">
                                                        {(leagueUser.displayName || leagueUser.email || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-white text-sm font-medium truncate">
                                                        {leagueUser.displayName || 'Unknown User'}
                                                    </div>
                                                    <div className="text-gray-400 text-xs truncate">
                                                        {leagueUser.email}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Permissions Grid */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {/* Create Games */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">Create Games</span>
                                                    <button
                                                        onClick={() => handlePermissionToggle(leagueUser.uid, 'canCreateGames')}
                                                        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${leagueUser.permissions?.canCreateGames ? 'bg-green-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${leagueUser.permissions?.canCreateGames ? 'translate-x-4' : 'translate-x-0.5'
                                                            }`} />
                                                    </button>
                                                </div>

                                                {/* Rate Players */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">Rate Players</span>
                                                    <button
                                                        onClick={() => handlePermissionToggle(leagueUser.uid, 'canRatePlayers')}
                                                        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${leagueUser.permissions?.canRatePlayers ? 'bg-green-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${leagueUser.permissions?.canRatePlayers ? 'translate-x-4' : 'translate-x-0.5'
                                                            }`} />
                                                    </button>
                                                </div>

                                                {/* Vote for Belts */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">Vote Belts</span>
                                                    <button
                                                        onClick={() => handlePermissionToggle(leagueUser.uid, 'canVoteForBelts')}
                                                        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${leagueUser.permissions?.canVoteForBelts ? 'bg-green-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${leagueUser.permissions?.canVoteForBelts ? 'translate-x-4' : 'translate-x-0.5'
                                                            }`} />
                                                    </button>
                                                </div>

                                                {/* Full Admin */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">Full Admin</span>
                                                    <button
                                                        onClick={() => handlePermissionToggle(leagueUser.uid, 'isAdmin')}
                                                        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${leagueUser.permissions?.isAdmin ? 'bg-red-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${leagueUser.permissions?.isAdmin ? 'translate-x-4' : 'translate-x-0.5'
                                                            }`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Modal Footer */}
                        <div className="flex justify-end p-4 border-t border-gray-700">
                            <button
                                onClick={() => setShowUserManagement(false)}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}