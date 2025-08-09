// EditPlayerModal.jsx
import React, { useState, useEffect } from "react";
import { StyledButton } from "./UIComponents";
import Tooltip from "./Tooltip";
import { ratingHelp } from "./ratingHelp"; // Import the rating help text

export default function EditPlayerModal({ player, onSave, onClose, isAdminEdit = false }) {
    const [editedPlayer, setEditedPlayer] = useState({
        name: "",
        scoring: 5,
        defense: 5,
        rebounding: 5,
        playmaking: 5,
        stamina: 5,
        physicality: 5,
        xfactor: 5,
        active: true
    });

    // Store the original name to use when saving
    const [originalName, setOriginalName] = useState("");

    // Initialize with player data when modal opens
    useEffect(() => {
        if (player) {
            setEditedPlayer({
                name: player.name || "",
                scoring: player.scoring || 5,
                defense: player.defense || 5,
                rebounding: player.rebounding || 5,
                playmaking: player.playmaking || 5,
                stamina: player.stamina || 5,
                physicality: player.physicality || 5,
                xfactor: player.xfactor || 5,
                active: player.active !== undefined ? player.active : true,
            });

            // Store the original name
            setOriginalName(player.name || "");
        }
    }, [player]);

    const handleChange = (field, value) => {
        setEditedPlayer(prev => ({
            ...prev,
            [field]: field === "name" ? value : Number(value)
        }));

        // Blur the name input when any slider is moved to dismiss keyboard on mobile
        if (field !== "name") {
            const nameInput = document.querySelector('input[type="text"]');
            if (nameInput) {
                nameInput.blur();
            }
        }
    };

    const handleSubmit = () => {
        // Validate input
        if (!editedPlayer.name.trim()) {
            alert("Player name cannot be empty");
            return;
        }

        // Call the onSave function with both the edited player and original name
        onSave(editedPlayer, originalName);
    };

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    // Determine if we're editing an existing player
    const isEditingExisting = !!originalName;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-white">
                    {isEditingExisting ? `Edit ${originalName}` : "Add New Player"}
                </h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                        Name
                    </label>
                    <input
                        type="text"
                        value={editedPlayer.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Player Name"
                    />
                </div>

                {/* Ability scores with tooltips - only show if not admin edit */}
                {!isAdminEdit ? (
                    <>
                        {["scoring", "defense", "rebounding", "playmaking", "stamina", "physicality", "xfactor"].map((ability) => (
                            <div key={ability} className="mb-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-gray-300 flex items-center">
                                        {capitalize(ability)}
                                        <span className="ml-2">
                                            <Tooltip text={ratingHelp[ability]} />
                                        </span>
                                    </label>
                                    <span className="text-sm text-gray-400">{editedPlayer[ability]}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.1"
                                    value={editedPlayer[ability]}
                                    onChange={(e) => handleChange(ability, e.target.value)}
                                    className="w-full mt-1 accent-blue-500"
                                />
                            </div>
                        ))}
                    </>
                ) : (
                    /* Show read-only stats if admin edit */
                    <div className="mb-4 p-3 bg-gray-700 rounded">
                        <div className="text-sm font-medium text-gray-300 mb-2">Current Player Stats (Read-Only)</div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                            <div>Scoring: {editedPlayer.scoring}</div>
                            <div>Defense: {editedPlayer.defense}</div>
                            <div>Rebounding: {editedPlayer.rebounding}</div>
                            <div>Playmaking: {editedPlayer.playmaking}</div>
                            <div>Stamina: {editedPlayer.stamina}</div>
                            <div>Physicality: {editedPlayer.physicality}</div>
                            <div>X-Factor: {editedPlayer.xfactor}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                            Only player names can be edited by admins. Use the rating system to update stats.
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-6">
                    <StyledButton
                        onClick={onClose}
                        className="bg-gray-600 hover:bg-gray-700"
                    >
                        Cancel
                    </StyledButton>
                    <StyledButton
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Save
                    </StyledButton>
                </div>
            </div>
        </div>
    );
}