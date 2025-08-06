import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export const isNativePlatform = () => {
    try {
        return Capacitor.isNativePlatform();
    } catch (error) {
        return false;
    }
};

export const takePicture = async () => {
    try {
        if (!isNativePlatform()) {
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';

                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            resolve(event.target.result);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    } else {
                        reject(new Error('No file selected'));
                    }
                };

                input.click();
            });
        }

        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: true,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
        });

        return image.dataUrl;
    } catch (error) {
        console.error('Error taking picture:', error);
        throw error;
    }
};

export const pickImage = async () => {
    try {
        if (!isNativePlatform()) {
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';

                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            resolve(event.target.result);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    } else {
                        reject(new Error('No file selected'));
                    }
                };

                input.click();
            });
        }

        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: true,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Photos,
        });

        return image.dataUrl;
    } catch (error) {
        console.error('Error picking image:', error);
        throw error;
    }
};

// Upload image to Firebase Storage
export const uploadPlayerPhoto = async (imageDataUrl, playerName, userId) => {
    try {
        console.log('Starting photo upload for:', playerName);

        // Convert data URL to blob
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();

        // Create filename
        const timestamp = Date.now();
        const cleanPlayerName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `player_photos/${userId}/${cleanPlayerName}_${timestamp}.jpg`;

        // Create storage reference
        const storageRef = ref(storage, filename);

        // Upload the file
        console.log('Uploading to Firebase Storage...');
        const snapshot = await uploadBytes(storageRef, blob);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Photo uploaded successfully:', downloadURL);

        return {
            success: true,
            downloadURL,
            filename,
            path: snapshot.ref.fullPath
        };
    } catch (error) {
        console.error('Error uploading photo:', error);
        throw error;
    }
};