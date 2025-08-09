

export const beltCategories = {
    // Negative belts
    snowflake: {
        name: "Flake",
        icon: "❄️",
        description: "For a player that doesn't show up to play",
        isNegative: true
    },
    toiletPaper: {
        name: "Soft",
        icon: "🧻",
        description: "For a player who plays soft",
        isNegative: true
    },
    hog: {
        name: "Ball Hog",
        icon: "0",
        description: "For a player who hogs the ball",
        isNegative: true
    },
    brickLayer: {
        name: "Brick Layer",
        icon: "🧱",
        description: "For the player who takes the most questionable shot attempts",
        isNegative: true
    },

    // Positive belts
    bullseye: {
        name: "Sharp Shooter",
        icon: "🎯",
        description: "Player who shows great shooting skills",
        isNegative: false
    },
    general: {
        name: "General",
        icon: "🎖️",
        description: "For the best on-court leader and communicator",
        isNegative: false
    },
    warrior: {
        name: "Warrior",
        icon: "⚔️",
        description: "For the player who plays through pain and never backs down from contact",
        isNegative: false
    },
    clutchGene: {
        name: "Clutch",
        icon: "🧬",
        description: "For the player who consistently performs in pressure moments",
        isNegative: false
    },
    motor: {
        name: "Motor",
        icon: "⚡",
        description: "Player who shows the most hustle",
        isNegative: false
    },
    infinityGauntlet: {
        name: "Has It All",
        icon: "🧤",
        description: "The best all-around player that can do it all",
        isNegative: false
    }
};



// Helper function to update belt standings based on votes and current holders
export const calculateBeltStandings = (allVotes, currentBeltHolders = {}) => {
    if (!allVotes || typeof allVotes !== 'object') return currentBeltHolders;

    // Track vote counts for each belt for each player
    const beltVotes = {};

    // Initialize structure for all belt categories
    Object.keys(beltCategories).forEach(beltId => {
        beltVotes[beltId] = {};
    });

    // Count votes with safety checks and name normalization
    Object.values(allVotes).forEach(userVotesObj => {
        if (!userVotesObj || typeof userVotesObj !== 'object') {
            return;
        }

        Object.entries(userVotesObj).forEach(([beltId, playerName]) => {
            if (!beltId || !playerName || typeof beltId !== 'string' || typeof playerName !== 'string') {
                return;
            }

            if (!beltCategories[beltId]) {
                return;
            }

            // Normalize the player name before counting
            if (!beltVotes[beltId][playerName]) {
                beltVotes[beltId][playerName] = 0;
            }
            beltVotes[beltId][playerName]++;
        });
    });

    // Apply championship rules for each belt
    const newBeltHolders = { ...currentBeltHolders };

    Object.entries(beltVotes).forEach(([beltId, playerVotes]) => {
        const currentHolder = currentBeltHolders[beltId];

        // Find the player with the most votes
        let maxVotes = 0;
        let topPlayer = null;

        Object.entries(playerVotes).forEach(([player, voteCount]) => {
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                topPlayer = player;
            }
        });

        if (!currentHolder) {
            // No current holder - first player to reach 5 votes gets the belt
            if (topPlayer && maxVotes >= 5) {
                newBeltHolders[beltId] = {
                    playerName: topPlayer,
                    votes: maxVotes
                };
            }
        } else {
            // There is a current holder
            const currentHolderVotes = playerVotes[currentHolder.playerName] || 0;

            // Update current holder's vote count
            newBeltHolders[beltId] = {
                ...currentHolder,
                votes: currentHolderVotes
            };

            // Check if someone can dethrone the current holder
            // They need MORE votes than the current holder (not just 1 more)
            if (topPlayer && topPlayer !== currentHolder.playerName && maxVotes > currentHolderVotes) {
                newBeltHolders[beltId] = {
                    playerName: topPlayer,
                    votes: maxVotes
                };
            }
        }
    });

    return newBeltHolders;
};