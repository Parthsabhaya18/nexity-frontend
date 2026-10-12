# Nexity: clickable prototype

A complete, front-end-only prototype of Nexity, a mystery-and-connection social app, plus its admin panel. Built with HTML5, CSS3 and vanilla JavaScript. There is no backend: data is mocked and persisted in `localStorage`. The product rules follow *Secret Social App Project Overview v3*.

## Run it

Open `index.html` (the user app) or `admin.html` (the admin panel) in a modern browser. Both work straight from the file system. You can also serve the folder with any static server, for example `npx serve .`.

The camera in **Create** needs a secure context: `file://` and `http://localhost` both work. If the camera is blocked or missing, the screen offers "Try again", photo upload, the built-in gallery, or a demo camera.

Open the app and the admin panel in two tabs of the same browser to see admin actions arrive live in the app. Examples: disabling the account, forcing a logout, gifting a plan, turning Nearby off, or changing plan prices.

## Demo accounts

| Where | Email | Password |
|---|---|---|
| User app | `tara@nexity.app` | `demo1234` |
| Admin panel | `admin@nexity.app` | `admin123` |

- The email verification and reset code is always `123456`.
- Five wrong passwords in a row lock login for 5 minutes. Resetting the password clears the lock.
- A failed payment can be simulated with UPI ID `fail@upi`, a card number ending in `0000`, or the "Next payment fails" toggle in Demo controls.
- Coupons: `NEXITY20` (20% off) and `WELCOME50` (50% off, first purchase only).

## Demo controls

Use the **Demo** button (bottom-right on mobile, "Demo controls" in the desktop sidebar), or press <kbd>Alt</kbd>+<kbd>D</kbd>, to:

- switch personas: Free, Plus, Premium, Secret Message receiver, Secret Crush receiver, Matched, Nearby explorer, New visitor, or open Admin;
- simulate events: an incoming secret message, a secret crush, a mutual match, or a chat reply;
- run the **Nearby simulator**: someone comes into or leaves Bluetooth range, an unknown Bluetooth device is ignored, a server-side location encounter (with the generic push, cooldown and daily cap), and "Advance clock by 1 day" to watch a hint go from today → yesterday → gone;
- change the simulated **phone**: Bluetooth adapter, Bluetooth advertising support, location services, precise location, and the Bluetooth / location permissions (not asked → denied → blocked → allowed);
- toggle a network error, a failing payment, or dark mode;
- pick a mood (Happy, Calm, Romantic, Sad, Angry, Cool, Relaxed, Excited, Tired, Motivated) and watch the light theme change;
- reset all demo data.

## Plans

| | Free | Plus (₹99, MRP ₹149) | Premium (₹249, MRP ₹399) |
|---|---|---|---|
| Send Secret Messages | — | 5 / month | Unlimited (fair use) |
| Secret Crush spots | — | 3 | Up to 10 |
| Read & reply to Secret Messages | Notification only (locked) | ✓ | ✓ |
| Match animation & chat | — | ✓ | ✓ |
| Nearby screen and "Someone is near you" notifications | ✓ | ✓ | ✓ |
| "This person was near you today." / "yesterday." in Secret Messages & Crush | Locked teaser | ✓ | ✓ |
| Premium profile badge 👑 | — | — | ✓ |

- Plans can be bought monthly, for 3 months (10% off) or yearly (25% off). Coupons stack on top and the checkout shows every discount.
- Users get a reminder 3 days before their plan expires.
- Admins can edit every price, feature and limit in **Admin → Plans**, and the app picks up the changes immediately.

### Secret Messages
- The receiver is notified "Someone is trying to reach you with a Secret Message 💌". The message arrives sealed: the list and thread show only "Someone sent you a secret message", a masked avatar, and placeholder lines. The sender's name, photo and message text are never rendered before the reveal.
- The receiver replies twice ("Reply 1 of 2", then "Reply 2 of 2"). The second reply unseals the envelope: the sender's name, photo and everything they wrote appear together, and the thread becomes a regular chat.
- Free receivers get the notification but the message stays locked until they upgrade.
- Reporting or blocking an anonymous sender never reveals who they are.

### Secret Crush
- The person you add gets "Someone added you as a Secret Crush 👀" and nothing more.
- If both people add each other, both see "Congratulations! It's a match 🎉" and the chat opens automatically.
- A crush that isn't mutual is never revealed to anyone, including whether the other person added you.

### Nearby
Full spec: `backend/documentation/modules/nearby/nearby-encounters.md`. The prototype simulates the phone, the other users and the server checks; it never uses real Bluetooth or GPS.
- Off by default and never asked for at launch. Turning it on goes through a consent screen where you pick **Bluetooth discovery**, **Location notifications** or both; each one then shows its own OS-style permission popup. A second "Don't allow" blocks the permission, after which only "Open Settings" can fix it.
- **Nearby screen** (Home header radar button, desktop sidebar, or Settings → Nearby → See who's nearby): scans only while it's open, then lists people whose phones confirmed each other, with "Nearby now", Follow, and ••• Report / Block. It has its own states for Nearby off, Bluetooth discovery off, permission needed or blocked, Bluetooth adapter off, unsupported phone, scanning, nobody nearby, offline, and paused by an admin.
- **Location notifications**: when the server finds two opted-in people close together, each gets "Someone is near you on Nexity. ✨". It never includes a name, photo or place. Each pair gets at most one per 6 hours, and each person at most 3 a day.
- **Secret hints**: Secret Message and Secret Crush rows, threads and the reveal show "This person was near you today." or "This person was near you yesterday.". After 2+ days, or when an encounter expires or doesn't exist, nothing is shown. Free users see a locked teaser. Anonymous cards never reveal who it is.
- One encounter per pair is kept (latest only, for 2 days). Blocked people, people with Nearby off and a globally paused feature never produce anything.
- Turning Nearby off stops everything at once. You'll see: "Nearby is off. Notifications that were already sent may still arrive."
- Admins see aggregate counts, misuse reports and the server settings (radius, minimum time together, cooldowns, daily cap, retention, id rotation), which they can edit with an audit entry. They can't see locations or who has Nearby on.

### Create (posts and stories)
- Create opens the camera. Tap the shutter for a photo; in Story mode, hold it to record a clip of up to 15 seconds. Switch cameras, use the flash, or pick from the gallery or an upload.
- Posts get filters and a caption. Stories get filters, text with colours and a background, and disappear after 24 hours.
- Reels show their length and are capped at 60 seconds.

### Admin panel
- The dashboard shows revenue as a daily chart (7, 30 or 90 days) or a monthly chart, plus active subscriptions per plan.
- Users can be disabled or enabled, signed out everywhere, marked active or inactive, gifted a plan, or deleted.

## Brand

The new Nexity logo is used on the splash screen, welcome, login, app sidebar and header, and the admin panel, with light and dark variants. The files are in `assets/brand/`. Logo artwork stays blue: primary `#2563EB`, sky `#38BDF8`, deep `#1D4ED8`, navy `#0F172A`. Those logo colors are not mood colors.

## Mood theme

Settings → Theme, and Demo controls, include a mood picker. The initial mood is Calm. Choosing a mood applies that row to the light appearance immediately (page background, white cards, accent, button, text, secondary text, and border). If dark mode is on, the prototype switches to light so the palette is visible. Dark mode can be turned on again and then uses the dark tokens, not a recolored mood palette. Success, warning, and danger stay status colors.

| Mood         | Background | Surface/Card | Primary   | Button    | Text      | Secondary Text | Border    |
| ------------ | ---------- | ------------ | --------- | --------- | --------- | -------------- | --------- |
| 😊 Happy     | `#FFFBEA`  | `#FFFFFF`    | `#F5B800` | `#D99500` | `#2B2200` | `#756A3A`      | `#F5E7A8` |
| 😌 Calm      | `#EFF8FF`  | `#FFFFFF`    | `#3B82F6` | `#1D4ED8` | `#0F2747` | `#58708C`      | `#CFE5FA` |
| ❤️ Romantic  | `#FFF1F5`  | `#FFFFFF`    | `#EC4899` | `#BE185D` | `#3B0A1E` | `#87506A`      | `#F7C6D8` |
| 😢 Sad       | `#EEF2FF`  | `#FFFFFF`    | `#6366F1` | `#4338CA` | `#171B3A` | `#626A91`      | `#D5D9F5` |
| 😡 Angry     | `#FFF1F1`  | `#FFFFFF`    | `#EF4444` | `#B91C1C` | `#350909` | `#824343`      | `#F6CACA` |
| 😎 Cool      | `#F5F3FF`  | `#FFFFFF`    | `#8B5CF6` | `#6D28D9` | `#21133D` | `#6B5A82`      | `#DDD4FE` |
| 🌿 Relaxed   | `#F1FAF4`  | `#FFFFFF`    | `#22C55E` | `#15803D` | `#0B2B18` | `#557562`      | `#CBEBD5` |
| 🔥 Excited   | `#FFF5ED`  | `#FFFFFF`    | `#F97316` | `#C2410C` | `#351306` | `#875D45`      | `#F6D0BA` |
| 😴 Tired     | `#F5F3F7`  | `#FFFFFF`    | `#8B7FA8` | `#625477` | `#292432` | `#756D7D`      | `#DDD8E5` |
| 🤩 Motivated | `#EEFDFD`  | `#FFFFFF`    | `#06B6D4` | `#0E7490` | `#062B32` | `#4C7278`      | `#BFE8EE` |

Primary buttons and the send button use **Button** with white text. Selected tabs and story rings use **Primary**. Cards stay `#FFFFFF`.

## Structure

```
index.html          User app shell
admin.html          Admin panel shell
assets/brand/       Logos, app icon, favicon (SVG)
css/
  variables.css     Design tokens (light + dark + mood palette)
  global.css        Reset, typography, buttons, forms, logo
  components.css    Shared components (nav, modals, toasts, chips…)
  screens.css       Screen-specific styles
  secret.css        Secret threads, compose, unseal reveal
  premium.css       Premium tab: Secret Messages + Secret Crush sections, people picker, add-crush sheet
  create.css        Camera, post editor, story editor
  nearby.css        Nearby screen, signal switches, consent, permission popups
  responsive.css    Tablet / desktop layouts
  admin.css         Admin panel layout
js/
  data.js, state.js Mock data, personas, persistence, business rules
  icons.js, ui.js   Lucide icons, logo, helpers, render components
scripts/
  build-icons.mjs   Regenerates js/icons.js from Lucide (run from frontend/: node prototype/scripts/build-icons.mjs)
  toast.js, modals.js, navigation.js, app.js   Framework
  auth.js, home.js, create.js, reels.js, search.js, user.js, secret.js,
  crush.js, chat.js, subscription.js, notifications.js, settings.js,
  safety.js, demo.js
  nearby.js         Nearby screen, permissions, signal switches, simulator
  admin.js          Admin panel
```
