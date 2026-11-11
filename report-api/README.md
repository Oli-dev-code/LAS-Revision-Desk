# Question-report Worker

Create a Cloudflare D1 database named `las-revision-question-reports`, apply `schema.sql`, replace the D1 ID in `wrangler.toml`, and deploy with Wrangler.

Set these Worker secrets/variables:

- `GITHUB_OWNER=Oli-dev-code`
- `GITHUB_REPO=LAS-Revision-Desk`
- `GITHUB_ISSUE_TOKEN` — fine-grained token with Issues: write only
- `TURNSTILE_SECRET_KEY`
- `RATE_LIMIT_SALT`

Create the `question-report` label in the GitHub repository. Update `report-config.js` with the Worker URL and public Turnstile site key before deploying the client.
