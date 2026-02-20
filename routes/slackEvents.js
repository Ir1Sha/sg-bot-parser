import { parseSlackText } from "../parser.js";
import {
  unsubRemovedMessage,
  manualCheckMessage,
  spamRemovedMessage,
  invalidManualCheckMessage,
  mailboxFullRemovedMessage,
  providerBlockRemovedMessage,
  bounceRemovedMessage,
} from "../responses.js";
import {
  normalizeEmail,
  isInCooldown,
  markProcessed,
} from "../utils/cooldown.js";

export function registerSlackEventsRoute(app, deps) {
  const { sendSlackReply, sgOps } = deps;

  app.post("/slack/events", (req, res) => {
    const body = req.body;

    if (body?.type === "url_verification") {
      return res.json({ challenge: body.challenge });
    }

    const evt = body?.event;

    if (!evt || evt.type !== "message" || evt.subtype || evt.bot_id) {
      return res.sendStatus(200);
    }

    const parsed = parseSlackText(evt.text || "");
    const email = parsed?.email;
    if (!email) return res.sendStatus(200);

    res.sendStatus(200);

    if (req.headers["x-slack-retry-num"]) return;

    void (async () => {
      const key = normalizeEmail(email);

      try {
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
          await sendSlackReply(evt, manualCheckMessage());
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
        const status = err?.response?.status;
        const data = err?.response?.data || err.message;
        const method = err?.config?.method?.toUpperCase();
        const url = err?.config?.url;

        console.error("SENDGRID CHECK FAILED:", { status, method, url, data });
      }
    })();
  });
}
