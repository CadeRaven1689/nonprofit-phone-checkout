import { campaignSummary } from "../src/nonprofit_workflows.js";

const report = campaignSummary([
  { donorEmail: "donor@example.org", donorName: "Avery", amountCents: 5000, campaign: "Community Pantry" },
], [{ email: "volunteer@example.org", shift: "Friday 5pm", campaign: "Community Pantry" }]);

console.log(JSON.stringify(report));
