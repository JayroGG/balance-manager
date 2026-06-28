// setupFilesAfterEnv — jest-expo already auto-mocks Expo modules, so (unlike the bare-RN
// employee-mobile-app) we need no expo-modules-core mock here. Keep this minimal; add per-file
// mocks where a specific test needs them. (ADR-010)

// A single, stable fetch mock installed BEFORE any module imports. RTK Query's fetchBaseQuery
// captures `fetch` when baseApi.js is constructed at import time, so the mock must already exist and
// must keep the same identity — tests mutate it (mockResolvedValue / mockReset), never reassign it.
global.fetch = jest.fn();
