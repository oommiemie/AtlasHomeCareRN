#!/bin/sh
# Runs every set against the hospital's model, with the app's sample data.
#   scripts/assistant-eval/run.sh          all sets
#   scripts/assistant-eval/run.sh main     one set: main | held | skills | wide | en | coverage | voice
set -e
D="$(cd "$(dirname "$0")" && pwd)"
"$D/build.sh"
cd "$D/.out"
want="${1:-all}"
[ "$want" = all ] || [ "$want" = main ]   && node eval.mjs        | grep -E "^(PASS|FAIL)|score"
[ "$want" = all ] || [ "$want" = held ]   && node eval.mjs held   | grep -E "^(PASS|FAIL)|score"
[ "$want" = all ] || [ "$want" = skills ] && node eval.mjs skills | grep -E "^(PASS|FAIL)|score"
[ "$want" = all ] || [ "$want" = wide ]   && node eval2.mjs       | grep -E "^(PASS|FAIL)|score"
[ "$want" = all ] || [ "$want" = en ]     && LANG_CODE=en node eval2.mjs | grep -E "^(PASS|FAIL)|score"
[ "$want" = all ] || [ "$want" = coverage ] && node eval3.mjs     | grep -E "^(PASS|FAIL)|score|·"
[ "$want" = voice ] && node eval3.mjs voice | grep -E "^(PASS|FAIL)|score"
exit 0
