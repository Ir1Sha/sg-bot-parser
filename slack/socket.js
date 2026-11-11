import { App } from '@slack/bolt';

import { parseSlackText } from '../parser.js';
import {
  unsubRemovedMessage,
  manualCheckMessage,
  spamRemovedMessage,
  invalidManualCheckMessage,
  mailboxFullRemovedMessage,
  providerBlockRemovedMessage,
  bounceRemovedMessage,
  noSuppressionsManualCheckMessage,
} from '../responses.js';
import {
  normalizeEmail,
  isInCooldown,
  markProcessed,
} from '../utils/cooldown.js';

export function startSocketMode({ sgOps, sendSlackReply, env }) {
  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  const slack = app.client;
  const processingEmails = new Set();
  const processedEvents = new Set();

  app.message(async ({ message }) => {
    try {
      console.log('SLACK EVENT:', {
        ts: message?.ts,
        thread_ts: message?.thread_ts,
        bot_id: message?.bot_id,
        subtype: message?.subtype,
        user: message?.user,
      });
      // ignore non-text, subtype, bot messages
      if (!message?.text) return;
      if (message.subtype) return;
      if (message.bot_id) return;
      const eventKey = `${message.channel}:${message.ts}`;
      if (processedEvents.has(eventKey)) return;
      processedEvents.add(eventKey);
      setTimeout(
        () => {
          processedEvents.delete(eventKey);
        },
        10 * 60 * 1000,
      );
      if (
        message.thread_ts &&
        !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message.text)
      )
        return;

      const threadTs = message.thread_ts || message.ts;

      let threadMessages = [];
      let originalText = message.text || '';

      if (message.thread_ts) {
        let cursor;

        do {
          const history = await slack.conversations.replies({
            channel: message.channel,
            ts: threadTs,
            limit: 100,
            ...(cursor ? { cursor } : {}),
          });

          threadMessages.push(...(history.messages || []));
          cursor = history.response_metadata?.next_cursor || null;
        } while (cursor);

        originalText = threadMessages[0]?.text || '';
      }

      const parsed = parseSlackText(message.text || '');
      const email = parsed?.email;
      if (!email) return;
      if (message.thread_ts) {
        const alreadyChecked = threadMessages.some((msg) => {
          const match =
            msg.bot_id === 'B0AJR1GQ7GS'
              ? msg.text?.match(/Email checked:\s*([^\s]+)/i)
              : null;
          return match && normalizeEmail(match[1]) === normalizeEmail(email);
        });

        if (alreadyChecked) return;
      }
      const processingKey = `${message.channel}:${threadTs}:${normalizeEmail(email)}`;
      if (processingEmails.has(processingKey)) return;
      processingEmails.add(processingKey);
      try {
        const isWithdrawal = /no email to confirm funds withdrawal/i.test(
          originalText,
        );

        // adapter to match your sendSlackReply(evt, msg)
        const evt = {
          channel: message.channel,
          ts: message.ts,
          thread_ts: message.thread_ts,
          email,
        };
        const key = `${normalizeEmail(email)}:${isWithdrawal ? 'withdrawal' : 'default'}`;

        if (!message.thread_ts && isInCooldown(key)) {
          await sendSlackReply(evt, manualCheckMessage());
          return;
        }

        const bounce = await sgOps.getBounceDetails(email);
        const block = await sgOps.getBlockDetails(email);
        const vi = isWithdrawal
          ? await sgOps.isWithdrawalUnsubscribed(email)
          : await sgOps.isVeryImportantUnsubscribed(email);
        const globalSources = await sgOps.getGlobalSources(email);
        const global = globalSources.any;
        const spam = await sgOps.isSpamReported(email);
        const invalid = await sgOps.isInvalidSuppressed(email);

        console.log('DIAG:', {
          email,
          bounce: bounce?.reason || null,
          block: block?.reason || null,
          global_sources: globalSources,
          global_unsubscribed: global,
          suppression_group: isWithdrawal ? 'withdrawal' : 'very_important',
          group_unsubscribed: vi,
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
          if (isWithdrawal) {
            await sgOps.deleteWithdrawalUnsubscribe(email);
          } else {
            await sgOps.deleteVeryImportantUnsubscribe(email);
          }

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
          console.log('GLOBAL AFTER DELETE:', globalAfter);

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
      } finally {
        processingEmails.delete(processingKey);
      }
    } catch (err) {
      console.error('Socket handler error:', err?.response?.data || err);
    }
  });

  (async () => {
    await app.start();
    console.log('⚡ Slack Socket Mode started');
  })();
}
