/* global TrelloPowerUp */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // CONFIG: names of the column(s) that mean "done". Case-insensitive,
  // compared against the whole list name. A card in such a list (or an
  // archived card) no longer counts as a prerequisite / dependent: the link
  // stays as history but stops blocking anything.
  // ---------------------------------------------------------------------
  var DONE_LIST_NAMES = ["Done", "#done"];

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
  var SECTION_VERSION = 4;

  // Storage keys (kept from the first version so existing links survive):
  //   "blockedBy" = this card DEPENDS ON these cards (prerequisites)
  //   "blocks"    = this card is REQUIRED BY these cards (dependents)
  var BLOCKS_KEY = "blocks";
  var BLOCKED_BY_KEY = "blockedBy";

  var REFRESH_SECONDS = 15;   // Trello minimum is 10
  var SNAPSHOT_TTL_MS = 5000; // share one board lookup between badges

  var DONE_NAMES = DONE_LIST_NAMES.map(function (n) {
    return String(n).trim().toLowerCase();
  });

  // --- board snapshot -------------------------------------------------
  // cards: id -> { closed, done }. One lookup is shared by all card badges
  // (they all run in this one connector iframe), cached for a few seconds.
  var snapCache = null;   // { at, promise }

  function loadSnapshot(t) {
    var now = Date.now();
    if (snapCache && now - snapCache.at < SNAPSHOT_TTL_MS) return snapCache.promise;
    var promise = Promise.all([
      t.cards("id", "idList", "closed"),
      t.lists("id", "name")
    ]).then(function (res) {
      var doneLists = {};
      (res[1] || []).forEach(function (l) {
        if (DONE_NAMES.indexOf(String(l.name).trim().toLowerCase()) !== -1) {
          doneLists[l.id] = true;
        }
      });
      var cards = {};
      (res[0] || []).forEach(function (c) {
        cards[c.id] = !!c.closed || !!doneLists[c.idList];
      });
      return cards;           // id -> isDone
    }).catch(function () {
      snapCache = null;
      return null;            // unknown: treat nothing as done
    });
    snapCache = { at: now, promise: promise };
    return promise;
  }

  // A card is done if archived or in a Done list. A card missing from the
  // board entirely (deleted) is treated as done: it can't block anything.
  function isDone(snap, id) {
    if (!snap) return false;
    return snap.hasOwnProperty(id) ? snap[id] : true;
  }

  // Pure logic. dependsOn = prerequisite ids, requiredBy = dependent ids.
  //   blocked  = this card is not done and has >=1 prerequisite not done
  //   blocker  = this card is not done and >=1 dependent is not done
  // A done card is neither.
  function computeState(selfId, dependsOn, requiredBy, snap) {
    var selfDone = isDone(snap, selfId);
    var openPrereqs = dependsOn.filter(function (id) { return !isDone(snap, id); }).length;
    var openDependents = requiredBy.filter(function (id) { return !isDone(snap, id); }).length;
    return {
      total: dependsOn.length + requiredBy.length,
      blocked: selfDone ? 0 : openPrereqs,
      blocker: selfDone ? 0 : openDependents
    };
  }

  function readState(t) {
    var selfId = t.getContext().card;
    return Promise.all([
      t.get("card", "shared", BLOCKED_BY_KEY, []),
      t.get("card", "shared", BLOCKS_KEY, []),
      loadSnapshot(t)
    ]).then(function (res) {
      return computeState(selfId, res[0] || [], res[1] || [], res[2]);
    }).catch(function () {
      // Never break the card view over a transient read failure.
      return { total: 0, blocked: 0, blocker: 0 };
    });
  }

  // One combined badge per card (a dynamic function can only return a
  // single badge). Symbols are what the Tampermonkey tint script keys on:
  //   "no entry" in the text => blocked (red); "warning" => blocker (yellow).
  // Blocked wins both the badge colour and the tint when both apply.
  function frontBadge(s) {
    if (s.blocked > 0) {
      var txt = "\u26D4 " + s.blocked;
      if (s.blocker > 0) txt += "  \u26A0\uFE0F " + s.blocker;
      return { text: txt, color: "red" };
    }
    if (s.blocker > 0) return { text: "\u26A0\uFE0F " + s.blocker, color: "yellow" };
    // Has links, but none active (all done): neutral, links kept as history.
    return { text: "\uD83D\uDD17 " + s.total };
  }

  // card-badges (card front). Trello documents `dynamic` + `refresh` (min
  // 10 s) but does not say what happens if a dynamic badge returns nothing,
  // so we don't rely on that: cards without any link return no badge at
  // all, and cards with links always show one (neutral when nothing is
  // active). The dynamic refresh is what notices that a prerequisite was
  // moved to Done, which changes nothing on the dependent card itself.
  function buildFrontBadges(t) {
    return Promise.all([
      t.get("card", "shared", BLOCKED_BY_KEY, []),
      t.get("card", "shared", BLOCKS_KEY, [])
    ]).then(function (res) {
      if (!(res[0] || []).length && !(res[1] || []).length) return [];
      return [{
        dynamic: function () { return readState(t).then(frontBadge); },
        refresh: REFRESH_SECONDS
      }];
    }).catch(function () { return []; });
  }

  // card-detail-badges (top of the card back): supports `title`.
  function buildDetailBadges(t) {
    return readState(t).then(function (s) {
      var badges = [];
      if (s.blocked > 0) {
        badges.push({ text: "\u26D4 " + s.blocked, color: "red", title: "Depends on (open)" });
      }
      if (s.blocker > 0) {
        badges.push({ text: "\u26A0\uFE0F " + s.blocker, color: "yellow", title: "Required by (open)" });
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
          url: t.signUrl("./section.html?v=" + SECTION_VERSION +
            "&done=" + encodeURIComponent(JSON.stringify(DONE_LIST_NAMES))),
          height: 230
        }
      };
    }
  });

  // Exposed only so the logic can be unit-tested outside Trello.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { computeState: computeState, frontBadge: frontBadge };
  }
})();
