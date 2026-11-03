import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * APP_VARIANT is set per EAS build profile so a development build, a preview build, and
 * the store build can sit side by side on one phone.
 */
const variant = process.env.APP_VARIANT ?? 'production';
const suffix = variant === 'production' ? '' : `.${variant}`;
const nameSuffix = variant === 'development' ? ' (Dev)' : variant === 'preview' ? ' (Preview)' : '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Evenly${nameSuffix}`,
  slug: 'evenly',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'evenly',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FFF4E6',
  ios: {
    bundleIdentifier: `app.evenly${suffix}`,
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        'Evenly uses the camera to photograph receipts. The photo is read on this device and never uploaded.',
      NSPhotoLibraryUsageDescription:
        'Evenly can read a receipt from a photo you pick. It is read on this device and never uploaded.',
    },
  },
  android: {
    package: `app.evenly${suffix}`,
    adaptiveIcon: {
      backgroundColor: '#FF6A3D',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: 'Evenly',
    shortName: 'Evenly',
    themeColor: '#FF6A3D',
    backgroundColor: '#FFF4E6',
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-localization',
    'expo-font',
    [
      'expo-image-picker',
      {
        cameraPermission:
          'Evenly uses the camera to photograph receipts. The photo is read on this device and never uploaded.',
        photosPermission:
          'Evenly can read a receipt from a photo you pick. It is read on this device and never uploaded.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        backgroundColor: '#FFF4E6',
        dark: { image: './assets/images/splash-icon.png', backgroundColor: '#1C1021' },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
