# Dependency Links — privát Trello Power-Up

Két mezőt ad minden kártya hátuljára:

- **Blocking** — kártyák, amiket ez a kártya blokkol
- **Blocked by** — kártyák, amik blokkolják ezt a kártyát

Mindkettő élő kereséssel működik (gépelés közben szűri a tábla kártyáit),
és kétirányúan szinkronban tartja magát: ha A-t hozzáadod B "Blocking"
mezőjéhez, B automatikusan megjelenik A "Blocked by" mezőjében is.

A kártya előlapján emellett egy-egy apró számjelző (badge) is megjelenik,
ha a kártyát valami blokkolja (🔒) vagy ha ő blokkol valamit (⛔).

**Nincs szükség semmilyen saját szerverre/backendre.** Minden adatot a
Trello saját "plugin data" tárolója őriz meg (`t.set` / `t.get`), a Trello
fiókodhoz és a board-hoz kötve. Egyetlen dolog kell hozzá: a fájlokat egy
publikus HTTPS címen kell tárolni, hogy a Trello be tudja ágyazni őket
(ez nem "backend", csak statikus fájl-hosting).

## 1. lépés — a fájlok publikálása GitHub Pages-re

1. Hozz létre egy új **publikus** GitHub repót (pl. `trello-dependency-powerup`).
2. Töltsd fel bele ennek a csomagnak mind a 6 fájlját **a repó gyökerébe**
   (ne almappába): `index.html`, `connector.html`, `client.js`,
   `section.html`, `section.js`, `icon.svg`.
3. A repóban: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**, branch: `main`, mappa: `/ (root)` → Save.
4. Pár perc múlva él az oldal itt:
   `https://<FELHASZNÁLÓNEVED>.github.io/<REPO-NÉV>/`
5. Nyisd meg a `client.js` fájlt a repóban, és a tetején cseréld ki ezt a
   sort a saját tényleges URL-edre:

   ```js
   var SECTION_ICON = "https://YOUR-USERNAME.github.io/YOUR-REPO/icon.svg";
   ```

   Mentsd el (commit) — a GitHub Pages automatikusan újrapublikálja.

## 2. lépés — Power-Up regisztrálása a Trello-ban

1. Menj a **[trello.com/power-ups/admin](https://trello.com/power-ups/admin)**
   oldalra, és kattints **"New"**.
2. A **"For Workspace"** mezőben válaszd ki a saját Workspace-edet (ha még
   sosem hoztál létre csapatot, Trello automatikusan csinált neked egy
   alapértelmezettet — abban te vagy az admin).
3. Adj neki egy nevet (pl. "Dependency Links"), és az **"Iframe Connector
   URL"** mezőbe írd be:

   ```
   https://<FELHASZNÁLÓNEVED>.github.io/<REPO-NÉV>/connector.html
   ```

4. Mentsd el. A Power-Up ettől kezdve **privát** — nincs beküldve a nyilvános
   Power-Up katalógusba, csak a te Workspace-edhez tartozó board-okon
   érhető el.
5. A Power-Up admin oldalán az **"Appearance"** fülön tölts fel egy ikont
   (ez csak az admin felületen és a Power-Up-választó listában jelenik meg,
   nem kell hozzá hosting — közvetlenül ide töltöd fel).
6. Menj a **"Capabilities"** fülre. Itt **manuálisan be kell kapcsolnod**
   mindhárom kapcsolót (ez nem automatikus, a `client.js` tartalmától
   függetlenül külön regisztrálni kell őket):
   - `card-badges`
   - `card-detail-badges`
   - `card-back-section`

   Minden kapcsoló egy önálló be/ki toggle — nem kell hozzá külön URL-t
   megadni, csak bekapcsolni. **Ne felejtsd el lementeni ("Save") az
   űrlapot** a kapcsolók bekapcsolása után — enélkül semmi nem történik,
   függetlenül attól, hogy a connector URL válaszol-e.

## 3. lépés — bekapcsolás egy board-on

1. Nyiss meg egy board-ot, amin ki szeretnéd próbálni.
2. **Power-Ups menü → keresés → "Custom"** fül — itt megjelenik a saját
   Workspace-ed alatt regisztrált "Dependency Links" Power-Up.
3. Kattints **"Add"**.
4. Frissítsd (hard refresh) a board oldalát. Ettől kezdve minden kártyán
   megjelenik a "Függőségek" szekció a kártya hátulján, és a badge-ek az
   előlapon.

Mivel a bekapcsolás **board-szintű** beállítás, bárki, akit meghívsz a
board-ra és aki megnyitja azt (bármelyik saját gépén), automatikusan látni
fogja ugyanezt — nincs szükség arra, hogy ők is külön engedélyezzenek
bármit. (Workspace-tagság sem feltétel a board megtekintéséhez/
használatához — csak a board-hoz kell hozzáférésük legyen.)

## Hibaelhárítás — ha egy capability sem jelenik meg

1. **Nézd meg a Capabilities fület újra** — mindhárom kapcsoló tényleg
   zölden/bekapcsolva áll-e, és rányomtál-e a "Save"-re utána.
2. **Nyisd meg a böngésző konzolját a board oldalon** (F12 → Console), és
   keress egy ilyen üzenetet:
   `Power-Up ... implements capabilities that haven't been enabled [...]`
   — ha ezt látod, pontosan megmondja, melyik kapcsolót felejtetted ki a
   portálon.
3. **Nézd meg a Network fület** is: töltődik-e be hiba nélkül a
   `connector.html`, utána a `client.js`? 404 vagy vegyes HTTP/HTTPS
   tartalom (mixed content) hiba esetén a Power-Up csendben nem csinál
   semmit, hibaüzenet nélkül.
4. **Kapcsold ki a gyorsítótárat** a devtools Network fülén (vagy nyomj
   kemény frissítést, Ctrl/Cmd+Shift+R), mert a connector/client.js régi,
   cache-elt verziója is okozhat ilyen tünetet.
5. Ha ettől sem mozdul semmi: vedd le a Power-Upot a board-ról, és add
   hozzá újra (Power-Ups menü → a három pötty a Power-Up neve mellett →
   Remove, majd Add újra).

## Ismert korlátok (v1)

- A keresés csak az **aktuális board** (nem archivált) kártyái között
  működik — másik board kártyájára nem lehet hivatkozni.
- Nincs **körkörös függőség elleni védelem** (A blokkolja B-t, B blokkolja
  A-t egyszerre is beállítható) — ha ez gond, szólj, és beépítjük, ahogy az
  Építési Sorrend appban is megvan.
- Egy mezőben (Blocking / Blocked by) kártyánként kb. **140 linkelt kártyáig**
  van hely (a Trello 4096 karakteres limitje miatt soronként) — a gyakorlatban
  ez bőven elég.
- Törölt/archivált kártyára mutató link "(törölt vagy archivált kártya)"
  címkével jelenik meg, de nem tűnik el automatikusan — kézzel eltávolítható
  a ×-szel.
