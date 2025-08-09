import { collection, doc, setDoc } from "firebase/firestore";

/**
 * Logs an activity to the league's log collection with detailed rating information
 * 
 * @param {Object} db - Firestore database instance
 * @param {string} leagueId - The ID of the current league
 * @param {string} action - Type of action (e.g., player_added, player_rating_changed)
 * @param {Object} details - Additional details about the action
 * @param {Object} user - Current user object
 * @param {boolean} undoable - Whether this action can be undone
 * @returns {Promise<boolean>} - Whether logging was successful
 */
export const logActivity = async (db, leagueId, action, details, user, undoable = false) => {
  if (!db || !leagueId) {
    console.warn("logActivity: Missing db or leagueId, skipping activity logging");
    return true;
  }
  
  try {
    console.log("Logging activity:", action, "with details:", details);
    
    // Sanitize user data
    const safeUser = user ? {
      uid: user.uid || "unknown",
      displayName: user.displayName || "",
      email: user.email || ""
    } : { uid: "unknown", displayName: "Unknown User", email: "" };
    
    // For player rating updates, enhance the log details and ensure player name is preserved
    let enhancedDetails = { ...details };
    
    // Make sure the player name is preserved in multiple fields for maximum compatibility
    if (["player_rating_updated", "player_rating_added", "player_rating_changed"].includes(action)) {
      // Create consistent access to player name (checking multiple potential fields)
      const playerName = details.playerName || details.name || details.player || "Unknown Player";
      
      // Explicitly set all player name fields for maximum compatibility
      enhancedDetails.playerName = playerName;
      enhancedDetails.name = playerName;
      enhancedDetails.player = playerName;
      
      console.log("Enhanced player name in log details:", playerName);
    }
    
    // Create log entry with enhanced details
    const logEntry = {
      action,
      details: enhancedDetails,
      userId: safeUser.uid,
      userName: safeUser.displayName || safeUser.email || "Anonymous",
      timestamp: new Date(),
      undoable: Boolean(undoable)
    };
    
    console.log("Final log entry before saving:", logEntry);
    
    try {
      const logsRef = collection(db, "leagues", leagueId, "logs");
      const newLogRef = doc(logsRef);
      await setDoc(newLogRef, logEntry);
      console.log("Activity logged successfully:", action);
      return true;
    } catch (firestoreError) {
      console.error("Firestore error logging activity:", firestoreError);
      return false;
    }
  } catch (error) {
    console.error("Unexpected error in logActivity:", error);
    return false;
  }
};

export default logActivity;