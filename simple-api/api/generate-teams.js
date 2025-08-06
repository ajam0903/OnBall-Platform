module.exports = (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { players, teamSize, weightings } = req.body;

        // Validate input
        if (!players || !Array.isArray(players) || players.length === 0) {
            return res.status(400).json({ error: 'Players array is required' });
        }

        if (!teamSize || teamSize < 1) {
            return res.status(400).json({ error: 'Valid team size is required' });
        }

        // Use default weightings if not provided
        const defaultWeightings = {
            scoring: 0.25,
            defense: 0.2,
            rebounding: 0.15,
            playmaking: 0.15,
            stamina: 0.1,
            physicality: 0.1,
            xfactor: 0.05
        };

        const finalWeightings = weightings || defaultWeightings;

        // Calculate player score function
        const calculatePlayerScore = (player) => {
            return (
                (player.scoring || 5) * finalWeightings.scoring +
                (player.defense || 5) * finalWeightings.defense +
                (player.rebounding || 5) * finalWeightings.rebounding +
                (player.playmaking || 5) * finalWeightings.playmaking +
                (player.stamina || 5) * finalWeightings.stamina +
                (player.physicality || 5) * finalWeightings.physicality +
                (player.xfactor || 5) * finalWeightings.xfactor
            );
        };

        // Generate teams using your algorithm
        const result = generateBalancedTeams(players, teamSize, calculatePlayerScore);

        return res.status(200).json({
            success: true,
            teams: result.teams,
            matchups: result.matchups
        });

    } catch (error) {
        console.error('Error generating teams:', error);
        return res.status(500).json({ error: 'Failed to generate teams: ' + error.message });
    }
};

// Your complete team generation algorithm
function generateBalancedTeams(players, teamSize, calculatePlayerScore) {
    // Since React app already filters active players, use all players sent
    const activePlayers = players;

    console.log("API received players:", activePlayers.length); // Debug log

    if (activePlayers.length === 0) {
        console.error("No active players found");
        return { teams: [], matchups: [] };
    }

    // Reset isBench property for all players
    const cleanedPlayers = activePlayers.map(player => ({
        ...player,
        active: true, // Ensure active is set
        isBench: false,
        score: calculatePlayerScore(player)
    }));

    // Shuffle players first for randomness
    const shuffledPlayers = [...cleanedPlayers].sort(() => Math.random() - 0.5);

    // Sort players by rating (highest to lowest)
    const sortedPlayers = [...shuffledPlayers].sort(
        (a, b) => b.score - a.score
    );

    // Calculate how many teams we can create based on active players and team size
    const numPossibleTeams = Math.floor(activePlayers.length / teamSize);

    // Create at least 2 teams, but more if we have enough players
    // Make sure we have an even number of teams for matchups
    const numTeams = Math.max(2, numPossibleTeams - (numPossibleTeams % 2));

    // Initialize teams array
    const teams = Array.from({ length: numTeams }, () => []);

    // First phase: Distribute the top players as starters using snake draft
    // This ensures the best players are evenly distributed as starters
    const totalStarterPositions = numTeams * teamSize;
    const starterPlayers = sortedPlayers.slice(0, totalStarterPositions);

    for (let i = 0; i < starterPlayers.length; i++) {
        // Determine team index using snake draft
        const round = Math.floor(i / numTeams);
        let teamIndex;

        if (round % 2 === 0) {
            teamIndex = i % numTeams; // Forward
        } else {
            teamIndex = numTeams - 1 - (i % numTeams); // Reverse
        }

        teams[teamIndex].push(starterPlayers[i]);
    }

    // Second phase: Distribute remaining players as bench players
    const benchPlayers = sortedPlayers.slice(totalStarterPositions);

    // Mark bench players
    benchPlayers.forEach(player => {
        player.isBench = true;
    });

    // Distribute bench players evenly, focusing on balancing team strength
    benchPlayers.forEach(benchPlayer => {
        // Find the team with lowest total strength
        const teamStrengths = teams.map(team => {
            return team.reduce((sum, player) => sum + player.score, 0);
        });

        const weakestTeamIndex = teamStrengths.indexOf(Math.min(...teamStrengths));
        teams[weakestTeamIndex].push(benchPlayer);
    });

    // Calculate team strength considering starters and bench differently
    const calculateTeamStrength = (team) => {
        if (!team || team.length === 0) return 0;

        // Separate starters and bench
        const starters = team.filter(p => p && p.isBench === false);
        const bench = team.filter(p => p && p.isBench === true);

        if (starters.length === 0) return 0;

        // Starters contribute 90% to team strength
        const starterScore = starters.reduce((sum, p) => sum + p.score, 0) / starters.length;

        // Bench contributes 10% to team strength
        const benchScore = bench.length > 0
            ? bench.reduce((sum, p) => sum + p.score, 0) / bench.length
            : 0;

        return (starterScore * 0.9) + (benchScore * 0.1);
    };

    // Optimization phase: Swap players to improve team balance
    for (let iteration = 0; iteration < 30; iteration++) {
        const teamStrengths = teams.map(calculateTeamStrength);
        const avgStrength = teamStrengths.reduce((sum, str) => sum + str, 0) / teamStrengths.length;

        // Calculate overall imbalance
        const variance = teamStrengths.reduce((sum, str) => sum + Math.pow(str - avgStrength, 2), 0) / teamStrengths.length;
        const stdDev = Math.sqrt(variance);

        // If teams are already very well-balanced, stop optimizing
        if (stdDev < 0.05) break;

        // Find the strongest and weakest teams
        const strongestTeamIdx = teamStrengths.indexOf(Math.max(...teamStrengths));
        const weakestTeamIdx = teamStrengths.indexOf(Math.min(...teamStrengths));

        if (strongestTeamIdx === weakestTeamIdx) break;

        // Try to swap starters between strongest and weakest teams
        let improved = false;

        // Only swap players of the same type (starter for starter, bench for bench)
        const strongTeamStarters = teams[strongestTeamIdx].filter(p => p && !p.isBench);
        const weakTeamStarters = teams[weakestTeamIdx].filter(p => p && !p.isBench);

        // Try every combination of starter swaps
        for (let sIdx = 0; sIdx < strongTeamStarters.length && !improved; sIdx++) {
            for (let wIdx = 0; wIdx < weakTeamStarters.length && !improved; wIdx++) {
                const sPlayerIdx = teams[strongestTeamIdx].indexOf(strongTeamStarters[sIdx]);
                const wPlayerIdx = teams[weakestTeamIdx].indexOf(weakTeamStarters[wIdx]);

                // Swap
                const temp = teams[strongestTeamIdx][sPlayerIdx];
                teams[strongestTeamIdx][sPlayerIdx] = teams[weakestTeamIdx][wPlayerIdx];
                teams[weakestTeamIdx][wPlayerIdx] = temp;

                // Evaluate
                const newStrengths = teams.map(calculateTeamStrength);
                const newAvgStrength = newStrengths.reduce((sum, str) => sum + str, 0) / newStrengths.length;
                const newVariance = newStrengths.reduce((sum, str) => sum + Math.pow(str - newAvgStrength, 2), 0) / newStrengths.length;
                const newStdDev = Math.sqrt(newVariance);

                // If improved, keep the swap
                if (newStdDev < stdDev) {
                    improved = true;
                } else {
                    // Undo swap
                    const temp = teams[strongestTeamIdx][sPlayerIdx];
                    teams[strongestTeamIdx][sPlayerIdx] = teams[weakestTeamIdx][wPlayerIdx];
                    teams[weakestTeamIdx][wPlayerIdx] = temp;
                }
            }
        }

        // If no starter swaps improved balance, try bench swaps
        if (!improved) {
            const strongTeamBench = teams[strongestTeamIdx].filter(p => p && p.isBench);
            const weakTeamBench = teams[weakestTeamIdx].filter(p => p && p.isBench);

            // Try every combination of bench swaps
            for (let sIdx = 0; sIdx < strongTeamBench.length && !improved; sIdx++) {
                for (let wIdx = 0; wIdx < weakTeamBench.length && !improved; wIdx++) {
                    const sPlayerIdx = teams[strongestTeamIdx].indexOf(strongTeamBench[sIdx]);
                    const wPlayerIdx = teams[weakestTeamIdx].indexOf(weakTeamBench[wIdx]);

                    // Swap
                    const temp = teams[strongestTeamIdx][sPlayerIdx];
                    teams[strongestTeamIdx][sPlayerIdx] = teams[weakestTeamIdx][wPlayerIdx];
                    teams[weakestTeamIdx][wPlayerIdx] = temp;

                    // Evaluate
                    const newStrengths = teams.map(calculateTeamStrength);
                    const newAvgStrength = newStrengths.reduce((sum, str) => sum + str, 0) / newStrengths.length;
                    const newVariance = newStrengths.reduce((sum, str) => sum + Math.pow(str - newAvgStrength, 2), 0) / newStrengths.length;
                    const newStdDev = Math.sqrt(newVariance);

                    // If improved, keep the swap
                    if (newStdDev < stdDev) {
                        improved = true;
                    } else {
                        // Undo swap
                        const temp = teams[strongestTeamIdx][sPlayerIdx];
                        teams[strongestTeamIdx][sPlayerIdx] = teams[weakestTeamIdx][wPlayerIdx];
                        teams[weakestTeamIdx][wPlayerIdx] = temp;
                    }
                }
            }
        }

        // If no improvement was possible, we're at a local optimum
        if (!improved) break;
    }

    // Final step: Ensure the best players on each team are starters
    // and worst players are on the bench
    teams.forEach(team => {
        // Sort players within each team by score
        team.sort((a, b) => b.score - a.score);

        // Mark the top teamSize players as starters, the rest as bench
        team.forEach((player, idx) => {
            player.isBench = idx >= teamSize;
        });
    });

    // Create balanced matchups
    const createBalancedMatchups = (teams, calculateTeamStrength) => {
        // Calculate strength for each team
        const teamsWithStrengths = teams.map(team => ({
            team,
            strength: calculateTeamStrength(team)
        }));

        // Sort teams by strength (highest to lowest)
        teamsWithStrengths.sort((a, b) => b.strength - a.strength);

        const matchups = [];

        // For exactly 4 teams (specific case)
        if (teamsWithStrengths.length === 4) {
            // Calculate the total difference for all possible pairings
            // Option 1: (0,1) (2,3) - Strongest vs 2nd strongest, 3rd vs weakest
            const diff1 = Math.abs(teamsWithStrengths[0].strength - teamsWithStrengths[1].strength) +
                Math.abs(teamsWithStrengths[2].strength - teamsWithStrengths[3].strength);

            // Option 2: (0,2) (1,3) - Strongest vs 3rd strongest, 2nd vs weakest
            const diff2 = Math.abs(teamsWithStrengths[0].strength - teamsWithStrengths[2].strength) +
                Math.abs(teamsWithStrengths[1].strength - teamsWithStrengths[3].strength);

            // Option 3: (0,3) (1,2) - Strongest vs weakest, 2nd vs 3rd
            const diff3 = Math.abs(teamsWithStrengths[0].strength - teamsWithStrengths[3].strength) +
                Math.abs(teamsWithStrengths[1].strength - teamsWithStrengths[2].strength);

            // Choose the option with the minimum total difference
            if (diff1 <= diff2 && diff1 <= diff3) {
                // Option 1 is best
                matchups.push([teamsWithStrengths[0].team, teamsWithStrengths[1].team]);
                matchups.push([teamsWithStrengths[2].team, teamsWithStrengths[3].team]);
            } else if (diff2 <= diff1 && diff2 <= diff3) {
                // Option 2 is best
                matchups.push([teamsWithStrengths[0].team, teamsWithStrengths[2].team]);
                matchups.push([teamsWithStrengths[1].team, teamsWithStrengths[3].team]);
            } else {
                // Option 3 is best
                matchups.push([teamsWithStrengths[0].team, teamsWithStrengths[3].team]);
                matchups.push([teamsWithStrengths[1].team, teamsWithStrengths[2].team]);
            }
        } else {
            // For other numbers of teams
            // Take the general approach of matching teams with similar strengths
            const availableTeams = [...teamsWithStrengths];

            while (availableTeams.length >= 2) {
                // Take the first team
                const firstTeam = availableTeams.shift();

                // Find the closest strength match
                let bestMatchIndex = 0;
                let bestMatchDiff = Math.abs(firstTeam.strength - availableTeams[0].strength);

                for (let i = 1; i < availableTeams.length; i++) {
                    const diff = Math.abs(firstTeam.strength - availableTeams[i].strength);
                    if (diff < bestMatchDiff) {
                        bestMatchDiff = diff;
                        bestMatchIndex = i;
                    }
                }

                const matchedTeam = availableTeams.splice(bestMatchIndex, 1)[0];
                matchups.push([firstTeam.team, matchedTeam.team]);
            }
        }

        return { teams, matchups };
    };

    // Return the balanced teams and matchups
    const result = createBalancedMatchups(teams, calculateTeamStrength);
    return result;
}