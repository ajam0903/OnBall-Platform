// playerStatsCalculator.js

// Calculate stats from match history with name consolidation
export const calculatePlayerStatsFromHistory = (playerName, matchHistory = []) => {
    const stats = { _w: 0, _l: 0, MVPs: 0 };

    matchHistory.forEach(match => {
        let teamA = [];  // Add this line
        let teamB = [];  // Add this line
        let scoreA = 0;
        let scoreB = 0;
        let mvp = "";

        // Extract teams and scores depending on the format
        if (match.teams && Array.isArray(match.teams)) {
            teamA = match.teams[0].map(p => p.name);
            teamB = match.teams[1].map(p => p.name);
        } else if (match.teamA && match.teamB) {
            teamA = match.teamA.map(p => p.name);
            teamB = match.teamB.map(p => p.name);
        }

        if (match.score) {
            scoreA = parseInt(match.score.a) || 0;
            scoreB = parseInt(match.score.b) || 0;
        }

        mvp = match.mvp || "";

        // Check if player participated
        const playerInTeamA = teamA.includes(playerName);
        const playerInTeamB = teamB.includes(playerName);

        if (playerInTeamA || playerInTeamB) {
            // Determine if player won
            const teamAWon = scoreA > scoreB;
            const playerWon = (playerInTeamA && teamAWon) || (playerInTeamB && !teamAWon);

            if (playerWon) {
                stats._w += 1;
            } else {
                stats._l += 1;
            }

            // Check if player is MVP
            if (mvp === playerName) {
                stats.MVPs += 1;
            }
        }
    });

    return {
        wins: stats._w,
        losses: stats._l,
        mvps: stats.MVPs,
        gamesPlayed: stats._w + stats._l,
        winPercentage: (stats._w + stats._l) > 0 ? ((stats._w / (stats._w + stats._l)) * 100).toFixed(1) : "0.0"
    };
};