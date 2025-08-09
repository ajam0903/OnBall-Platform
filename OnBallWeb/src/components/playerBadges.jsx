import React from "react";
import { BadgeCollection } from "./Badge";  // Updated import
import { getPlayerBadges } from "./badgeSystem.jsx";

export default function PlayerBadges({
    playerName,
    leaderboard = {},
    matchHistory = [],
    size = "normal",
    maxDisplay = 3
}) {
    const badges = getPlayerBadges(playerName, leaderboard, matchHistory);

    return (
        <BadgeCollection
            badges={badges}
            maxDisplay={maxDisplay}
            size={size}
        />
    );
}