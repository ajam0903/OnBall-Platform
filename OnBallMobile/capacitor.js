import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

export const takePicture = async () => {
    try {
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
        });

        return image.webPath;
    } catch (error) {
        console.error('Error taking picture:', error);
        throw error;
    }
};

export const pickImage = async () => {
    try {
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Uri,
            source: CameraSource.Photos,
        });

        return image.webPath;
    } catch (error) {
        console.error('Error picking image:', error);
        throw error;
    }
};