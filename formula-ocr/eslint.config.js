import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Retained migration references; none are reachable from the current App.
    'src/components/AdminTools.tsx',
    'src/components/DocumentPreview.tsx',
    'src/components/DonationButton.tsx',
    'src/components/FormulaTypeSelector.tsx',
    'src/components/MultiFormulaDetector.tsx',
    'src/components/PDFFormulaViewer/**',
    'src/components/PaymentModal.tsx',
    'src/components/QualityIndicator.tsx',
    'src/components/wholePageRecognition/**',
    'src/utils/advancedFormulaDetection/integrationExample.tsx',
    'src/utils/formatConverter.ts',
    'src/utils/userService.ts',
    'src/utils/wholePageRecognition/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
