/* global TrelloPowerUp */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // FONTOS: miután publikáltad ezt a repót GitHub Pages-re, írd át ezt az
  // URL-t a saját, tényleges GitHub Pages címedre (pl.
  // "https://attila.github.io/trello-dependency-powerup/icon.svg").
  // Ez az ikon jelenik meg a kártya hátulján a "Függőségek" szekció mellett.
  // ---------------------------------------------------------------------
  var SECTION_ICON = "https://syke80.github.io/trello-dependency-powerup/icon.svg";

  var BLOCKS_KEY = "blocks";
  var BLOCKED_BY_KEY = "blockedBy";

  // A két badge (kártya előlapi jelző) ugyanazt a logikát használja a
  // card-badges és a card-detail-badges capability-hez is.
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
          title: "Ennyi kártya blokkolja ezt a kártyát"
        });
      }
      if (blocks.length > 0) {
        badges.push({
          text: "⛔ " + blocks.length,
          color: "blue",
          title: "Ez a kártya ennyi másikat blokkol"
        });
      }
      return badges;
    }).catch(function () {
      // Ha a pluginData olvasása (átmenetileg) hibázik, ne törjön el a
      // kártya nézete — egyszerűen ne mutassunk badge-et.
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
        title: "Függőségek",
        icon: SECTION_ICON,
        content: {
          type: "iframe",
          url: t.signUrl("./section.html"),
          height: 230
        }
      };
    }
  });
})();
