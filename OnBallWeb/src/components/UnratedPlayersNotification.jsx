import React from "react";
import { StyledButton } from "./UIComponents";

export default function UnratedPlayersNotification({
    user,
    players,
    onStartRating
}) {
    // Calculate unrated players for current user
    const unratedPlayers = players.filter(player => {
        const userSubmission = player.submissions?.find(s => s.submittedBy === user?.email);
        return !userSubmission;
    });

    // Don't show notification if all players are rated
    if (unratedPlayers.length === 0) {
        return null;
    }

    return (
        <div className="bg-blue-900 bg-opacity-20 border border-blue-500 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <span className="mr-2 text-blue-400">⭐</span>
                    <div>
                        <h3 className="text-blue-400 font-medium">
                            Rate Players
                        </h3>
                        <p className="text-sm text-gray-300">
                            You have {unratedPlayers.length} player{unratedPlayers.length !== 1 ? 's' : ''} left to rate
                        </p>
                    </div>
                </div>
                <StyledButton
                    onClick={onStartRating}
                    className="bg-blue-600 hover:bg-blue-700 text-sm px-4 py-2"
                >
                    Start Rating
                </StyledButton>
            </div>
        </div>
    );
}