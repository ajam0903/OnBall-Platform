import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "./firebase";
import ErrorBoundary from "./components/ErrorBoundary";
import './App.css'
import { takePicture, pickImage, isNativePlatform, uploadPlayerPhoto } from "./utils/capacitor";

export default function OnBallMobile() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [activeTab, setActiveTab] = useState("teams");
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        setIsMobile(isNativePlatform());
    }, []);

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("Auth change:", currentUser ? 'signed in' : 'signed out');
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Handle Google Sign In
    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in:", error);
            alert("Sign in failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle Sign Out
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setShowUserMenu(false);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleCameraTest = async () => {
        try {
            console.log('Testing camera...');
            const imageUrl = await takePicture();
            console.log('Photo captured!');

            if (imageUrl) {
                showImageModal(imageUrl);
            }
        } catch (error) {
            console.error('Camera test failed:', error);
            alert('Camera failed: ' + error.message);
        }
    };

    const handleGalleryTest = async () => {
        try {
            console.log('Testing gallery...');
            const imageUrl = await pickImage();
            console.log('Image selected!');

            if (imageUrl) {
                showImageModal(imageUrl);
            }
        } catch (error) {
            console.error('Gallery test failed:', error);
            alert('Gallery failed: ' + error.message);
        }
    };

    const showImageModal = (imageUrl) => {
        // Remove any existing modals first
        const existingModal = document.getElementById('photo-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'photo-modal';
        modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
    `;

        const container = document.createElement('div');
        container.style.cssText = `
        background: #1f2937;
        border-radius: 12px;
        padding: 20px;
        max-width: 90vw;
        max-height: 90vh;
        text-align: center;
        position: relative;
        overflow: hidden;
    `;

        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        border-radius: 8px;
        margin-bottom: 20px;
        object-fit: contain;
    `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
    `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
        background: #6b7280;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
    `;

        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = 'Upload to Firebase';
        uploadBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
    `;

        closeBtn.onclick = () => {
            document.body.removeChild(modal);
        };

        uploadBtn.onclick = async () => {
            if (user) {
                try {
                    uploadBtn.textContent = 'Uploading...';
                    uploadBtn.disabled = true;

                    const result = await uploadPlayerPhoto(imageUrl, 'TestPlayer', user.uid);

                    if (result.success) {
                        alert('✅ Upload successful!\n\nFirebase URL:\n' + result.downloadURL);
                        document.body.removeChild(modal);
                    }
                } catch (error) {
                    alert('❌ Upload failed: ' + error.message);
                    uploadBtn.textContent = 'Upload to Firebase';
                    uploadBtn.disabled = false;
                }
            }
        };

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        buttonContainer.appendChild(closeBtn);
        buttonContainer.appendChild(uploadBtn);
        container.appendChild(img);
        container.appendChild(buttonContainer);
        modal.appendChild(container);
        document.body.appendChild(modal);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "teams":
                return (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">Teams</h3>
                        <p className="text-center">Generate balanced teams</p>
                        {user && (
                            <p className="text-sm text-green-400 mt-2">✅ Signed in as {user.displayName}</p>
                        )}
                    </div>
                );
            case "players":
                return (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">Players</h3>
                        <p className="text-center mb-4">Player rankings and ratings</p>

                        <div className="space-y-3 w-full max-w-xs">
                            <button
                                className="btn w-full flex items-center justify-center gap-2"
                                onClick={handleCameraTest}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {isMobile ? 'Take Photo' : 'Select Photo'}
                            </button>

                            <button
                                className="btn-secondary w-full flex items-center justify-center gap-2"
                                onClick={handleGalleryTest}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Choose from Gallery
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mt-4 text-center">
                            {isMobile ? 'Camera functions ready!' : 'File picker ready for web'}
                        </p>
                    </div>
                );
            case "stats":
                return (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">Stats</h3>
                        <p className="text-center">Leaderboard and statistics</p>
                    </div>
                );
            case "awards":
                return (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707L18 6M21 12h-1M4 12H3m3.343-5.657l-.707-.707L6 6m2.5 7a4.5 4.5 0 11-4.5-4.5 4.5 4.5 0 014.5 4.5z" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">Awards</h3>
                        <p className="text-center">Belts and badges</p>
                    </div>
                );
            case "logs":
                return (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">Logs</h3>
                        <p className="text-center">Match history</p>
                    </div>
                );
            default:
                return <div>Unknown tab</div>;
        }
    };

    // Show loading screen
    if (loading) {
        return (
            <div className="mobile-safe-area h-full flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white">Loading OnBall...</p>
                </div>
            </div>
        );
    }

    // Show sign-in screen if not authenticated
    if (!user) {
        return (
            <ErrorBoundary>
                <div className="mobile-safe-area h-full flex flex-col items-center justify-center bg-gray-900 p-8">
                    <div className="text-center max-w-sm">
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold text-white mb-2">OnBall</h1>
                            <p className="text-gray-400">Basketball Team Generator</p>
                            {isMobile && (
                                <span className="inline-block text-xs bg-blue-600 text-white px-2 py-1 rounded mt-2">Mobile</span>
                            )}
                        </div>

                        <div className="mb-8">
                            <svg className="w-20 h-20 mx-auto text-orange-500 mb-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                        </div>

                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full bg-white text-gray-900 font-medium py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign in with Google
                        </button>

                        <p className="text-gray-500 text-sm mt-4">
                            Sign in to access your leagues and generate teams
                        </p>
                    </div>
                </div>
            </ErrorBoundary>
        );
    }

    // Main app when authenticated
    return (
        <ErrorBoundary>
            <div className="mobile-safe-area h-full flex flex-col bg-gray-900">
                {/* Header */}
                <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-white">OnBall</h1>
                        {isMobile && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Mobile</span>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium"
                        >
                            {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </button>

                        {showUserMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                                <div className="p-3 border-b border-gray-700">
                                    <p className="text-white font-medium truncate">{user.displayName}</p>
                                    <p className="text-gray-400 text-sm truncate">{user.email}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden">
                    {renderTabContent()}
                </div>

                {/* Bottom Navigation */}
                <div className="bg-gray-800 border-t border-gray-700 p-2">
                    <div className="flex justify-around items-center">
                        <button
                            onClick={() => setActiveTab("teams")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "teams" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-xs">Teams</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("players")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "players" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-xs">Players</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("stats")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "stats" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">Stats</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("awards")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "awards" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707L18 6M21 12h-1M4 12H3m3.343-5.657l-.707-.707L6 6m2.5 7a4.5 4.5 0 11-4.5-4.5 4.5 4.5 0 014.5 4.5z" />
                            </svg>
                            <span className="text-xs">Awards</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("logs")}
                            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === "logs" ? "text-blue-400 bg-gray-700" : "text-gray-400"
                                }`}
                        >
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs">Logs</span>
                        </button>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}