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
- 코드는 쓰지 않는다(eip·ct·ai 트랙의 코드 빈칸 문제 제외). 예외: `push(5) → push(7) → pop()` 처럼 연산 나열은 프롬프트 안에 텍스트로 쓴다.
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

## 도입 설명(intro) 작성 규칙
curriculum.json 레슨의 선택 필드 `intro`(문단 배열)다. 레슨 시작 카드에서 레슨 이름 아래, 핵심 정리(keyPoints) **위**에 보인다. 없는 레슨은 핵심 정리만 보인다.
- **목적**: keyPoints를 처음 보는 사람이 이해할 수 있게 한다. keyPoints가 전제하는 용어(호스트, 프로세스, 포트 등)를 먼저 정의하고, 이 개념이 **왜 필요한지**를 먼저 말한다.
- **분량**: 1~3문단, 문단당 40~220자, 합계 450자 이내. `pnpm content:validate`가 강제한다.
- **keyPoints를 그대로 반복하지 않는다.** keyPoints의 문장이 문단에 통째로 들어 있으면 validate가 막는다. 정의는 keyPoints가, 배경과 필요성은 intro가 맡는다.
- **뒤 레슨(뒤 유닛) 개념을 미리 쓰지 않는다.** 유닛 순서 원칙을 그대로 따른다.
- **비유 금지 원칙 유지.** 일상 비유 없이 전문 용어를 쓰되, 처음 나오는 용어는 문단 안에서 한 번 풀어 준다.
- intro에서 정의한 용어도 문제의 정답으로 요구하려면 keyPoints에 있어야 한다(학습자가 핵심 정리를 기준으로 학습한다).
- 형식: `"intro": ["첫 문단", "둘째 문단"]`. 문단 단위로 줄바꿈되며 마크업은 쓰지 않는다.

## 유닛 순서 원칙
- 트랙 안의 유닛은 **구체(자료구조 조작·동작) → 추상(분석·표기)** 순서로 둔다. 예: 자료구조 트랙은 배열·연결 리스트 → 스택·큐·덱 → 복잡도 분석.
- 앞 유닛의 keyPoints·문제·보기·해설에 뒤 유닛의 개념(O 표기, 상각 등)을 쓰지 않는다. 앞에서는 "한 번", "뒤 원소 수만큼", "n번" 같은 연산 횟수로 말하고, 뒤 유닛에서 이미 본 동작에 이름을 붙인다.
- 유닛 slug의 숫자(u01, u02…)는 생성 당시 순서일 뿐이고, 실제 순서는 curriculum.json의 배열 순서다(시드가 배열 위치로 sortOrder를 매긴다). slug는 진도 보존 때문에 바꾸지 않는다.

## 정보처리기사(eip) 트랙 (2026-10-14, 뼈대만 — 비공개 phase2)
- 범위: **필기 5과목**(2020 개편 구조: 소프트웨어 설계 / 소프트웨어 개발 / 데이터베이스 구축 / 프로그래밍 언어 활용 / 정보시스템 구축 관리). 현행 출제기준 문서와 대조하기 전이다. 2022년 필기 시험지 2회분의 과목명·순서가 이 구조와 같았다. 실기는 범위 밖.
- 유닛 이름은 "과목 짧은 이름 · 주제"(설계·개발·DB·언어·관리), 과목 순서는 시험 과목 순서, 과목 안에서는 위의 유닛 순서 원칙(구체 → 추상)을 따른다.
- 일반 레슨은 위 사다리·문장 규칙을 그대로 따른다. **각 유닛의 마지막 레슨 "모의 문제: {주제}"**는 실제 시험 형식으로 그 유닛을 점검한다. 10문제 모두 single 4지선다로 내고, 유닛의 다른 레슨 keyPoints에 나온 개념만 정답으로 요구한다(세부 형식은 문제 작성 PR에서 확정).
- **기출문제의 문장·보기·해설은 어떤 파일에도 옮기지 않는다**(바꿔 쓰기도 금지). 기출은 "어떤 개념이 자주 나오는지" 비중을 정하는 데만 쓴다. 문제는 출제 범위 항목과 keyPoints만 보고 새로 쓴다.
- 기존 트랙과 겹치는 용어(DB·OS·네트워크·자료구조)는 그 트랙 keyPoints의 정의와 같은 문장을 쓴다. 시험에서만 쓰는 뜻이 따로 있으면(카디널리티 = 튜플 수, DCL에 COMMIT·ROLLBACK 포함 등) 시험 정의를 쓰되, 해설에서 실무 뜻과 구분해 준다.
- 코드 블록은 이 트랙에서만, 아래 "코드 빈칸 문제" 형태로만 쓴다. 다른 트랙은 코드 금지 그대로다.

### 코드 빈칸 문제 (eip·ct·ai·aws·sec 전용, validate가 강제)
- **짧은 코드(5~10줄) 안의 빈칸을 채우거나 고르는 문제만** 낸다. 전체 코드 작성 문제와 실행 결과를 장문으로 서술하는 문제는 내지 않는다.
- `content.code = { "language", "source" }`. language는 `c` · `java` · `python` · `sql` · `pseudo` 중 하나. `bash`·`json`·`hcl`은 aws 트랙 전용(AWS CLI·IAM/S3 정책·Terraform). `http`·`html`은 sec 트랙 전용(보안 헤더·쿠키 속성, 출력 인코딩 템플릿). 탭 대신 공백을 쓴다.
- `json` 코드는 validate가 빈칸(`___`)을 정답(fill은 `accepted[0]`, single은 정답 보기)으로 채운 뒤 `JSON.parse`로 검사한다. 파싱이 안 되면 실패하므로 따옴표·쉼표·중괄호까지 정답에 맞게 쓴다.
- 코드는 **12줄 이하, 한 줄 48자 이하**(모바일 폭에서 가로 스크롤을 줄이기 위해). 빈칸은 코드 안에 `___`로 **정확히 1개**(fill). single은 0~1개.
- fill: 빈칸 자리에 쓸 답이 한글·영문·숫자·공백뿐일 때만(`extends`, `static`, `SELECT`). `prompt`에는 `___`가 없어도 된다(질문만 쓴다).
- 기호가 필요한 답(`i++`, `->`, `==`, `%`)은 **single**로 내고 코드 안 `___`에 들어갈 것을 보기에서 고르게 한다.
- 실행 결과를 묻는 문제는 결과값이 짧은 한 줄일 때만 single로 낸다(코드에 빈칸을 두지 않고 "출력값은?"). 추적이 길어지는 코드는 쓰지 않는다.
- 필기 4과목(프로그래밍 언어 활용) 레슨과 각 유닛의 모의 문제에서 쓴다. 다른 과목은 코드 없이 낸다.
- keyPoints에 없는 문법·개념을 빈칸 정답으로 요구하지 않는다. 코드 주석으로 정답을 알려 주지 않는다.

fill 예시 (java, `extends` 빈칸):

```json
{
  "id": "eip-javainherit-005",
  "type": "fill",
  "difficulty": 2,
  "tags": ["java", "상속"],
  "content": {
    "prompt": "자식 클래스가 부모를 상속하는 키워드는?",
    "code": {
      "language": "java",
      "source": "class Animal {}\nclass Dog ___ Animal {\n    void bark() {}\n}"
    }
  },
  "answer_key": { "accepted": ["extends"] },
  "explanation": "Java에서 클래스 상속은 extends 키워드로 표현하며, Dog가 Animal의 멤버를 물려받는다."
}
```

single 예시 (c, 출력값 고르기):

```json
{
  "id": "eip-cprint-007",
  "type": "single",
  "difficulty": 2,
  "tags": ["c", "연산자"],
  "content": {
    "prompt": "출력되는 값은?",
    "code": {
      "language": "c",
      "source": "int a = 7;\nint b = 2;\nprintf(\"%d\", a / b);"
    },
    "options": ["3", "3.5", "4"]
  },
  "answer_key": { "index": 0 },
  "explanation": "int끼리의 나눗셈은 소수점 아래를 버리므로 7 / 2는 3이 된다."
}
```

## 코딩 테스트(ct) 트랙 (뼈대 전)
알고리즘 사고를 같은 문제 형식(single·ox·fill + 코드 빈칸)으로 드릴한다.
- **코드 빈칸 허용**: 위 "코드 빈칸 문제" 규칙(12줄·48자·빈칸 개수·기호 답은 single)을 그대로 쓴다.
- **코드가 있는 문제는 언어별 variants로만 낸다**(validate가 강제). 사용자가 설정·온보딩에서 고른 언어(python·java·javascript·cpp)의 코드만 나가고, 채점도 그 언어 버전으로 한다. 코드가 없는 문제는 언어와 무관하게 하나다.
  - `content.code`는 쓰지 않는다. 대신 `content.variants`에 **4개 언어를 모두** 둔다(하나라도 빠지면 실패). variants는 `ct` 트랙에서만 허용된다.
  - 파일 관례(content = 화면에 나가는 것, answer_key = 서버 전용)를 그대로 따른다: 코드와 보기는 `content.variants[lang]`(`code`, 필요하면 `options`), 정답은 `answer_key.variants[lang]`(single `{ index }` · fill `{ accepted }` · ox `{ value }`). 언어 키 집합이 둘이 같아야 하고 `code.language`는 키와 같은 값이다.
  - `prompt`·`hint`·`explanation`은 공통이다. 언어 때문에 해설이 달라야 하면 `answer_key.variants[lang].explanation`에만 따로 쓴다(없으면 공통 해설).
  - single의 보기는 `content.options`(공통)에 두고, 언어마다 달라야 할 때만 `variants[lang].options`로 덮는다. **정답 index는 언어별로 따로 센다**(보기가 다르면 위치도 다르다).
  - 각 variant 코드에 12줄·48자·빈칸 개수 규칙을 따로 적용한다. fill의 대표 정답(`accepted[0]`)은 한글·영문·숫자·공백에 더해 식별자용 밑줄(`push_back`)을 허용한다. `()`·`.` 같은 기호가 필요하면 single로 낸다.
  - 언어 문법 차이를 묻는 문제가 아니라면 4개 언어가 **같은 알고리즘·같은 개념**을 가리키게 쓴다(변수 이름·구조를 맞춘다).

fill 예시 (리스트 끝에 원소 추가 — python `append` / java `add` / javascript `push` / cpp `push_back`):

```json
{
  "id": "ct-listadd-005",
  "type": "fill",
  "difficulty": 1,
  "tags": ["리스트", "추가"],
  "content": {
    "prompt": "리스트 끝에 3을 추가하는 메서드는?",
    "variants": {
      "python": { "code": { "language": "python", "source": "a = [1, 2]\na.___(3)" } },
      "java": { "code": { "language": "java", "source": "List<Integer> a = new ArrayList<>();\na.___(3);" } },
      "javascript": { "code": { "language": "javascript", "source": "const a = [1, 2];\na.___(3);" } },
      "cpp": { "code": { "language": "cpp", "source": "vector<int> a = {1, 2};\na.___(3);" } }
    }
  },
  "answer_key": {
    "variants": {
      "python": { "accepted": ["append"] },
      "java": { "accepted": ["add"] },
      "javascript": { "accepted": ["push"] },
      "cpp": { "accepted": ["push_back", "pushback"] }
    }
  },
  "explanation": "리스트 끝에 원소를 넣는 메서드 이름은 언어마다 다르다."
}
```

single 예시 (같은 코드 모양이라도 결과가 언어마다 다른 경우 — 정답 index가 언어별):

```json
{
  "id": "ct-divide-007",
  "type": "single",
  "difficulty": 2,
  "tags": ["나눗셈"],
  "content": {
    "prompt": "출력되는 값은?",
    "options": ["3", "3.5"],
    "variants": {
      "python": { "code": { "language": "python", "source": "print(7 // 2)" } },
      "java": { "code": { "language": "java", "source": "System.out.println(7 / 2);" } },
      "javascript": { "code": { "language": "javascript", "source": "console.log(7 / 2);" } },
      "cpp": { "code": { "language": "cpp", "source": "cout << 7 / 2;" } }
    }
  },
  "answer_key": {
    "variants": {
      "python": { "index": 0, "explanation": "파이썬의 // 는 몫(정수 나눗셈)을 구하므로 7 // 2 는 3이 된다." },
      "java": { "index": 0 },
      "javascript": { "index": 1 },
      "cpp": { "index": 0 }
    }
  },
  "explanation": "JavaScript는 정수 나눗셈이 없어 7 / 2가 3.5이고, 나머지 언어는 정수 몫 3이다."
}
```

## AI·ML(ai) 트랙 (2026-10-23 공개)
머신러닝 기초 이론(유닛 1~7)과 LLM 활용 실무(유닛 8~12)를 반반 다룬다. 독자는 백엔드 개발자·비전공자이고, 수식은 최소로 정의와 동작 위주로 쓴다.
- **유닛 순서**: 기본 → 데이터 → 회귀·분류 → 평가 → 트리·앙상블 → 신경망 → 딥러닝 구조 → 임베딩 → LLM 기초 → LLM 활용 → RAG·에이전트 → 평가·운영. 앞 유닛에 뒤 유닛 용어(1~7유닛의 임베딩·LLM·RAG·프롬프트·토큰, 1~5유닛의 신경망 등)를 정답·보기로 쓰지 않는다.
- **코드 빈칸 허용**: 위 "코드 빈칸 문제" 규칙(12줄·48자·빈칸 개수·기호 답은 single)을 그대로 쓴다. `content.code` 하나만 쓰고 언어는 `python` 단일(variants 없음). NumPy·scikit-learn·PyTorch의 짧은 조각만 쓰고, 정답이 되는 메서드·클래스 이름은 그 레슨 keyPoints에 있어야 한다(`fit`, `predict_proba`, `backward` 등). 밑줄이 들어간 이름(`zero_grad`, `train_test_split`)은 fill 대표 정답이 될 수 없으니 single로 낸다.
- **코드는 실행 검증 필수**: 실행 결과·출력을 묻는 문제는 실제로 돌려 본 값만 정답으로 쓴다(라이브러리 버전에 따라 달라지는 출력 형식은 묻지 않는다).
- **벤더 숫자·이름 금지**: 특정 회사의 모델명·API 이름·가격·컨텍스트 길이·벤치마크 점수는 쓰지 않는다. "모델이 함수 이름과 인자를 JSON으로 돌려준다"처럼 일반 개념으로 쓴다. 알고리즘·표준 이름(HNSW, IVF, BM25, JSON Schema)과 오픈소스 라이브러리 이름은 허용한다.
- 각 유닛 마지막 레슨은 "종합: {유닛 이름}"이며, 그 유닛 다른 레슨의 keyPoints만 정답으로 요구한다.

## AWS(aws) 트랙 (2026-10-26 공개)
실무 기초 + 끝내면 실제로 써먹을 수 있는 수준(자격증 대비 아님). 12유닛 99레슨, 구체(계정·IAM·VPC·EC2) → 설계(고가용성·Well-Architected) 순.
- **각 유닛 마지막 레슨 "현장: …"**은 증상 → 확인 순서 → 원인 → 조치를 고르는 판단 레슨이다. 그 유닛과 앞 유닛 keyPoints만 정답으로 쓴다. 12유닛은 ALB+ECS(Fargate)+RDS+S3(+CloudFront) 웹앱 하나를 "웹앱 배포 1~4"로 쌓고 "종합 시나리오"로 끝난다.
- **코드 빈칸**: `bash`(AWS CLI), `json`(IAM·버킷 정책, validate가 정답을 채워 `JSON.parse` 검사), `hcl`(Terraform). 정답이 될 명령·JSON 키·Terraform 명령은 그 레슨 keyPoints에 있어야 한다. `aws:SourceIp`·`s3:GetObject`처럼 콜론·따옴표가 든 답은 fill 대표 정답이 될 수 없으니 single로 낸다. 실제 계정 ID·액세스 키처럼 보이는 값은 쓰지 않는다(`123456789012`, `my-bucket` 같은 문서 예시 값만).
- **자주 바뀌는 숫자 금지**: 서비스 한도·가격·무료 사용량·최대 크기·기본 타임아웃은 정답·보기로 쓰지 않는다. 고정 규칙(서브넷 예약 IP 처음 4개·마지막 1개, 보안 그룹 상태 저장, NACL 규칙 번호 순 평가, 명시적 거부 우선, 새 보안 그룹 아웃바운드 전체 허용, 기본 NACL 전체 허용·사용자 지정 NACL 전체 거부)은 써도 된다.
- **최근 바뀐 동작은 현재 기준으로**: 새 S3 버킷은 퍼블릭 액세스 차단 켜짐·ACL 꺼짐, 새 객체 SSE-S3 기본 적용, CloudFront→S3는 OAI가 아니라 OAC, Terraform S3 백엔드 잠금은 `use_lockfile`(DynamoDB 잠금은 deprecated), NAT 게이트웨이는 영역 NAT·리전 NAT 두 방식, 루트 사용자 MFA는 모든 계정 유형에 요구. 문제를 쓸 때 다시 AWS 공식 문서로 확인한다.
- 시험 문제·덤프는 쓰지 않는다. 서비스 이름은 AWS 공식 표기(IAM Identity Center, Session Manager 등).

## 보안(sec) 트랙 (2026-10-27 공개)
백엔드 개발자가 실무에서 막고 점검할 수 있는 수준(방어 관점). 13유닛 106레슨, 구체(CIA·비밀번호·세션) → 설계(OWASP Top 10 점검) 순.
- **공격은 원리·징후·막는 법까지만.** 실제로 쓸 수 있는 공격 페이로드(인젝션 문자열, XSS 스크립트, 우회 기법)·익스플로잇 절차는 문제·보기·해설·코드 어디에도 쓰지 않는다. 코드에는 "취약한 패턴"(문자열 이어 붙인 쿼리, `innerHTML`, `shell=True`)과 "고친 코드"만 둔다.
- **각 유닛 마지막 레슨 "현장: …"**은 증상 → 확인 순서 → 원인 → 조치를 고르는 판단 레슨이다(AWS 트랙과 같다). 그 유닛과 앞 유닛 keyPoints만 정답으로 쓴다. 13유닛은 OWASP Top 10:2025 범주로 앞 유닛을 다시 점검하고 "종합 시나리오"로 끝난다.
- **코드 빈칸은 "취약 코드 → 안전한 코드" 고치기**: 파라미터 바인딩(`sql`·`python`·`javascript`), 출력 인코딩·DOM API(`javascript`·`html`), 쿠키 속성·CSP·CORS·보안 헤더(`http`). 언어 variants는 쓰지 않는다(`content.code` 단일) — 개념이 언어 문법이 아니라 바인딩·속성 이름에 있어서다. 정답이 될 헤더·속성·함수 이름은 그 레슨 keyPoints에 있어야 한다. `SameSite=Lax`·`'self'`처럼 기호가 든 답은 single로 낸다.
- **OWASP Top 10은 2025판 기준**(A01 접근 제어 실패 … A10 예외 상황 처리 미흡, SSRF는 A01에 통합). 순위 번호는 1위(접근 제어 실패)만 묻고 나머지는 범주 이름으로 묻는다.
- 클라우드 보안(IAM·보안 그룹·KMS 세부 설정)은 AWS 트랙 몫이다. 여기서는 "AWS 트랙 기준으로 점검"처럼 연결만 한다.
- eip `u14-security`(시험용 보안)와 keyPoints·문제 문장을 겹치지 않게 쓴다. 같은 용어(기밀성, RBAC, 솔트)도 실무 판단 쪽으로 묻는다.
- 표준·브라우저 동작은 현재 기준으로 쓴다(SameSite 미지정 시 동작은 브라우저마다 달라 항상 명시, `SameSite=None`은 Secure 필수, CSRF 방어에 SameSite + 토큰/Origin 검사, 비밀번호 해시는 argon2id 권장). 자주 바뀌는 숫자(권장 cost 값, 토큰 수명 분 단위)는 정답으로 묻지 않는다.

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
