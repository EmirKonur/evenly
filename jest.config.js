const pnpmAware = (packages) => `node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:${packages})/)`;

const transpiledPackages = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  'expo-.*',
  'react-navigation',
  '@react-navigation/.*',
  'react-native-.*',
  'lucide-react-native',
].join('|');

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'domain',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/src/{money,receipt,data,features}/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'ui',
      preset: 'jest-expo/ios',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      transformIgnorePatterns: [pnpmAware(transpiledPackages)],
      setupFiles: ['<rootDir>/jest.polyfills.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // The package's "exports" pick an .mjs build that Jest's CommonJS runtime cannot load.
        '^lucide-react-native$':
          '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
      },
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__fixtures__/**',
    '!src/app/**',
  ],
  coverageReporters: ['text-summary', 'text', 'lcov'],
};
