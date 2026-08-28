# Arbeitsteilung: vier parallele Lanes

Ziel: vier Leute (oder Agents) arbeiten gleichzeitig, ohne sich in denselben Dateien zu treffen
und ohne aufeinander zu warten.

## Schritt 0 – gemeinsam, vor dem Split

Das lässt sich nicht parallelisieren und muss zuerst stehen, sonst bauen vier Leute vier
verschiedene Annahmen. Einmal zusammen festlegen, dann einfrieren:

1. **`MenuDoc`-JSON** (`shared/types/menu.ts`) – das kanonische Karten-Format.
2. **QR-Payload** (`shared/types/qr.ts`) – Binärlayout und Kodierung. Es gibt keine Order-Entität.
3. **Drizzle-Schema in Modul-Dateien** aufteilen (siehe unten), Migration 0001 einmal generieren.
   Kein `users`/`accounts`-Tabellenpaar – es gibt keine Restaurant-Konten.
4. **Fixtures** (`shared/fixtures/`): eine realistische Beispielkarte als `MenuDoc`, ein
   Beispiel-QR-Payload, zwei Übersetzungsstände. Damit kann jede Lane sofort loslegen, auch wenn die
   anderen drei noch nichts geliefert haben.
5. **Fehlerformat** und `restaurantId`-Scoping-Regel.

Alles darunter ist Vertrag. Wer ihn ändern will, macht das sichtbar für alle, nicht nebenbei.

## Die vier Lanes

### Lane A – Scan & Extraktion
Von hochgeladenem Foto/Video zu einem validierten `MenuDoc`.

- Upload-Endpunkte, Signed URLs, Storage
- Video-Frames extrahieren, dedupen (Content-Hash, Unschärfe-Filter)
- Vision-Call, Prompt, Retries, Confidence
- Merge mehrerer Seiten/Frames zu einer Karte, Validierung gegen das `MenuDoc`-Schema
- Statusmaschine des `ScanJob`

**Besitzt:** `server/api/scans/`, `server/services/extraction/`, `server/jobs/`, `server/db/schema/scans.ts`
**Liefert nach außen:** `ScanJob`-Status + ein `MenuDoc` → Lane B
**Kann sofort starten:** ja, gegen Fixture-Bilder

### Lane B – Menü-Domäne & Übersetzung
Von `MenuDoc` zu einer versionierten, mehrsprachigen Karte in der DB.

- Menu-Versionierung, Ablösung alter Versionen, `currentMenuId` pro `kind`
- Matching: Ist dieser Scan dieselbe Karte wie die aktuelle Version? Dann nur bestätigen
  (`confirmCount++`, `lastConfirmedAt`) statt eine neue Version anzulegen (E7)
- Freshness: wann eine Karte als veraltet gilt und ein Update angeboten wird (E11)
- Import eines `MenuDoc` in die normalisierten Tabellen, Export zurück
- Translation-Tabelle, Auflösung mit Fallback-Kette, Glossar
- Übersetzungs-Worker, Nachziehen fehlender Locales
- `GET /api/menus/:id?locale=` – die Ausspiel-API

**Besitzt:** `server/db/schema/menus.ts`, `server/api/menus/`, `server/services/translation/`
**Liefert nach außen:** die Ausspiel-API → Lane C
**Kann sofort starten:** ja, gegen das Fixture-`MenuDoc`

### Lane C – Gast-Frontend
Alles, was der Gast sieht.

- Restaurant-Picker: Vorschlagsliste nach Distanz, Textsuche als Fallback
- Kamera-/Upload-UI, Scan-Fortschritt – nur im Ausnahmefall, wenn keine Karte im Cache liegt
- „Karte aktualisieren" und der Hinweis auf veraltete Stände
- Korrektur-Schritt direkt nach dem Scan: der Gast hat die Karte vor sich und ist der Einzige,
  der eine falsche Extraktion bemerken kann
- Karten-Ansicht: Sektionen, Items, Optionen, Allergen-Filter, Sprachumschalter
- Auswahl/Warenkorb, clientseitig persistent (funktioniert ohne Netz weiter)
- QR-Code lokal aus der Auswahl erzeugen, ohne Server-Roundtrip

**Besitzt:** `app/` (alles außer der Kellner-Route), `app/composables/`
**Konsumiert:** Lane A (Scan-Status), Lane B (Menü-API), Lane D (QR-Kodierung)
**Kann sofort starten:** ja, gegen Fixtures und Mock-Endpunkte

### Lane D – QR, Kellner & Restaurant-Identität
Von der Auswahl zur gescannten Bestellung.

- QR-Payload kodieren und dekodieren, Versionsbyte, Kompaktheit (Ziel: unter 100 Byte)
- Auflösung `menuId` + Item-Indizes gegen die Menü-Tabelle
- Kellner-Ansicht `/s/:payload` – schlanke Seite, **Originaltext der Karte** groß, Übersetzung
  klein darunter. Kein Login, der Payload in der URL ist alles, was sie braucht
- Restaurant-Identität: Geolocation → Places Nearby → Vorschlagsliste, Auflösung auf
  `googlePlaceId`, Anlage neuer Restaurant-Datensätze, Fallback ohne GPS
- Anonyme Device-Token, Geo-Nähe-Prüfung und Rate Limits beim Scan (E9, E12)

Es gibt bewusst kein Restaurant-Konto und keinen Owner-Login. Diese Lane baut kein Auth-System,
sondern einen anonymen Gast-Zugang per Device-Token. Der Kellner braucht gar keinen.

**Besitzt:** `server/db/schema/restaurants.ts`, `shared/qr/`, `server/api/session/`, `app/pages/s/`
**Kann sofort starten:** ja, Kodierung und Kellner-Seite gegen das Fixture-Menü

## Warum dieser Schnitt

Die Grenzen liegen dort, wo ohnehin ein Datenformat übergeben wird: A→B ist `MenuDoc`,
B→C ist die Menü-API, C→D ist der QR-Payload. Jede Grenze ist ein Format, für das ein Fixture
existiert – deshalb kann jede Lane gegen das Fixture entwickeln, statt auf die Nachbar-Lane zu warten.

## Konfliktzonen und wie wir sie entschärfen

| Zone | Problem | Regel |
|---|---|---|
| `server/db/schema.ts` | alle brauchen es | in `server/db/schema/{restaurants,menus,scans}.ts` aufteilen, `index.ts` re-exportiert nur. Jede Lane besitzt ihre Datei |
| Migrationen | Drizzle nummeriert fortlaufend, parallel erzeugt = Kollision | Migration-Dateien nie im Feature-Branch generieren. Vor dem Merge auf `main` neu generieren |
| `shared/types/` | Vertrag von allen | nach Schritt 0 eingefroren. Änderung nur mit Zustimmung der betroffenen Lanes |
| `restaurants`-Tabelle | von allen gelesen | gehört Lane D (kommt mit der Places-Auflösung), andere lesen nur |
| `nuxt.config.ts`, `package.json` | jeder fügt mal was hinzu | kleine, sofort gemergte Commits statt langer Branches |

## Sync-Punkte

- **Nach Schritt 0:** Verträge liegen auf `main`, alle vier starten.
- **Erster Integrationspunkt:** A+B zusammen – ein echtes Foto ergibt ein gespeichertes Menü.
- **Zweiter:** C+B – die Karte lädt aus der echten API statt aus Fixtures.
- **Dritter:** C+D – QR erzeugen, scannen, Kellner sieht die Bestellung im Originaltext.

Bis dahin ersetzt jede Lane ihre Mocks einzeln durch echte Aufrufe. Ein großer Big-Bang-Merge
am Ende ist der Weg, auf dem diese Aufteilung schiefgeht.

## Definition of Done pro Lane

Eine Lane ist fertig, wenn: die eigenen Endpunkte/Seiten gegen echte Daten laufen, das Fixture
weiterhin durchgeht, `restaurantId`-Scoping in jeder Query steht, der Originaltext der Karte
über die eigene Grenze hinweg erhalten bleibt, und diese Grenze (das übergebene JSON) im
Doc-Ordner beschrieben ist.
