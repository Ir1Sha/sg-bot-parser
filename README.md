# sg-bot-parser

Express-based Slack bot webhook that parses incoming messages for an email address, checks SendGrid suppression state for that recipient, optionally removes suppressions, and posts a threaded reply in Slack with the outcome.

## What This Project Does

This service listens for Slack Events API messages on `/slack/events`.
When a message contains an email, it:

1. Queries SendGrid suppression sources for that email.
2. Decides whether action is needed.
3. Removes eligible suppressions (global unsubscribes, group unsubscribe, spam report, bounce, block).
4. Posts a contextual reply in the same Slack thread and mentions a configured user.

It is designed to automate first-line suppression recovery while forcing manual review for risky or ambiguous cases.

## High-Level Flow

1. Slack sends an event to `POST /slack/events`.
2. Route ignores non-user messages and retries, and handles Slack URL verification.
3. Email is extracted from message text (`mailto:` links or plain email patterns).
4. If the email was processed recently (30-minute cooldown), bot replies with manual-check guidance.
5. Service checks SendGrid for:
- global unsubscribe (legacy + ASM global)
- very important ASM group suppression
- spam report
- invalid email suppression
- bounce details
- block details
6. Decision logic:
- Invalid suppression present -> no auto-delete, manual check reply.
- Nothing suppressed -> manual check reply.
- Any removable suppression present -> delete those entries.
7. After deleting global unsubscribes, service re-checks global state:
- If still globally suppressed, manual check reply.
8. If removals succeeded, email enters cooldown and bot sends a reason-aware success message.

## Endpoint Responsibilities

### `POST /slack/events`
File: `routes/slackEvents.js`

Responsibilities:
- Responds to Slack URL verification requests (`type: url_verification`).
- Accepts only user-authored `message` events (ignores bot/system subtypes).
- Parses message text to extract an email.
- Returns HTTP `200` quickly, then continues async processing.
- Prevents duplicate handling for Slack retries via `x-slack-retry-num`.
- Runs suppression check/remove workflow via SendGrid operations.
- Sends threaded status reply to Slack.

Notes:
- Route is registered in `server.js` using dependency injection (`sendSlackReply`, `sgOps`).

## Module Map

- `server.js`
- Bootstraps app, loads env, creates clients, registers routes, starts Express.

- `config/env.js`
- Validates required environment variables and exits process if missing.

- `routes/slackEvents.js`
- Main orchestration logic for Slack event intake, cooldown checks, suppression decisions, and replies.

- `parser.js`
- Extracts `email` and optional `issue` text from Slack message body.

- `sendgrid/client.js`
- Axios client factory targeting `https://api.sendgrid.com/v3`.

- `sendgrid/suppressions.js`
- SendGrid suppression operations:
  - read global suppression from legacy + ASM endpoints
  - delete global suppression from both endpoints
  - check/delete spam reports
  - check invalid suppression
  - read/delete bounces
  - read/delete blocks
  - check/delete suppression in a specific ASM group
  - classify mailbox-full scenarios from bounce/block reason/status

- `slack/client.js`
- Slack Web API wrapper; posts thread replies and mentions configured user.

- `utils/cooldown.js`
- In-memory 30-minute dedup/cooldown map keyed by normalized email.

- `responses.js`
- Centralized human-facing response templates sent back to Slack.

## Suppression Decision Rules (Current Behavior)

Given an extracted email:

1. If in cooldown -> `manualCheckMessage()`.
2. Query suppression signals.
3. If `invalid_suppressed` -> `invalidManualCheckMessage()` and mark cooldown.
4. If no suppression flags (`bounce`, `block`, `global`, `very important`, `spam`) -> `manualCheckMessage()`.
5. Else delete all detected removable suppressions.
6. If global suppression was removed, verify global state again; if still present -> `manualCheckMessage()` and mark cooldown.
7. If anything was removed, mark cooldown and send one message:
- spam existed -> `spamRemovedMessage()`
- else bounce existed -> mailbox-full or generic bounce message
- else block existed -> mailbox-full or provider-block message
- else -> generic unsubscribe removed message

## Environment Variables

Required:

- `SENDGRID_API_KEY`
- `SENDGRID_VERY_IMPORTANT_GROUP_ID`
- `SLACK_BOT_TOKEN`
- `SLACK_NOTIFY_USER_ID`

Optional:

- `PORT` (default `3000`)

## Run Locally

```bash
npm install
npm start
```

Server starts at:

- `http://localhost:3000` (unless `PORT` is set)

## Operational Notes

- Cooldown storage is in-memory; restarts clear it.
- Route intentionally acknowledges Slack quickly, then works asynchronously.
- SendGrid API errors are logged with status/method/url/payload.
- The very-important group check currently fetches whole group suppressions and searches for the email.

## Future Improvements

- Persist cooldown in Redis or database for multi-instance deployments.
- Add signature verification for Slack requests.
- Add structured logging/metrics and trace IDs.
- Add tests for decision matrix in `routes/slackEvents.js`.
- Add rate limiting and retry/backoff policies for SendGrid API calls.
