export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
    // CSS optimization for production
    ...(process.env.NODE_ENV === 'production' && {
      cssnano: {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
          normalizeWhitespace: true,
          minifyFontValues: true,
          minifySelectors: true,
        }],
      },
    }),
  },
};
