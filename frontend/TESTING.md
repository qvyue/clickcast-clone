# Testing Guide

This project uses **Vitest** with **React Testing Library** for unit and integration testing.

## Setup

The testing framework is pre-configured with the following dependencies:

- `vitest` - Fast, Vite-native test runner
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - Custom Jest DOM matchers
- `jsdom` - JavaScript implementation of DOM for Node.js

## Running Tests

```bash
# Run tests in watch mode (recommended during development)
npm test

# Run tests once (for CI/CD)
npm run test:run

# Run tests with coverage report
npm run test:coverage
```

## Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',      // Use jsdom for DOM simulation
    globals: true,              // Enable global test APIs (describe, it, expect)
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

### Test Setup (`src/test/setup.ts`)

```typescript
import '@testing-library/jest-dom'
```

## Writing Tests

### Test File Naming

Place test files next to the source file they test:

```
src/
├── api/
│   ├── client.ts
│   └── client.test.ts      # Test file
├── store/
│   ├── editorStore.ts
│   └── editorStore.test.ts
```

### Example: Testing a Utility Function

```typescript
import { describe, it, expect } from 'vitest'

describe('myUtility', () => {
  it('should return correct value', () => {
    const result = myUtility('input')
    expect(result).toBe('expected output')
  })
})
```

### Example: Testing a React Component

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render title', () => {
    render(<MyComponent title="Hello" />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Example: Testing a Zustand Store

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useMyStore } from './myStore'

describe('useMyStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMyStore.setState({ count: 0 })
  })

  it('should increment count', () => {
    const store = useMyStore.getState()
    store.increment()
    expect(useMyStore.getState().count).toBe(1)
  })
})
```

### Example: Mocking API Calls

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API calls', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should fetch data', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'test' }), { status: 200 })
    )

    const result = await fetchData()
    expect(result).toEqual({ data: 'test' })
  })
})
```

## Current Test Coverage

### API Client (`src/api/client.test.ts`)

- `fetchWithTimeout` - timeout behavior
- `ApiError` - error creation and formatting
- `handleResponse` - JSON parsing and error handling
- URL helper functions (`getScreenshotUrl`, `getAudioUrl`, `getVideoUrl`)
- `saveTimeline` - POST request
- `renderVideo` - render job creation

### Editor Store (`src/store/editorStore.test.ts`)

- `setDomain` - domain switching and state reset
- `setTimeline` - timeline loading
- `selectScene` - scene selection
- `updateScene` - scene updates with boundary checks
- `deleteScene` - scene deletion with startFrame recalculation
- `deleteSceneImage` - image removal
- `setCurrentFrame` - frame tracking
- `setRendering` - render state management
- `save` - save operation

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it.

2. **Use descriptive test names** - Test names should describe the expected behavior.

   ```typescript
   // Good
   it('should return 404 error when resource not found', () => { ... })

   // Bad
   it('error handling', () => { ... })
   ```

3. **Keep tests isolated** - Each test should be independent and not rely on other tests.

4. **Use `beforeEach` for setup** - Reset state before each test to ensure isolation.

5. **Mock external dependencies** - Mock API calls, timers, and external modules to test in isolation.

6. **Test edge cases** - Include tests for boundary conditions and error scenarios.

## Coverage Reports

After running `npm run test:coverage`, view the coverage report:

- **Terminal output** - Summary of coverage by file
- **HTML report** - Open `coverage/index.html` in a browser for detailed line-by-line coverage
