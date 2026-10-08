#!/usr/bin/env bash
# site-stats.sh — agregados do site da Winserv (spec 2026-10-08 §7).
#   ./scripts/site-stats.sh [DESDE] [ATE]     # formatos do journalctl; padrao: ontem..hoje
# O awk roda NA VM: nenhuma linha com IP sai da UE. Sem acesso ao journal do sistema a
# leitura seria parcial e silenciosa — entao aborta.
set -euo pipefail
HOST="${DEPLOY_HOST:-winserv-eu}"
SINCE="${1:-yesterday}"
UNTIL="${2:-today}"

if ! ssh "$HOST" 'sudo -n true' 2>/dev/null; then
    echo "sem sudo -n na VM: a leitura do journal seria parcial — abortado" >&2
    exit 1
fi
# shellcheck disable=SC2029  # SINCE/UNTIL are expanded here on purpose, quoted for the remote shell
ssh "$HOST" "sudo -n journalctl CONTAINER_NAME=winserv-site -o cat --since $(printf %q "$SINCE") --until $(printf %q "$UNTIL") | awk -f /opt/winserv-website/deploy/site-stats.awk"
