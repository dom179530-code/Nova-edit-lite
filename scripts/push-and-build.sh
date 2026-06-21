#!/bin/bash
# ============================================================
#  Nova Edit Lite — Push to GitHub & trigger APK build
#  Usage: ./scripts/push-and-build.sh <github-username>
# ============================================================
set -e

GITHUB_USER="${1:-dom179530-code}"
REPO_NAME="nova-edit-lite"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "================================================"
echo "  Nova Edit Lite — GitHub Push & APK Build"
echo "================================================"
echo "  GitHub user : $GITHUB_USER"
echo "  Repo        : $REPO_NAME"
echo ""

cd "$PROJECT_DIR"

# ── 1. Check git ─────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "ERROR: git not found. Install from https://git-scm.com"
  exit 1
fi
if ! command -v gh &>/dev/null; then
  echo "NOTE: GitHub CLI (gh) not found."
  echo "      Install from https://cli.github.com for automatic repo creation."
  echo "      OR: create the repo manually at https://github.com/new"
  echo "          then re-run this script."
  HAVE_GH=false
else
  HAVE_GH=true
fi

# ── 2. Init git if needed ────────────────────────────────────
if [ ! -d .git ]; then
  echo "[1/4] Initialising git repository..."
  git init
  git branch -M main
else
  echo "[1/4] Git repository already initialised."
fi

# ── 3. Create GitHub repo ────────────────────────────────────
echo "[2/4] Creating GitHub repository..."
if [ "$HAVE_GH" = true ]; then
  gh repo create "$GITHUB_USER/$REPO_NAME" --public --confirm 2>/dev/null || \
  echo "      Repo may already exist — continuing."
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
else
  echo ""
  echo "  ACTION NEEDED: Create the repo at https://github.com/new"
  echo "  Repo name: $REPO_NAME  |  Visibility: Public"
  echo "  Do NOT check 'Add a README'"
  echo ""
  read -p "  Press Enter once the repo is created..."
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
fi

# ── 4. Commit & push ─────────────────────────────────────────
echo "[3/4] Committing and pushing code..."
git add .
git commit -m "Nova Edit Lite — Android APK ready" 2>/dev/null || \
  echo "      Nothing new to commit."
git push -u origin main --force

echo "      Pushed to https://github.com/$GITHUB_USER/$REPO_NAME"

# ── 5. Trigger Actions workflow ──────────────────────────────
echo "[4/4] Triggering GitHub Actions APK build..."
if [ "$HAVE_GH" = true ]; then
  gh workflow run build-apk.yml --repo "$GITHUB_USER/$REPO_NAME" 2>/dev/null && \
    echo "      Workflow triggered!" || \
    echo "      Workflow will auto-start from the push."
else
  echo "      The push already triggers the workflow automatically."
fi

echo ""
echo "================================================"
echo "  DONE! Your APK will be ready in ~5 minutes."
echo ""
echo "  Download it here:"
echo "  https://github.com/$GITHUB_USER/$REPO_NAME/actions"
echo ""
echo "  Steps:"
echo "  1. Open the link above"
echo "  2. Click the latest 'Build Android APK' run"
echo "  3. Scroll to Artifacts → click 'nova-edit-lite-debug-apk'"
echo "================================================"
echo ""
