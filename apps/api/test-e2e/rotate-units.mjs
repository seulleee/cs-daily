// CI 전용: 콘텐츠 디렉터리를 복사한 뒤
//  1) 첫 번째 트랙의 첫 유닛을 맨 뒤로 옮기고 (시드가 유닛 순서 변경 — sort_order 유니크 제약 — 을 견디는지 확인),
//  2) 그 유닛의 마지막 레슨을 커리큘럼과 문제 파일에서 뺀다 (시드가 콘텐츠에서 빠진 레슨을 지우지 않고 sortOrder 음수 "퇴역"으로 남기는지 확인).
// 재시드 입력을 만드는 용도다. 원본 content 디렉터리는 건드리지 않는다.
// 사용: node apps/api/test-e2e/rotate-units.mjs <원본 content 디렉터리> <출력 디렉터리>
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// 회전한 유닛의 마지막 레슨을 뺀다. 레슨이 하나 남아야 유닛이 비지 않는다
if (first.lessons.length < 2) {
  console.error(`${track.slug}/${first.slug}: 레슨이 2개 이상이어야 마지막 레슨을 뺄 수 있다`);
  process.exit(1);
}
const [removed] = first.lessons.splice(first.lessons.length - 1, 1);
// 문제 파일이 남아 있으면 content validate/시드가 "커리큘럼에 없는 레슨"으로 실패하므로 같이 지운다
const questionFile = join(out, 'questions', track.slug, first.slug, `${removed.slug}.json`);
if (!existsSync(questionFile)) {
  console.error(`뺄 레슨의 문제 파일이 없다: ${questionFile}`);
  process.exit(1);
}
rmSync(questionFile);

writeFileSync(file, `${JSON.stringify(curriculum, null, 2)}\n`);

console.log(`rotated: ${track.slug}/${first.slug} 를 ${track.units.length}번째(맨 뒤)로 이동 -> ${out}`);
console.log(`removed: ${track.slug}/${first.slug}/${removed.slug} 를 커리큘럼과 문제 파일에서 제외`);
