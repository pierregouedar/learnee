#!/bin/sh
# Envoie le code (dernier commit) et la config sur le NAS, puis reconstruit et relance l'app.
# Usage : deploy/nas/deploy.sh root@<ip-du-nas>   (les données dans /opt/learnee/data sont conservées)
set -eu
HOST="${1:?usage: deploy.sh user@host}"
DIR=/opt/learnee
cd "$(git rev-parse --show-toplevel)"
# chown : le conteneur tourne sous l'utilisateur node (uid 1000), il doit pouvoir écrire dans data/.
ssh "$HOST" "mkdir -p $DIR/app $DIR/data && chown -R 1000:1000 $DIR/data && rm -rf $DIR/app/*"
git archive HEAD | ssh "$HOST" "tar -x -C $DIR/app"
scp deploy/nas/compose.yaml "$HOST:$DIR/compose.yaml"
grep -v '^DATABASE_PATH=' .env.local | ssh "$HOST" "cat > $DIR/app.env && chmod 600 $DIR/app.env"
ssh "$HOST" "cd $DIR && docker compose up -d --build --remove-orphans app"
