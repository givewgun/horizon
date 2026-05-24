#!/bin/bash
# ──────────────────────────────────────────────────────────────────────
# Horizon — Ubuntu VM Initial Setup (Oracle Cloud)
# Run once as 'ubuntu' user after SSH-ing into a new Ubuntu VM.
#
# Usage: bash oracle-vm-setup.sh <GITHUB_TOKEN>
# Example: bash oracle-vm-setup.sh ghp_xxxxxxxxxxxx
#
# GITHUB_TOKEN: Personal Access Token with repo read scope.
# Create one at: https://github.com/settings/tokens/new
#
# If the VM was already provisioned for the gunvest project, Docker,
# UFW and the `tunnel-gateway` network already exist — this script is
# idempotent and will skip those steps.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

GITHUB_TOKEN="${1:?Usage: bash oracle-vm-setup.sh <GITHUB_TOKEN>}"
GITHUB_REPO="givewgun/horizon"
REPO_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
APP_DIR="/opt/horizon/app"
DATA_DIR="/opt/horizon/app/data"
VM_USER="ubuntu"
BRANCH="master"

echo "═══════════════════════════════════════════════"
echo " Horizon — Ubuntu VM Setup"
echo "═══════════════════════════════════════════════"

# ── 1. System Update ─────────────────────────────────────────────────
echo "[1/7] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y -q
sudo apt-get upgrade -y -q

# ── 2. Install Docker (skip if present) ──────────────────────────────
echo "[2/7] Installing Docker..."
if command -v docker >/dev/null 2>&1; then
  echo "  Docker $(docker --version) already installed — skipping"
else
  sudo apt-get install -y -q ca-certificates curl gnupg git
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y -q
  sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
  sudo usermod -aG docker ${VM_USER}
  echo "  Docker $(docker --version) installed"
fi

# Ensure git is present even if Docker was preinstalled
sudo apt-get install -y -q git

# ── 3. Firewall Rules ────────────────────────────────────────────────
echo "[3/7] Configuring firewall (port 22 only — Cloudflare Tunnel handles ingress)..."
sudo ufw allow 22/tcp 2>/dev/null || true
sudo ufw --force enable 2>/dev/null || true
echo "  Firewall configured"

# ── 4. Tunnel Gateway Network ────────────────────────────────────────
echo "[4/7] Ensuring tunnel-gateway docker network exists..."
if [ -z "$(sudo docker network ls --filter name=^tunnel-gateway$ --format='{{.Name}}')" ]; then
  sudo docker network create tunnel-gateway
  echo "  Created tunnel-gateway network"
  echo ""
  echo "  ⚠  NOTE: The global cloudflared container is NOT installed by this script."
  echo "     If this VM is fresh (no gunvest deploy), follow docs/SSL.md Phase 3 to"
  echo "     run the global tunnel container on this network before continuing."
  echo ""
else
  echo "  tunnel-gateway network already exists — skipping"
fi

# ── 5. App Directory + Clone ─────────────────────────────────────────
echo "[5/7] Setting up directories and cloning repository..."
sudo mkdir -p "${APP_DIR}" "${DATA_DIR}"
sudo chown -R ${VM_USER}:${VM_USER} /opt/horizon

if [ -d "${APP_DIR}/.git" ]; then
  echo "  Repository already exists, pulling latest..."
  cd "${APP_DIR}"
  git remote set-url origin "${REPO_URL}"
  git pull origin "${BRANCH}"
else
  git clone "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

cd "${APP_DIR}"
git config credential.helper store
git remote set-url origin "${REPO_URL}"

# ── 6. .env.production ───────────────────────────────────────────────
echo "[6/7] Setting up environment file..."
# Horizon's CI deploy job regenerates .env.production from GitHub Secrets
# on every push. This bootstrap copy is only used for the very first
# manual `docker compose up` before any CI run.
if [ ! -f "${APP_DIR}/.env.production" ]; then
  cp "${APP_DIR}/.env.production.example" "${APP_DIR}/.env.production"
  chmod 600 "${APP_DIR}/.env.production"
  echo ""
  echo "  ┌────────────────────────────────────────────────────┐"
  echo "  │  Fill in API keys (or push to master and let CI    │"
  echo "  │  overwrite this file from GitHub Secrets):         │"
  echo "  │  nano ${APP_DIR}/.env.production"
  echo "  └────────────────────────────────────────────────────┘"
  echo ""
  echo "  Keys: OPENWEATHER_KEY, WINDY_KEY, N2YO_KEY,"
  echo "        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID"
  echo ""
  echo "  Then start the app:"
  echo "    cd ${APP_DIR}"
  echo "    sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build"
  echo ""
  exit 0
else
  echo "  .env.production already exists — keeping current values"
fi

# ── 7. Build & Start ─────────────────────────────────────────────────
echo "[7/7] Building and starting horizon-app container..."
cd "${APP_DIR}"
sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo "  Waiting for container healthcheck..."
for i in $(seq 1 30); do
  if sudo docker exec horizon-app wget -qO- http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "  horizon-app is healthy"
    break
  fi
  sleep 2
done

# ── (skipped) Database setup ─────────────────────────────────────────
# Horizon uses better-sqlite3 with the DB file at /app/data/horizon.sqlite,
# bind-mounted from ./data. No external DB service, no seed step.
#
# If/when we add a PostgreSQL service, restore the gunvest pattern here:
#   - wait for `horizon-db` pg_isready
#   - run a seed script
#   - add a daily pg_dump cron to /opt/horizon/backups

# ── (skipped) Daily backup cron ──────────────────────────────────────
# For sqlite, a simple file-copy cron would suffice. Add later if needed:
#   0 3 * * * cp /opt/horizon/app/data/horizon.sqlite \
#             /opt/horizon/backups/horizon-$(date +\%F).sqlite

echo ""
echo "═══════════════════════════════════════════════"
echo " Horizon deployment complete!"
echo " Public URL: https://horizon.givewgun.com"
echo "   (routed by Cloudflare Tunnel → horizon-app:8080)"
echo " Logs: sudo docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f"
echo "═══════════════════════════════════════════════"
