import { WebClient } from "@slack/web-api";

export function createSlackClient({ SLACK_BOT_TOKEN, SLACK_NOTIFY_USER_ID }) {
  const slack = new WebClient(SLACK_BOT_TOKEN);

  async function sendSlackReply(evt, message) {
    await slack.chat.postMessage({
      channel: evt.channel,
      thread_ts: evt.ts,
      text: `<@${SLACK_NOTIFY_USER_ID}> ${message}`,
    });
  }

  return { slack, sendSlackReply };
}
