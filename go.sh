#!/bin/bash
npm install


while true; do
  node send_universal.js --api lite --bin ./pow-miner-cuda -c https://static.ton-rocket.com/private-config.json --givers 1000
  sleep 1;
done;
