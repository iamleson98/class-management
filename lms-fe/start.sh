#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=512" npx next dev --port 3000 >> /home/z/my-project/dev.log 2>&1
  sleep 2
done