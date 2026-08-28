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
`id`, `placeProvider` (`osm` | `google`), `placeId`, `name`, `lat`, `lng`, `sourceLocale`,
`currency`, `timezone`, `currentMenuId?`. Unique über `(placeProvider, placeId)`.

Die **Ortsreferenz ist der Anker**, an dem der Karten-Cache hängt: stabil, eindeutig,
unabhängig von der Schreibweise. In v1 ist das die **OSM-Objekt-ID** (`node/123456`), weil
OpenStreetMap kostenlos ist. Das Feldpaar hält den Wechsel auf Google Places offen, ohne
Migration. Lokale ohne Eintrag (Straßenstand, zu neu) bekommen einen Datensatz mit
Koordinaten und `placeId = null`; das Matching läuft dann über Distanz.

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

Gefüllt wird sie zweistufig: Beim Versiegeln wird die Karte in einem Durchgang in die
Zielsprache des Scanners übersetzt. Jede weitere Sprache entsteht beim ersten Abruf, ohne neue
Frames, und ist danach für alle da. Während des Scans sieht der Gast den Originaltext – die
Zeilen erscheinen ohnehin schneller, als er sie lesen kann.

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
  ├─ Geolocation ──► eigener Geohash-Cache ──► Treffer? Liste direkt
  │                         │
  │                         └── leer ──► Overpass/OSM (amenity=restaurant|cafe|bar,
  │                                       Radius ~150 m), Ergebnis in den Cache
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

Der Tick liefert **nur Originaltext und Struktur, keine Übersetzung**. Übersetzt wird einmal
beim Versiegeln über die ganze Karte – das hält die Ausgabe pro Frame kurz und liefert mit
vollem Kartenkontext bessere Ergebnisse.

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

**Bildrate:** keine feste. Das Issue nennt 2–5 fps; mit lokaler Inferenz (1–3 s pro Frame)
würde das nur eine Warteschlange aufbauen, die nie abgearbeitet wird. Stattdessen ist immer
**höchstens ein Tick unterwegs**, und der Client wählt aus den Frames seit der letzten Antwort
den besten aus: scharf, und deutlich verschieden vom zuletzt gesendeten. Unscharfe und nahezu
identische Bilder werden verworfen, statt sie zu senden (E13).

Der Hinweistext muss dazu passen: langsam schwenken und auf jedem Abschnitt kurz verweilen.
Das ist ohnehin die Bewegung, die brauchbare Frames erzeugt.

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
`MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_NAME`. Kein anbieterspezifisches SDK. Der Browser
ruft nie ein Modell direkt auf.

**Gefahren wird lokal, nicht über eine Cloud-API.** Es sollen keine laufenden Token-Kosten
entstehen, und Kamerabilder fremder Tische sollen die eigene Maschine gar nicht erst verlassen.

| | Empfehlung |
|---|---|
| Modell | **Qwen3-VL-8B-Instruct** – führend unter den kleinen offenen VLMs bei Dokumentenlesen (96,1 DocVQA), Apache 2.0, ~6 GB in 4-Bit-Quantisierung |
| Server | **vLLM** (schneller, `structured_outputs` mit JSON-Schema) oder **Ollama** (deutlich einfacher aufzusetzen, JSON-Schema über `format`) |
| Hardware | eine GPU mit ≥8 GB VRAM. Ohne GPU ist der Live-Scan nicht benutzbar |

Beide Server sprechen dieselbe OpenAI-kompatible Schnittstelle. Für den Wechsel auf einen
gehosteten Anbieter ändern sich nur die drei Env-Variablen, kein Code. Genau dafür ist die
generische API da – auch Gemini bietet unter
`https://generativelanguage.googleapis.com/v1beta/openai/` einen kompatiblen Endpunkt.

Antworten werden per JSON-Schema erzwungen und serverseitig nochmals validiert. Ein Tick,
dessen Antwort nicht validiert, zählt als Fehlschlag und ändert nichts.

### Was lokale Inferenz am Design ändert

Ein 8B-Modell auf einer Consumer-GPU braucht für einen Frame grob **1–3 Sekunden**, nicht die
200 ms einer Cloud-API. Drei Anpassungen folgen daraus, und sie stehen so auch in den
Scan-Regeln:

1. **Keine feste Bildrate.** Es ist immer höchstens **ein Tick unterwegs**; der nächste Frame
   geht erst raus, wenn der vorige beantwortet ist. Die Rate ergibt sich aus der Hardware,
   statt eine Warteschlange zu füllen, die das Modell nie abarbeitet.
2. **Der Tick übersetzt nicht.** Er liest nur Struktur und Originaltext. Das halbiert die
   Ausgabelänge und damit die Wartezeit pro Frame.
3. **Übersetzt wird beim Versiegeln**, einmal über die ganze Karte statt häppchenweise – ein
   Aufruf, bei dem Latenz nicht mehr stört, und mit dem ganzen Kartenkontext sogar bessere
   Ergebnisse. Weitere Sprachen kommen später on demand dazu.

Der Scan dauert damit spürbar länger als mit einer Cloud-API. Das ist vertretbar, weil er
dank Cache nur den ersten Gast eines Restaurants trifft.

## Was das kostet

Ziel ist ein Betrieb ohne laufende Kosten. Das ist erreichbar, aber nur mit Hardware, die
ohnehin läuft.

**Modell: null Token-Kosten.** Lokale Inferenz kostet Strom und eine GPU, sonst nichts.
Zum Vergleich, was wir uns damit sparen: Über eine Cloud-API (Gemini 2.5 Flash-Lite, $0.10/1M
Input, $0.40/1M Output) läge ein kompletter Kartenscan bei etwa 2–3 Cent, durch den Cache
einmal pro Restaurant – rund 25 Dollar für 1.000 Lokale.

**Die Falle dabei:** Eine gemietete Cloud-GPU ist die *teuerste* Variante, nicht die
günstigste. Sie kostet rund um die Uhr, auch wenn niemand scannt, und übersteigt die
API-Kosten um ein Vielfaches. „Lokal" heißt hier eigene Maschine oder Heimserver. Soll die App
später öffentlich und ohne eigene Hardware laufen, ist eine Cloud-API die billigere Antwort –
der Wechsel kostet dank `MODEL_BASE_URL` keine Zeile Code.

**Der Free Tier** der Gemini API wäre nominell kostenlos, verwendet Inhalte aber zur
Produktverbesserung. Fotos fremder Speisekarten und Tische dorthin zu schicken, ist nicht
vertretbar. Ein weiterer Grund für lokal.

**Ortssuche ohne Google.** Places kostet pro Aufruf und würde bei *jedem App-Start* anfallen –
damit wäre es der größte Posten, obwohl das Modell nichts kostet. Stattdessen:

- **OpenStreetMap** als Quelle, über Overpass abgefragt. Kostenlos, aber mit Fair-Use-Limits.
- **Jede Antwort landet in unserer eigenen Tabelle**, indiziert über Geohash-Zellen. Der Cache
  füllt sich dadurch von selbst: Ein Ort, der einmal abgefragt wurde, braucht Overpass nie
  wieder. Das hält uns zugleich innerhalb der Fair-Use-Grenzen.
- Wird das zu knapp, wandert ein OSM-Auszug der Zielregion per PostGIS in unsere Postgres und
  die Umkreissuche wird eine SQL-Abfrage ohne jeden externen Dienst (E14).

Damit ist von „mit Google verbunden" wenig übrig: kein Sign-In, keine Places, kein Gemini.
Falls Google-Anbindung ein eigenes Ziel war und nicht nur der Weg zu Ortsdaten und einem
Vision-Modell, ist das die Stelle, an der wir das bewusst aufgeben (E6).

## Frontend-Stack

- **shadcn-vue** (`shadcn-nuxt` plus `@tailwindcss/vite`, Tailwind v4). Komponenten werden in
  `app/components/ui` kopiert statt als Abhängigkeit eingebunden – sie gehören uns und dürfen
  angepasst werden. Basis ist Reka UI, der Vue-Port von Radix, also mit Fokus-Handling und
  Tastaturbedienung ab Werk. Der **Drawer** ist das Bottom Sheet des Scan-Screens.
- **motion-v** (`motion-v/nuxt`) für Bewegung: `<motion>`-Elemente, `<AnimatePresence>` für
  Austritte, `layout` für Layout-Übergänge.

### Animationsregeln für die Live-Liste

Während des Scans schreibt das Modell alle paar Sekunden in eine Liste, in die der Gast
gleichzeitig tippt. Bewegung ist hier ein Risiko, kein Schmuck:

- **Neue Zeile: Einblenden erlaubt.** Kurz, unter 200 ms, kein Springen der Nachbarn.
- **Verfeinerte Zeile: keine Animation.** Wenn ein späterer Tick Preis oder Beschreibung
  nachträgt, wird der Text still ersetzt. Kein Aufblitzen, kein Layout-Sprung – die Zeile
  darf sich nicht unter dem Finger bewegen, der gerade darauf zielt.
- **Keine Umsortierung während des Scans.** Neue Sektionen werden in der Reihenfolge
  angehängt, in der sie entdeckt werden, nicht in die Kartenreihenfolge einsortiert. Sortiert
  und gruppiert wird erst in der Ansicht der versiegelten Karte.
- **`layout` nur außerhalb des Scan-Sheets.** Im Sheet erzeugt die Layout-Engine genau die
  Sprünge, die wir vermeiden wollen.
- **`prefers-reduced-motion` respektieren**, per Media-Query abgesichert und nicht nur auf
  Bibliotheksverhalten vertrauend.
- **Die Kellner-Ansicht animiert nichts.** Sie wird im Betrieb gelesen, in Eile, oft schräg
  auf ein Display geschaut. Große Typografie, statisch.

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
6. **Bilder gehören uns nicht.** Frames werden nach dem Modellaufruf verworfen und gehen bei
   lokaler Inferenz an keinen fremden Dienst.
7. **Kein laufender Kostenposten.** Modell lokal, Ortsdaten aus OSM mit eigenem Cache. Wo ein
   externer Dienst nötig wäre, wird zuerst nach der kostenlosen Variante gesucht.

## Konventionen

- **Sprache:** Code, Kommentare und Docs auf Deutsch; Bezeichner auf Englisch. GitHub-Issues
  auf Englisch, weil Issue #1 so begonnen wurde.
- **Frontend:** Nuxt 4, shadcn-vue auf Tailwind v4, motion-v. Keine zweite UI-Bibliothek.
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
| E1 | Speicher für Frames | entfällt – Frames werden nie persistiert und verlassen bei lokaler Inferenz die Maschine nicht |
| E2 | Modell | lokal: Qwen3-VL-8B über vLLM oder Ollama, OpenAI-kompatibel per Env |
| E3 | Übersetzung | einmal beim Versiegeln über die ganze Karte, weitere Sprachen on demand |
| E4 | Job-Queue | entfällt – Ticks laufen synchron, es gibt keinen Batch-Job |
| E5 | Zahlungen | nein, die Bestellung endet beim Kellner |
| E6 | Was heißt „mit Google connected"? | **In v1 nichts.** Ortsdaten von OSM, Modell lokal. Falls Google-Anbindung ein eigenes Ziel ist, muss das hier neu entschieden werden |
| E7 | Wann ist ein Scan dieselbe Karte? | Ähnlichkeit über `sourceName` und Preise; ab Schwelle bestätigen statt neu anlegen |
| E8 | Veraltete Preise | Datum der Kartenversion im Ticket zeigen, der Kellner entscheidet |
| E9 | Missbrauch | Device-Token, Geo-Nähe-Prüfung, Rate Limits, unbestätigte Karten kennzeichnen |
| E10 | Wann braucht es doch eine `orders`-Tabelle? | sobald der Kellner bestätigen soll oder Freitext-Notizen nötig werden |
| E11 | Ab wann ist eine Karte veraltet? | 90 Tage, früher bei Meldung „Preise stimmen nicht" |
| E12 | Darf ein Einzelscan die Karte für alle ersetzen? | ja, aber nur mit Geo-Nähe-Prüfung |
| E13 | Bildrate | keine feste Rate: ein Tick in Flight, Client wählt den besten Frame seit der letzten Antwort |
| E14 | Ortsdaten | OSM über Overpass, jede Antwort in den eigenen Geohash-Cache. Bei zu engem Fair-Use: OSM-Auszug per PostGIS lokal |
| E15 | Wo läuft die GPU? | eigene Maschine oder Heimserver. Eine gemietete Cloud-GPU wäre teurer als eine Cloud-API und damit die schlechteste Option |

## Status

`server/db/schema.ts` enthält nur die Platzhalter-Tabelle `menu_items` aus dem Scaffolding,
inklusive `price_cents NOT NULL`. Sie ist mit v1 unvereinbar und wird durch das Modell oben
ersetzt. Kein paralleles Cents-Feld „für alle Fälle".
