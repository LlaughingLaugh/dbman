/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom', // Or 'node' if preferred for server-side only tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle CSS imports (if any in components/modules being tested indirectly)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',

    // Next.js specific mocks or path handling can be added here if needed
    // For example, if 'next/navigation' is used in a way that needs mocking in unit tests
    // '^next/navigation$': '<rootDir>/__mocks__/nextNavigation.js',

    // Path Aliases from tsconfig.json
    '^@/components/(.*)$': '<rootDir>/app/components/$1',
    '^@/lib/(.*)$': '<rootDir>/app/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1', // Broader alias if used
     // If you have a top-level @/* that maps to ./ (project root) for some things
    // AND specific ones like @/app/* that map to ./app/*, order might matter
    // or more specific regex. For now, given tsconfig, this should be okay.
    // For @/* -> ./app/* as per tsconfig:
    '^@/(.*)$': '<rootDir>/app/$1',
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Coverage reporting (optional, but good practice)
  // collectCoverage: true,
  // coverageDirectory: "coverage",
  // coverageProvider: "v8", // or "babel"
};

// Note: The last alias '^@/(.*)$': '<rootDir>/app/$1' is based on the tsconfig's "@/*": ["./app/*"]
// If @/* was meant to be "./*" (root), then it would be '<rootDir>/$1'.
// Given the tsconfig, it seems @/* is also pointing into app.
// If components were outside app and aliased like "@components/*": ["./components/*"]
// then it would be: '^@components/(.*)$': '<rootDir>/components/$1',
// The current setup matches the provided tsconfig.
