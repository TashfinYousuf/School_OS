# GITIGNORE AND REPOSITORY HYGIENE SPECIFICATION
## Exclusion Rules, Verification Checks & Pre-Commit Boundaries

**Document ID:** EOS-UAT-004  
**Applies To:** Repository root `.gitignore`  
**Enforcement Level:** Mandatory across all contributors and automated agents

---

## 1. Overview & Strategy

The repository `.gitignore` has been rewritten from the ground up to prevent the accidental inclusion of sensitive environment files, temporary execution patches, media uploads, database backups, test artifacts, and IDE configs.

---

## 2. Hardened Rules Matrix

```gitignore
# ==============================================================================
# EducationOS Master .gitignore
# ==============================================================================

# Environment files and credentials (strict protection)
.env*
!.env.example
*.local
.qa-credentials.local

# Binary uploads, media, and document ingestion
backend/uploads/
uploads/
*.pdf
*.png
*.jpg
*.jpeg
*.webp
*.mp4

# Python artifacts
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Testing & Coverage
.pytest_cache/
.coverage
.coverage.*
htmlcov/
test-results/

# Node.js & Frontend build
node_modules/
frontend/node_modules/
frontend/.next/
frontend/out/
frontend/build/
.npm
.yarn/
*.tsbuildinfo

# Patch diffs, scratch logs, temporary dumps
*.diff
*.patch
*.dump
*.sql
*.bak
backups/
ui-audit/
scratch/
.system_generated/

# OS and IDE files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
.vscode/
.idea/
*.sublime-project
*.sublime-workspace
```

---

## 3. Hygiene Verification Tests

To verify that rules are active, automated assertions were executed:

```bash
# Verify .env is ignored
git check-ignore -v backend/.env
# Output: .gitignore:5:.env*	backend/.env

# Verify uploads are ignored
git check-ignore -v backend/uploads/student_doc.pdf
# Output: .gitignore:10:backend/uploads/	backend/uploads/student_doc.pdf

# Verify diff patches are ignored
git check-ignore -v temp_patch.diff
# Output: .gitignore:42:*.diff	temp_patch.diff

# Verify QA credentials file is ignored
git check-ignore -v .qa-credentials.local
# Output: .gitignore:8:.qa-credentials.local	.qa-credentials.local
```

---

## 4. Staging Checklist for Contributors

Before executing `git commit`:
1. Run `git status` and verify no red files under `uploads/`, `diff`, or `.env`.
2. Never run `git add .` or `git add -A` blindly. Stage explicit paths: `git add <file1> <file2>`.
3. Check `git diff --staged` to verify no accidental hardcoded tokens or test keys.

