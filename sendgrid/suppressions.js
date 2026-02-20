import { normalizeEmail } from "../utils/cooldown.js";

export function createSendgridSuppressions({ sg, VERY_IMPORTANT_GROUP_ID }) {
  // ---- GLOBAL ----
  async function getGlobalSources(email) {
    const enc = encodeURIComponent(email);

    let legacy = false;
    let asm = false;

    // legacy
    try {
      const r = await sg.get(`/suppression/unsubscribes/${enc}`);
      if (Array.isArray(r.data)) legacy = r.data.length > 0;
      else if (r.data && typeof r.data === "object")
        legacy = Object.keys(r.data).length > 0;
      else legacy = Boolean(r.data);
    } catch (err) {
      if (err?.response?.status === 404) legacy = false;
      else throw err;
    }

    // ASM global
    try {
      const r = await sg.get(`/asm/suppressions/global/${enc}`);
      asm = Boolean(r?.data?.recipient_email);
    } catch (err) {
      if (err?.response?.status === 404) asm = false;
      else throw err;
    }

    return { legacy, asm, any: legacy || asm };
  }

  async function deleteGlobalUnsubscribe(email) {
    const enc = encodeURIComponent(email);

    // legacy
    try {
      const r1 = await sg.delete(`/suppression/unsubscribes/${enc}`);
      console.log("DELETE legacy global:", r1.status);
    } catch (err) {
      console.log(
        "DELETE legacy global ERROR:",
        err?.response?.status,
        err?.response?.data || err.message
      );
    }

    // ASM
    try {
      const r2 = await sg.delete(`/asm/suppressions/global/${enc}`);
      console.log("DELETE asm global:", r2.status);
    } catch (err) {
      console.log(
        "DELETE asm global ERROR:",
        err?.response?.status,
        err?.response?.data || err.message
      );
    }
  }

  // ---- spam ----
  async function isSpamReported(email) {
    const enc = encodeURIComponent(email);

    try {
      const r = await sg.get(`/suppression/spam_reports/${enc}`);
      if (Array.isArray(r.data)) return r.data.length > 0;
      if (r.data && typeof r.data === "object")
        return Object.keys(r.data).length > 0;
      return Boolean(r.data);
    } catch (err) {
      if (err?.response?.status === 404) return false;
      throw err;
    }
  }

  async function deleteSpamReport(email) {
    await sg.delete(`/suppression/spam_reports/${encodeURIComponent(email)}`);
  }

  // ---- invalid ----
  async function isInvalidSuppressed(email) {
    const enc = encodeURIComponent(email);

    try {
      const r = await sg.get(`/suppression/invalid_emails/${enc}`);
      if (Array.isArray(r.data)) return r.data.length > 0;
      if (r.data && typeof r.data === "object")
        return Object.keys(r.data).length > 0;
      return Boolean(r.data);
    } catch (err) {
      if (err?.response?.status === 404) return false;
      throw err;
    }
  }

  // ---- bounces ----
  async function getBounceDetails(email) {
    const enc = encodeURIComponent(email);

    try {
      const r = await sg.get(`/suppression/bounces/${enc}`);
      if (!Array.isArray(r.data) || !r.data.length) return null;
      return r.data[0];
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async function deleteBounce(email) {
    await sg.delete(`/suppression/bounces/${encodeURIComponent(email)}`);
  }

  // ---- blocks ----
  async function getBlockDetails(email) {
    const enc = encodeURIComponent(email);

    try {
      const r = await sg.get(`/suppression/blocks/${enc}`);
      if (!Array.isArray(r.data) || !r.data.length) return null;
      return r.data[0];
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async function deleteBlock(email) {
    await sg.delete(`/suppression/blocks/${encodeURIComponent(email)}`);
  }

  function isMailboxFull(objOrReason = "") {
    const reason =
      typeof objOrReason === "string"
        ? objOrReason
        : String(objOrReason?.reason || "");

    const status =
      typeof objOrReason === "string" ? "" : String(objOrReason?.status || "");

    const r = reason.toLowerCase();
    const s = status.trim();

    if (s.startsWith("4.2.2") || s.startsWith("5.2.2")) return true;

    return (
      r.includes("over quota") ||
      r.includes("out of storage") ||
      r.includes("mailbox full") ||
      r.includes("full mailbox") ||
      r.includes("mailbox is full") ||
      r.includes("quota exceeded") ||
      r.includes("insufficient storage") ||
      r.includes("storage") ||
      r.includes("quota")
    );
  }

  // ---- VI group suppression ----
  async function isVeryImportantUnsubscribed(email) {
    const target = normalizeEmail(email);

    const r = await sg.get(
      `/asm/groups/${VERY_IMPORTANT_GROUP_ID}/suppressions`
    );
    if (!Array.isArray(r.data)) return false;

    return r.data.some((e) => normalizeEmail(e) === target);
  }

  async function deleteVeryImportantUnsubscribe(email) {
    const r = await sg.delete(
      `/asm/groups/${VERY_IMPORTANT_GROUP_ID}/suppressions/${encodeURIComponent(
        email
      )}`
    );
    console.log("DELETE VI group:", r.status);
  }

  return {
    getGlobalSources,
    deleteGlobalUnsubscribe,

    isSpamReported,
    deleteSpamReport,

    isInvalidSuppressed,

    getBounceDetails,
    deleteBounce,

    getBlockDetails,
    deleteBlock,

    isMailboxFull,

    isVeryImportantUnsubscribed,
    deleteVeryImportantUnsubscribe,
  };
}
