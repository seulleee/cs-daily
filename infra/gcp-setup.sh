#!/usr/bin/env bash
# CS 데일리 — GCP 1회성 세팅 (Cloud Shell에서 실행, 여러 번 실행해도 안전)
#   curl -fsSL https://raw.githubusercontent.com/seulleee/cs-daily/main/infra/gcp-setup.sh | bash
#
# 만드는 것
#   1) Artifact Registry 저장소 cs-daily (서울)
#   2) 서비스 계정
#      - cs-daily-deploy : GitHub Actions 배포용 (Cloud Run 배포·이미지 푸시)
#      - cs-daily-run    : Cloud Run 런타임용 (시크릿 읽기만)
#      - cs-daily-scheduler : Cloud Scheduler → /internal/jobs/tick 호출용 (Cloud Run invoker)
#   3) Workload Identity Federation: seulleee/cs-daily 레포의 Actions만 cs-daily-deploy로 인증
#   4) Secret Manager 시크릿 "자리" (값은 사람이 직접 추가)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-cs-daily-510823}"
REGION="asia-northeast3"
REPO="seulleee/cs-daily"
POOL="github"
PROVIDER="cs-daily-repo"

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

say "1/5 Artifact Registry"
exists gcloud artifacts repositories describe cs-daily --location "$REGION" ||
  gcloud artifacts repositories create cs-daily --repository-format=docker --location "$REGION" --description="CS 데일리 API 이미지"
# 오래된 이미지 자동 정리 (최근 5개만 유지) — 무료 저장 용량(0.5GB) 안에 머물기 위함
cat > /tmp/ar-cleanup.json <<'JSON'
[{"name":"keep-recent-5","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}},
 {"name":"delete-old","action":{"type":"Delete"},"condition":{"tagState":"ANY","olderThan":"0s"}}]
JSON
gcloud artifacts repositories set-cleanup-policies cs-daily --location "$REGION" --policy=/tmp/ar-cleanup.json --no-dry-run --quiet >/dev/null

say "2/5 서비스 계정"
for sa in cs-daily-deploy cs-daily-run cs-daily-scheduler; do
  exists gcloud iam service-accounts describe "$sa@$PROJECT_ID.iam.gserviceaccount.com" ||
    gcloud iam service-accounts create "$sa" --display-name "$sa"
done
DEPLOY_SA="cs-daily-deploy@$PROJECT_ID.iam.gserviceaccount.com"
RUN_SA="cs-daily-run@$PROJECT_ID.iam.gserviceaccount.com"
SCHED_SA="cs-daily-scheduler@$PROJECT_ID.iam.gserviceaccount.com"

say "3/5 권한 (최소 권한)"
bind() { gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$1" --role "$2" --condition=None --quiet >/dev/null; echo "  $2 → ${1%%@*}"; }
bind "$DEPLOY_SA" roles/run.admin
bind "$DEPLOY_SA" roles/artifactregistry.writer
bind "$RUN_SA" roles/secretmanager.secretAccessor
# 배포 SA가 런타임 SA를 Cloud Run 서비스에 붙일 수 있도록
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser --quiet >/dev/null
echo "  roles/iam.serviceAccountUser(cs-daily-run) → cs-daily-deploy"

say "4/5 Workload Identity Federation (GitHub Actions → $REPO 만 허용)"
exists gcloud iam workload-identity-pools describe "$POOL" --location global ||
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
exists gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool "$POOL" --location global ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool "$POOL" --location global --display-name "seulleee/cs-daily" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$REPO'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" --quiet >/dev/null
WIF_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"

say "5/5 Secret Manager 자리 만들기 (값은 비어 있음)"
for s in DATABASE_URL DIRECT_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET JOBS_SECRET RESEND_API_KEY; do
  exists gcloud secrets describe "$s" || gcloud secrets create "$s" --replication-policy=user-managed --locations="$REGION" >/dev/null
  # 사람이 정할 필요 없는 랜덤 키는 여기서 생성 (값은 화면에 출력하지 않음)
  case "$s" in JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|JOBS_SECRET)
    [ -n "$(gcloud secrets versions list "$s" --filter='state=ENABLED' --format='value(name)')" ] ||
      openssl rand -base64 48 | tr -d '\n' | gcloud secrets versions add "$s" --data-file=- >/dev/null ;;
  esac
  printf '  %-22s versions=%s\n' "$s" "$(gcloud secrets versions list "$s" --filter='state=ENABLED' --format='value(name)' | wc -l)"
done

cat <<EOF

================ 완료 — GitHub 레포에 넣을 값 ================
[Secrets]
  GCP_PROJECT_ID   = $PROJECT_ID
  GCP_WIF_PROVIDER = $WIF_PROVIDER
  GCP_DEPLOY_SA    = $DEPLOY_SA
[참고]
  Cloud Run 런타임 SA  = $RUN_SA
  Scheduler 호출용 SA  = $SCHED_SA
==============================================================
EOF
