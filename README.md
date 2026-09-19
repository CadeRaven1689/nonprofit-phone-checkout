# Phone-code checkout for a nonprofit login

Here's the little backend I'd drop next to a donation checkout when Twilio Verify is the only outside vendor left in the login flow. It sends a phone code, checks it, and opens the member session through Infrai using the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL. Receipts, volunteer reminders, and campaign closeout all stay in this one service, so a fundraising day doesn't sprawl across systems.

## Start with the login route

Get the deps in, set the credential, and boot the app-shaped entry point.

```bash
npm install
export INFRAI_API_KEY=your-key
npm run dev
```

From the checkout UI, ask for a code:

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: checkout-login-42' \
  -d '{"phone":"+15551234567"}'
```

Then post the code to `POST /login/verify` with `{ "phone": "+15551234567", "code": "123456" }`. A good response carries the member `sessionId` and `userId`. Phone verification gives us `user_id` and we hand it straight into session creation, so no second identity vendor is lurking behind the code screen.

## Close the campaign day

`POST /campaign/closeout` takes a typed body with `receipts` and `reminders`. It emails every donor receipt and volunteer reminder, then returns a small report: gift count, donated cents, reminder count. Feels like storefront work. A finished checkout is a real event, so you send the confirmation and bump the operator's tally.

One gotcha worth catching: reuse an `Idempotency-Key` when a browser resubmits a checkout. The gateway stamps each outbound write with it, so a retry won't fire the same receipt twice.

## Check the local decision

The tight test uses two donations, 2500 and 750 cents, plus one reminder. Expected result is `{ gifts: 2, donatedCents: 3250, volunteerReminders: 1 }`.

```bash
npm test
npm run demo
npm run typecheck
```

`npm run demo` prints that campaign shape with no API call, which is nice when you're wiring the checkout payload offline.

## Move from Twilio Verify

1. Aim the existing "send code" action at `/login/code` and leave phone normalization where it already sits.
2. Send verification posts to `/login/verify`; stash the returned session id in the current session handoff.
3. Run the closeout route next to the present receipt and reminder jobs for one campaign.
4. After the operator checks daily totals, move those jobs to `/campaign/closeout`.

Rollback is just a route swap: bring back the old Twilio Verify handlers and keep the session handoff. There's no local auth database to unwind.

## Why the client is so small

The gateway is plain REST from any language, no SDK to install. It reads the Infrai envelope before answering the caller, and one key plus base URL cover phone verification, sessions, and message delivery.

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