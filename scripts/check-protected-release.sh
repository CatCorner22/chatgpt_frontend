#!/bin/sh
set -eu
export FOCUS_TEST_LOOPBACK_ONLY=1
cd "$(dirname "$0")/.."

npm run lint
npm exec --no -- tsc --noEmit
npm test
npm --prefix north-star-kit run typecheck
npm --prefix north-star-kit test
npm run test:benchmark
npm run test:sites-build
python3 scripts/test-colleague-kit.py
npm run build:sites
WRANGLER_SEND_METRICS=false node scripts/test-protected-worker.mjs
npm run test:booking-pilot
node scripts/test-designer-booking-pilot.mjs
