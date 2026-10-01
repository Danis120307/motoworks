const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  Chart: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'public/css/output.css',
      'prisma/migrations/**',
      'coverage/**',
      'prisma/*.db',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^(next|_)$', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-var': 'warn',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
];
