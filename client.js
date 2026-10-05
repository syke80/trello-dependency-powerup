/* global TrelloPowerUp */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // IMPORTANT: once you publish this repo to GitHub Pages, change this URL
  // to your actual GitHub Pages address (e.g.
  // "https://attila.github.io/trello-dependency-powerup/icon.svg").
  // This icon shows up next to the "Dependencies" section on the back of
  // the card.
  // ---------------------------------------------------------------------
  var SECTION_ICON = "https://syke80.github.io/trello-dependency-powerup/icon.svg";

  // Cache-busting version for the card-back-section iframe URL. Browsers
  // partition the HTTP cache by (top-level site, resource origin) — this
  // is true in Chrome, Firefox, and Safari — so the copy of section.html
  // loaded as an iframe under trello.com gets a COMPLETELY SEPARATE cache
  // entry from what you get by opening the URL directly. That's why it
  // can look like "Trello is caching an old version even though GitHub
  // Pages is already up to date". Because of this, an ordinary page
  // refresh in Trello is NOT guaranteed to reload this iframe.
  //
  // EVERY TIME you change section.html or section.js and publish the
  // change to GitHub Pages, bump this number by one. Since that changes
  // the requested URL itself, the browser is guaranteed to treat it as a
  // brand new resource, regardless of whether the old version is still
  // cached.
  var SECTION_VERSION = 3;

  var BLOCKS_KEY = "blocks";
  var BLOCKED_BY_KEY = "blockedBy";

  function readCounts(t) {
    return Promise.all([
      t.get("card", "shared", BLOCKS_KEY, []),
      t.get("card", "shared", BLOCKED_BY_KEY, [])
    ]).then(function (res) {
      return { blocks: (res[0] || []).length, blockedBy: (res[1] || []).length };
    }).catch(function () {
      // If reading pluginData fails (transiently), don't break the card
      // view — just show no badge.
      return { blocks: 0, blockedBy: 0 };
    });
  }

  // card-badges (front of the card): the documented badge fields are
  // dynamic/text/icon/color/monochrome/refresh — NOT title, so no tooltip
  // text here. Icons are plain emoji inside `text`, which needs no hosted
  // image: ⛔ ("no entry") for "something is blocking this", ⚠️ ("warning")
  // for "this is itself blocking something".
  //
  // NOTE ON POSITION: Trello does not document or expose any control over
  // where a Power-Up's badges sit in the badge row relative to Trello's
  // own (due date, checklist, comments, ...) — in practice they're
  // appended after Trello's built-in ones, not placed first, and there is
  // no way to pin a badge into the member-avatars corner (that area is
  // entirely Trello's own rendering, outside any Power-Up capability).
  function buildFrontBadges(t) {
    return readCounts(t).then(function (c) {
      var badges = [];
      if (c.blockedBy > 0) {
        badges.push({ text: "⛔ " + c.blockedBy, color: "red" });
      }
      if (c.blocks > 0) {
        badges.push({ text: "⚠️ " + c.blocks, color: "yellow" });
      }
      return badges;
    });
  }

  // card-detail-badges (top of the card-back view): this capability DOES
  // support `title`, shown as a label above the badge, so we keep it here.
  function buildDetailBadges(t) {
    return readCounts(t).then(function (c) {
      var badges = [];
      if (c.blockedBy > 0) {
        badges.push({
          text: "⛔ " + c.blockedBy,
          color: "red",
          title: "Blocked by"
        });
      }
      if (c.blocks > 0) {
        badges.push({
          text: "⚠️ " + c.blocks,
          color: "yellow",
          title: "Blocking"
        });
      }
      return badges;
    });
  }

  TrelloPowerUp.initialize({
    "card-badges": function (t) {
      return buildFrontBadges(t);
    },
    "card-detail-badges": function (t) {
      return buildDetailBadges(t);
    },
    "card-back-section": function (t) {
      return {
        title: "Dependencies",
        icon: SECTION_ICON,
        content: {
          type: "iframe",
          url: t.signUrl("./section.html?v=" + SECTION_VERSION),
          height: 230
        }
      };
    }
  });
})();
