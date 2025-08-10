import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { log, logWarn, logError } from "@shared/utils/logger";

/**
 * Ensures the necessary collections and documents exist in the database
 * 
 * @param {Object} db - Firestore database instance
 * @param {string} leagueId - The ID of the current league
 */
export const ensureSchemaExists = async (db, leagueId) => {
  if (!db || !leagueId) return;
  
  try {
    // Check if the league document exists
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueDoc = await getDoc(leagueRef);
    
    if (!leagueDoc.exists()) {
      console.error("League does not exist");
      return;
    }
    
    // Check if the default set exists
    const defaultSetRef = doc(db, "leagues", leagueId, "sets", "default");
    const defaultSetDoc = await getDoc(defaultSetRef);
    
    if (!defaultSetDoc.exists()) {
      // Create the default set
      await setDoc(defaultSetRef, {
        players: [],
        teams: [],
        matchups: [],
        scores: [],
        mvpVotes: [],
        leaderboard: {},
        matchHistory: []
      });
    }
    
    // Check if the logs collection already has an initialization log
    const logsRef = collection(db, "leagues", leagueId, "logs");
    const initQuery = query(
      logsRef, 
      where("action", "==", "schema_initialized"),
      limit(1)
    );
    
    const initSnapshot = await getDocs(initQuery);
    
    // Only create initialization log if it doesn't exist already
    if (initSnapshot.empty) {
      log("Creating schema initialization log");
      
      const testLogRef = doc(collection(db, "leagues", leagueId, "logs"));
      await setDoc(testLogRef, {
        action: "schema_initialized",
        details: {
          message: "Log system initialized"
        },
        timestamp: new Date(),
        undoable: false,
        // Add a system user identifier
        userName: "System",
        userId: "system"
      });
    } else {
      log("Schema initialization log already exists");
    }
    
    log("Schema migration completed successfully");
  } catch (error) {
    console.error("Error in schema migration:", error);
  }
};

export default ensureSchemaExists;