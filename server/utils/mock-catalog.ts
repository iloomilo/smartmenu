import type { ExtractPatch } from '../../shared/types'

type CatalogEntry = ExtractPatch & {
  translations: Record<string, { name: string, description: string | null, section: string }>
}

export const MOCK_CATALOG: CatalogEntry[] = [
  {
    originalName: 'Obazda mit Brezn',
    originalDescription: 'Camembert-Obazda, rote Zwiebeln, Laugenbrezel',
    originalSection: 'Vorspeisen',
    price: 7.5,
    page: 1,
    translations: {
      en: { name: 'Obazda with pretzel', description: 'Camembert cheese spread, red onion, pretzels', section: 'Starters' },
      de: { name: 'Obazda mit Brezn', description: 'Camembert-Obazda, rote Zwiebeln, Laugenbrezel', section: 'Vorspeisen' },
      es: { name: 'Obazda con pretzel', description: 'Crema de camembert, cebolla roja, pretzel', section: 'Entrantes' },
      fr: { name: 'Obazda au bretzel', description: 'Fromage Camembert, oignon rouge, bretzel', section: 'Entrées' },
    },
  },
  {
    originalName: 'Spargelsuppe',
    originalDescription: 'Weißer Spargel, Schnittlauch, Buttercroûtons',
    originalSection: 'Vorspeisen',
    price: 6.9,
    page: 1,
    translations: {
      en: { name: 'Asparagus soup', description: 'White asparagus, chives, butter croutons', section: 'Starters' },
      de: { name: 'Spargelsuppe', description: 'Weißer Spargel, Schnittlauch, Buttercroûtons', section: 'Vorspeisen' },
      es: { name: 'Sopa de espárragos', description: 'Espárrago blanco, cebollino, crutones', section: 'Entrantes' },
      fr: { name: 'Velouté d’asperges', description: 'Asperge blanche, ciboulette, croûtons', section: 'Entrées' },
    },
  },
  {
    originalName: 'Matjes mit Äpfeln',
    originalDescription: 'Matjesfilet, Apfel, Zwiebel, Sahne',
    originalSection: 'Vorspeisen',
    price: 8.5,
    page: 1,
    translations: {
      en: { name: 'Herring with apples', description: 'Matjes herring, apple, onion, cream', section: 'Starters' },
      de: { name: 'Matjes mit Äpfeln', description: 'Matjesfilet, Apfel, Zwiebel, Sahne', section: 'Vorspeisen' },
      es: { name: 'Arenque con manzana', description: 'Arenque, manzana, cebolla, nata', section: 'Entrantes' },
      fr: { name: 'Hareng aux pommes', description: 'Hareng, pomme, oignon, crème', section: 'Entrées' },
    },
  },
  {
    originalName: 'Wiener Schnitzel vom Kalb',
    originalDescription: 'Kalbschnitzel, Preiselbeeren, Kartoffelsalat',
    originalSection: 'Hauptgerichte',
    price: 22,
    page: 1,
    translations: {
      en: { name: 'Viennese veal schnitzel', description: 'Veal schnitzel, lingonberries, potato salad', section: 'Mains' },
      de: { name: 'Wiener Schnitzel vom Kalb', description: 'Kalbschnitzel, Preiselbeeren, Kartoffelsalat', section: 'Hauptgerichte' },
      es: { name: 'Schnitzel de ternera', description: 'Escalope de ternera, arándanos, ensalada de patata', section: 'Principales' },
      fr: { name: 'Schnitzel de veau', description: 'Escalope de veau, airelles, salade de pommes de terre', section: 'Plats' },
    },
  },
  {
    originalName: 'Schweinebraten mit Knödel',
    originalDescription: 'Krustenbraten, Semmelknödel, dunkle Biersoße',
    originalSection: 'Hauptgerichte',
    price: 18.5,
    page: 1,
    translations: {
      en: { name: 'Roast pork with dumpling', description: 'Crackling roast, bread dumpling, dark beer gravy', section: 'Mains' },
      de: { name: 'Schweinebraten mit Knödel', description: 'Krustenbraten, Semmelknödel, dunkle Biersoße', section: 'Hauptgerichte' },
      es: { name: 'Asado de cerdo con knödel', description: 'Cerdo asado, dumplings, salsa de cerveza', section: 'Principales' },
      fr: { name: 'Rôti de porc et knödel', description: 'Porc croustillant, knödel, sauce à la bière', section: 'Plats' },
    },
  },
  {
    originalName: 'Zanderfilet auf Linsen',
    originalDescription: 'Zander, Beluga-Linsen, braune Butter',
    originalSection: 'Hauptgerichte',
    price: 24,
    page: 1,
    translations: {
      en: { name: 'Pike-perch on lentils', description: 'Zander, beluga lentils, brown butter', section: 'Mains' },
      de: { name: 'Zanderfilet auf Linsen', description: 'Zander, Beluga-Linsen, braune Butter', section: 'Hauptgerichte' },
      es: { name: 'Lucioperca con lentejas', description: 'Lucioperca, lentejas beluga, mantequilla noisette', section: 'Principales' },
      fr: { name: 'Sandre aux lentilles', description: 'Sandre, lentilles beluga, beurre noisette', section: 'Plats' },
    },
  },
  {
    originalName: 'Käsespätzle',
    originalDescription: 'Bergkäse, Röstzwiebeln, grüner Salat',
    originalSection: 'Hauptgerichte',
    price: 14.9,
    page: 1,
    translations: {
      en: { name: 'Cheese spätzle', description: 'Mountain cheese, fried onions, green salad', section: 'Mains' },
      de: { name: 'Käsespätzle', description: 'Bergkäse, Röstzwiebeln, grüner Salat', section: 'Hauptgerichte' },
      es: { name: 'Spätzle con queso', description: 'Queso de montaña, cebolla frita, ensalada', section: 'Principales' },
      fr: { name: 'Spätzle au fromage', description: 'Fromage de montagne, oignons frits, salade', section: 'Plats' },
    },
  },
  {
    originalName: 'Apfelstrudel mit Vanille',
    originalDescription: 'Warmer Strudel, Vanilleeis, Puderzucker',
    originalSection: 'Nachspeisen',
    price: 7.5,
    page: 2,
    translations: {
      en: { name: 'Apple strudel with vanilla', description: 'Warm strudel, vanilla ice cream, icing sugar', section: 'Desserts' },
      de: { name: 'Apfelstrudel mit Vanille', description: 'Warmer Strudel, Vanilleeis, Puderzucker', section: 'Nachspeisen' },
      es: { name: 'Strudel de manzana', description: 'Strudel caliente, helado de vainilla', section: 'Postres' },
      fr: { name: 'Strudel aux pommes', description: 'Strudel chaud, glace vanille', section: 'Desserts' },
    },
  },
  {
    originalName: 'Kaiserschmarrn',
    originalDescription: 'Zerrissener Pfannkuchen, Zwetschgenröster',
    originalSection: 'Nachspeisen',
    price: 9.9,
    page: 2,
    translations: {
      en: { name: 'Kaiserschmarrn', description: 'Shredded pancake, roasted plums', section: 'Desserts' },
      de: { name: 'Kaiserschmarrn', description: 'Zerrissener Pfannkuchen, Zwetschgenröster', section: 'Nachspeisen' },
      es: { name: 'Kaiserschmarrn', description: 'Tortita troceada, ciruelas asadas', section: 'Postres' },
      fr: { name: 'Kaiserschmarrn', description: 'Crêpe déchirée, quetsches rôties', section: 'Desserts' },
    },
  },
  {
    originalName: 'Dampfnudel mit Pflaumen',
    originalDescription: 'Gedämpfte Hefeklöße, Zwetschgenkompott',
    originalSection: 'Nachspeisen',
    price: 6.5,
    page: 2,
    translations: {
      en: { name: 'Dampfnudel with plums', description: 'Steamed yeast dumpling, plum compote', section: 'Desserts' },
      de: { name: 'Dampfnudel mit Pflaumen', description: 'Gedämpfte Hefeklöße, Zwetschgenkompott', section: 'Nachspeisen' },
      es: { name: 'Dampfnudel con ciruelas', description: 'Bollo al vapor, ciruelas', section: 'Postres' },
      fr: { name: 'Dampfnudel aux prunes', description: 'Boule de levure vapeur, pruneaux', section: 'Desserts' },
    },
  },
  {
    originalName: 'Helles vom Fass 0,5l',
    originalDescription: 'Lager vom Hausbrauer',
    originalSection: 'Getränke',
    price: 4.8,
    page: 2,
    translations: {
      en: { name: 'Draft helles 0.5l', description: 'House-brewed pale lager', section: 'Drinks' },
      de: { name: 'Helles vom Fass 0,5l', description: 'Lager vom Hausbrauer', section: 'Getränke' },
      es: { name: 'Helles de barril 0,5l', description: 'Lager de la casa', section: 'Bebidas' },
      fr: { name: 'Helles pression 0,5l', description: 'Lager de la maison', section: 'Boissons' },
    },
  },
  {
    originalName: 'Silvaner Weinglas',
    originalDescription: 'Franken, trocken',
    originalSection: 'Getränke',
    price: 5.5,
    page: 2,
    translations: {
      en: { name: 'Silvaner, glass', description: 'Franconia, dry', section: 'Drinks' },
      de: { name: 'Silvaner Weinglas', description: 'Franken, trocken', section: 'Getränke' },
      es: { name: 'Silvaner copa', description: 'Franconia, seco', section: 'Bebidas' },
      fr: { name: 'Silvaner au verre', description: 'Franconie, sec', section: 'Boissons' },
    },
  },
  {
    originalName: 'Aperol Spritz',
    originalDescription: 'Aperol, Prosecco, Soda',
    originalSection: 'Getränke',
    price: null,
    priceLabel: 'MP',
    page: 2,
    translations: {
      en: { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda', section: 'Drinks' },
      de: { name: 'Aperol Spritz', description: 'Aperol, Prosecco, Soda', section: 'Getränke' },
      es: { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda', section: 'Bebidas' },
      fr: { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda', section: 'Boissons' },
    },
  },
]

/** Canned patches per mock camera frame. Later frames refine earlier rows (upsert). */
export const FRAME_PATCHES: Record<number, ExtractPatch[]> = {
  0: [
    pick('Obazda mit Brezn', { price: null, priceLabel: '7,–' }),
    pick('Spargelsuppe'),
  ],
  1: [
    pick('Obazda mit Brezn'),
    pick('Matjes mit Äpfeln'),
    pick('Wiener Schnitzel vom Kalb', { price: null, originalDescription: null }),
  ],
  2: [
    pick('Wiener Schnitzel vom Kalb'),
    pick('Schweinebraten mit Knödel'),
    pick('Zanderfilet auf Linsen'),
    pick('Käsespätzle'),
  ],
  3: [
    pick('Apfelstrudel mit Vanille'),
    pick('Kaiserschmarrn'),
  ],
  4: [
    pick('Dampfnudel mit Pflaumen'),
    pick('Helles vom Fass 0,5l'),
    pick('Silvaner Weinglas'),
    pick('Aperol Spritz'),
  ],
}

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
] as const

function pick(originalName: string, override: Partial<ExtractPatch> = {}): ExtractPatch {
  const row = MOCK_CATALOG.find(item => item.originalName === originalName)
  if (!row) throw new Error(`Unknown mock dish: ${originalName}`)
  const { translations: _, ...base } = row
  return { ...base, ...override }
}

export function translatePatch(patch: ExtractPatch, locale: string) {
  const row = MOCK_CATALOG.find(item => item.originalName === patch.originalName)
  const t = row?.translations[locale] ?? row?.translations.en
  return {
    originalName: patch.originalName,
    translatedName: t?.name ?? patch.originalName,
    originalDescription: patch.originalDescription ?? row?.originalDescription ?? null,
    translatedDescription: t?.description ?? null,
    originalSection: patch.originalSection,
    translatedSection: t?.section ?? patch.originalSection,
    price: patch.price === undefined ? row?.price ?? null : patch.price,
    priceLabel: patch.priceLabel ?? row?.priceLabel ?? null,
    page: patch.page ?? row?.page ?? null,
  }
}

export function translateCatalogItem(originalName: string, originalSection: string, locale: string) {
  const row = MOCK_CATALOG.find(item => item.originalName === originalName && item.originalSection === originalSection)
    ?? MOCK_CATALOG.find(item => item.originalName === originalName)
  const t = row?.translations[locale] ?? row?.translations.en
  return {
    translatedName: t?.name ?? originalName,
    translatedDescription: t?.description ?? null,
    translatedSection: t?.section ?? originalSection,
  }
}
