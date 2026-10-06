# Dependency Links — private Trello Power-Up

Adds two fields to the back of every card:

- **Depends on** — the cards that must be finished before this one
- **Required by** — the cards that need this one

Both work with live search (filters the board's cards as you type), and
keep themselves in sync bidirectionally: if you add A to B's "Required
by" field, B automatically shows up in A's "Depends on" field too.

## Done-awareness

A card in a column named **Done** or **#done** (case-insensitive, whole
name) is finished, and so is an archived card. Finished cards stop
counting:

- A prerequisite that is done no longer blocks anything. The link stays
  as history and is shown struck through, dimmed, with a ✓.
- A done card is never shown as blocked or as a blocker.
- A deleted card counts as done.

Change the column names in `DONE_LIST_NAMES` at the top of `client.js`
(for example `["Done", "#done", "Complete"]`).

## Badges on the card front

One badge per card that has links:

- ⛔ n (red) — blocked: n prerequisites are not done yet
- ⚠️ n (yellow) — blocker: n open cards are waiting for this one
- both, if both apply: `⛔ 2  ⚠️ 1` (red)
- 🔗 n (gray) — has links, but none are active (everything is done)

The badge re-checks the board every ~15 seconds, so it notices when a
prerequisite is moved to Done (that change doesn't touch the dependent
card itself, so Trello would not refresh it otherwise). Expect a delay of
up to about 15–30 seconds.

**No server/backend of any kind is required.** All data is kept by
Trello's own "plugin data" store (`t.set` / `t.get`), tied to your Trello
account and the board. The only thing you need is to host the files at a
public HTTPS URL so Trello can embed them (that's not a "backend", just
static file hosting).

## Step 1 — publish the files to GitHub Pages

1. Create a new **public** GitHub repo (e.g. `trello-dependency-powerup`).
2. Upload all 6 files from this package **into the repo root** (not a
   subfolder): `index.html`, `connector.html`, `client.js`,
   `section.html`, `section.js`, `icon.svg`.
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**, branch: `main`, folder: `/ (root)` → Save.
4. After a couple of minutes the page is live at:
   `https://<YOUR-USERNAME>.github.io/<REPO-NAME>/`
5. Open `client.js` in the repo, and at the top replace this line with
   your actual URL:

   ```js
   var SECTION_ICON = "https://YOUR-USERNAME.github.io/YOUR-REPO/icon.svg";
   ```

   Commit it — GitHub Pages republishes automatically.

## Step 2 — register the Power-Up in Trello

1. Go to **[trello.com/power-ups/admin](https://trello.com/power-ups/admin)**
   and click **"New"**.
2. In the **"For Workspace"** field, pick your Workspace (if you've never
   explicitly created a team, Trello already made you a default one — you
   are its admin).
3. Give it a name (e.g. "Dependency Links"), and in the **"Iframe
   Connector URL"** field enter:

   ```
   https://<YOUR-USERNAME>.github.io/<REPO-NAME>/connector.html
   ```

4. Save. The Power-Up is now **private** from here on — it is not
   submitted to the public Power-Up directory, and is only available on
   boards that belong to your Workspace.
5. On the Power-Up's admin page, under the **"Appearance"** tab, upload an
   icon (this only appears in the admin UI and the Power-Up picker list —
   it needs no hosting, you upload it directly there).
6. Go to the **"Capabilities"** tab. Here you need to **manually turn
   on** all three toggles (this is not automatic — they need to be
   registered separately, regardless of what `client.js` implements):
   - `card-badges`
   - `card-detail-badges`
   - `card-back-section`

   Each is its own on/off toggle — no separate URL is needed, just turn
   it on. **Don't forget to save the form** after turning the toggles
   on — without that, nothing happens, regardless of whether the
   connector URL responds.

## Step 3 — turn it on for a board

1. Open a board you want to try it on.
2. **Power-Ups menu → search → "Custom"** tab — your "Dependency Links"
   Power-Up, registered under your Workspace, shows up here.
3. Click **"Add"**.
4. Hard-refresh the board page. From then on, every card gets the
   "Dependencies" section on its back, and the badges on its front.

Since turning it on is a **board-level** setting, anyone you invite to
the board who opens it (on any device of their own) will automatically
see the same thing — they don't need to enable anything themselves.
(Workspace membership isn't required to view/use the board either — they
just need access to the board.)

## Troubleshooting — if no capability shows up at all

1. **Check the Capabilities tab again** — are all three toggles actually
   green/on, and did you click "Save" afterward?
2. **Open the browser console on the board page** (F12 → Console), and
   look for a message like:
   `Power-Up ... implements capabilities that haven't been enabled [...]`
   — if you see this, it tells you exactly which toggle you missed in the
   portal.
3. **Check the Network tab** too: does `connector.html` load without
   error, and then `client.js`? On a 404 or mixed HTTP/HTTPS content
   error, the Power-Up silently does nothing, with no error message.
4. **Disable the cache** in devtools' Network tab (or do a hard refresh,
   Ctrl/Cmd+Shift+R), since an old, cached version of connector.js/
   client.js can also cause this symptom.
5. If none of that moves the needle: remove the Power-Up from the board
   and add it again (Power-Ups menu → the three dots next to the
   Power-Up's name → Remove, then Add again).

## Known limitations (v1)

- Search only works among the cards on the **current board** (not
  archived ones) — you can't reference a card on a different board.
- There's **no protection against circular dependencies** (you can set A
  depends on B and B depends on A at the same time) — if that's an issue, let me
  know and we'll add it, the way the Építési Sorrend app already does.
- Each field (Depends on / Required by) has room for roughly **140 linked
  cards** per card (due to Trello's 4096-character limit per row) — in
  practice that's plenty.
- A link to a deleted or archived card stays (shown as done); remove it
  manually with the × if you don't want it as history.
- Only list names matching `DONE_LIST_NAMES` exactly count as done, so a
  column called "✅ Done" needs to be added to that list.
