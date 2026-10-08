#!/usr/bin/env bash
# =============================================================================
# publish.sh — publica o site da Winserv na VM da UE (spec 2026-10-08 §8)
# =============================================================================
# Mesma doutrina do publish-marketing.sh do portal: arvore limpa, ensaio primeiro,
# nenhuma remocao de arquivo que so existe na VM sem decisao humana, e a resposta
# no ar comparada com o que foi construido. --staging mede pelo IP da VM com o
# certificado `tls internal` (antes da virada do DNS, spec §9).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOST="${DEPLOY_HOST:-winserv-eu}"
VM_IP="${VM_IP:-2.28.19.100}"
REMOTE="/opt/winserv-website"
SITE="www.winserv.com.br"
APEX="winserv.com.br"
CADDYFILE="${PORTAL_REPO:-$HOME/winserv-unifi-portal}/deployments/eu/caddy/Caddyfile"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
err()  { printf "%b[ERRO]%b %s\n" "$RED" "$NC" "$1"; }
ok()   { printf "%b[OK]%b %s\n" "$GREEN" "$NC" "$1"; }
step() { printf "\n=== %s ===\n" "$1"; }

ASSUME_YES=0; STAGING=0; ALLOW_DELETE=0
for a in "$@"; do
    case "$a" in
        --yes) ASSUME_YES=1 ;;
        --staging) STAGING=1 ;;
        --allow-delete) ALLOW_DELETE=1 ;;
        *) err "opcao desconhecida: $a"; exit 2 ;;
    esac
done

CURL=(curl -s --max-time 10)
if [ "$STAGING" -eq 1 ]; then
    CURL+=(-k --resolve "${SITE}:443:${VM_IP}" --resolve "${APEX}:443:${VM_IP}")
fi

cd "$PROJECT_DIR"

step "Arvore e build"
if [ -n "$(git status --porcelain -- . ':!og.html' ':!palette-test.html')" ]; then
    err "arvore suja — commit antes de publicar"; exit 1
fi
npm ci --silent
npm run build --silent
npm test --silent
ok "build e testes"

DRY="$(mktemp)"; DRY_DEPLOY="$(mktemp)"
trap 'rm -f "$DRY" "$DRY_DEPLOY"' EXIT

step "Ensaio"
rsync -az --checksum --delete --exclude '.DS_Store' -n --itemize-changes dist/ "${HOST}:${REMOTE}/dist/" > "$DRY"
if grep -q '^\*deleting' "$DRY" && [ "$ALLOW_DELETE" -eq 0 ]; then
    err "o rsync removeria da VM:"
    grep '^\*deleting' "$DRY" | sed 's/^\*deleting */  /'
    err "Nada foi enviado. Se a remocao e esperada (pagina renomeada), rode de novo com --allow-delete."
    exit 1
fi
rsync -a --checksum --inplace -n --itemize-changes deploy/ "${HOST}:${REMOTE}/deploy/" > "$DRY_DEPLOY"
printf "site: %s arquivo(s); deploy/: %s arquivo(s)\n" \
    "$(grep -cE '^[<>]f' "$DRY" || true)" "$(grep -cE '^[<>]f' "$DRY_DEPLOY" || true)"

if [ "$ASSUME_YES" -eq 0 ]; then
    printf "%bPublicar em %s:%s? (s/N): %b" "$YELLOW" "$HOST" "$REMOTE" "$NC"
    read -r ANSWER
    case "${ANSWER:-n}" in s|S) ;; *) echo "Abortado."; exit 0 ;; esac
fi

step "Enviando"
rsync -az --checksum --delete --exclude '.DS_Store' dist/ "${HOST}:${REMOTE}/dist/"
# --inplace: the conf is a single-file bind mount; a renaming write leaves nginx on the old inode.
rsync -a --checksum --inplace deploy/ "${HOST}:${REMOTE}/deploy/"
if grep -qE '^[<>]f' "$DRY_DEPLOY" || [ -z "$(ssh "$HOST" 'docker ps -q -f name=^winserv-site$')" ]; then
    # nginx reads its conf only when it starts: `up -d` alone sees no compose change.
    # shellcheck disable=SC2029  # REMOTE is a local constant and must expand here
    ssh "$HOST" "cd ${REMOTE}/deploy && docker compose up -d --force-recreate"
    ok "container recriado"
fi
ok "publicado"

step "Medindo no ar"
sleep 3
FAILED=0
for page in "" "contato.html" "privacidade.html" "filtro.html"; do
    file="dist/${page:-index.html}"
    LIVE="$("${CURL[@]}" "https://${SITE}/${page}" | shasum -a 256 | cut -d' ' -f1)"
    LOCAL="$(shasum -a 256 "$file" | cut -d' ' -f1)"
    if [ "$LIVE" = "$LOCAL" ]; then ok "no ar == dist: /${page}"; else err "/${page} no ar diverge de dist/"; FAILED=1; fi
done

HEADERS="$("${CURL[@]}" -o /dev/null -D - "https://${SITE}/" | tr -d '\r')"
STS="$(awk 'tolower($1)=="strict-transport-security:"{sub(/^[^:]*: */,""); print}' <<<"$HEADERS")"
if [ "$STS" = "max-age=31536000" ]; then ok "HSTS do www sem includeSubDomains/preload"; else err "HSTS do www: '${STS}'"; FAILED=1; fi

WANT_CSP="$(awk '/^www\.winserv\.com\.br \{/{b=1} b&&/^\}/{b=0} b&&/Content-Security-Policy/' "$CADDYFILE" \
    | sed -E 's/.*Content-Security-Policy "([^"]*)".*/\1/')"
LIVE_CSP="$(awk 'tolower($1)=="content-security-policy:"{sub(/^[^:]*: */,""); print}' <<<"$HEADERS")"
if [ -n "$WANT_CSP" ] && [ "$LIVE_CSP" = "$WANT_CSP" ]; then ok "CSP no ar == Caddyfile"; else err "CSP no ar diverge do Caddyfile (${CADDYFILE})"; FAILED=1; fi

APEX_HEADERS="$("${CURL[@]}" -o /dev/null -D - "https://${APEX}/contato.html" | tr -d '\r')"
LOC="$(awk 'tolower($1)=="location:"{print $2}' <<<"$APEX_HEADERS")"
if [ "$LOC" = "https://${SITE}/contato.html" ]; then ok "apex redireciona preservando o caminho"; else err "apex Location: '${LOC}'"; FAILED=1; fi
if grep -qi '^strict-transport-security:' <<<"$APEX_HEADERS"; then err "apex manda HSTS — guardrail 4"; FAILED=1; else ok "apex sem HSTS"; fi

exit "$FAILED"
