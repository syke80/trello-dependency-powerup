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

  // Both badges (the front-of-card indicators) share the same logic, for
  // both the card-badges and card-detail-badges capabilities.
  function buildBadges(t) {
    return Promise.all([
      t.get("card", "shared", BLOCKS_KEY, []),
      t.get("card", "shared", BLOCKED_BY_KEY, [])
    ]).then(function (res) {
      var blocks = res[0] || [];
      var blockedBy = res[1] || [];
      var badges = [];

      if (blockedBy.length > 0) {
        badges.push({
          text: "🔒 " + blockedBy.length,
          color: "orange",
          title: "This many cards block this card"
        });
      }
      if (blocks.length > 0) {
        badges.push({
          text: "⛔ " + blocks.length,
          color: "blue",
          title: "This card blocks this many others"
        });
      }
      return badges;
    }).catch(function () {
      // If reading pluginData fails (transiently), don't break the card
      // view — just show no badge.
      return [];
    });
  }

  TrelloPowerUp.initialize({
    "card-badges": function (t) {
      return buildBadges(t);
    },
    "card-detail-badges": function (t) {
      return buildBadges(t);
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
