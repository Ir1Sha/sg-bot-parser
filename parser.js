export function parseSlackText(text = "") {
  const mailtoMatch = text.match(/mailto:([^\|>]+)/i);
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  const email = (mailtoMatch?.[1] || emailMatch?.[0] || "")
    .trim()
    .toLowerCase();

  const issueMatch = text.match(/Issue:\s*(.+)$/im);
  const issue = (issueMatch?.[1] || "").trim();

  return { email, issue };
}
