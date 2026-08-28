# SmartMenu – Grundlagen

Diese Datei klärt die Domäne und die Datenstrukturen so weit, dass mehrere Agents parallel
daran arbeiten können. Details (vollständiges Drizzle-Schema, API-Verträge, Scan-Pipeline)
kommen in eigene Dateien in diesem Ordner, sobald hier Einigkeit besteht.
Den Schnitt in parallel bearbeitbare Workstreams beschreibt [arbeitsteilung.md](arbeitsteilung.md).

## Was die App macht

1. Der Gast öffnet die App. Per Geolocation wird das Restaurant vorgeschlagen, in dem er sitzt.
2. **Liegt die Karte schon vor, wird sie sofort angezeigt.** Kein Scan, kein Warten.
   Das ist der Normalfall.
3. Nur wenn keine Karte existiert oder sie veraltet ist, scannt er – per Foto (einseitig) oder
   Video (mehrseitig). Die Karte wird per Vision-Modell in ein `MenuDoc` überführt und übersetzt.
4. Der Gast wählt Gerichte aus. Daraus entsteht eine Bestellung.
5. Die Bestellung wird als QR-Code angezeigt. Der Kellner scannt ihn und liest sie im
   **Originaltext der Karte**, die er ohnehin kennt.

Der Scan ist Einmalaufwand für ein ganzes Restaurant, nicht Aufwand pro Gast. Alles am
Datenmodell zielt darauf, dass er sich für alle folgenden Gäste amortisiert.

## Rollen

| Rolle | Auth | Kann |
|---|---|---|
| **Gast** | anonym (Device-Token), Google Sign-In optional | scannen, Karte lesen, korrigieren, auswählen, QR erzeugen |
| **Kellner** | kein Konto, kein Login – nur der Token in der gescannten URL | Bestellung im Originaltext der Karte lesen |

Das Restaurant hat **keinen Account**. Niemand auf Restaurantseite registriert sich, pflegt Preise
oder gibt eine Karte frei. Die Daten kommen ausschließlich aus Gast-Scans.

Das ist die zentrale Designentscheidung, und sie trägt nur unter einer Bedingung: Der Kellner
bekommt immer den **Originaltext der Karte** angezeigt, nie eine Rückübersetzung. Er arbeitet
dort, kennt die Karte, und erkennt eine falsche Position sofort. Deshalb braucht er keine
verifizierten Stammdaten – die echte Karte in seiner Hand ist die Autorität.

## Entitäten

```
Restaurant ──< Menu (versioniert, aus Scans) ──< MenuSection ──< MenuItem ──< OptionGroup ──< Option
     │                 │
     │                 └──< Translation (pro Locale, pro Feld)
     │
     ├──< ScanJob ──< ScanAsset        (Rohmedien)
     │        └──── ExtractionResult    (roher Modell-Output, unveränderlich)
     │

Eine Bestellung ist keine Entität. Sie lebt im QR-Code (siehe unten).
```

### Restaurant
Ein reiner Identitätsdatensatz, kein Konto und kein Besitzer.
`id`, `googlePlaceId` (unique), `name`, `lat`, `lng`, `sourceLocale` (Sprache der Karte),
`currency`, `timezone`, `currentMenuId?`.

Die **Google Place ID ist der Anker**, an dem der gesamte Karten-Cache hängt. Sie ist stabil,
weltweit eindeutig und unabhängig davon, wie der Gast das Lokal schreibt. Ein Restaurant ohne
Place ID (Straßenstand, zu neu für Places) bekommt einen manuell angelegten Datensatz mit
Koordinaten – dann greift Matching über Distanz statt über die ID.

### Menu
Eine Version einer Karte, erzeugt durch einen Scan. `id`, `restaurantId`, `kind`
(`food` | `drinks` | `lunch` | `seasonal`), `sourceLocale`, `createdFromScanId`, `createdAt`,
`lastConfirmedAt`, `confirmCount`, `confidence`, `supersededById?`.

Ein Restaurant hat oft mehrere Karten nebeneinander – Speisekarte, Getränkekarte, Mittagskarte.
Deshalb `kind`, und `restaurant.currentMenuId` wird zu einem Zeiger pro `kind`.

Es gibt kein `draft`/`published`, weil es niemanden gibt, der freigibt. Stattdessen ein
Vertrauensmodell: Eine Karte, die mehrfach unabhängig gleich gescannt wurde, ist verlässlicher
als ein Einzelscan.

### MenuSection
`id`, `menuId`, `position`, `sourceText`. Reine Gliederung („Vorspeisen", „Getränke").

### MenuItem
`id`, `sectionId`, `position`, `sourceText`, `sourceDescription?`, `priceCents`, `currency`,
`allergens[]`, `diet[]`, `confidence`, `imageAssetId?`.

`sourceText` ist das, was wörtlich auf der Karte steht, und wird nie überschrieben. Alles
Übersetzte hängt daran.

### OptionGroup / Option
Größen, Beilagen, Zubereitung. Gruppe: `minSelect`, `maxSelect`, `required`.
Option: `sourceText`, `priceDeltaCents`.

### Translation
`entityType`, `entityId`, `field`, `locale`, `text`, `source` (`model` | `guest` | `original`),
`confidence`. Ein Datensatz pro Feld und Sprache. Auflösung mit Fallback-Kette
`gastLocale → en → sourceLocale`.

### ScanJob / ScanAsset / ExtractionResult
`ScanJob`: `restaurantId`, `kind` (`image` | `video`), `status`, `error?`, Kosten/Modell.
`ScanAsset`: eine Datei oder ein Video-Frame, mit `pageIndex` bzw. `frameTs` und Content-Hash
zum Dedupen. `ExtractionResult`: der rohe Modell-Output, nie überschrieben – Korrekturen landen
im `Menu`, nicht hier.

### Bestellung – bewusst nicht in der DB
Es gibt keine `orders`-Tabelle. Die Bestellung steckt vollständig im QR-Code, und zwar als
Referenzen, nicht als Text:

```
/s/<payload>

payload (binär, base64url):
  v         1 Byte    Payload-Version
  menuId    16 Byte   die konkrete, unveränderliche Menü-Version
  locale    1 Byte    Gast-Locale (Index in Locale-Tabelle)
  items[]   je ~3 Byte  itemIndex, qty, Options-Bitmaske, optional noteCode
```

Bei 12 Positionen sind das rund 60 Bytes, also ein QR der Version 4–5 – auf jedem Handy-Display
zuverlässig scanbar. Die Kellner-Seite löst `menuId` + Indizes gegen die Menü-Tabelle auf und
rendert den Originaltext.

Warum keine Tabelle:

- **Der Preis-Snapshot ist schon da.** Menüs sind unveränderlich versioniert, also friert die
  `menuId` Preis und Text bereits ein. Snapshot-Spalten wären dieselbe Information doppelt.
- **Netz braucht der Kellner ohnehin**, um das Menü zu laden. Eine Order-Zeile würde daran nichts ändern.
- **Kein Schreibpfad, keine Retention, keine Löschpflichten** für Daten, die niemand später liest.

Preis dafür:

- **Kein Rückkanal.** Der Kellner kann nicht bestätigen, der Gast sieht keinen Status. Für v1
  (E5: die Bestellung endet beim Kellner) in Ordnung, später eine echte Erweiterung.
- **Kein Freitext.** Eine Notiz wie „ohne Zwiebeln" steht in keiner Karte, müsste als Volltext in
  den Payload und wäre zum Scan-Zeitpunkt unübersetzt. In v1 deshalb eine feste Liste
  vordefinierter Notizen (`noteCode`), die wie Kartentexte übersetzt wird.
- **Kein Ablauf und kein Widerruf.** Ein einmal erzeugter QR bleibt gültig. Ohne Zahlung ist
  das folgenlos.

Für Auswertungen genügt ein anonymes Event-Log (`menuId`, `itemIndex`, Zeitstempel) ohne
Bezug zu einem Gast – das ist keine Order-Entität.

## Restaurant finden

```
Gast öffnet App
  │
  ├─ Geolocation ──► Places Nearby (Typ: restaurant/cafe/bar, Radius ~150 m)
  │                    │
  │                    └─► Liste der nächsten Lokale, sortiert nach Distanz
  │                          Gast tippt eines an – nie automatisch auswählen
  │
  └─ kein GPS / nichts gefunden ──► Textsuche oder „Karte scannen" direkt
```

Automatisch das nächste Lokal zu wählen, geht in genau den Situationen schief, die im Alltag
häufig sind: GPS ist in Innenräumen auf 20–50 m ungenau, in einer Einkaufsstraße oder einem
Food Court liegen fünf Lokale in diesem Radius. Deshalb ist die Geolocation ein **Vorschlag**,
kein Ergebnis. Der Gast bestätigt mit einem Tipp.

Ist das Restaurant gewählt, gilt:

| Zustand | Was der Gast sieht |
|---|---|
| `currentMenuId` vorhanden, frisch | Karte sofort, kein Scan |
| vorhanden, aber alt oder wenig bestätigt | Karte sofort, mit Datumshinweis und Button „Karte aktualisieren" |
| keine Karte | direkt der Scan-Flow |

## Wann wird neu gescannt

Nie automatisch und nie im Hintergrund. Ein Neu-Scan wird ausgelöst, wenn der Gast auf
„Karte aktualisieren" tippt – weil er als Einziger die echte Karte vor sich hat und den
Unterschied überhaupt sehen kann. Angeboten wird das:

- wenn die aktuelle Version älter als eine Schwelle ist (Vorschlag: 90 Tage, E11),
- wenn sie nur einen einzigen Scan hat und noch nie bestätigt wurde,
- immer als unauffälliger Einstieg, auch bei frischer Karte.

Was der Neu-Scan bewirkt, hängt vom Ergebnis ab:

- **Praktisch identisch** zur aktuellen Version → keine neue Version. Nur `lastConfirmedAt`
  und `confirmCount` hochzählen. Das ist der häufige Fall und darf die Tabelle nicht aufblähen.
- **Abweichend** → neue `menu`-Version, alte bekommt `supersededById`, `currentMenuId` zeigt
  auf die neue.

Bereits erzeugte QR-Codes zeigen weiterhin auf die alte `menuId` und bleiben korrekt. Das ist
der Grund, warum Menüs unveränderlich sind und der QR eine Version referenziert statt „die
aktuelle Karte".

## Prinzipien, die das Modell tragen

1. **Der Originaltext ist die Autorität.** Er wird bei Extraktion, Übersetzung und Bestellung
   unverändert mitgeführt. Der Kellner sieht ihn, der Gast sieht die Übersetzung daneben.
2. **Menus sind unveränderlich.** Eine Korrektur oder ein neuer Preis erzeugt eine neue Version.
   QR-Codes zeigen auf eine konkrete Version und bleiben deshalb gültig, wenn nachgescannt wird.
3. **Der Cache hängt an der Place ID.** Ein Scan zahlt auf alle folgenden Gäste desselben
   Lokals ein. Latenz und Modellkosten fallen einmal pro Karte an, nicht einmal pro Gast.
4. **Der QR-Code trägt Referenzen, keinen Text.** Er zeigt auf eine unveränderliche
   Menü-Version; die Texte kommen beim Scannen aus der DB. Deshalb bleibt er klein und
   bleibt korrekt, auch wenn längst eine neuere Karte existiert.
5. **Korrigiert wird beim Scan, nicht danach.** Der Gast hat die Karte vor sich – er ist der
   Einzige, der eine falsche Extraktion überhaupt bemerken kann. Deshalb gehört ein
   Korrektur-Schritt direkt in den Scan-Flow.

## Konventionen

- **Sprache:** Code, Kommentare und Docs auf Deutsch; Bezeichner auf Englisch.
- **IDs:** `uuid` v7 für alles, was extern referenziert wird. Keine fortlaufenden Zahlen in URLs oder QR-Codes.
- **Geld:** `integer` in kleinster Währungseinheit plus `currency` (ISO 4217). Nie `float`.
- **Zeit:** `timestamptz` in UTC, Anzeige über die Restaurant-Timezone.
- **Locales:** BCP-47, normalisiert kleingeschrieben (`de`, `en`, `tr`, `pt-br`).
- **Enums:** als Postgres-Enum, nicht als freier Text.
- **Schemaänderungen:** über `pnpm db:generate` + Migration, nie manuell in der DB.

## Offene Entscheidungen

| # | Frage | Vorschlag |
|---|---|---|
| E1 | Object Storage | GCS, weil Google ohnehin im Stack ist |
| E2 | Vision-Modell für die Extraktion | Gemini Flash pro Seite, Eskalation bei niedriger Confidence |
| E3 | Übersetzung: LLM oder Cloud Translation | LLM mit Glossar – Gerichtnamen brauchen kulinarischen Kontext |
| E4 | Job-Queue | Nitro Task + Queue-Tabelle in Postgres, kein externer Broker vor v1 |
| E5 | Zahlungen in der App? | Nein in v1, die Bestellung endet beim Kellner |
| E10 | Ab wann braucht es doch eine `orders`-Tabelle? | Sobald der Kellner bestätigen soll oder Freitext-Notizen nötig werden |
| E6 | Was heißt „mit Google connected"? | Places für die Restaurant-Identität, Gemini für Extraktion und Übersetzung, Sign-In nur optional für den Gast |
| E7 | Wann gilt ein Scan als dieselbe Karte wie eine bestehende Version? | Ähnlichkeit über Item-Namen und Preise; ab Schwelle bestätigen statt neu anlegen |
| E8 | Was passiert bei veralteten Preisen? | Im QR das Datum der Kartenversion mitführen, der Kellner entscheidet |
| E9 | Missbrauch: jemand scannt Unsinn hoch | Scans an Device-Token binden, unbestätigte Karten kennzeichnen, Scan nur in Geo-Nähe des Lokals zulassen |
| E11 | Ab wann gilt eine Karte als veraltet? | 90 Tage, plus früher bei Meldung „Preise stimmen nicht" |
| E12 | Darf ein einzelner Scan die Karte für alle ersetzen? | Ja, aber nur nach dem Korrektur-Schritt des Gasts und mit Geo-Nähe-Prüfung |

## Status

`server/db/schema.ts` enthält aktuell nur eine Platzhalter-Tabelle `menu_items` aus dem
Scaffolding. Sie wird durch das Modell oben ersetzt. Diese Datei beschreibt den Zielzustand.
