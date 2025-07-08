module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [],
  rules: {
    // 禁用所有规则
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'vue/no-unused-vars': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'no-debugger': 'off',
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
} 
