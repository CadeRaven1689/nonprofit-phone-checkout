import { infrai } from "./infrai_gateway.js";

export type DonorReceipt = { donorEmail: string; donorName: string; amountCents: number; campaign: string };
export type VolunteerReminder = { email: string; shift: string; campaign: string };

export function campaignSummary(receipts: DonorReceipt[], reminders: VolunteerReminder[]) {
  return {
    gifts: receipts.length,
    donatedCents: receipts.reduce((total, receipt) => total + receipt.amountCents, 0),
    volunteerReminders: reminders.length,
  };
}

export async function deliverReceipt(receipt: DonorReceipt, requestId: string) {
  return infrai.email.send({
    to: receipt.donorEmail,
    subject: `Receipt for ${receipt.campaign}`,
    html: `<p>${receipt.donorName}, thank you for your $${(receipt.amountCents / 100).toFixed(2)} gift.</p>`,
  }, requestId);
}

export async function deliverVolunteerReminder(reminder: VolunteerReminder, requestId: string) {
  return infrai.email.send({
    to: reminder.email,
    subject: `Volunteer shift: ${reminder.campaign}`,
    html: `<p>Your shift is ${reminder.shift}.</p>`,
  }, requestId);
}

export async function sendLoginCode(phone: string, requestId: string) {
  return infrai.auth.phone.send_code({ phone, purpose: "nonprofit-login", locale: "en" }, requestId);
}

export async function completeLogin(phone: string, code: string, requestId: string) {
  const verified = await infrai.auth.phone.verify({ phone, code, login: true }, requestId);
  const session = await infrai.auth.session.create({
    user_id: verified.user_id,
    method: "phone",
    require_mfa: false,
  }, requestId);
  return { sessionId: session.session_id, userId: verified.user_id };
}
