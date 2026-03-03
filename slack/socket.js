import { App } from "@slack/bolt";

export function startSocketMode({ sgOps, sendSlackReply, env }) {
  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  app.message(async ({ message }) => {
    try {
      if (!message.text || message.subtype) return;

      const email = message.text.trim().toLowerCase();

      const result = await sgOps.check(email);

      const reply = result.message;
      await sendSlackReply(message, reply);
    } catch (err) {
      console.error("Socket handler error:", err);
    }
  });

  (async () => {
    await app.start();
    console.log("⚡ Slack Socket Mode started");
  })();
}
