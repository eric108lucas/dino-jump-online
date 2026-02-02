// Ranking System - Manages scores and leaderboard
class RankingSystem {
    constructor() {
        this.storageKey = 'dino-game-rankings';
        this.maxEntries = 10;
    }

    // Get all rankings from storage
    getRankings() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.warn('Failed to load rankings:', e);
            return [];
        }
    }

    // Save rankings to storage
    saveRankings(rankings) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(rankings));
        } catch (e) {
            console.warn('Failed to save rankings:', e);
        }
    }

    // Add a new score
    addScore(score, level, won) {
        const rankings = this.getRankings();

        const entry = {
            id: Date.now(),
            score: score,
            level: level,
            timestamp: this.formatTimestamp(new Date()),
            won: won
        };

        rankings.push(entry);

        // Sort by score descending
        rankings.sort((a, b) => b.score - a.score);

        // Keep only top entries
        const trimmed = rankings.slice(0, this.maxEntries);

        this.saveRankings(trimmed);

        // Return the rank of the new entry (1-indexed, or -1 if not in top 10)
        const rank = trimmed.findIndex(r => r.id === entry.id);
        return rank >= 0 ? rank + 1 : -1;
    }

    // Format timestamp in user-friendly format
    formatTimestamp(date) {
        const options = {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };

        return date.toLocaleString('en-US', options);
    }

    // Clear all rankings
    clearRankings() {
        this.saveRankings([]);
    }
}

// Global ranking system instance
const rankingSystem = new RankingSystem();
