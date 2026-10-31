#!/usr/bin/env bash
# scripts/secret-scan.sh
# Acceptance check #10: No credentials in tracked files.
# Fails if any tracked file contains likely secrets/private keys/env values.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Tracked files only (respects .gitignore).
tracked=$(git ls-files)

patterns=(
  'AKIA[0-9A-Z]{16}'            # AWS access key
  'ghp_[A-Za-z0-9]{36,}'        # GitHub token
  'github_pat_[A-Za-z0-9_]_'    # GitHub fine-grained token
  'sk_live_[A-Za-z0-9]{24,}'    # Stripe live key
  'sk_test_[A-Za-z0-9]{24,}'    # Stripe test key
  'xoxb-[A-Za-z0-9-]{24,}'      # Slack bot token
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'  # PEM private key
  '0x[a-fA-F0-9]{64}'           # raw 32-byte private key (hex)
  'PRIVATE_KEY\s*=\s*.{10,}'    # env private key assignments
  'SECRET\s*=\s*.{10,}'         # generic secret assignments
  'PASSWORD\s*=\s*.{10,}'       # password assignments
)

found=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  # Skip lock files and generated artifacts (not credentials).
  case "$file" in
    *.lock|foundry.lock|package-lock.json) continue ;;
  esac
  for pat in "${patterns[@]}"; do
    if grep -nEi "$pat" "$file" 2>/dev/null | grep -viE 'example|\.example|test|mock|placeholder|0x0000'; then
      echo "CREDENTIAL DETECTED in $file matching /$pat/"
      grep -nEi "$pat" "$file" | head -5
      found=1
    fi
  done
done <<< "$tracked"

if [ "$found" -eq 1 ]; then
  echo "FAIL: credentials found in tracked files."
  exit 1
fi

# Ensure .env is ignored (not committed).
if git check-ignore .env >/dev/null 2>&1; then
  echo "PASS: .env is gitignored."
else
  echo "WARN: .env is not gitignored (add to .gitignore)."
fi

echo "PASS: no credentials in tracked files."
exit 0
