module.exports = {
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'test', 'docs', 'refactor', 'perf', 'build', 'ci', 'chore'],
    ],
    'type-empty': [2, 'never'],
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'repo', 'ci', 'docker', 'deps', 'docs', 'config', 'db',
        'auth', 'restaurants', 'menu', 'cart', 'orders', 'payments',
        'delivery', 'stats', 'reviews', 'refunds', 'reminders', 'ai',
        'middleware', 'ui',
      ],
    ],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 72],
    'body-empty': [2, 'always'],
    'footer-empty': [2, 'always'],
  },
};
