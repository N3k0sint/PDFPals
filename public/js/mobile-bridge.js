/**
 * PDFPals Mobile Bridge
 * Handles cross-platform differences between Web, Desktop, and Native Mobile.
 */

const MobileBridge = {
    /**
     * Detects if the app is running as a native Capacitor app (Android/iOS).
     */
    isNative: function() {
        return window.Capacitor && window.Capacitor.isNativePlatform();
    },

    /**
     * Safely saves a file (Blob) to the device.
     * On Web/Desktop: Standard anchor download.
     * On Mobile: Uses Filesystem and Share plugins.
     */
    saveFile: async function(blob, fileName) {
        if (this.isNative()) {
            try {
                // Convert Blob to Base64
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64Data = reader.result.split(',')[1];
                    
                    // 1. Write to temporary cache
                    const savedFile = await window.Capacitor.Plugins.Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: 'CACHE'
                    });

                    // 2. Open Native Share sheet
                    await window.Capacitor.Plugins.Share.share({
                        title: fileName,
                        text: 'Your PDF is ready!',
                        url: savedFile.uri,
                        dialogTitle: 'Save or Share PDF'
                    });
                };
            } catch (error) {
                console.error("Mobile Save Error:", error);
                alert("Mobile Save Error: " + error.message);
            }
        } else {
            // Standard Browser Download Flow
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    },

    /**
     * Provides a generic camera error message compatible with mobile.
     */
    getCameraErrorMessage: function(err) {
        console.error("Camera Error:", err);
        let msg = "Could not access the camera.\n\n";
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            if (this.isNative()) {
                msg += "Please enable Camera permissions in your Phone Settings for PDFPals.";
            } else {
                msg += "Please allow camera access in your browser settings and refresh.";
            }
        } else {
            msg += "Reason: " + err.message;
        }
        return msg;
    }
};

window.MobileBridge = MobileBridge;
