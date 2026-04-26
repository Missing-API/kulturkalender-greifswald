import type { KulturkalenderSourceEvent } from "../services/adapters/kulturkalender/kulturkalender.source.schema";

/**
 * Dummy event data for the spike.
 * Uses the same shape as the real Kulturkalender source feed.
 */
export const dummySourceEvents: KulturkalenderSourceEvent[] = [
  {
    kumo_link: "https://www.kulturkalender.greifswald.de/events/58362?start_on=2026-04-26",
    kumo_id: 58_362,
    kumo_updated_at: "2026-02-12T12:33:51.000+01:00",
    category: "Ausstellung",
    venue: "Kirche Wieck",
    title: "Mit Blick auf's Wasser",
    subtitle: "Fotoausstellung von Thomas Mauroschat",
    content: "Von April bis Juni wird es eine Fotoausstellung im Gemeinderaum geben.",
    image: "https://www.kulturkalender.greifswald.de/images/example1.jpg",
    image_link: "https://www.kulturkalender.greifswald.de/images/example1.jpg",
    image_credits: "Privat",
    time: "",
    date: "2026-04-26",
    time_venue: " / Kirche Wieck",
    organiser: null,
  },
  {
    kumo_link: "https://www.kulturkalender.greifswald.de/events/58240?start_on=2026-04-26",
    kumo_id: 58_240,
    kumo_updated_at: "2025-12-11T15:36:24.000+01:00",
    category: "Ausstellung",
    venue: "Pommersches Landesmuseum",
    title: "Galerie der Romantik",
    subtitle: "Caspar David Friedrich sehen",
    content: "1774 erblickte Caspar David Friedrich in Greifswald das Licht der Welt.",
    image: "https://www.kulturkalender.greifswald.de/images/example2.jpg",
    image_link: "https://www.kulturkalender.greifswald.de/images/example2.jpg",
    image_credits: "Pommersches Landesmuseum",
    time: "",
    date: "2026-04-26",
    time_venue: " / Pommersches Landesmuseum",
    organiser: null,
  },
  {
    kumo_link: "https://www.kulturkalender.greifswald.de/events/54014?start_on=2026-04-26",
    kumo_id: 54_014,
    kumo_updated_at: "2026-03-05T10:06:44.000+01:00",
    category: "Extra",
    venue: "Universität",
    title: "Tägliche öffentliche Führung durch Aula und Karzer",
    subtitle: "Die Kustodie der Uni Greifswald bietet öffentliche Führungen an.",
    content: "Schauen Sie großen Denkern in die Augen. Anmeldung: ohne. Beginn: 15:00 Uhr.",
    image: "https://www.kulturkalender.greifswald.de/images/example3.jpg",
    image_link: "https://www.kulturkalender.greifswald.de/images/example3.jpg",
    image_credits: "Pressestelle Universität Greifswald",
    time: "15:00",
    date: "2026-04-26",
    time_venue: "15:00 / Universität",
    organiser: "Kustodie der Universität Greifswald",
  },
];
