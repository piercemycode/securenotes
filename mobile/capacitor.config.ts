import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.piercemycode.securenotes',
    appName: 'SecureNotes',
    webDir: '../web',
    bundledWebRuntime: false,
    server: {
        androidScheme: 'https',
        allowNavigation: [
            'firestore.googleapis.com',
            'identitytoolkit.googleapis.com',
            '*.firebaseio.com'
        ]
    },
    android: {
        backgroundColor: '#0d0d1a',
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
        buildOptions: {
            keystorePath: 'securenotes.keystore',
            keystoreAlias: 'securenotes'
        }
    },
    ios: {
        backgroundColor: '#0d0d1a',
        contentInset: 'always',
        scrollEnabled: true,
        allowNativeLongPress: true
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 1500,
            backgroundColor: '#0d0d1a',
            showSpinner: false,
            androidSplashResourceName: 'splash',
            androidScaleType: 'center',
            iosSpinnerStyle: 'small',
            spinnerColor: '#7c3aed'
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#0d0d1a',
            overlaysWebView: false
        }
    }
};

export default config;