import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: ['test/**/*.test.js'],
  nodeResolve: true,
  concurrency: 1,
  testFramework: {
    config: {
      timeout: '10000',
    },
  },
  plugins: [
    {
      name: 'resolve-node-builtins',
      resolveImport({ source }) {
        if (['fs', 'path', 'http', 'https', 'url', 'stream', 'zlib', 'canvas', 'path2d'].includes(source)) {
          return '/test/mocks/empty-module.js';
        }
      },
    },
  ],
  testRunnerHtml: (testFramework) => `
    <!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="/css/reset.css" />
        <link rel="stylesheet" href="/css/shoelace.css" />
        <link rel="stylesheet" href="/css/container.css" />
        <link rel="stylesheet" href="/css/utils.css" />
        <link rel="stylesheet" href="/css/cropper.css" />
        <link rel="stylesheet" href="/css/main.css" />
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
};
