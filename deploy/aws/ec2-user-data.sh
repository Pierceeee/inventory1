#!/usr/bin/env bash
# EC2 user data for the app host (Amazon Linux 2023). Paste into
# "Advanced details > User data" when launching the instance. Installs Docker
# and the Compose plugin; the SSM agent and AWS CLI ship with AL2023.
set -euo pipefail

COMPOSE_VERSION=v2.29.7

dnf install -y docker
systemctl enable --now docker

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/adspark-it-inventory/release
chmod 0750 /opt/adspark-it-inventory
