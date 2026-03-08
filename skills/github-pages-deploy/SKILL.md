---
name: github-pages-deploy
description: Deploy static webpages to GitHub Pages with a stable link. Use when user asks to publish/deploy/update a webpage, asks for a stable URL, or temporary tunnel links expire. Supports cloning target repo, copying built HTML assets, committing, pushing, and verifying the final Pages URL.
---

# GitHub Pages Deploy

## Deploy workflow

1. Confirm target repository and expected public URL.
2. Prepare deploy files locally (single HTML or folder assets).
3. Clone repository to `/tmp/<repo-name>` to avoid polluting workspace.
4. Copy webpage files into repo root or chosen subpath.
5. Commit with clear message and push to default branch.
6. Verify URL availability and report link.

## Fast path commands

Use this pattern (replace values):

```bash
REPO_URL="https://github.com/<owner>/<repo>.git"
REPO_NAME="<repo>"
SOURCE_PATH="/absolute/path/to/file-or-folder"
TARGET_PATH="<target-file-or-folder-in-repo>"

rm -rf "/tmp/${REPO_NAME}"
git clone "$REPO_URL" "/tmp/${REPO_NAME}"

# file -> file
cp "$SOURCE_PATH" "/tmp/${REPO_NAME}/${TARGET_PATH}"

cd "/tmp/${REPO_NAME}"
git add "$TARGET_PATH"
git -c user.name='OpenClaw Bot' -c user.email='bot@openclaw.local' commit -m "feat: publish ${TARGET_PATH}"
git push origin main
```

For folder deploys:

```bash
cp -R "/absolute/source-folder" "/tmp/${REPO_NAME}/<target-folder>"
```

## Verification

1. Check push success in command output.
2. Probe URL:

```bash
curl -I -s "https://<owner>.github.io/<repo>/<target-file>" | head -12
```

3. If first probe is 404, wait 1-3 minutes and probe again (Pages propagation).
4. Return final stable URL + note about short propagation delay.

## Troubleshooting

- If `gh auth` token invalid, use plain `git clone/push` over HTTPS when credential helper works.
- If GitHub unreachable temporarily, retry once after network check:

```bash
curl -I https://github.com
```

- If repo uses non-`main` publishing branch, detect with:

```bash
git remote show origin
```

and push to the configured default branch.

## Reply template

- State deployment completed.
- Provide stable Pages URL.
- Mention propagation delay only if currently 404.
- Ask user to report any rendering issues for quick patch + redeploy.
