export const badgeCategories = {
    gamesPlayed: {
        name: "Vet",
        description: "Total Games Played",
        tiers: {
            bronze: {
                threshold: 50,
                name: "Up-and-Comer",
                color: "text-amber-600",
                bgGradient: "from-amber-900 to-amber-700",
                borderColor: "border-amber-600",
                glowColor: "shadow-amber-500/50"
            },
            silver: {
                threshold: 100,
                name: "Seasoned Vet",
                color: "text-slate-300",
                bgGradient: "from-slate-700 to-slate-500",
                borderColor: "border-slate-400",
                glowColor: "shadow-slate-400/50"
            },
            gold: {
                threshold: 200,
                name: "Gold Legend",
                color: "text-yellow-300",
                bgGradient: "from-yellow-700 to-yellow-500",
                borderColor: "border-yellow-400",
                glowColor: "shadow-yellow-400/50"
            },
            amethyst: {
                threshold: 500,
                name: "Court Master",
                color: "text-purple-300",
                bgGradient: "from-purple-800 to-purple-600",
                borderColor: "border-purple-400",
                glowColor: "shadow-purple-400/50"
            }
        }
    },
    wins: {
        name: "Winner",
        description: "Total games won",
        tiers: {
            bronze: {
                threshold: 25,
                name: "Rising Star",
                color: "text-amber-600",
                bgGradient: "from-amber-900 to-amber-700",
                borderColor: "border-amber-600",
                glowColor: "shadow-amber-500/50"
            },
            silver: {
                threshold: 50,
                name: "Champion",
                color: "text-slate-300",
                bgGradient: "from-slate-700 to-slate-500",
                borderColor: "border-slate-400",
                glowColor: "shadow-slate-400/50"
            },
            gold: {
                threshold: 100,
                name: "Elite Winner",
                color: "text-yellow-300",
                bgGradient: "from-yellow-700 to-yellow-500",
                borderColor: "border-yellow-400",
                glowColor: "shadow-yellow-400/50"
            },
            amethyst: {
                threshold: 250,
                name: "Victory Lord",
                color: "text-purple-300",
                bgGradient: "from-purple-800 to-purple-600",
                borderColor: "border-purple-400",
                glowColor: "shadow-purple-400/50"
            }
        }
    },
    mvps: {
        name: "MVP",
        description: "Most Valuable Player awards",
        tiers: {
            bronze: {
                threshold: 10,
                name: "Clutch Player",
                color: "text-amber-600",
                bgGradient: "from-amber-900 to-amber-700",
                borderColor: "border-amber-600",
                glowColor: "shadow-amber-500/50"
            },
            silver: {
                threshold: 25,
                name: "Team Carry",
                color: "text-slate-300",
                bgGradient: "from-slate-700 to-slate-500",
                borderColor: "border-slate-400",
                glowColor: "shadow-slate-400/50"
            },
            gold: {
                threshold: 50,
                name: "MVP Elite",
                color: "text-yellow-300",
                bgGradient: "from-yellow-700 to-yellow-500",
                borderColor: "border-yellow-400",
                glowColor: "shadow-yellow-400/50"
            },
            amethyst: {
                threshold: 100,
                name: "GOAT",
                color: "text-purple-300",
                bgGradient: "from-purple-800 to-purple-600",
                borderColor: "border-purple-400",
                glowColor: "shadow-purple-400/50"
            }
        }
    },
    winStreaks: {
        name: "Win Streak",
        description: "Longest consecutive wins",
        tiers: {
            bronze: {
                threshold: 5,
                name: "Hot Streak",
                color: "text-amber-600",
                bgGradient: "from-amber-900 to-amber-700",
                borderColor: "border-amber-600",
                glowColor: "shadow-amber-500/50"
            },
            silver: {
                threshold: 10,
                name: "On Fire",
                color: "text-slate-300",
                bgGradient: "from-slate-700 to-slate-500",
                borderColor: "border-slate-400",
                glowColor: "shadow-slate-400/50"
            },
            gold: {
                threshold: 15,
                name: "Unstoppable",
                color: "text-yellow-300",
                bgGradient: "from-yellow-700 to-yellow-500",
                borderColor: "border-yellow-400",
                glowColor: "shadow-yellow-400/50"
            },
            amethyst: {
                threshold: 25,
                name: "Dominator",
                color: "text-purple-300",
                bgGradient: "from-purple-800 to-purple-600",
                borderColor: "border-purple-400",
                glowColor: "shadow-purple-400/50"
            }
        }
    }
};

// Calculate player statistics for badges
export const calculatePlayerStats = (playerName, leaderboard = {}, matchHistory = []) => {
    const playerStats = leaderboard[playerName] || { _w: 0, _l: 0, MVPs: 0 };

    const stats = {
        gamesPlayed: (playerStats._w || 0) + (playerStats._l || 0),
        wins: playerStats._w || 0,
        mvps: playerStats.MVPs || 0,
        winStreaks: 0
    };

    // Use longest streak for badge earning
    if (matchHistory && matchHistory.length > 0) {
        stats.winStreaks = calculateLongestWinStreak(playerName, matchHistory);
    }

    return stats;
};

export const calculateLongestWinStreak = (playerName, matchHistory) => {
    if (!matchHistory || matchHistory.length === 0) return 0;

    // Sort matches by date (oldest to newest for proper streak calculation)
    const sortedMatches = [...matchHistory].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    let longestStreak = 0;
    let currentStreak = 0;

    for (const match of sortedMatches) {
        // Skip deleted/voided matches
        if (match.isDeleted) {
            continue;
        }

        let teamA = [];
        let teamB = [];
        let scoreA = 0;
        let scoreB = 0;

        // Handle different match formats and normalize player names
        if (Array.isArray(match.teams) && match.teams.length >= 2) {
            teamA = match.teams[0].map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
            teamB = match.teams[1].map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
        } else if (match.teamA && match.teamB) {
            teamA = match.teamA.map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
            teamB = match.teamB.map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
        }

        if (match.score) {
            scoreA = parseInt(match.score.a) || 0;
            scoreB = parseInt(match.score.b) || 0;
        }

        // Normalize the player name we're searching for
        const normalizedPlayerName = playerName ? playerName.trim().toLowerCase() : '';

        // Determine which team the player was on
        const isOnTeamA = teamA.includes(normalizedPlayerName);
        const isOnTeamB = teamB.includes(normalizedPlayerName);

        // Skip if player wasn't in this match
        if (!isOnTeamA && !isOnTeamB) {
            continue;
        }

        // Determine if player's team won
        const playerWon = (isOnTeamA && scoreA > scoreB) || (isOnTeamB && scoreB > scoreA);

        if (playerWon) {
            // Player won, increment current streak
            currentStreak++;
            // Update longest streak if current is longer
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            // Player lost, reset current streak
            currentStreak = 0;
        }
    }

    return longestStreak;
};

// Add this complete function to badgeSystem.jsx
export const calculateCurrentWinStreak = (playerName, matchHistory) => {
    if (!matchHistory || matchHistory.length === 0) return 0;

    // Sort matches by date (newest to oldest)
    const sortedMatches = [...matchHistory].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
    });

    let currentStreak = 0;

    for (const match of sortedMatches) {
        // Skip deleted/voided matches
        if (match.isDeleted) {
            continue;
        }

        let teamA = [];
        let teamB = [];
        let scoreA = 0;
        let scoreB = 0;

        // Handle different match formats and normalize player names
        if (Array.isArray(match.teams) && match.teams.length >= 2) {
            teamA = match.teams[0].map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
            teamB = match.teams[1].map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
        } else if (match.teamA && match.teamB) {
            teamA = match.teamA.map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
            teamB = match.teamB.map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return name ? name.trim().toLowerCase() : '';
            });
        }

        if (match.score) {
            scoreA = parseInt(match.score.a) || 0;
            scoreB = parseInt(match.score.b) || 0;
        }

        const normalizedPlayerName = playerName ? playerName.trim().toLowerCase() : '';
        const isOnTeamA = teamA.includes(normalizedPlayerName);
        const isOnTeamB = teamB.includes(normalizedPlayerName);

        if (!isOnTeamA && !isOnTeamB) {
            continue;
        }

        const playerWon = (isOnTeamA && scoreA > scoreB) || (isOnTeamB && scoreB > scoreA);

        if (playerWon) {
            currentStreak++;
        } else {
            break;
        }
    }

    return currentStreak;
};

export const getPlayerBadges = (playerName, leaderboard = {}, matchHistory = [], correctedStats = null) => {
    const calculatedStats = calculatePlayerStats(playerName, leaderboard, matchHistory);
    // Merge corrected stats with calculated stats (corrected stats take priority)
    const stats = correctedStats ? { ...calculatedStats, ...correctedStats } : calculatedStats;

    const earnedBadges = {};
    Object.entries(badgeCategories).forEach(([categoryId, category]) => {
        const playerValue = stats[categoryId] || 0;
        let highestTier = null;
        // Find the highest tier achieved
        Object.entries(category.tiers).forEach(([tierId, tier]) => {
            if (playerValue >= tier.threshold) {
                highestTier = { ...tier, tierId };
            }
        });
        if (highestTier) {
            earnedBadges[categoryId] = {
                ...highestTier,
                categoryName: category.name,
                currentValue: playerValue
            };
        }
    });
    return earnedBadges;
};

// Get progress towards next badge tier
export const getBadgeProgress = (playerName, leaderboard = {}, matchHistory = [], correctedStats = null) => {
    const calculatedStats = calculatePlayerStats(playerName, leaderboard, matchHistory);
    // Merge corrected stats with calculated stats (corrected stats take priority)
    const stats = correctedStats ? { ...calculatedStats, ...correctedStats } : calculatedStats;

    const progress = {};
    Object.entries(badgeCategories).forEach(([categoryId, category]) => {
        let displayValue = stats[categoryId] || 0;
        let comparisonValue = stats[categoryId] || 0;
        // Special case: use current streak for winStreaks progress display
        if (categoryId === 'winStreaks') {
            displayValue = calculateCurrentWinStreak(playerName, matchHistory);
            comparisonValue = stats[categoryId] || 0; // longest streak for tier determination
            // Debug logging
            if (playerName.toLowerCase().includes('murtaza')) {
                console.log('=== MURTAZA WIN STREAK DEBUG ===');
                console.log('Current streak (display):', displayValue);
                console.log('Longest streak (for tiers):', comparisonValue);
                console.log('Recent matches:', matchHistory.slice(0, 5));
            }
        }
        const tiers = Object.entries(category.tiers);
        // Find current tier (based on longest streak for win streaks)
        let currentTier = null;
        let nextTier = null;
        for (const [tierId, tier] of tiers) {
            if (comparisonValue >= tier.threshold) {
                currentTier = { ...tier, tierId };
            }
        }
        // Find next tier after the current earned tier
        for (const [tierId, tier] of tiers) {
            if (comparisonValue < tier.threshold) {
                nextTier = { ...tier, tierId };
                break;
            }
        }
        if (categoryId === 'winStreaks' && playerName.toLowerCase().includes('murtaza')) {
            console.log('Current tier:', currentTier);
            console.log('Next tier:', nextTier);
            console.log('Display value (current streak):', displayValue);
            console.log('Comparison value (longest streak):', comparisonValue);
        }
        progress[categoryId] = {
            categoryName: category.name,
            currentValue: displayValue, // Show current streak for win streaks
            currentTier,
            nextTier,
            progressPercent: nextTier ?
                Math.min((displayValue / nextTier.threshold) * 100, 100) : 100
        };
    });
    return progress;
};