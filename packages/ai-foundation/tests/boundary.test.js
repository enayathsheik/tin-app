const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = path.join(__dirname, '..');
const ALLOWED_IMPORTER = path.join('providers', 'openai', 'adapter.js');
const SKIP_DIRS = new Set(['node_modules', 'tests', '.git']);
const OPENAI_IMPORT_PATTERN = /require\(['"]openai['"]\)|from\s+['"]openai['"]/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

describe('OpenAI SDK import boundary', () => {
  it('is only imported from providers/openai/adapter.js', () => {
    const offenders = walk(PACKAGE_ROOT)
      .filter((file) => path.relative(PACKAGE_ROOT, file) !== ALLOWED_IMPORTER)
      .filter((file) => OPENAI_IMPORT_PATTERN.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(PACKAGE_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
