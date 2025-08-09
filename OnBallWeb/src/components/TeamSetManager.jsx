import React, { useState, useEffect } from "react";
import { db } from "../firebase"; // Make sure firebase.js exports your initialized db
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

export default function TeamSetManager({ currentSet, setCurrentSet }) {
  const [sets, setSets] = useState([]);
  const [newSetName, setNewSetName] = useState("");

  useEffect(() => {
    const fetchSets = async () => {
      const querySnapshot = await getDocs(collection(db, "sets"));
      const allSets = querySnapshot.docs.map(doc => doc.id);
      setSets(allSets);
    };
    fetchSets();
  }, []);

  const handleCreateSet = async () => {
    if (!newSetName) return;
    const newSet = { players: [], mvpVotes: [], scores: [] };
    await setDoc(doc(db, "sets", newSetName), newSet);
    setSets(prev => [...prev, newSetName]);
    setCurrentSet(newSetName);
    setNewSetName("");
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <label><strong>Active Set:</strong></label>
      <select
        value={currentSet}
        onChange={(e) => setCurrentSet(e.target.value)}
        style={{ marginLeft: "0.5rem" }}
      >
        {sets.map((set) => (
          <option key={set} value={set}>{set}</option>
        ))}
      </select>

      <div style={{ marginTop: "1rem" }}>
        <input
          placeholder="New Set Name"
          value={newSetName}
          onChange={(e) => setNewSetName(e.target.value)}
        />
        <button onClick={handleCreateSet} style={{ marginLeft: "0.5rem" }}>Create Set</button>
      </div>
    </div>
  );
}
