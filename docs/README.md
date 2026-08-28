# SmartMenu – Grundlagen

Diese Datei klärt Domäne und Datenstrukturen so weit, dass mehrere Agents parallel arbeiten
können. Den Schnitt in Workstreams beschreibt [arbeitsteilung.md](arbeitsteilung.md).

Sie ist die **Produktreferenz**. Wo sie von
[Issue #1](https://github.com/iloomilo/smartmenu/issues/1) abweicht, gilt diese Datei; die
technischen Entscheidungen aus dem Issue sind übernommen und unten als solche markiert.

## Was die App macht

1. Der Gast öffnet die App. Per Geolocation wird das Restaurant vorgeschlagen, in dem er sitzt.
2. **Liegt die Karte schon vor, wird sie sofort angezeigt.** Kein Scan, kein Warten.
   Das ist der Normalfall.
3. Nur wenn keine Karte existiert oder sie veraltet ist, scannt er: Kamera auf die Karte,
   langsam schwenken, umblättern. Währenddessen füllt sich eine zweisprachige Liste live.
4. Der Gast tippt Gerichte an, prüft Mengen und bekommt einen QR-Code.
5. Der Kellner scannt ihn und liest die Bestellung im **Originaltext der Karte**, den er kennt.

Der Scan ist Einmalaufwand für ein ganzes Restaurant, nicht Aufwand pro Gast. Das gesamte
Datenmodell zielt darauf, dass er sich für alle folgenden Gäste amortisiert.

## Rollen

| Rolle | Auth | Kann |
|---|---|---|
| **Gast** | anonym (Device-Token) | scannen, Karte lesen, auswählen, QR erzeugen |
| **Kellner** | keiner – der Payload in der gescannten URL ist alles | Bestellung im Originaltext lesen |

Das Restaurant hat **kein Konto**. Niemand auf Restaurantseite registriert sich, pflegt Preise
oder gibt eine Karte frei. Die Daten kommen ausschließlich aus Gast-Scans.

Das trägt nur unter einer Bedingung: Der Kellner sieht immer den **Originaltext**, nie eine
Rückübersetzung. Er arbeitet dort, kennt die Karte und erkennt eine falsche Position sofort.
Die echte Karte in seiner Hand ist die Autorität, nicht unsere Datenbank.

## Entitäten

```
Restaurant ──< Menu (versioniert, aus Scans) ──< MenuItem
     │              │
     │              └──< Translation (pro Feld, pro Locale)
     │
     └──< ScanSession   (Telemetrie eines Scans – niemals Bilder)
```

Eine Bestellung ist keine Entität. Sie lebt im QR-Code.

### Restaurant
Reiner Identitätsdatensatz, kein Konto, kein Besitzer.
`id`, `googlePlaceId` (unique, nullable), `name`, `lat`, `lng`, `sourceLocale`, `currency`,
`timezone`, `currentMenuId?`.

Die **Google Place ID ist der Anker**, an dem der Karten-Cache hängt: stabil, weltweit
eindeutig, unabhängig von der Schreibweise. Lokale ohne Place ID (Straßenstand, zu neu)
bekommen einen Datensatz mit Koordinaten; das Matching läuft dann über Distanz.

Ein Menu **darf auch ohne Restaurant existieren** – dann ist es ein Einmal-Scan ohne
Cache-Nutzen. Das hält den Scan-Flow lauffähig, wenn Places nichts liefert oder der Gast
die Ortsfreigabe verweigert.

### Menu
Eine Version einer Karte.
`id`, `restaurantId?`, `kind` (`food` | `drinks` | `lunch` | `seasonal`), `state`
(`scanning` | `sealed`), `sourceLocale`, `currency`, `createdAt`, `sealedAt?`,
`lastConfirmedAt`, `confirmCount`, `supersededById?`.

**Lebenszyklus – der Punkt, an dem Live-Scan und Unveränderlichkeit zusammenkommen:**

```
scanning ──────────────► sealed ──────────────► superseded
(Upserts pro Tick,       (unveränderlich,        (durch neuere Version
 nur der Scanner sieht    für alle sichtbar,      abgelöst, alte QR-Codes
 es)                      currentMenuId zeigt     bleiben gültig)
                          hierauf)
```

Während des Scans mutiert das Menu bei jedem Tick. Mit „Fertig" wird es versiegelt und danach
nie wieder geändert. Nur versiegelte Menüs werden gecacht und ausgespielt. Ein späterer
Neu-Scan erzeugt ein neues Menu, statt das alte anzufassen.

Ein Restaurant hat oft mehrere Karten parallel (Speise-, Getränke-, Mittagskarte), deshalb
`kind`, und `currentMenuId` ist ein Zeiger **pro `kind`**.

Es gibt kein `draft`/`published`, weil niemand freigibt. Stattdessen ein Vertrauensmodell:
eine mehrfach unabhängig gleich gescannte Karte ist verlässlicher als ein Einzelscan.

### MenuItem
`id`, `menuId`, `position`, `sourceName`, `sourceDescription?`, `sourceSection?`,
`price` (`numeric(12,3)`, nullable), `priceLabel?`, `page?`, `firstSeenAt`, `lastSeenAt`.

- **`sourceName` ist das, was wörtlich auf der Karte steht**, und wird nie überschrieben.
  Alles Übersetzte hängt daran.
- **Section ist ein Feld, keine Tabelle** (aus dem Issue). Gruppiert wird beim Ausspielen.
- **Preis ist nullable.** „Tagespreis", „MP", „ab 12" landen unverändert in `priceLabel`,
  `price` bleibt leer. Wir erfinden keine Zahl.
- **Upsert-Schlüssel:** `(menuId, sourceName, sourceSection)`. Ein späterer, klarerer Blick
  auf dieselbe Zeile ergänzt Preis oder Beschreibung, statt eine zweite Zeile anzulegen.
- `position` ist erst nach dem Versiegeln stabil und wird dort einmal vergeben – der QR-Code
  referenziert darüber.

Nicht in v1: Varianten und Extras (Größen, Beilagen) sowie Allergene und Ernährungsformen.
Aus einer Karte abgeleitete Allergenangaben wären eine medizinische Aussage, die wir nicht
belegen können.

### Translation
`entityType`, `entityId`, `field`, `locale`, `text`, `source` (`model` | `original`), `confidence`.
Ein Datensatz pro Feld und Sprache, Auflösung mit Fallback `gastLocale → en → sourceLocale`.

**Hier weichen wir bewusst vom Issue ab.** Das Issue legt Übersetzungen als zweites Feldpaar
direkt ans Item, mit genau einer Zielsprache pro Menu. Das funktioniert, solange ein Menu einem
Gast gehört. Sobald dieselbe Karte gecacht und von einem deutschen, einem türkischen und einem
japanischen Gast gelesen wird, braucht es mehrere Sprachen nebeneinander – sonst überschreibt
jeder Sprachwechsel die Arbeit des vorigen Gasts und das Modell läuft erneut.

Gefüllt wird sie zweistufig: Der Extraktions-Tick liefert Original **und** Übersetzung in die
Zielsprache des Scanners in einem Aufruf. Jede weitere Sprache wird beim ersten Abruf
nachübersetzt, ohne neue Frames, und ist danach für alle da.

### ScanSession
`id`, `menuId`, `deviceToken`, `startedAt`, `endedAt?`, `tickCount`, `failureCount`, `model`.

Telemetrie und Missbrauchsschutz. **Kamerabilder werden niemals gespeichert** – weder auf
Platte noch in Postgres. Jedes Frame wird nach der Modellantwort verworfen, auch im Fehlerfall.
Wir wollen keine Fotos fremder Tische besitzen.

### Bestellung – bewusst nicht in der DB
Es gibt keine `orders`-Tabelle. Die Bestellung steckt vollständig im QR-Code, als Referenzen
statt Text:

```
/s/<payload>

payload (binär, base64url):
  v        1 Byte    Payload-Version
  menuId   16 Byte   die versiegelte Menü-Version
  locale   1 Byte    Gast-Locale (Index)
  items[]  je ~3 Byte  position, qty
```

Bei 12 Positionen rund 60 Byte, also QR-Version 4–5 – auf jedem Handy-Display zuverlässig
scanbar. Die Kellner-Seite löst `menuId` + Positionen gegen die Menü-Tabelle auf.

Warum keine Tabelle: Versiegelte Menüs sind unveränderlich, also friert die `menuId` Preis und
Text bereits ein – Snapshot-Spalten wären dieselbe Information doppelt. Netz braucht der
Kellner ohnehin, um die Karte zu laden.

Preis dafür: kein Rückkanal (der Kellner kann nicht bestätigen), kein Freitext, kein Widerruf.
Für v1 tragbar, siehe E10.

Die **Auswahl während des Scans** hängt an `menuItem.id`, nicht an der Position – ein Upsert,
der eine Zeile verfeinert, darf keinen Tap verlieren. Sie liegt clientseitig (`localStorage`)
und wird erst beim Versiegeln auf Positionen abgebildet. Damit übersteht sie einen Tab-Tod,
ohne dass wir Auswahl serverseitig speichern.

## Restaurant finden

```
Gast öffnet App
  │
  ├─ Geolocation ──► Places Nearby (Typ: restaurant/cafe/bar, Radius ~150 m)
  │                    └─► Liste nach Distanz – Gast tippt eines an, nie automatisch
  │
  └─ kein GPS / nichts gefunden ──► Textsuche oder „Karte scannen" ohne Restaurant
```

Automatisch das nächste Lokal zu wählen, scheitert in genau den häufigen Fällen: GPS ist in
Innenräumen auf 20–50 m ungenau, in einer Einkaufsstraße oder einem Food Court liegen fünf
Lokale in diesem Radius. Geolocation ist ein **Vorschlag**, kein Ergebnis.

| Zustand | Was der Gast sieht |
|---|---|
| `currentMenuId` vorhanden, frisch | Karte sofort, kein Scan |
| vorhanden, aber alt oder unbestätigt | Karte sofort, mit Datumshinweis und „Karte aktualisieren" |
| keine Karte | direkt der Scan-Flow |

## Scannen

Live und nicht als Batch: Die Kamera läuft, der Client wählt Frames aus und schickt sie
einzeln an den Server, der Extrakt füllt sich sichtbar. Der Gast bekommt Rückmeldung, während
er die Karte noch in der Hand hat.

**Ein Tick:** ein JPEG + die aktuelle Item-Liste → Server → Modell → **Patches** (neue oder
korrigierte Zeilen), nie eine komplette Neuschreibung. Der Server upsertet auf
`(menuId, sourceName, sourceSection)`.

Regeln, die aus dem Issue kommen und dort gut begründet sind:

- **Kein Voll-Replace und kein Freeze-on-first-sight.** Eine früh halb gelesene Zeile darf
  später ergänzt werden, ohne dass die Liste flackert oder ein Tap verlorengeht.
- **Seitenwechsel erkennt das Modell selbst** und darf `page` setzen. Es gibt keine UI zum
  Trennen, Zusammenführen oder Zurücknehmen von Seiten – der Scan bleibt eine Bewegung.
- **Der Loop pausiert**, wenn die App in den Hintergrund geht, und hat eine harte Zeitgrenze
  mit „Fortsetzen". Ein vergessener Scan darf nicht in der Hosentasche weiterlaufen.
- **Fehler löschen nie die Liste.** Nach mehreren aufeinanderfolgenden Modell- oder
  Netzfehlern wird pausiert und „Erneut versuchen" angeboten; gefundene Gerichte bleiben.
- **Leeres Ergebnis ist ein leerer Zustand**, keine erfundene Karte.
- Nach „Fertig" bleibt die Kamera aus.

Eine einseitige Karte ist ein einseitiges Booklet – derselbe Weg, kein zweiter Codepfad für
Fotos.

**Frame-Rate:** Das Issue nennt 2–5 fps. Das sind bei einem Minute-Scan bis zu 300
Modellaufrufe. Weil ein Scan hier einem ganzen Restaurant zugutekommt, ist das vertretbar,
aber der Client sollte trotzdem vorselektieren: unscharfe und zum Vorgänger nahezu identische
Frames gar nicht erst senden. Ziel sind 1–2 tatsächlich gesendete Frames pro Sekunde (E13).

## Wann wird neu gescannt

Nie automatisch, nie im Hintergrund. Ausgelöst wird es, wenn der Gast „Karte aktualisieren"
tippt – er hat als Einziger die echte Karte vor sich. Angeboten wird das, wenn die Version
älter als die Schwelle ist (Vorschlag 90 Tage, E11), wenn sie noch nie bestätigt wurde, und
sonst als unauffälliger Einstieg.

- **Ergebnis praktisch identisch** → keine neue Version, nur `lastConfirmedAt` und
  `confirmCount` hochzählen. Häufiger Fall, darf die Tabelle nicht aufblähen.
- **Abweichend** → neues Menu, altes bekommt `supersededById`, `currentMenuId` zeigt auf das neue.

Bereits erzeugte QR-Codes zeigen auf die alte `menuId` und bleiben korrekt.

## Modellzugriff

Der Server spricht eine **OpenAI-kompatible Chat-Completions-API**, konfiguriert über
`MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_NAME`. Kein anbieterspezifisches SDK. Der Schlüssel
liegt ausschließlich serverseitig; der Browser ruft nie einen Modellanbieter direkt auf.

Das ist die Entscheidung aus dem Issue, und sie ist auch dann richtig, wenn Gemini das Modell
der Wahl ist: Gemini bietet unter `https://generativelanguage.googleapis.com/v1beta/openai/`
selbst einen OpenAI-kompatiblen Endpunkt mit Bild-Input, `response_format` per JSON-Schema und
Streaming. Die generische Schnittstelle kostet uns also nichts und bringt drei Dinge:
Anbieterwechsel per Env, ein Fake-Modell im Test, und keine Abhängigkeit von einem SDK-Release.
Gemini-Spezifika wie Thinking-Budget oder explizites Context-Caching brauchen `extra_body` –
unser Tick nutzt keins davon.

Antworten werden per JSON-Schema erzwungen und serverseitig validiert, bevor sie in die DB
gehen. Ein Tick, dessen Antwort nicht validiert, zählt als Fehlschlag und ändert nichts.

## Was das kostet

Kostenlos ist es nur in der Entwicklung. Die Zahlen, damit die Entscheidung auf Fakten steht:

**Modell.** Gemini 2.5 Flash-Lite kostet $0.10 pro 1M Input- und $0.40 pro 1M Output-Tokens.
Ein Tick sind grob 1.500–2.000 Input-Tokens (Frame plus aktuelle Item-Liste) und ~150 Output-Tokens.
Bei rund 120 gesendeten Frames für eine Karte landet ein **kompletter Scan bei etwa 2–3 Cent**.
Nachübersetzung in eine weitere Sprache kostet einen Bruchteil davon.

Genau hier zahlt sich der Cache aus: Diese 2–3 Cent fallen **einmal pro Restaurant** an, nicht
pro Gast. 1.000 erfasste Lokale kosten damit ungefähr 25 Dollar, dauerhaft. Im Modell aus
Issue #1, wo jeder Besuch neu scannt, skaliert derselbe Betrag mit der Zahl der Gäste.

**Der Free Tier** der Gemini API ist echt kostenlos, hat aber eine Bedingung, die für uns nicht
funktioniert: Inhalte werden zur Produktverbesserung verwendet. Fotos fremder Speisekarten und
Tische dorthin zu schicken, ist in Produktion nicht vertretbar. Für lokale Entwicklung und
Tests ist er richtig.

**Google Places ist vermutlich der größere Posten**, nicht das Modell: Ein Nearby-Search-Aufruf
liegt in der Größenordnung von Cents und fällt bei **jedem App-Start** an, nicht nur beim
Scannen. Drei Gegenmittel:

- Nearby-Ergebnisse serverseitig pro Geohash-Zelle cachen, statt jeden Start durchzureichen.
- Place IDs dürfen laut Googles Bedingungen dauerhaft gespeichert werden, andere Felder nur
  begrenzt – unser Anker ist deshalb ohnehin die ID.
- Als kostenlose Alternative kommt OpenStreetMap (Overpass/Nominatim) für die Umkreissuche in
  Frage; die OSM-Objekt-ID träte dann an die Stelle der Place ID. Das ist der Weg, wenn die
  App wirklich ohne laufende Kosten auskommen soll (E14).

**Wirklich kostenlos in Produktion** geht nur mit einem selbst gehosteten Vision-Modell hinter
derselben OpenAI-kompatiblen Schnittstelle (Ollama, vLLM, llama.cpp). Dann fallen keine
Token-Kosten an, dafür Serverkosten und eine schlechtere Extraktionsqualität. Weil der
Zugriff über `MODEL_BASE_URL` konfiguriert ist, kostet dieser Wechsel keine Codeänderung –
das ist ein weiteres Argument für die generische API.

## Prinzipien, die das Modell tragen

1. **Der Originaltext ist die Autorität.** Er wird durch Extraktion, Übersetzung und
   Bestellung unverändert mitgeführt. Der Kellner sieht ihn, der Gast die Übersetzung daneben.
2. **Der Cache hängt an der Place ID.** Ein Scan zahlt auf alle folgenden Gäste desselben
   Lokals ein. Latenz und Modellkosten fallen einmal pro Karte an, nicht einmal pro Gast.
3. **Versiegelte Menüs sind unveränderlich.** Korrektur oder neuer Preis erzeugen eine neue
   Version; QR-Codes bleiben dadurch gültig.
4. **Der QR-Code trägt Referenzen, keinen Text.** Er bleibt klein und korrekt, auch wenn
   längst eine neuere Karte existiert.
5. **Wir erfinden nichts.** Kein Preis ohne gedruckte Zahl, keine Karte aus einem leeren
   Extrakt, keine Allergenangabe aus dem Bauch.
6. **Bilder gehören uns nicht.** Frames werden nach dem Modellaufruf verworfen.

## Konventionen

- **Sprache:** Code, Kommentare und Docs auf Deutsch; Bezeichner auf Englisch.
- **IDs:** `uuid` v7 für alles extern Referenzierte. Keine fortlaufenden Zahlen in URLs oder QR.
- **Geld:** `numeric(12,3)`, nullable, plus `currency` (ISO 4217) am Menu – eine Währung pro
  Karte. **Kein `float`** (Summierung des Tickets) und **keine Cents-Ganzzahl** (das Issue
  argumentiert zu Recht, dass Cents bei fremden Währungen und „ab"-Preisen die falsche
  Quelle der Wahrheit sind). `numeric` erfüllt beides. Das Ticket summiert nur Zeilen mit
  gesetztem `price`.
- **Zeit:** `timestamptz` in UTC, Anzeige über die Restaurant-Timezone.
- **Locales:** BCP-47, normalisiert kleingeschrieben (`de`, `en`, `tr`, `pt-br`).
- **Enums:** als Postgres-Enum, nicht als freier Text.
- **Schemaänderungen:** über `pnpm db:generate` + Migration, nie manuell in der DB.
- **Kein globaler Endpunkt**, der Gerichte über Menüs hinweg zurückgibt. Jede Query ist auf
  ein Menu oder ein Restaurant gescoped. Die Starter-Routen `menu-items.get/post` fallen weg.

## Tests

Ein einziger automatisierter Seam: die **Menu-HTTP-API**, mit dem Modell-Client als
Test-Double, der vorgegebene Patches liefert und auf Kommando fehlschlägt. Getestet wird
äußeres Verhalten – Menu anlegen, Ticks schicken, Upsert und Verfeinerung prüfen, Sektionen,
nullbare Preise, Währung, Sprachwechsel, QR-Payload, Fehlerserie ohne Datenverlust.

Keine Tests gegen Vue-Interna, Drizzle-Zeilenformen, Prompt-Strings oder Bildraten. Die
Genauigkeit der Seitenerkennung wird in v1 nicht gegen Videofixtures getestet.

## Nicht in v1

Konten und Login, Scan-Historie, Restaurant-Admin, POS-Anbindung. Varianten und Extras.
Allergene und Ernährungsformen. Steuern, Trinkgeld, gemischte Währungen. Layout der Papierkarte
nachbauen, Gerichtsfotos, AR-Übersetzung. Native Apps. Desktop-optimierter Scan. Öffentliche
Menü-Suche. Zahlungen.

## Offene Entscheidungen

| # | Frage | Vorschlag |
|---|---|---|
| E1 | Speicher für Frames | entfällt – Frames werden nie persistiert |
| E2 | Modellanbieter | OpenAI-kompatible API per Env; Gemini Flash als Default-Modell dahinter |
| E3 | Übersetzung | im selben Tick wie die Extraktion, weitere Sprachen on demand |
| E4 | Job-Queue | entfällt – Ticks laufen synchron, es gibt keinen Batch-Job |
| E5 | Zahlungen | nein, die Bestellung endet beim Kellner |
| E6 | Was heißt „mit Google connected"? | Places und Geolocation für die Restaurant-Identität; Gemini nur als Modell hinter der generischen API |
| E7 | Wann ist ein Scan dieselbe Karte? | Ähnlichkeit über `sourceName` und Preise; ab Schwelle bestätigen statt neu anlegen |
| E8 | Veraltete Preise | Datum der Kartenversion im Ticket zeigen, der Kellner entscheidet |
| E9 | Missbrauch | Device-Token, Geo-Nähe-Prüfung, Rate Limits, unbestätigte Karten kennzeichnen |
| E10 | Wann braucht es doch eine `orders`-Tabelle? | sobald der Kellner bestätigen soll oder Freitext-Notizen nötig werden |
| E11 | Ab wann ist eine Karte veraltet? | 90 Tage, früher bei Meldung „Preise stimmen nicht" |
| E12 | Darf ein Einzelscan die Karte für alle ersetzen? | ja, aber nur mit Geo-Nähe-Prüfung |
| E13 | Frame-Rate und Vorauswahl | Client filtert unscharfe und redundante Frames, Ziel 1–2 gesendete fps |
| E14 | Places kostenpflichtig – Alternative? | Geohash-Cache; falls die App ohne laufende Kosten auskommen muss, OSM/Overpass statt Places |
| E15 | Betriebsmodell der Modellkosten | Erst geklärt, wer zahlt: Free Tier nur in Dev, Prod entweder bezahlt oder selbst gehostet |

## Status

`server/db/schema.ts` enthält nur die Platzhalter-Tabelle `menu_items` aus dem Scaffolding,
inklusive `price_cents NOT NULL`. Sie ist mit v1 unvereinbar und wird durch das Modell oben
ersetzt. Kein paralleles Cents-Feld „für alle Fälle".
