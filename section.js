/* global TrelloPowerUp */
(function () {
  "use strict";

  var t = TrelloPowerUp.iframe();

  // Storage keys (unchanged from the earlier "Blocking / Blocked by"
  // wording, so existing links keep working):
  //   "blockedBy" = this card DEPENDS ON these cards (its prerequisites)
  //   "blocks"    = this card is REQUIRED BY these cards (its dependents)
  var BLOCKS_KEY = "blocks";
  var BLOCKED_BY_KEY = "blockedBy";
  var MAX_SUGGESTIONS = 8;

  var allCards = [];       // { id, name, idList, closed }
  var listNameById = {};   // idList -> list name
  var currentCardId = null;
  var doneListIds = {};    // idList -> true for lists that count as "Done"

  // The names that count as the Done column come from client.js (top of the
  // file) via the iframe URL, so there is a single place to configure them.
  var DONE_NAMES = (function () {
    try {
      var raw = new URLSearchParams(location.search).get("done");
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(function (n) { return String(n).trim().toLowerCase(); });
    } catch (e) {}
    return ["done", "#done"];
  })();

  // A card is "done" when it is archived, or sits in a Done list.
  // A card that no longer exists at all (deleted) is treated as done too:
  // it can't block anything anymore.
  function isDone(id) {
    var c = cardById(id);
    if (!c) return true;
    return !!c.closed || !!doneListIds[c.idList];
  }

  function showError(err) {
    var el = document.getElementById("error");
    el.hidden = false;
    el.textContent = "Error: " + (err && err.message ? err.message : "unknown error");
  }

  function clearError() {
    var el = document.getElementById("error");
    el.hidden = true;
    el.textContent = "";
  }

  function resize() {
    // Adjusts the iframe's height to the actual content (e.g. when a
    // suggestion list opens, or a new chip is added).
    t.sizeTo("#app").catch(function () {});
  }

  function cardById(id) {
    for (var i = 0; i < allCards.length; i++) {
      if (allCards[i].id === id) return allCards[i];
    }
    return null;
  }

  function cardLabel(c) {
    var listName = listNameById[c.idList] || "";
    return listName ? c.name + " — " + listName : c.name;
  }

  function loadBoardData() {
    return Promise.all([
      t.cards("id", "name", "idList", "closed"),
      t.lists("id", "name"),
      t.card("id")
    ]).then(function (res) {
      // Keep archived cards too: they are needed to show "done" history
      // chips. The search suggestions filter them out separately.
      allCards = res[0] || [];
      listNameById = {};
      doneListIds = {};
      (res[1] || []).forEach(function (l) {
        listNameById[l.id] = l.name;
        if (DONE_NAMES.indexOf(String(l.name).trim().toLowerCase()) !== -1) {
          doneListIds[l.id] = true;
        }
      });
      currentCardId = res[2].id;
    });
  }

  function getIds(cardId, key) {
    return t.get(cardId, "shared", key, []);
  }

  function setIds(cardId, key, ids) {
    return t.set(cardId, "shared", key, ids);
  }

  // prerequisiteId is a prerequisite of dependentId
  // (dependent "depends on" prerequisite; prerequisite is "required by" dependent)
  function addLink(blockerId, blockedId) {
    return Promise.all([
      getIds(blockerId, BLOCKS_KEY),
      getIds(blockedId, BLOCKED_BY_KEY)
    ]).then(function (res) {
      var blockerBlocks = res[0].slice();
      var blockedBlockedBy = res[1].slice();
      if (blockerBlocks.indexOf(blockedId) === -1) blockerBlocks.push(blockedId);
      if (blockedBlockedBy.indexOf(blockerId) === -1) blockedBlockedBy.push(blockerId);
      return Promise.all([
        setIds(blockerId, BLOCKS_KEY, blockerBlocks),
        setIds(blockedId, BLOCKED_BY_KEY, blockedBlockedBy)
      ]);
    });
  }

  function removeLink(blockerId, blockedId) {
    return Promise.all([
      getIds(blockerId, BLOCKS_KEY),
      getIds(blockedId, BLOCKED_BY_KEY)
    ]).then(function (res) {
      var blockerBlocks = res[0].filter(function (id) { return id !== blockedId; });
      var blockedBlockedBy = res[1].filter(function (id) { return id !== blockerId; });
      return Promise.all([
        setIds(blockerId, BLOCKS_KEY, blockerBlocks),
        setIds(blockedId, BLOCKED_BY_KEY, blockedBlockedBy)
      ]);
    });
  }

  function renderChips(containerEl, ids, onRemove) {
    containerEl.innerHTML = "";
    ids.forEach(function (id) {
      var c = cardById(id);
      var done = isDone(id);
      var label = c ? cardLabel(c) : "(deleted card)";
      if (c && c.closed) label += " (archived)";

      var chip = document.createElement("span");
      chip.className = "chip" + (done ? " done" : "");
      if (done) chip.title = "Done: no longer an active dependency (kept as history)";

      var textSpan = document.createElement("span");
      textSpan.className = "chip-label";
      textSpan.textContent = (done ? "\u2713 " : "") + label;
      chip.appendChild(textSpan);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "chip-x";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "Remove");
      removeBtn.addEventListener("click", function () { onRemove(id); });
      chip.appendChild(removeBtn);

      containerEl.appendChild(chip);
    });
  }

  // direction: "required" -> the picked card depends on this card (this card is required by it)
  //            "depends"  -> this card depends on the picked card
  function wireField(prefix, direction) {
    var input = document.getElementById(prefix + "-search");
    var chipsEl = document.getElementById(prefix + "-chips");
    var suggestionsEl = document.getElementById(prefix + "-suggestions");
    var key = direction === "required" ? BLOCKS_KEY : BLOCKED_BY_KEY;

    function refresh() {
      return getIds(currentCardId, key).then(function (ids) {
        renderChips(chipsEl, ids, function (removeId) {
          clearError();
          var p = direction === "required"
            ? removeLink(currentCardId, removeId)
            : removeLink(removeId, currentCardId);
          p.then(refresh).then(resize).catch(showError);
        });
        resize();
        return ids;
      });
    }

    function renderSuggestions(query, linkedIds) {
      var q = query.trim().toLowerCase();
      suggestionsEl.innerHTML = "";
      if (!q) { resize(); return; }

      var results = allCards.filter(function (c) {
        if (c.id === currentCardId) return false;
        if (c.closed) return false;
        if (linkedIds.indexOf(c.id) !== -1) return false;
        return c.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, MAX_SUGGESTIONS);

      results.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "suggestion";
        item.textContent = cardLabel(c);
        item.addEventListener("click", function () {
          clearError();
          var p = direction === "required"
            ? addLink(currentCardId, c.id)
            : addLink(c.id, currentCardId);
          p.then(function () {
            input.value = "";
            suggestionsEl.innerHTML = "";
            return refresh();
          }).then(resize).catch(showError);
        });
        suggestionsEl.appendChild(item);
      });
      resize();
    }

    input.addEventListener("input", function () {
      getIds(currentCardId, key).then(function (ids) {
        renderSuggestions(input.value, ids);
      });
    });
    input.addEventListener("focus", function () {
      if (input.value) {
        getIds(currentCardId, key).then(function (ids) {
          renderSuggestions(input.value, ids);
        });
      }
    });

    refresh();
  }

  document.addEventListener("click", function (e) {
    // Clicking outside the suggestion list closes any open lists.
    ["depends", "required"].forEach(function (prefix) {
      var input = document.getElementById(prefix + "-search");
      var suggestionsEl = document.getElementById(prefix + "-suggestions");
      if (e.target !== input && !suggestionsEl.contains(e.target)) {
        suggestionsEl.innerHTML = "";
      }
    });
    resize();
  });

  loadBoardData().then(function () {
    wireField("depends", "depends");
    wireField("required", "required");
    resize();
  }).catch(showError);
})();
