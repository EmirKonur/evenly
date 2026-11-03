const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/**
 * Money and receipt code works in integer minor units only. These selectors catch the ways
 * a float usually sneaks back in: a decimal literal, a division, a rounding call, or
 * parseFloat/toFixed. The branded `Cents` type catches the rest at compile time.
 */
const integerMoneyRules = [
  {
    selector: 'Literal[raw=/^\\d*\\.\\d+(e[-+]?\\d+)?$/i]',
    message: 'No float literals in money code. Amounts are integer minor units (Cents).',
  },
  {
    selector: "BinaryExpression[operator='/'], AssignmentExpression[operator='/=']",
    message: 'No division in money code. Use allocate() so every unit lands somewhere.',
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name=/^(round|floor|ceil|trunc)$/]",
    message: 'No rounding in money code. Use allocate() or parseDecimal().',
  },
];

const floatParsingRules = [
  {
    selector:
      "CallExpression[callee.name='parseFloat'], CallExpression[callee.property.name='parseFloat']",
    message: 'parseFloat loses money precision. Use parseMoney() or parseDecimal().',
  },
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: 'toFixed rounds binary floats. Use formatMoney().',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'ios/*', 'android/*', 'drizzle/migrations.js'],
  },
  {
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...floatParsingRules],
    },
  },
  {
    files: ['src/money/**/*.ts', 'src/receipt/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...floatParsingRules, ...integerMoneyRules],
    },
  },
]);
