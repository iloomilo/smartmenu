# Arbeitsteilung: vier parallele Lanes

Ziel: vier Agents arbeiten gleichzeitig, ohne sich in denselben Dateien zu treffen und ohne
aufeinander zu warten. Grundlage ist [README.md](README.md).

## Schritt 0 – gemeinsam, vor dem Split

Nicht parallelisierbar. Steht das nicht zuerst, bauen vier Leute vier verschiedene Annahmen.
Einmal festlegen, dann einfrieren:

1. **Drizzle-Schema** in Modul-Dateien: `server/db/schema/{restaurants,menus,scans}.ts`,
   `index.ts` re-exportiert nur. Migration 0001 einmal generieren. Die Starter-Tabelle
   `menu_items` mit `price_cents NOT NULL` wird ersetzt, kein paralleles Cents-Feld.
2. **Tick-Vertrag** (`shared/types/extract.ts`): Request (Frame + aktuelle Items) und das
   Patch-JSON-Schema, das dem Modell vorgegeben und gegen das validiert wird.
3. **QR-Payload** (`shared/types/qr.ts`): Binärlayout und Kodierung.
4. **Modell-Client-Interface** (`server/services/model/`): eine Funktion, ein Fake daneben.
   Ohne dieses Interface kann niemand testen. Dazu ein `docker-compose`-Profil oder eine
   Anleitung, die das lokale Modell startet – sonst kann Lane A nicht gegen echte Antworten
   entwickeln.
5. **Fixtures** (`shared/fixtures/`): eine realistische Karte als Item-Liste, eine Tick-Folge
   aus Patches (inklusive Verfeinerung derselben Zeile), ein QR-Payload, zwei Sprachstände.
6. **Fehlerformat** und die Scoping-Regel (jede Query auf ein Menu oder ein Restaurant).

Alles darunter ist Vertrag. Wer ihn ändert, macht es sichtbar, nicht nebenbei.

## Die vier Lanes

### Lane A – Extraktion (Server)
Vom Frame zum gespeicherten Item.

- `POST /api/menus/:id/ticks`: Frame entgegennehmen, Modell aufrufen, Patches validieren, upserten
- Modell-Client gegen die OpenAI-kompatible API (`MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_NAME`),
  Antwort per JSON-Schema erzwungen. Lokal: Qwen3-VL-8B über vLLM oder Ollama
- Nur ein Tick gleichzeitig in Bearbeitung; der Endpunkt lehnt einen zweiten ab, statt zu stauen
- Upsert auf `(menuId, sourceName, sourceSection)`; Verfeinern statt Duplizieren
- Frames nach dem Aufruf verwerfen, auch im Fehlerfall. Nichts auf Platte, nichts in Postgres
- Sprach-Erkennung. **Keine** Übersetzung im Tick – die macht Lane B beim Versiegeln
- Fehlerzählung pro Session, retryable Fehler nach außen sichtbar machen

**Besitzt:** `server/api/menus/[id]/ticks*`, `server/services/model/`, `server/services/extract/`, `schema/scans.ts`
**Grenze nach außen:** der Tick-Vertrag
**Kann sofort starten:** ja, gegen das Fake-Modell und die Patch-Fixtures

### Lane B – Menü-Domäne, Cache & Übersetzung
Von Items zu einer gecachten, mehrsprachigen Karte.

- Menu-Lebenszyklus `scanning → sealed`, Positionen beim Versiegeln stabil vergeben
- Cache: `currentMenuId` pro `kind`, Freshness, Ablösung über `supersededById`
- Matching beim Neu-Scan: identisch → nur `confirmCount`/`lastConfirmedAt`, abweichend → neue Version (E7)
- Übersetzung beim Versiegeln in einem Durchgang über die ganze Karte
- Translation-Tabelle, Fallback-Kette, Nachübersetzung weiterer Sprachen ohne neue Frames
- `GET /api/menus/:id?locale=` – die Ausspiel-API, nach Sektionen gruppiert

**Besitzt:** `schema/menus.ts`, `server/api/menus/`, `server/services/translation/`
**Grenze nach außen:** die Ausspiel-API
**Kann sofort starten:** ja, gegen die Karten-Fixture

### Lane C – Gast-Frontend
Alles, was der Gast sieht.

- Restaurant-Picker: Vorschlagsliste nach Distanz, Textsuche als Fallback
- Kamera-Vollbild mit Bottom Sheet, Hinweistext, Trefferzähler
- **Frame-Auswahl im Client**: immer nur ein Tick in Flight, dazwischen den besten Frame
  wählen (scharf, deutlich verschieden zum letzten). Keine feste Bildrate (E13)
- Liste stabil halten: kein Flackern, kein Voll-Replace, Auswahl hängt an `menuItem.id`
- Pause bei Hintergrund, harte Zeitgrenze mit „Fortsetzen", Kamera aus nach „Fertig"
- Fehlerserie: Liste behalten, pausieren, „Erneut versuchen"
- Mengen-Review, QR-Code lokal erzeugen
- Karte aus dem Cache anzeigen samt Datumshinweis und „Karte aktualisieren"

**Besitzt:** `app/` außer der Kellner-Route
**Konsumiert:** Lane A (Ticks), Lane B (Ausspiel-API), Lane D (Places, QR-Kodierung)
**Kann sofort starten:** ja, gegen Fixtures und Mock-Endpunkte

### Lane D – Restaurant-Identität, QR & Kellner
Ort rein, gescannte Bestellung raus.

- Geolocation → Umkreissuche über **Overpass/OSM** → Vorschlagsliste, Auflösung auf
  `(placeProvider, placeId)`, Anlage neuer Restaurant-Datensätze, Fallback ohne GPS
- **Jede Overpass-Antwort in einen eigenen Geohash-Cache schreiben.** Der Aufruf fällt sonst
  bei jedem App-Start an; der Cache hält uns zugleich in den Fair-Use-Grenzen (E14)
- QR-Payload kodieren und dekodieren, Versionsbyte, Ziel unter 100 Byte
- Kellner-Ansicht `/s/:payload`: Originaltext groß, Übersetzung klein darunter, Mengen, Summe
  nur über Zeilen mit Preis. Kein Login
- Device-Token, Geo-Nähe-Prüfung und Rate Limits beim Scan (E9, E12)

Diese Lane baut kein Auth-System. Es gibt einen anonymen Gast-Zugang per Device-Token, und der
Kellner braucht gar keinen.

**Besitzt:** `schema/restaurants.ts`, `server/api/places/`, `server/services/osm/`, `shared/qr/`, `app/pages/s/`
**Kann sofort starten:** ja, Kodierung und Kellner-Seite gegen die Karten-Fixture

## Warum dieser Schnitt

Die Grenzen liegen dort, wo ohnehin ein Format übergeben wird: A↔C ist der Tick, B→C die
Ausspiel-API, C↔D Places und der QR-Payload. Für jede Grenze gibt es ein Fixture, deshalb
entwickelt jede Lane dagegen, statt auf die Nachbar-Lane zu warten.

## Konfliktzonen

| Zone | Problem | Regel |
|---|---|---|
| `server/db/schema.ts` | alle brauchen es | in Modul-Dateien aufteilen, `index.ts` re-exportiert nur. Jede Lane besitzt ihre Datei |
| Migrationen | Drizzle nummeriert fortlaufend, parallel erzeugt = Kollision | nie im Feature-Branch generieren, sondern vor dem Merge auf `main` |
| `menus`-Tabelle | A schreibt Items hinein, B besitzt den Lebenszyklus | B besitzt die Datei, A schreibt nur über die Upsert-Funktion, die B bereitstellt |
| `shared/types/` | Vertrag von allen | nach Schritt 0 eingefroren |
| `restaurants` | von allen gelesen | gehört Lane D, andere lesen nur |
| `nuxt.config.ts`, `package.json` | jeder ergänzt mal etwas | kleine, sofort gemergte Commits statt langer Branches |

## Sync-Punkte

- **Nach Schritt 0:** Verträge liegen auf `main`, alle vier starten.
- **Erster:** A+B – eine Tick-Folge erzeugt ein versiegeltes, abrufbares Menu.
- **Zweiter:** C+A – echte Kamera füllt die Liste live.
- **Dritter:** C+B+D – Karte aus dem Cache statt aus Fixtures, QR erzeugen, Kellner liest sie.

Jede Lane ersetzt ihre Mocks einzeln. Ein Big-Bang-Merge am Ende ist der Weg, auf dem diese
Aufteilung schiefgeht.

## Tests

Ein einziger automatisierter Seam für alle Lanes: die Menu-HTTP-API mit dem Modell-Client als
Test-Double. Getestet wird äußeres Verhalten, nicht Vue-Interna, Drizzle-Zeilenformen oder
Prompt-Strings. Jede Lane liefert ihre Fälle in dieselbe Suite.

## Definition of Done pro Lane

Die eigenen Endpunkte oder Seiten laufen gegen echte Daten, die Fixtures gehen weiterhin durch,
jede Query ist auf Menu oder Restaurant gescoped, der Originaltext bleibt über die eigene
Grenze hinweg erhalten, und diese Grenze ist im Doc-Ordner beschrieben.
