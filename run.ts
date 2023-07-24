import 'colors';
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { runAll } from './lib';

const skipPaths = ['node_modules/'];

const rootDir = resolve(__dirname, '..');

const [ _, __, ..._dirs ] = process.argv;

const dirs = _dirs?.length ? _dirs : [ 'shared', 'app' ];
const testDirs = dirs.map(d => join(rootDir, d));

const addTests = (path: string) => {
  const contents = readdirSync(path);

  for (const entry of contents) {
    const entryPath = join(path, entry);

    if (
      (entry.indexOf('.test.ts') >= 0) &&
      !skipPaths.find(p => entryPath.indexOf(p) >= 0)
    ) {
      const currentFile = entryPath.replace(rootDir, '');
      console.log(`* ${currentFile}`);
      require(entryPath);
    } else {
      const stats = statSync(entryPath);
      if (stats.isDirectory()) addTests(entryPath);
    }
  }
}

const run = async () => {
  try {
    console.log('Collecting test files...');

    for (const testDir of testDirs) {
      addTests(testDir);
    }
    const result = await runAll();
    // writeFileSync('./test.json', JSON.stringify(result, null, '  '));
    process.exit(result.pass ? 0 : 1);
  } catch(e) {
    console.log(`Fatal error: `.red, e);
    process.exit(2);
  }
}

run();
