import { App } from "@slack/bolt";

import { parseSlackText } from "../parser.js";
import {
  unsubRemovedMessage,
  manualCheckMessage,
  spamRemovedMessage,
  invalidManualCheckMessage,
  mailboxFullRemovedMessage,
  providerBlockRemovedMessage,
  bounceRemovedMessage,
  noSuppressionsManualCheckMessage,
} from "../responses.js";
import {
  normalizeEmail,
  isInCooldown,
  markProcessed,
} from "../utils/cooldown.js";

export function startSocketMode({ sgOps, sendSlackReply, env }) {
  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  app.message(async ({ message }) => {
    try {
      // ignore non-text, subtype, bot messages
      if (!message?.text) return;
      if (message.subtype) return;
      if (message.bot_id) return;

      const parsed = parseSlackText(message.text || "");
      const email = parsed?.email;
      if (!email) return;

      // adapter to match your sendSlackReply(evt, msg)
      const evt = { channel: message.channel, ts: message.ts };
      const key = normalizeEmail(email);

      if (isInCooldown(key)) {
        await sendSlackReply(evt, manualCheckMessage());
        return;
      }

      const bounce = await sgOps.getBounceDetails(email);
      const block = await sgOps.getBlockDetails(email);
      const vi = await sgOps.isVeryImportantUnsubscribed(email);
      const globalSources = await sgOps.getGlobalSources(email);
      const global = globalSources.any;
      const spam = await sgOps.isSpamReported(email);
      const invalid = await sgOps.isInvalidSuppressed(email);

      console.log("DIAG:", {
        email,
        bounce: bounce?.reason || null,
        block: block?.reason || null,
        global_sources: globalSources,
        global_unsubscribed: global,
        very_important_group_unsubscribed: vi,
        spam_reported: spam,
        invalid_suppressed: invalid,
        in_cooldown: isInCooldown(key),
      });

      if (invalid) {
        markProcessed(key);
        await sendSlackReply(evt, invalidManualCheckMessage());
        return;
      }

      if (!bounce && !block && !global && !vi && !spam) {
        markProcessed(key);
        await sendSlackReply(evt, noSuppressionsManualCheckMessage());
        return;
      }

      let removedSomething = false;

      if (spam) {
        await sgOps.deleteSpamReport(email);
        removedSomething = true;
      }

      if (global) {
        await sgOps.deleteGlobalUnsubscribe(email);
        removedSomething = true;
      }

      if (vi) {
        await sgOps.deleteVeryImportantUnsubscribe(email);
        removedSomething = true;
      }

      if (bounce) {
        await sgOps.deleteBounce(email);
        removedSomething = true;
      }

      if (block) {
        await sgOps.deleteBlock(email);
        removedSomething = true;
      }

      if (global) {
        const globalAfter = await sgOps.getGlobalSources(email);
        console.log("GLOBAL AFTER DELETE:", globalAfter);

        if (globalAfter.any) {
          markProcessed(key);
          await sendSlackReply(evt, manualCheckMessage());
          return;
        }
      }

      if (removedSomething) {
        markProcessed(key);

        let msg = unsubRemovedMessage();

        if (spam) {
          msg = spamRemovedMessage();
        } else if (bounce) {
          msg = sgOps.isMailboxFull(bounce)
            ? mailboxFullRemovedMessage(bounce)
            : bounceRemovedMessage(bounce);
        } else if (block) {
          msg = sgOps.isMailboxFull(block)
            ? mailboxFullRemovedMessage(block)
            : providerBlockRemovedMessage(block);
        }

        await sendSlackReply(evt, msg);
      }

      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error("Socket handler error:", err?.response?.data || err);
    }
  });

  (async () => {
    await app.start();
    console.log("⚡ Slack Socket Mode started");
  })();
}
