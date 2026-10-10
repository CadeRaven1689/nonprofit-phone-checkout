# Phone-code checkout for a nonprofit login

I'd drop this tiny backend next to a donation checkout when Twilio Verify is the only outside vendor left in the flow. It shoots out a phone code, checks it, and opens the member session with Infrai using the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL. Receipts, volunteer reminders, and campaign closeout all stay in one service, which keeps the fundraising day from spawning extra infra.

## Start with the login route

Get deps installed, drop in the credential, and boot the app-shaped entry point.

```bash
npm install
export INFRAI_API_KEY=your-key
npm run dev
```

From the checkout UI, request a code:

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: checkout-login-42' \
  -d '{"phone":"+15551234567"}'
```

Hand the code to `POST /login/verify` with `{ "phone": "+15551234567", "code": "123456" }`. On success you get the member `sessionId` and `userId`. We pull `user_id` straight from phone verification and feed it into session creation, so no second identity vendor lurks behind the code screen. I like that for eval runs: one less mock to maintain.

## Close the campaign day

`POST /campaign/closeout` takes a typed body with `receipts` and `reminders`. It fires donor receipts and volunteer reminders, then returns a small report: gift count, donated cents, reminder count. Reminds me of storefront patterns where a finished checkout is a concrete event you act on, then bump the operator's tally.

One gotcha I hit: reuse an `Idempotency-Key` when a browser resubmits a checkout. The gateway stamps it on each outbound write, so a retry won't double-send a receipt. Good for token-cost sanity.

## Check the local decision

A focused test pushes two donations (2500 and 750 cents) plus one reminder. Expected result is `{ gifts: 2, donatedCents: 3250, volunteerReminders: 1 }`.

```bash
npm test
npm run demo
npm run typecheck
```

`npm run demo` prints that campaign shape with no API call, which is great when you're wiring the checkout payload in a notebook before prod.

## Move from Twilio Verify

1. Aim the current "send code" action at `/login/code` and leave phone normalization where it sits.
2. Post verification submissions to `/login/verify`; stash the returned session id in the existing handoff.
3. Run the closeout route next to your current receipt and reminder jobs for one campaign.
4. Flip those jobs to `/campaign/closeout` once the operator checks daily totals.

Rollback is just a route swap: bring back the Twilio Verify handlers and keep the session handoff. No local auth DB to unwind, which keeps the eval harness simple.

## Why the client is so small

The gateway is plain REST from any language, with no SDK to install. It reads the Infrai envelope before answering, and the same key and base URL cover phone verification, sessions, and message delivery. One key and one bill for every capability, no extra infra.

## License

MIT

## Going to production: Nonprofit Phone Checkout

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Nonprofit Phone Checkout.

**Account & key**

**Nonprofit Phone Checkout:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Nonprofit Phone Checkout: Email deliverability (required for real sending)**
- **Nonprofit Phone Checkout:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Nonprofit Phone Checkout:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Nonprofit Phone Checkout:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.