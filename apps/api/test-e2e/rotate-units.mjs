// CI 전용: 콘텐츠 디렉터리를 복사한 뒤 첫 번째 트랙의 첫 유닛을 맨 뒤로 옮긴다.
// 시드가 유닛 순서 변경(sort_order 유니크 제약)을 견디는지 재시드로 확인하기 위한 입력을 만든다.
// 사용: node apps/api/test-e2e/rotate-units.mjs <원본 content 디렉터리> <출력 디렉터리>
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [srcArg, outArg] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error('사용: node rotate-units.mjs <원본 content 디렉터리> <출력 디렉터리>');
  process.exit(2);
}
const src = resolve(srcArg);
const out = resolve(outArg);

cpSync(src, out, { recursive: true });

const file = join(out, 'curriculum.json');
const curriculum = JSON.parse(readFileSync(file, 'utf8'));
const track = curriculum.tracks[0];
if (!track || track.units.length < 2) {
  console.error('회전할 유닛이 2개 이상인 첫 트랙이 없다');
  process.exit(1);
}
const [first] = track.units.splice(0, 1);
track.units.push(first);
writeFileSync(file, `${JSON.stringify(curriculum, null, 2)}\n`);

console.log(`rotated: ${track.slug}/${first.slug} 를 ${track.units.length}번째(맨 뒤)로 이동 -> ${out}`);
