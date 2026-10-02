/* global TrelloPowerUp */
(function () {
  "use strict";

  var t = TrelloPowerUp.iframe();

  var BLOCKS_KEY = "blocks";
  var BLOCKED_BY_KEY = "blockedBy";
  var MAX_SUGGESTIONS = 8;

  var allCards = [];       // { id, name, idList, closed }
  var listNameById = {};   // idList -> list name
  var currentCardId = null;

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
      allCards = (res[0] || []).filter(function (c) { return !c.closed; });
      listNameById = {};
      (res[1] || []).forEach(function (l) { listNameById[l.id] = l.name; });
      currentCardId = res[2].id;
    });
  }

  function getIds(cardId, key) {
    return t.get(cardId, "shared", key, []);
  }

  function setIds(cardId, key, ids) {
    return t.set(cardId, "shared", key, ids);
  }

  // blockerId blocks blockedId
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
      var label = c ? cardLabel(c) : "(deleted or archived card)";

      var chip = document.createElement("span");
      chip.className = "chip";

      var textSpan = document.createElement("span");
      textSpan.textContent = label;
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

  // direction: "blocking"  -> this card blocks the one picked
  //            "blockedby" -> the one picked blocks this card
  function wireField(prefix, direction) {
    var input = document.getElementById(prefix + "-search");
    var chipsEl = document.getElementById(prefix + "-chips");
    var suggestionsEl = document.getElementById(prefix + "-suggestions");
    var key = direction === "blocking" ? BLOCKS_KEY : BLOCKED_BY_KEY;

    function refresh() {
      return getIds(currentCardId, key).then(function (ids) {
        renderChips(chipsEl, ids, function (removeId) {
          clearError();
          var p = direction === "blocking"
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
        if (linkedIds.indexOf(c.id) !== -1) return false;
        return c.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, MAX_SUGGESTIONS);

      results.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "suggestion";
        item.textContent = cardLabel(c);
        item.addEventListener("click", function () {
          clearError();
          var p = direction === "blocking"
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
    ["blocking", "blockedby"].forEach(function (prefix) {
      var input = document.getElementById(prefix + "-search");
      var suggestionsEl = document.getElementById(prefix + "-suggestions");
      if (e.target !== input && !suggestionsEl.contains(e.target)) {
        suggestionsEl.innerHTML = "";
      }
    });
    resize();
  });

  loadBoardData().then(function () {
    wireField("blocking", "blocking");
    wireField("blockedby", "blockedby");
    resize();
  }).catch(showError);
})();
