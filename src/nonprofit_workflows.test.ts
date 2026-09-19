import assert from "node:assert/strict";
import test from "node:test";
import { campaignSummary } from "./nonprofit_workflows.js";

test("campaign closeout totals gifts and reminders for the checkout report", () => {
  const report = campaignSummary([
    { donorEmail: "sam@example.org", donorName: "Sam", amountCents: 2500, campaign: "Winter Pantry" },
    { donorEmail: "lee@example.org", donorName: "Lee", amountCents: 750, campaign: "Winter Pantry" },
  ], [{ email: "volunteer@example.org", shift: "Saturday 9am", campaign: "Winter Pantry" }]);
  assert.deepEqual(report, { gifts: 2, donatedCents: 3250, volunteerReminders: 1 });
});
