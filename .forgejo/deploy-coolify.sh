#!/bin/sh
# Déclenche un déploiement Coolify puis attend son issue : la CI échoue si Coolify échoue.
# Usage : deploy-coolify.sh <uuid de l'application Coolify>
# Env : COOLIFY_TOKEN (permissions deploy + read : read sert à suivre le déploiement).
set -eu
API=https://banane.tailcddc99.ts.net:8000/api/v1
AUTH="Authorization: Bearer $COOLIFY_TOKEN"
TIMEOUT=${DEPLOY_TIMEOUT:-300}
INTERVAL=${POLL_INTERVAL:-10}

RESPONSE=$(wget -q -O - --header "$AUTH" --post-data "" "$API/deploy?uuid=$1")
ID=$(echo "$RESPONSE" | jq -r '.deployments[0].deployment_uuid // empty')
[ -n "$ID" ] || { echo "Pas d'identifiant de déploiement dans la réponse : $RESPONSE"; exit 1; }
echo "Déploiement $ID lancé"

ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(wget -q -O - --header "$AUTH" "$API/deployments/$ID" | jq -r '.status // empty')
  echo "[${ELAPSED}s] $STATUS"
  case "$STATUS" in
    finished) echo "Déploiement réussi"; exit 0 ;;
    failed|error|cancelled*) echo "Déploiement en échec ($STATUS) : voir Coolify > learnee > Deployments"; exit 1 ;;
  esac
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done
echo "Délai de ${TIMEOUT}s dépassé"
exit 1
