#!/bin/bash
# Mineração automática diária — chamado pelo LaunchAgent com.aure.opportunity-miner
# Garante que o servidor está de pé e dispara uma rodada de mineração.

PROJECT_DIR="$HOME/opportunity-miner"
PORT=3050
URL="http://localhost:$PORT"
LOG="$PROJECT_DIR/data/auto-mine.log"

mkdir -p "$PROJECT_DIR/data"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando rodada de mineração automática" >> "$LOG"

# Sobe o servidor se não estiver rodando
if ! curl -sf -o /dev/null --max-time 5 "$URL"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Servidor fora do ar, iniciando..." >> "$LOG"
  cd "$PROJECT_DIR" || exit 1
  nohup npm run dev >> "$PROJECT_DIR/data/server.log" 2>&1 &
  # Espera até 90s o servidor responder
  for _ in $(seq 1 30); do
    sleep 3
    if curl -sf -o /dev/null --max-time 5 "$URL"; then break; fi
  done
fi

if ! curl -sf -o /dev/null --max-time 5 "$URL"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO: servidor não subiu, abortando" >> "$LOG"
  exit 1
fi

# Dispara a mineração (pode demorar alguns minutos)
RESULT=$(curl -sf -X POST --max-time 600 "$URL/api/auto-mine" -H 'Content-Type: application/json' -d '{}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Resultado: $RESULT" >> "$LOG"
