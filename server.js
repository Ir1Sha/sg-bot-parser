import "dotenv/config";
import express from "express";

import { loadEnvOrExit } from "./config/env.js";
import { createSendgridClient } from "./sendgrid/client.js";
import { createSendgridSuppressions } from "./sendgrid/suppressions.js";
import { createSlackClient } from "./slack/client.js";
import { registerSlackEventsRoute } from "./routes/slackEvents.js";

const env = loadEnvOrExit();

const sg = createSendgridClient(env.SENDGRID_API_KEY);
const sgOps = createSendgridSuppressions({
  sg,
  VERY_IMPORTANT_GROUP_ID: env.VERY_IMPORTANT_GROUP_ID,
});

const { sendSlackReply } = createSlackClient({
  SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN,
  SLACK_NOTIFY_USER_ID: env.SLACK_NOTIFY_USER_ID,
});

const app = express();
app.use(express.json());

registerSlackEventsRoute(app, { sendSlackReply, sgOps });

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
