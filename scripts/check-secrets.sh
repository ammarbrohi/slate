#!/bin/sh
# Pre-commit secret guard. Blocks a commit if staged changes look like they
# contain credentials or sensitive files. Runs from .husky/pre-commit.
#
# Bypass (use sparingly, you accept the risk): git commit --no-verify
set -e

fail() {
  echo ""
  echo "  ✖ commit blocked by secret scan:"
  echo "    $1"
  echo ""
  echo "  Unstage/clean it, or bypass with: git commit --no-verify"
  echo ""
  exit 1
}

# Files staged for this commit (added/copied/modified).
staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

# 1) Block sensitive FILE PATHS (defence in depth vs `git add -f`).
blocked_path=$(printf '%s\n' "$staged" | grep -nE \
  '(^|/)\.env$|(^|/)\.env\.[^/]*\.local$|(^|/)\.env\.local$|(^|/)server/data/|(^|/)id_rsa$|(^|/)id_ed25519$|\.pem$|\.p12$|\.keystore$' \
  || true)
[ -n "$blocked_path" ] && fail "sensitive file staged -> $blocked_path"

# 2) Block secret-looking VALUES in the added lines only (^+).
added=$(git diff --cached -U0 --diff-filter=ACM | grep '^+' | grep -v '^+++' || true)
[ -z "$added" ] && exit 0

# Stripe/Clerk live & test secret keys, GitHub tokens, AWS keys, private keys,
# Slack tokens, and explicit secret assignments to real-looking values.
hit=$(printf '%s\n' "$added" | grep -nE \
  'sk_(test|live)_[A-Za-z0-9]{8,}|rk_(test|live)_[A-Za-z0-9]{8,}|CLERK_SECRET_KEY[[:space:]]*=[[:space:]]*sk_|-----BEGIN[[:space:]][A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}' \
  || true)
[ -n "$hit" ] && fail "credential-like value in staged diff -> $hit"

# 3) Warn (do not block) on publishable keys — safe but usually unintended.
warn=$(printf '%s\n' "$added" | grep -nE 'pk_(test|live)_[A-Za-z0-9]{8,}' || true)
[ -n "$warn" ] && echo "  ⚠ note: publishable key in staged diff (safe, but check it's intended): $warn"

exit 0
