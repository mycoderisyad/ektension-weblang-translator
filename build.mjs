import { build, context } from 'esbuild';
import { mkdir, copyFile, rm, cp } from 'node:fs/promises';

const isWatch = process.argv.includes('--watch');

async function copyStaticFiles() {
  await mkdir('build/popup', { recursive: true });
  await mkdir('build/options', { recursive: true });
  await mkdir('build/assets', { recursive: true });

  await copyFile('manifest.json', 'build/manifest.json');
  await copyFile('popup/popup.html', 'build/popup/popup.html');
  await copyFile('options/options.html', 'build/options/options.html');

  await cp('assets', 'build/assets', { recursive: true, force: true });
}

async function run() {
  await rm('build', { recursive: true, force: true });
  await mkdir('build', { recursive: true });

  const config = {
    entryPoints: {
      'background': 'src/background/main.js',
      'content': 'src/content/main.js',
      'popup/popup': 'src/popup/main.js',
      'options/options': 'src/options/main.js',
      'styles/popup/popup': 'src/styles/popup/index.css',
      'styles/options/options': 'src/styles/options/index.css',
      'styles/content/aiPopup': 'src/styles/content/aiPopup.css',
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
    await copyStaticFiles();
    await ctx.watch();
    console.log('Watching source files. Load extension from build/ folder.');
  } else {
    await build(config);
    await copyStaticFiles();
    console.log('Build complete. Load extension from build/ folder.');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


