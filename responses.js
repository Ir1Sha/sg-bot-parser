export function unsubRemovedMessage() {
  return (
    "This email was not sent because the recipient previously unsubscribed from these emails.\n" +
    "Відписку видалено, юзер може спробувати ще раз."
  );
}

export function manualCheckMessage() {
  return (
    "A suppression record for this recipient was recently removed, but it appeared again.\n" +
    "Manual check required."
  );
}

export function spamRemovedMessage() {
  return (
    "This email was not sent because the recipient previously marked your messages as spam.\n" +
    "Скаргу видалено, юзер може спробувати ще раз."
  );
}

export function invalidManualCheckMessage() {
  return "Invalid address suppression detected. Manual check required.";
}

function fmtReason(obj) {
  const reason = obj?.reason ? String(obj.reason).trim() : "";
  const status = obj?.status ? String(obj.status).trim() : "";
  const extra = [];

  if (status) extra.push(`SMTP: ${status}`);
  if (reason) extra.push(`Reason: ${reason}`);

  return extra.length ? extra.join("\n") : "Reason: (not provided by SendGrid)";
}

// Mailbox full
export function mailboxFullRemovedMessage(bounce) {
  return (
    "Bounce suppression removed.\n" +
    fmtReason(bounce) +
    "\n\n" +
    "Порада для юзера:\n" +
    "Схоже, що у поштовій скриньці немає вільного місця. " +
    "Лог помилки видалено. Користувач може спробувати ще раз, але бажано спочатку очистити памʼять."
  );
}

// Other bounce
export function bounceRemovedMessage(bounce) {
  return (
    "Bounce suppression removed.\n" +
    fmtReason(bounce) +
    "\n\n" +
    "Лог помилки видалено, юзер може спробувати ще раз. If it happens again, manual verification is required."
  );
}

// Provider block
export function providerBlockRemovedMessage(block) {
  return (
    "Block suppression removed.\n" +
    fmtReason(block) +
    "\n\n" +
    "Лог помилки видалено, юзер може спробувати ще раз. If it happens again, manual verification is required."
  );
}
