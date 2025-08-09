// AwardsTab.jsx
import React, { useState } from "react";
import { badgeCategories } from "./badgeSystem.jsx";
import { getPlayerBadges } from "./badgeSystem.jsx";
import BeltsTab from "./BeltsTab";
import Badge from './Badge';
import { WinsBadgeIcon, VetBadgeIcon, MVPBadgeIcon, WinStreakBadgeIcon } from "./BadgeIcons";

const renderCategoryIcon = (categoryId, size = 24, tier = "gold") => {
    const iconComponents = {
        gamesPlayed: VetBadgeIcon,
        wins: WinsBadgeIcon,
        mvps: MVPBadgeIcon,
        winStreaks: WinStreakBadgeIcon
    };

    const IconComponent = iconComponents[categoryId];

    if (!IconComponent) {
        return <span className="text-lg">🏅</span>;
    }

    return <IconComponent tier={tier} size={size} />;
};

export default function AwardsTab({
    players = [],
    leaderboard = {},
    matchHistory = [],
    currentBelts = {},
    userVotes = {},
    onVote,
    user,
    beltVotes = {}
}) {
    const [activeSubTab, setActiveSubTab] = useState("belts");
    const [expandedCategory, setExpandedCategory] = useState(null);

    // Calculate badge statistics
    const getBadgeStats = () => {
        const stats = {};

        Object.keys(badgeCategories).forEach(categoryId => {
            stats[categoryId] = {
                bronze: 0,
                silver: 0,
                gold: 0,
                amethyst: 0
            };
        });

        players.forEach(player => {
            const badges = getPlayerBadges(player.name, leaderboard, matchHistory);
            Object.entries(badges).forEach(([categoryId, badge]) => {
                if (stats[categoryId] && stats[categoryId][badge.tierId] !== undefined) {
                    stats[categoryId][badge.tierId]++;
                }
            });
        });

        return stats;
    };

    const badgeStats = getBadgeStats();

    // Get top performers for each category
    const getTopPerformers = () => {
        const topPerformers = {};

        Object.keys(badgeCategories).forEach(categoryId => {
            const playerBadges = players.map(player => {
                const badges = getPlayerBadges(player.name, leaderboard, matchHistory);
                return {
                    playerName: player.name,
                    badge: badges[categoryId] || null
                };
            }).filter(p => p.badge !== null);

            // Sort by tier (amethyst > gold > silver > bronze) then by value
            const tierOrder = { amethyst: 4, gold: 3, silver: 2, bronze: 1 };
            playerBadges.sort((a, b) => {
                const tierDiff = (tierOrder[b.badge.tierId] || 0) - (tierOrder[a.badge.tierId] || 0);
                if (tierDiff !== 0) return tierDiff;
                return b.badge.currentValue - a.badge.currentValue;
            });

            topPerformers[categoryId] = playerBadges.slice(0, 5);
        });

        return topPerformers;
    };

    const topPerformers = getTopPerformers();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Awards</h2>
            </div>

            {/* Sub-tab navigation */}
            <div className="flex border-b border-gray-700">
                <button
                    onClick={() => setActiveSubTab("belts")}
                    className={`px-4 py-2 text-sm font-medium ${activeSubTab === "belts"
                        ? "text-blue-400 border-b-2 border-blue-400"
                        : "text-gray-400 hover:text-gray-300"
                        }`}
                >
                    Belts
                </button>
                <button
                    onClick={() => setActiveSubTab("badges")}
                    className={`px-4 py-2 text-sm font-medium ${activeSubTab === "badges"
                        ? "text-blue-400 border-b-2 border-blue-400"
                        : "text-gray-400 hover:text-gray-300"
                        }`}
                >
                    Badges
                </button>
            </div>

            {activeSubTab === "belts" && (
                <BeltsTab
                    players={players}
                    currentBelts={currentBelts}
                    userVotes={userVotes}
                    onVote={onVote}
                    user={user}
                    beltVotes={beltVotes}
                />
            )}

            {activeSubTab === "badges" && (
                <div className="space-y-6">
                    {/* Badge Grid Display */}
                    <div className="space-y-4">
                        {Object.entries(badgeCategories).map(([categoryId, category]) => (
                            <div key={categoryId} className="bg-gray-800 p-3 rounded-lg">
                                {/* Category Header - More compact */}
                                <div className="text-center mb-3">
                                    <h3 className="text-lg font-bold text-white mb-1">{category.name}</h3>
                                    <p className="text-xs text-gray-400">{category.description}</p>
                                </div>

                                {/* Badge Tier Grid (4 across) - Reduced spacing */}
                                <div className="grid grid-cols-4 gap-3">
                                    {Object.entries(category.tiers).map(([tierId, tier]) => {
                                        const holdersCount = badgeStats[categoryId][tierId];
                                        const topHolder = topPerformers[categoryId].find(p => p.badge.tierId === tierId);

                                        return (
                                            <div
                                                key={tierId}
                                                className="text-center cursor-pointer transition-all duration-300 hover:scale-105 p-1"
                                                onClick={() => setExpandedCategory(
                                                    expandedCategory === `${categoryId}-${tierId}`
                                                        ? null
                                                        : `${categoryId}-${tierId}`
                                                )}
                                            >
                                                {/* Smaller badge icon */}
                                                <div className="flex justify-center">
                                                    {renderCategoryIcon(categoryId, 56, tierId)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Show details only when a badge is clicked */}
                                {Object.entries(category.tiers).map(([tierId, tier]) => {
                                    const isExpanded = expandedCategory === `${categoryId}-${tierId}`;
                                    const tierId_holders = topPerformers[categoryId].filter(p => p.badge.tierId === tierId);
                                    const holdersCount = badgeStats[categoryId][tierId];

                                    if (!isExpanded) return null;

                                    return (
                                        <div key={`expanded-${tierId}`} className="mt-3 pt-3 border-t border-gray-700 bg-gray-700 rounded-lg p-3">
                                            {/* Badge info header - More compact */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center">
                                                    <span className="mr-2">
                                                        {renderCategoryIcon(categoryId, 24, tierId)}
                                                    </span>
                                                    <div>
                                                        <h4 className={`text-base font-bold ${tier.color}`}>
                                                            {tier.name}
                                                        </h4>
                                                        <p className="text-xs text-gray-400">
                                                            {tier.threshold}+ {category.name.toLowerCase()} required
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base font-bold text-white">{holdersCount}</div>
                                                    <div className="text-xs text-gray-400">
                                                        {holdersCount === 1 ? 'player' : 'players'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Badge holders list - More compact */}
                                            <div>
                                                <h5 className="text-xs font-medium text-white mb-2">Badge Holders:</h5>
                                                {tierId_holders.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {tierId_holders.map((performer, index) => (
                                                            <div key={performer.playerName} className="flex justify-between items-center p-2 bg-gray-600 rounded text-sm">
                                                                <div className="flex items-center">
                                                                    {index === 0 && <span className="text-yellow-400 mr-1 text-xs">👑</span>}
                                                                    <span className="text-white">
                                                                        {performer.playerName}
                                                                    </span>
                                                                </div>
                                                                <div className="text-gray-300 text-xs">
                                                                    {performer.badge.currentValue}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-3 text-gray-400 text-xs">
                                                        No players have earned this badge yet
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}