import React, { useState, useEffect } from "react";
import { StyledButton } from "./UIComponents";
import { doc, getDoc } from "firebase/firestore";
export default function PlayerNameMatcher({
    user,
    players,
    currentLeagueId,
    db,
    onPlayerClaimRequest
}) {
    const [matchingPlayers, setMatchingPlayers] = useState([]);
    const [showNotification, setShowNotification] = useState(false);

    useEffect(() => {
        if (user && players && players.length > 0 && db && currentLeagueId) {
            findMatchingPlayers();
        }
    }, [user, players, db, currentLeagueId]);

    const findMatchingPlayers = async () => {
        if (!user?.displayName || !db) return;

        const userName = user.displayName.toLowerCase();
        const userEmail = user.email.toLowerCase();

        // Check if user has any approved claims for this league
        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                // Check if user has any approved claims in this league
                const hasApprovedClaim = claimedPlayers.some(
                    claim => claim.leagueId === currentLeagueId && claim.status === 'approved'
                );

                // If user already has an approved claim, don't show the matcher
                if (hasApprovedClaim) return;
            }
        } catch (error) {
            console.error("Error checking user claims:", error);
        }

        const matches = players.filter(player => {
            const playerName = player.name.toLowerCase();

            // Check for exact match or close matches
            return (
                playerName === userName ||
                playerName.includes(userName) ||
                userName.includes(playerName) ||
                playerName === userEmail.split('@')[0] ||
                // Check if first name matches
                userName.split(' ')[0] === playerName.split(' ')[0]
            );
        }).filter(player => !player.isCardClaimed); // Only show unclaimed players

        if (matches.length > 0) {
            setMatchingPlayers(matches);
            setShowNotification(true);
        }
    };

    const handleClaimPlayer = (playerName) => {
        onPlayerClaimRequest(playerName);
        setShowNotification(false);
    };

    const handleDismiss = () => {
        setShowNotification(false);
        // Store in localStorage to not show again for this session
        localStorage.setItem(`dismissed_matches_${currentLeagueId}`, 'true');
    };

    // Don't show if already dismissed this session
    if (localStorage.getItem(`dismissed_matches_${currentLeagueId}`) === 'true') {
        return null;
    }

    if (!showNotification || matchingPlayers.length === 0) {
        return null;
    }

    return (
        <div className="bg-blue-900 bg-opacity-20 border border-blue-500 rounded-lg p-4 mb-4">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <span className="text-blue-400 text-xl">🏀</span>
                </div>
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-400">
                        Potential Player Match Found!
                    </h3>
                    <div className="mt-2 text-sm text-gray-300">
                        {matchingPlayers.length === 1 ? (
                            <>
                                We found a player named <strong>{matchingPlayers[0].name}</strong> that might be you.
                                Would you like to claim this player profile?
                            </>
                        ) : (
                            <>
                                We found {matchingPlayers.length} players that might match your name.
                                Would you like to claim any of these profiles?
                            </>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {matchingPlayers.map((player, index) => (
                            <StyledButton
                                key={index}
                                onClick={() => handleClaimPlayer(player.name)}
                                className="text-xs px-3 py-1"
                            >
                                Claim "{player.name}"
                            </StyledButton>
                        ))}
                        <button
                            onClick={handleDismiss}
                            className="text-xs px-3 py-1 text-gray-400 hover:text-gray-300 underline"
                        >
                            Not me, dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}