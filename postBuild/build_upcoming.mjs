import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const dataPath = 'static/js/data/gameDataVUpcoming.json';

// Run from the repository root, after npm run protoc && npm run build.
const source = process.argv[2];

assert(source, 'Usage: node postBuild/build_upcoming.mjs <game-source-directory>');
const revision = (directory) => execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const info = {
    nextdex: revision('.'),
    config: revision('er-config'),
    gameSource: revision(source),
    builtAt: new Date().toISOString(),
};

// Clear shit out
rmSync(dataPath, { force: true });


const result = spawnSync(process.execPath, [
    'target/main.js', '-o', 'Upcoming', '-rd', '-ip', source, '-sv', '2', '-nc',
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');

if (result.error) throw result.error;
assert.equal(result.status, 0, 'Data generation failed');

// Fails on any random erorr logs
assert(!/Something went wrong|Failed at gettings|couldn't write/i.test(result.stdout + result.stderr), 'Generator reported a parsing or output failure');

const json = readFileSync(dataPath, 'utf8');
const data = JSON.parse(json);
for (const key of ['species', 'moves', 'abilities', 'trainers', 'items', 'mapsT']) {
    assert(Array.isArray(data[key]) && data[key].length > 0, `Missing or empty ${key}`);
}
assert(data.locations?.maps?.length > 0, 'Missing encounter maps');

const cacheVersion = createHash('sha256').update(json).update(JSON.stringify(info)).digest('hex');
writeFileSync('static/js/deployment_version.js', `export default ${JSON.stringify({ version: 'Upcoming', cacheVersion })};\n`);
writeFileSync('static/build-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(`Validated Upcoming: ${data.species.length} species, ${data.moves.length} moves, ${data.trainers.length} trainers`);
