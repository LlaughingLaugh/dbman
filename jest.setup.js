// In jest.setup.js or jest.setup.ts
import '@testing-library/jest-dom';

// You can add other global setup items here if needed.
// For example, if you need to mock a global function or object:
/*
global.matchMedia = global.matchMedia || function() {
  return {
    matches : false,
    addListener : function() {},
    removeListener: function() {}
  }
}
*/

// If your server actions or modules they import use 'fetch',
// and you're in a Node environment for tests (or jsdom without full fetch),
// you might need to polyfill fetch or mock it globally.
// Example using whatwg-fetch (install it first: npm install --save-dev whatwg-fetch)
// import 'whatwg-fetch';

// Or, if you prefer to mock fetch globally for all tests:
/*
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'mocked data' }),
    ok: true,
    status: 200,
  })
);
*/

// Silence console.error and console.warn during tests if they are too noisy
// and not indicative of actual test failures.
/*
let originalError;
let originalWarn;

beforeAll(() => {
  originalError = console.error;
  originalWarn = console.warn;
  console.error = (...args) => {
    // Suppress specific errors or all
    // if (args[0] && args[0].toString().includes('specific error to ignore')) {
    //   return;
    // }
    // originalError(...args); // Uncomment to still see them
  };
  console.warn = (...args) => {
    // Suppress specific warnings or all
    // originalWarn(...args); // Uncomment to still see them
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
*/
