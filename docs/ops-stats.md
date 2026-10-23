# 운영 지표 (`GET /internal/stats`)

운영자만 보는 사용 지표다. 유료화 전 **수요 검증**(결제 없음, 사전 신청만)에 쓴다. 응답은 집계뿐이라 이메일·닉네임·user id가 들어 있지 않다.

## 호출 방법 (Cloud Shell)

인증은 `/internal/jobs/tick`과 같은 `Authorization: Bearer {JOBS_SECRET}`이다. 시크릿 값은 Secret Manager에서 읽어 변수로만 쓰고, 화면에 찍거나 문서·채팅에 붙여 넣지 않는다.

```bash
PROJECT=cs-daily-510823
API=https://cs-daily-api-541298537642.asia-northeast3.run.app
JOBS_SECRET="$(gcloud secrets versions access latest --secret=JOBS_SECRET --project="$PROJECT")"
curl -sS -H "Authorization: Bearer $JOBS_SECRET" "$API/internal/stats" | jq .
unset JOBS_SECRET
```

- 시크릿이 없거나 틀리면 401. 사용자 로그인 토큰으로는 접근할 수 없다.
- 요약만 보고 싶다면: `... | jq '{users, streaks, premiumInterest}'`, 코호트 리텐션 표: `... | jq -r '.retention.cohortWeeks[] | [.weekStart, .signups, .d1.rate, .d7.rate, .d30.rate] | @tsv'`
- 응답의 `definitions`에 각 지표의 정의가 들어 있다.

## 지표 정의

| 항목 | 정의 |
| --- | --- |
| `users.total` | 가입자 수 |
| `users.active1d/7d/30d` | 최근 24시간/7일/30일 안에 **레슨 또는 복습 세션을 끝낸** 사용자 수(중복 제거). 유닛 건너뛰기 테스트(placement)와 끝내지 않은 세션은 제외 |
| `retention.cohortWeeks[]` | 최근 8주(이번 주 포함) 가입 코호트. 주는 사용자 로컬 가입일이 속한 **월요일 시작** 주 |
| `d1`·`d7`·`d30` | 가입 로컬 날짜 + n일째 **그 날짜**에 세션을 끝낸 사용자 비율(`rate`). `eligible`은 그 날짜가 로컬 기준으로 이미 지난 가입자(분모), `retained`는 재방문자(분자). 관측 가능한 가입자가 없으면 `rate`는 `null` |
| `tracks[]` | `startedUsers` 트랙을 선택한 사용자 수, `completedLessons` 완료한 레슨 수(건너뛰기 통과로 완료 처리된 레슨 포함), `completedLessonsLast7d` 최근 7일에 처음 완료된 레슨 수 |
| `streaks.atLeast3/7` | 현재 스트릭 3일/7일 이상 사용자 수(`user_stats.current_streak`) |
| `premiumInterest` | 사전 신청 수(`total`), 알림 동의 수(`notifyConsent`), 관심 항목별(`interests`)·가격 의향 구간별(`priceBands`) 신청 수. 값이 0인 항목도 나온다 |

날짜 계산은 `User.timezone`(없거나 올바르지 않으면 Asia/Seoul)을 쓴다. 코호트 경계와 `eligible` 계산은 `apps/api/src/modules/jobs/domain/usage-stats.ts`(단위 테스트 `apps/api/test/usage-stats.spec.ts`), 집계 SQL은 `application/get-usage-stats.handler.ts`에 있다.

## 읽는 법

- 표본이 작을 때(가입자 수십 명)는 비율보다 `eligible`·`retained` 절대값을 같이 본다.
- 수요 신호는 `premiumInterest.priceBands`에서 `free_only`를 뺀 비중, 그리고 `notifyConsent` 비율이다. 결제는 없으므로 실제 지불 의사가 아니라 의향 조사임을 감안한다.
- 사전 신청 데이터는 출시 안내와 수요 파악에만 쓰고, 사용자가 신청을 취소하면 행이 삭제된다(`/privacy` 참고).
