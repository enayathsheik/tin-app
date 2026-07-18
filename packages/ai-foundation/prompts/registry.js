const fs = require('fs');
const path = require('path');

// Resolves (promptId, version?) -> parsed JSON template, defaulting to the
// latest non-deprecated version found on disk under prompts/<promptId>/*.json.
function resolvePrompt(promptId, version) {
  const dir = path.join(__dirname, promptId);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  const templates = files
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => compareVersions(b.version, a.version)); // newest first

  if (version) {
    const exact = templates.find((t) => t.version === version);
    if (!exact) throw new Error(`Prompt ${promptId}@${version} not found`);
    return exact;
  }

  const latest = templates.find((t) => !t.deprecated);
  if (!latest) throw new Error(`No non-deprecated version of prompt ${promptId} found`);
  return latest;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

module.exports = { resolvePrompt };
