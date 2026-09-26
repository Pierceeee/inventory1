#!/usr/bin/env bash
# Deploys one release on the EC2 host. The GitLab deploy job sends this
# script (with docker-compose.yml and Caddyfile) through AWS Systems Manager;
# it runs as root on the instance. See README "Deploying to AWS from GitLab".
#
# Usage: deploy.sh <region> <image uri:tag> <parameter path>
#   e.g. deploy.sh ap-southeast-1 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/adspark-it-inventory:1a2b3c4d /akm/prod
set -euo pipefail

REGION="$1"
IMAGE="$2"
PARAM_PATH="${3%/}"
APP_DIR=/opt/adspark-it-inventory
RELEASE_DIR="$APP_DIR/release"
REGISTRY="${IMAGE%%/*}"
HEALTH_TIMEOUT_SECONDS=180

log() { printf '[deploy] %s\n' "$*"; }

cd "$APP_DIR"
install -m 0644 "$RELEASE_DIR/docker-compose.yml" docker-compose.yml
install -m 0644 "$RELEASE_DIR/Caddyfile" Caddyfile

# .env from Parameter Store: one parameter per setting, e.g.
# /akm/prod/DATABASE_URL. Written fresh every deploy, readable by root only.
# Values are single-quoted so docker compose never interpolates them.
log "writing .env from ${PARAM_PATH}/*"
trap 'rm -f .env.next' EXIT
umask 077
aws ssm get-parameters-by-path --region "$REGION" --path "$PARAM_PATH" \
    --with-decryption --recursive --query 'Parameters[].[Name,Value]' --output text \
  | while IFS=$'\t' read -r name value; do
      key="${name##*/}"
      if [[ ! "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
        echo "[deploy] parameter ${name} is not a valid setting name" >&2; exit 1
      fi
      if [[ "$value" == *"'"* ]]; then
        echo "[deploy] ${key} contains a single quote, which .env cannot hold safely" >&2; exit 1
      fi
      printf "%s='%s'\n" "$key" "$value"
    done > .env.next
for required in DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY ALLOWED_IPS AKM_HOSTNAME; do
  grep -q "^${required}=" .env.next || { echo "[deploy] ${PARAM_PATH}/${required} is missing" >&2; exit 1; }
done
printf "AKM_IMAGE='%s'\n" "$IMAGE" >> .env.next
chmod 600 .env.next
mv .env.next .env
umask 022

log "pulling ${IMAGE}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker compose pull app caddy

# Migrations first: they are additive and safe ahead of the code, but the
# new code may need columns an old database does not have yet.
log "applying database migrations"
docker compose run --rm --no-deps app node server/scripts/migrate.js

log "starting the new release"
docker compose up -d --no-build --remove-orphans

log "waiting for the app to report healthy"
container="$(docker compose ps -q app)"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
status=starting
while (( SECONDS < deadline )); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo missing)"
  [[ "$status" == healthy ]] && break
  sleep 5
done
if [[ "$status" != healthy ]]; then
  echo "[deploy] app is ${status} after ${HEALTH_TIMEOUT_SECONDS}s - last log lines:" >&2
  docker compose logs --tail=80 app >&2 || true
  exit 1
fi

# Keep a week of old images so a recent release can be redeployed quickly.
docker image prune -af --filter "until=168h" >/dev/null || true
log "deployed ${IMAGE}"
