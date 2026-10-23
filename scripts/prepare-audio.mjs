import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = 'assets/audio', original = root + '/original', web = root + '/web';
for (const dir of [original, web, 'work/audio']) mkdirSync(dir, { recursive: true });
const curl = (url, target) => execFileSync('curl.exe', ['-fL', '--retry', '2', '--connect-timeout', '15', '--max-time', '180', '-o', target, url], { stdio: 'inherit' });
const tracks = [
  ['reminiscing', 'Reminiscing', 'USUAN1100097'], ['earnest', 'Earnest', 'USUAN1100248'],
  ['evening', 'Evening Fall (Piano)', 'USUAN1100235'], ['touching', 'Touching Story', 'USUAN1100036'],
  ['reaching', 'Reaching Out', 'USUAN1100099'],
];
const files = [];
function publish(id, source, options, info) {
  const temp = 'work/audio/' + id + (info.kind === 'music' ? '.mp3' : '.wav');
  if (!existsSync(temp)) execFileSync('ffmpeg.exe', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, ...options, temp], { stdio: 'inherit' });
  const bytes = readFileSync(temp), sha256 = createHash('sha256').update(bytes).digest('hex');
  const name = id + '-' + sha256.slice(0, 16) + path.extname(temp); writeFileSync(web + '/' + name, bytes);
  const probe = JSON.parse(execFileSync('ffprobe.exe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', temp]).toString());
  files.push({ id, path: 'assets/audio/web/' + name, sha256, bytes: bytes.length, duration: Number(probe.format.duration), mime: info.kind === 'music' ? 'audio/mpeg' : 'audio/wav', ...info });
}
for (const [id, title, isrc] of tracks) {
  const source = original + '/' + title + '.mp3', url = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + encodeURIComponent(id === 'evening' ? 'Evening Fall - Piano' : title) + '.mp3';
  if (!existsSync(source)) curl(url, source);
  publish(id, source, ['-af', 'loudnorm=I=-20:TP=-2:LRA=9', '-ar', '44100', '-ac', '2', '-b:a', '160k', '-map_metadata', '-1'], { kind: 'music', title, author: 'Kevin MacLeod', source: url, sourcePage: 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=' + isrc, license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Re-encoded to 160kbps MP3, loudness normalized; runtime fades only.' });
}
const zip = original + '/kenney_impact-sounds.zip';
if (!existsSync(zip)) curl('https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip', zip);
execFileSync('tar.exe', ['-xf', path.resolve(zip), '-C', path.resolve('work/audio')]);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const samples = walk('work/audio').filter(p => /\.ogg$/i.test(p));
const choose = name => samples.find(p => path.basename(p).toLowerCase() === name.toLowerCase());
const effects = [['page', 'impactSoft_medium_000.ogg'], ['deal', 'impactSoft_medium_002.ogg'], ['select', 'impactWood_light_000.ogg'], ['discard', 'impactWood_medium_000.ogg'], ['opponent', 'impactWood_light_001.ogg'], ['close', 'impactSoft_medium_001.ogg']];
for (const [id, name] of effects) {
  const sample = choose(name); if (!sample) { console.log(samples.map(p => path.basename(p))); throw Error('Expected licensed sound sample missing: ' + name); }
  publish(id, sample, ['-af', 'atrim=duration=0.65,afade=t=out:st=0.35:d=0.3,loudnorm=I=-29:TP=-8:LRA=5', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le'], { kind: 'effect', title: name, author: 'Kenney', source: 'https://kenney.nl/assets/impact-sounds', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modifications: 'Trimmed, faded, mono PCM, loudness normalized.' });
}
if (files.reduce((n, f) => n + f.bytes, 0) > 15 * 1024 * 1024) throw Error('Audio exceeds the 15MB release budget');
writeFileSync(root + '/manifest.json', JSON.stringify({ version: 'record-audio-1', files }, null, 2) + '\n');
writeFileSync(root + '/CREDITS.md', '# 未完的牌谱 · 声音署名\n\nMusic by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0.\n\n' + tracks.map(([, title, isrc]) => '- ' + title + ': https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=' + isrc).join('\n') + '\n\nLicense: https://creativecommons.org/licenses/by/4.0/\n\nEffects by Kenney, Impact Sounds, CC0 1.0.\nhttps://kenney.nl/assets/impact-sounds\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\nChanges: loudness normalization, encoding, trimming and fades as recorded in manifest.json. No vocals or original DEEMO recordings are used.\n');
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0) }));
