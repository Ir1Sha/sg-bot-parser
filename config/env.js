export function loadEnvOrExit() {
  const SENDGRID_API_KEY = (process.env.SENDGRID_API_KEY || "").trim();
  const VERY_IMPORTANT_GROUP_ID = (
    process.env.SENDGRID_VERY_IMPORTANT_GROUP_ID || ""
  ).trim();

  if (!SENDGRID_API_KEY) {
    console.error("ERROR: SENDGRID_API_KEY is missing in .env");
    process.exit(1);
  }
  if (!VERY_IMPORTANT_GROUP_ID) {
    console.error("ERROR: SENDGRID_VERY_IMPORTANT_GROUP_ID is missing in .env");
    process.exit(1);
  }

  const SLACK_BOT_TOKEN = (process.env.SLACK_BOT_TOKEN || "").trim();
  if (!SLACK_BOT_TOKEN) {
    console.error("ERROR: SLACK_BOT_TOKEN is missing in .env");
    process.exit(1);
  }

  const SLACK_NOTIFY_USER_ID = (process.env.SLACK_NOTIFY_USER_ID || "").trim();
  if (!SLACK_NOTIFY_USER_ID) {
    console.error("ERROR: SLACK_NOTIFY_USER_ID is missing in .env");
    process.exit(1);
  }

  const PORT = Number(process.env.PORT || 3000);

  return {
    SENDGRID_API_KEY,
    VERY_IMPORTANT_GROUP_ID,
    SLACK_BOT_TOKEN,
    SLACK_NOTIFY_USER_ID,
    PORT,
  };
}
