import { build, context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

const isWatch = process.argv.includes('--watch');

async function run() {
  await mkdir('dist', { recursive: true });
  await mkdir('build', { recursive: true });

  const config = {
    entryPoints: {
      'background': 'src/background/main.js',
      'content': 'src/content/main.js',
      'popup': 'src/popup/main.js',
      'options': 'src/options/main.js',
      'styles/popup/popup': 'src/styles/popup/index.css',
      'styles/options/options': 'src/styles/options/index.css',
    },
    outdir: 'build',
    bundle: true,
    format: 'iife',
    target: ['chrome110'],
    sourcemap: true,
    minify: false,
    legalComments: 'none',
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  };

  if (isWatch) {
    const ctx = await context(config);
    await ctx.watch();
  } else {
    await build(config);
  }

  // Keep manifest pointing to original names by copying bundled files back
  await copyFile('build/background.js', 'background.js');
  await copyFile('build/content.js', 'content.js');
  await copyFile('build/popup.js', 'popup/popup.js');
  await copyFile('build/options.js', 'options/options.js');
  await copyFile('build/styles/popup/popup.css', 'popup/popup.css');
  await copyFile('build/styles/options/options.css', 'options/options.css');
  console.log('Build complete.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


