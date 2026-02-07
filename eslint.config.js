import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // Default: frontend (browser) files
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser, // ✅ browser globals for React code
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // ✅ Override for API + backend files (Node.js env)
  {
    files: ['pages/api/**/*.{js,ts}', 'lib/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node, // enable process, global, __dirname, etc.
      },
    },
  },
  {
  files: ['pages/_app.js'],
  rules: {
    'no-unused-vars': 'off'
  }
}
])
