# Project Guidelines & Rules

## Ticket Completion & PR Workflow
Whenever you complete a ticket or ticket group:
1. Ensure the full CI verification suite passes locally (`npm run check:ci`).
2. Commit changes on a dedicated feature branch (`feature/<TICKET-IDS>`).
3. If the `docs` submodule has changes, commit and push them to `origin master`.
4. Automatically push the feature branch to `origin` and open a Pull Request using `gh pr create`.
5. Verify both GitHub Actions checks and the Netlify Deploy Preview succeed before declaring complete:
   - Verify CI checks pass using `gh pr checks`.
   - Provide the user with the PR URL and the accompanying Netlify Deploy Preview URL:
     `https://deploy-preview-<PR_NUMBER>--copio-documents.netlify.app`
