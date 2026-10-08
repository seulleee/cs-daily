# 문제 작성 가이드 — 듀오링고식 반복 드릴 (v4, 2026-10-08)

목표: 레슨을 "사실 8개를 한 번씩 묻는 시험"이 아니라 "개념 2~3개를 형태만 바꿔 여러 번 반복하는 드릴"로 만든다.
비전공자가 레슨 하나를 끝내면 그 레슨의 핵심 용어 2~3개를 **정의로 알아보고, 다른 것과 구분하고, 이름을 떠올리고, 한 단계 적용**할 수 있어야 한다.

## 레슨 설계 절차
1. packages/content/curriculum.json 에서 레슨의 name / objective / **keyPoints(핵심 정리 2~4줄, "용어 — 정의")** 를 읽는다. 레슨은 **핵심 개념 1~2개**만 다룬다(유닛당 레슨 7~10개로 잘게 나뉘어 있다).
2. 10문제는 keyPoints에 적힌 용어·정의를 그대로 드릴한다. **keyPoints에 없는 개념을 정답으로 요구하지 않는다** — 학습자는 시작 카드에서 keyPoints만 보고 들어온다.
3. 아래 사다리 순서로 만든다. 같은 개념이 최소 3번, 서로 다른 형태로 나와야 한다.

| 번호 | 역할 | 형태 |
|---|---|---|
| 001~002 | 소개 | keyPoints의 정의를 주고 용어 고르기 (single, 보기 3개, 각 1~3단어) |
| 003~004 | 구분 | 이것은 A? B? (single 보기 2~3개) 또는 한 문장 OX — 흔한 혼동 쌍을 가른다 |
| 005~006 | 빈칸 | 핵심 용어 한 단어 (fill, 한글·영문·숫자만) |
| 007~009 | 적용 | 한 단계 계산·판단·상황 적용 (single 보기 2~4개). "다음 상황에서 일어나는 일은?" 형태 포함 |
| 010 | 되짚기 | 001 개념을 다른 형태로 한 번 더 (single 또는 ox) |

- 유형 비율(레슨당): single 6~7, ox 2, fill 1~2, multi 0 (multi는 쓰지 않는다).
- OX는 레슨당 O 1개 + X 1개. X 문장은 "흔한 혼동"(스택↔큐, WHERE↔HAVING, TCP↔UDP 등)이어야 한다.
- 난이도: 001~005 = 1, 006~010 = 2.

## 문장 규칙 (가장 중요)
- **문제 50자 이내**, 한 문장. 질문 하나만.
- **보기 15자 이내**, 명사구. 문장형 보기 금지. 보기 수는 2~4개.
- **해설 1~2문장(20~120자)**: 정답 근거 한 문장 + (필요하면) 오답이 왜 아닌지 한 문장.
- 전문 용어를 정확히 쓴다. **일상 비유 금지**(접시·줄 서기·택배·우편·주방·엑셀 등 어떤 비유도 안 됨).
- 코드는 쓰지 않는다. 예외: `push(5) → push(7) → pop()` 처럼 연산 나열은 프롬프트 안에 텍스트로 쓴다.
- 계산은 한 단계, 숫자 2~3개.
- 함정·말장난·"항상/절대" 꼬기 금지.

## 형식 규칙
- 파일 경로 `questions/{track}/{unit}/{lessonSlug}.json`, 안에 track/unit/lesson 값. 문제 id는 `{track}-{qslug}-{NNN}` (qslug는 curriculum 설계에서 레슨마다 정한 값, 전 트랙 유일). 파일당 정확히 10문제(001~010).
- 스키마: packages/contracts/src/questions.ts
  - single: content {prompt, options[2..6]}, answer_key {index}
  - ox: content {prompt}, answer_key {value}
  - fill: content {prompt에 "___" 포함, hint? ≤120자}, answer_key {accepted: [...]} — accepted[0]은 한글·영문·숫자·공백만. 변형(한글/영문/띄어쓰기)은 accepted에 넉넉히. hint에 정답을 그대로 적지 않는다.
- tags 2~3개(소문자 kebab), refs는 기존 것 유지 또는 확실한 공식 URL(최대 3).
- 정답 index 위치를 섞는다(0번에 몰리지 않게).
- JSON 2칸 들여쓰기, ensure_ascii=False, 파일 끝 개행.
- 저장 후 레포 루트에서 `pnpm content:validate` 통과 필수.

## 완성 예시 (dsa/u03-stack-queue/l01, 개념: 스택·push/pop·LIFO)
001 single "나중에 넣은 것을 먼저 꺼내는 자료구조는?" [큐, 스택, 배열] → 1
002 single "스택에 원소를 넣는 연산은?" [push, pop, peek] → 0
003 single "원소의 삽입과 삭제가 top 한쪽에서만 일어나는 자료구조는?" [큐, 스택] → 1
004 ox "스택의 pop은 가장 먼저 push한 원소를 꺼낸다." → false
005 ox "스택은 LIFO 구조이다." → true
006 fill "스택에서 원소를 꺼내는 연산은 ___ 이다." accepted [pop, 팝]
007 fill "Last In, First Out의 약자는 ___ 이다." accepted [LIFO, 리포]
008 single "push(5) → push(7) → pop(). 꺼내지는 값은?" [5, 7] → 1
009 single "push(1) → push(2) → pop() → push(3). 지금 top은?" [1, 2, 3] → 2
010 single "LIFO의 뜻은?" [나중에 들어온 것이 먼저 나감, 먼저 들어온 것이 먼저 나감] → 0
