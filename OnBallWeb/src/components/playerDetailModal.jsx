// PlayerDetailModal.jsx
import { log, logWarn, logError } from "../utils/logger";
import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getPlayerBadges, getBadgeProgress, badgeCategories, calculatePlayerStats } from "./badgeSystem.jsx";
import Badge from "./Badge";
import PlayerCardClaimModal from './PlayerCardClaimModal';
import { StyledButton } from './UIComponents';
import { calculatePlayerStatsFromHistory } from '../utils/playerStatsCalculator';
import { calculateWeightedRating } from '../utils/ratingUtils';

function getCategoryIcon(categoryName) {
    const iconMap = {
        "Vet": "gamesPlayed",
        "Winner": "wins",
        "MVP": "mvps",
        "Win Streak": "winStreaks"
    };
    return iconMap[categoryName] || "gamesPlayed"; // default fallback
}

export default function PlayerDetailModal({
    isOpen,
    onClose,
    player,
    leaderboard = {},
    matchHistory = [],
    playerOVRs = {},
    showReviewerNames = false,
    isAdmin = false,
    currentLeagueId, 
    db, 
    user, 
}) {
    const [activeTab, setActiveTab] = useState("overview");
    const [playerCardData, setPlayerCardData] = useState(null);
    const [showClaimModal, setShowClaimModal] = useState(false);

    if (!isOpen || !player) return null;

    // Calculate stats the same way as LeaderboardTab
    const playerStats = calculatePlayerStatsFromHistory(player.name, matchHistory);

    // For badges and progress, we need to be more selective about what we override
    // Only override the stats that need name consolidation (wins, losses, mvps, gamesPlayed)
    // but let the badge system calculate winStreaks itself
    const statsForBadges = {
        gamesPlayed: playerStats.gamesPlayed,
        wins: playerStats.wins,
        mvps: playerStats.mvps,
        // Don't include winStreaks here - let the badge system calculate it
    };

    // Call the functions with partial corrected stats
    // The badge functions will use corrected stats for wins/mvps/gamesPlayed 
    // but calculate winStreaks normally
    const badges = getPlayerBadges(player.name, leaderboard, matchHistory, statsForBadges);
    const progress = getBadgeProgress(player.name, leaderboard, matchHistory, statsForBadges);
    const playerLeaderboardStats = leaderboard[player.name] || { _w: 0, _l: 0, MVPs: 0 };
    const overallRating = playerOVRs[player.name] || 5;

    const winPercentage = playerStats.gamesPlayed > 0 ?
        ((playerStats.wins / playerStats.gamesPlayed) * 100).toFixed(1) : "0.0";
    const fetchPlayerCardData = async () => {
        try {
            const allUsersSnapshot = await getDocs(collection(db, "users"));
            let claimedData = null;
            let userHasClaimedCard = false;

            allUsersSnapshot.forEach(doc => {
                const userData = doc.data();
                const claimedPlayers = userData.claimedPlayers || [];

                // Check if current user has any approved claims in this league
                if (user && doc.id === user.uid) {
                    userHasClaimedCard = claimedPlayers.some(
                        claim => claim.leagueId === currentLeagueId && claim.status === 'approved'
                    );
                }

                const playerClaim = claimedPlayers.find(
                    claim => claim.leagueId === currentLeagueId &&
                        claim.playerName.toLowerCase() === player.name.toLowerCase()
                );

                if (playerClaim && playerClaim.status === 'approved') {
                    claimedData = {
                        isClaimed: true,
                        height: playerClaim.height || "",
                        weight: playerClaim.weight || "",
                        customPhotoURL: playerClaim.customPhotoURL,
                        claimedByUid: doc.id,
                        claimedByName: userData.displayName || userData.email,
                        claimedAt: playerClaim.claimedAt,
                        status: playerClaim.status
                    };
                }
            });

            setPlayerCardData(claimedData || {
                isClaimed: false,
                userHasClaimedCard: userHasClaimedCard
            });
        } catch (error) {
            console.error("Error fetching player card data:", error);
            setPlayerCardData({ isClaimed: false, userHasClaimedCard: false });
        }
    };

    useEffect(() => {
        if (isOpen && player && currentLeagueId && db) {
            fetchPlayerCardData();
        }
    }, [isOpen, player, currentLeagueId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header with Player Name and Close Button */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-700 bg-gray-800">
                    <h2 className="text-2xl font-bold text-white tracking-wider">
                        {player.name.toUpperCase()}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-800">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === "overview"
                                ? "text-blue-400 border-b-2 border-blue-400 bg-gray-750"
                                : "text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("awards")}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === "awards"
                                ? "text-blue-400 border-b-2 border-blue-400 bg-gray-750"
                                : "text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        Awards & Badges
                    </button>
                    <button
                        onClick={() => setActiveTab("reviews")}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === "reviews"
                            ? "text-blue-400 border-b-2 border-blue-400 bg-gray-750"
                            : "text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        Reviews ({player.submissions?.length || 0})
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                    {activeTab === "overview" && (
                        <div className="space-y-6">
                            {/* Player Card - Condensed spacing */}
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-lg">

                                {/* Player Photo with OVR Badge */}
                                <div className="flex justify-center mb-4 relative">
                                    <div className="w-36 h-36 bg-gray-700 rounded-lg border-2 border-gray-600 flex items-center justify-center relative overflow-hidden">
                                        {playerCardData?.customPhotoURL ? (
                                            <img
                                                src={playerCardData.customPhotoURL}
                                                alt={player.name}
                                                className="w-full h-full object-cover rounded-lg"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="text-gray-300 text-4xl font-bold">
                                                {player.name.split(' ').map(name => name.charAt(0)).join('').toUpperCase()}
                                            </div>
                                        )}

                                        {/* Pencil Icon for Editing - only show if user owns this card */}
                                        {playerCardData?.isClaimed && playerCardData?.claimedByUid === user?.uid && (
                                            <button
                                                onClick={() => setShowClaimModal(true)}
                                                className="absolute top-1 right-1 bg-gray-900 bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all duration-200 hover:scale-110"
                                                title="Edit player card"
                                            >
                                                <svg
                                                    className="w-3 h-3 text-white"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}

                                        {/* OVR Badge */}
                                        <div className="absolute top-0 left-0 bg-gray-800 rounded-br-lg px-2 py-1 border-r border-b border-gray-600 shadow-lg">
                                            <div className="text-xs text-gray-400 text-center leading-tight">OVR</div>
                                            <div className="text-sm font-bold text-white text-center leading-tight">
                                                {overallRating.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Height and Weight - only show if player card is claimed and has data */}
                                {playerCardData?.isClaimed && (playerCardData?.height || playerCardData?.weight) && (
                                    <div className="grid grid-cols-2 gap-0 border-b border-gray-600">
                                        {playerCardData?.height && (
                                            <div className="text-center py-2 px-3 border-r border-gray-600">
                                                <div className="text-xs text-gray-400 mb-1">HEIGHT:</div>
                                                <div className="text-lg font-bold text-white">
                                                    {playerCardData.height}
                                                </div>
                                            </div>
                                        )}
                                        {playerCardData?.weight && (
                                            <div className="text-center py-2 px-3">
                                                <div className="text-xs text-gray-400 mb-1">WEIGHT:</div>
                                                <div className="text-lg font-bold text-white">
                                                    {playerCardData.weight} <span className="text-xs">lbs</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Wins Record - Full width */}
                                <div className="text-center py-2 border-b border-gray-600">
                                    <div className="text-l font-bold text-white">
                                        Record: <span className="text-green-400">{playerStats.wins} wins</span> - <span className="text-red-400">{playerStats.gamesPlayed - playerStats.wins} losses</span>
                                    </div>
                                </div>

                                {/* Win Rate and MVPs */}
                                <div className="grid grid-cols-2 gap-0">
                                    <div className="text-center py-2 px-3 border-r border-gray-600">
                                        <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                                        <div className="text-lg font-bold text-white">
                                            {winPercentage}%
                                        </div>
                                    </div>
                                    <div className="text-center py-2 px-3">
                                        <div className="text-xs text-gray-400 mb-1">MVP's</div>
                                        <div className="text-lg font-bold text-white">
                                            {playerStats.mvps}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Player Abilities */}
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold text-white mb-4">Player Abilities</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {["scoring", "defense", "rebounding", "playmaking", "stamina", "physicality", "xfactor"].map((ability) => (
                                        <div key={ability} className="flex justify-between items-center">
                                            <span className="text-gray-300 capitalize">{ability}:</span>
                                            <div className="flex items-center">
                                                <div className="w-20 h-2 bg-gray-600 rounded-full mr-2">
                                                    <div
                                                        className="h-2 bg-blue-500 rounded-full"
                                                        style={{ width: `${((player[ability] || 5) / 10) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-white font-medium w-6 text-right">
                                                    {player[ability] || 5}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Player Card Claim Section - Simplified */}
                            {playerCardData && (
                                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                                        <span className="mr-2">👤</span>
                                        Player Card Status
                                    </h3>
                                    {playerCardData.isClaimed ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-green-400 font-medium">✓ Claimed</span>
                                                <span className="text-sm text-gray-400">
                                                    by {playerCardData.claimedByName}
                                                </span>
                                            </div>
                                            {playerCardData.status === 'pending' && (
                                                <div className="text-yellow-400 text-sm">
                                                    ⏳ Approval pending
                                                </div>
                                            )}
                                            {/* Hint for card owners */}
                                            {playerCardData?.claimedByUid === user?.uid && (
                                                <div className="mt-3 pt-3 border-t border-gray-700">
                                                    <div className="text-xs text-gray-400">
                                                        💡 Use the pencil icon on your photo to edit your card details
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="text-gray-400">
                                                This player card is available to claim
                                            </div>
                                            {!playerCardData.userHasClaimedCard && (
                                                <StyledButton
                                                    onClick={() => setShowClaimModal(true)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    Claim Player Card
                                                </StyledButton>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Recent Badges */}
                            {Object.keys(badges).length > 0 && (
                                <div className="bg-gray-700 p-4 rounded-lg">
                                    <h3 className="text-lg font-semibold text-white mb-3">Recent Achievements</h3>
                                    <div className="space-y-3">
                                        {Object.values(badges).slice(0, 4).map((badge, index) => {
                                            return (
                                                <div key={index} className="bg-gray-600 p-4 rounded-lg">
                                                    <div className="flex items-center mb-2">
                                                        <Badge
                                                            badge={badge}
                                                            categoryId={getCategoryIcon(badge.categoryName)}
                                                            size="small"
                                                            showTooltip={false}
                                                        />
                                                        <div className="ml-4">
                                                            <div className={`text-white font-medium ${badge.color}`}>
                                                                {badge.name}
                                                            </div>
                                                            <div className="text-sm text-gray-400">
                                                                {badge.currentValue} {badge.categoryName.toLowerCase()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "awards" && (
                       <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-lg">
                            {/* Earned Badges */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">
                                    Earned Badges ({Object.keys(badges).length})
                                </h3>
                                {Object.keys(badges).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(badges).map(([categoryId, badge]) => {
                                            const categoryIcon = getCategoryIcon(badge.categoryName);

                                            return (
                                                <div key={categoryId} className="bg-gray-700 p-4 rounded-lg">
                                                    <div className="flex items-center mb-2">
                                                        <Badge
                                                            badge={badge}
                                                            categoryId={getCategoryIcon(badge.categoryName)}
                                                            size="normal"
                                                            showTooltip={false}
                                                        />
                                                        <div className="ml-4">
                                                            <div className={`text-white font-medium ${badge.color}`}>
                                                                {badge.name}
                                                            </div>
                                                            <div className="text-sm text-gray-400">
                                                                {badge.currentValue} {badge.categoryName.toLowerCase()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        No badges earned yet. Keep playing to unlock achievements!
                                    </div>
                                )}
                            </div>

                            {/* Progress Towards Next Badges */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Progress Towards Next Badges</h3>
                                <div className="space-y-4">
                                    {Object.entries(progress).map(([categoryId, prog]) => {
                                        if (!prog.nextTier) return null; // Already at max tier

                                        return (
                                            <div key={categoryId} className="bg-gray-700 p-4 rounded-lg">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center">
                                                        <span className="text-xl mr-2">
                                                            {badgeCategories[categoryId].icon}
                                                        </span>
                                                        <div>
                                                            <div className="text-white font-medium">
                                                                {prog.nextTier.name} {prog.categoryName}
                                                            </div>
                                                            <div className="text-sm text-gray-400">
                                                                {prog.currentValue} / {prog.nextTier.threshold}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-lg ${prog.nextTier.color}`}>
                                                        {prog.nextTier.icon}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-600 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${prog.progressPercent}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {(prog.nextTier.threshold - prog.currentValue)} more needed
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "reviews" && (
                        <div className="space-y-6">
                            {/* Reviews Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">
                                    Player Reviews ({player.submissions?.length || 0})
                                </h3>
                                {player.submissions && player.submissions.length > 0 ? (
                                    <div className="space-y-4">
                                        {player.submissions.map((submission, index) => (
                                            <div key={index} className="bg-gray-700 p-4 rounded-lg">
                                                {/* Review Header */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                                                            {submission.submittedByName ? submission.submittedByName.charAt(0).toUpperCase() :
                                                                submission.submittedBy ? submission.submittedBy.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <div className="ml-3">
                                                            {/* Show reviewer name only if admin allows it AND user is admin */}
                                                            {showReviewerNames && isAdmin ? (
                                                                <div className="text-sm font-medium text-white">
                                                                    {submission.userName || submission.submittedByName || submission.submittedBy || 'Anonymous'}

                                                                </div>
                                                            ) : (
                                                                <div className="text-sm font-medium text-white">
                                                                    Reviewer #{index + 1}
                                                                </div>
                                                            )}
                                                            <div className="text-xs text-gray-400">
                                                                {submission.submissionDate ?
                                                                    new Date(submission.submissionDate).toLocaleDateString() :
                                                                    'Date unknown'
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Overall Rating */}
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-blue-400">
                                                            {calculateWeightedRating(submission).toFixed(1)}
                                                        </div>
                                                        <div className="text-xs text-gray-400">Overall</div>
                                                    </div>
                                                </div>

                                                {/* Rating Breakdown */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {[
                                                        { key: 'scoring', label: 'Scoring' },
                                                        { key: 'defense', label: 'Defense' },
                                                        { key: 'rebounding', label: 'Rebounding' },
                                                        { key: 'playmaking', label: 'Playmaking' },
                                                        { key: 'stamina', label: 'Stamina' },
                                                        { key: 'physicality', label: 'Physicality' },
                                                        { key: 'xfactor', label: 'X-Factor' }
                                                    ].map(({ key, label }) => (
                                                        <div key={key} className="text-center">
                                                            <div className="text-sm text-gray-300 mb-1">{label}</div>
                                                            <div className="text-lg font-medium text-white">
                                                                {submission[key] || 0}
                                                            </div>
                                                            <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                                                                <div
                                                                    className="bg-blue-500 h-1.5 rounded-full"
                                                                    style={{ width: `${((submission[key] || 0) / 10) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        No reviews submitted for this player yet.
                                    </div>
                                )}
                            </div>

                            {/* Review Statistics */}
                            {player.submissions && player.submissions.length > 1 && (
                                <div className="bg-gray-700 p-4 rounded-lg">
                                    <h4 className="text-md font-semibold text-white mb-3">Review Statistics</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { key: 'scoring', label: 'Scoring' },
                                            { key: 'defense', label: 'Defense' },
                                            { key: 'rebounding', label: 'Rebounding' },
                                            { key: 'playmaking', label: 'Playmaking' },
                                            { key: 'stamina', label: 'Stamina' },
                                            { key: 'physicality', label: 'Physicality' },
                                            { key: 'xfactor', label: 'X-Factor' }
                                        ].map(({ key, label }) => {
                                            const values = player.submissions.map(s => s[key] || 0);
                                            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                                            const min = Math.min(...values);
                                            const max = Math.max(...values);

                                            return (
                                                <div key={key} className="text-center">
                                                    <div className="text-sm text-gray-300 mb-1">{label}</div>
                                                    <div className="text-lg font-medium text-white">
                                                        {avg.toFixed(1)}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        Range: {min}-{max}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                    )}
                </div>
            </div>
            {/* Regular claim/edit modal */}
            <PlayerCardClaimModal
                isOpen={showClaimModal}
                onClose={() => setShowClaimModal(false)}
                playerName={player?.name}
                user={user}
                currentLeagueId={currentLeagueId}
                db={db}
                onClaimSuccess={() => {
                    fetchPlayerCardData();
                    setShowClaimModal(false);
                }}
            />
            );
        </div>

    );
}