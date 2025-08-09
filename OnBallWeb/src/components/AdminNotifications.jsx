import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { StyledButton } from "./UIComponents";

export default function AdminNotifications({
    user,
    currentLeague,
    currentLeagueId,
    db
}) {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const isAdmin = currentLeague && (
        currentLeague.createdBy === user?.uid ||
        (currentLeague.admins && currentLeague.admins.includes(user?.uid))
    );

    useEffect(() => {
        if (!isAdmin || !currentLeagueId) return;

        const notificationsRef = collection(db, "leagues", currentLeagueId, "notifications");
        const q = query(
            notificationsRef,
            where("type", "==", "player_claim_request"),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notificationsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNotifications(notificationsList);
        });

        return () => unsubscribe();
    }, [isAdmin, currentLeagueId, db]);

    const handleApproveReject = async (notificationId, newStatus, claimedByUid) => {
        setIsLoading(true);
        try {
            // Get the notification data first
            const notification = notifications.find(n => n.id === notificationId);
            if (!notification) {
                throw new Error("Notification not found");
            }

            // Update the notification
            const notificationRef = doc(db, "leagues", currentLeagueId, "notifications", notificationId);
            await updateDoc(notificationRef, {
                status: newStatus,
                reviewedAt: new Date().toISOString(),
                reviewedBy: user.uid
            });

            // Update the user's claimed player status
            const userRef = doc(db, "users", claimedByUid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                const updatedClaimedPlayers = claimedPlayers.map(claim => {
                    if (claim.leagueId === currentLeagueId &&
                        claim.playerName === notification.playerName) {
                        return { ...claim, status: newStatus }; // This was the missing piece
                    }
                    return claim;
                });

                await updateDoc(userRef, { // Use updateDoc instead of setDoc
                    claimedPlayers: updatedClaimedPlayers
                });
            }

            // Remove notification from pending list locally
            setNotifications(prev => prev.filter(n => n.id !== notificationId));

        } catch (error) {
            console.error("Error updating claim status:", error);
            alert("Failed to update claim status. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAdmin || notifications.length === 0) {
        return null;
    }

    return (
        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium text-yellow-400 mb-3 flex items-center">
                <span className="mr-2">⚠️</span>
                Player Claim Requests ({notifications.length})
            </h3>

            <div className="space-y-3">
                {notifications.map((notification) => (
                    <div key={notification.id} className="bg-gray-800 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="text-white font-medium">
                                    {notification.claimedByName} wants to claim "{notification.playerName}"
                                </div>
                                <div className="text-sm text-gray-300 mt-1">
                                    Email: {notification.claimedByEmail}
                                </div>
                                {notification.height && (
                                    <div className="text-sm text-gray-300">
                                        Height: {notification.height}
                                    </div>
                                )}
                                {notification.weight && (
                                    <div className="text-sm text-gray-300">
                                        Weight: {notification.weight}
                                    </div>
                                )}
                                {notification.customPhotoURL && (
                                    <div className="text-sm text-gray-300">
                                        Photo: <a href={notification.customPhotoURL} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View</a>
                                    </div>
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                    Requested: {new Date(notification.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex space-x-2 ml-4">
                                <StyledButton
                                    onClick={() => handleApproveReject(notification.id, 'approved', notification.claimedBy)}
                                    disabled={isLoading}
                                    className="bg-green-600 hover:bg-green-700 text-xs px-3 py-1"
                                >
                                    Approve
                                </StyledButton>
                                <StyledButton
                                    onClick={() => handleApproveReject(notification.id, 'rejected', notification.claimedBy)}
                                    disabled={isLoading}
                                    className="bg-red-600 hover:bg-red-700 text-xs px-3 py-1"
                                >
                                    Reject
                                </StyledButton>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}