import typescript from 'rollup-plugin-typescript2';
import serve from 'rollup-plugin-serve';
import nodeResolve from 'rollup-plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import commonjs from 'rollup-plugin-commonjs';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import postcssPresetEnv from 'postcss-preset-env';
import postcssLit from 'rollup-plugin-postcss-lit';

const dev = process.env.ROLLUP_WATCH;
const port = process.env.PORT || 8235;

const serveopts = {
  contentBase: ['./dist'],
  port,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};
const terserOpt = {
  module: true,
  compress: {
    drop_console: ['log', 'error'],
    module: false,
  },
};
const plugins = [
  nodeResolve({}),
  commonjs(),
  typescript({}),
  json(),
  postcss({
    plugins: [
      postcssPresetEnv({
        stage: 1,
        features: {
          'nesting-rules': true,
        },
      }),
    ],
    extract: false,
    inject: false,
  }),
  postcssLit(),
  dev && serve(serveopts),
  !dev && terser(terserOpt),
];

export default [
  {
    input: 'src/main.ts',
    output: [
      {
        file: dev ? 'dist/sidebar-organizer.js' : 'build/sidebar-organizer.js',
        format: 'es',
        sourcemap: dev ? true : false,
        inlineDynamicImports: true,
      },
    ],
    plugins: [...plugins],
    moduleContext: (id) => {
      const thisAsWindowForModules = [
        'node_modules/@formatjs/intl-utils/lib/src/diff.js',
        'node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js',
      ];
      if (thisAsWindowForModules.some((id_) => id.trimRight().endsWith(id_))) {
        return 'window';
      }
    },
    watch: {
      exclude: 'node_modules/**',
      buildDelay: 1000,
      include: 'src/**/*',
    },
  },
];
