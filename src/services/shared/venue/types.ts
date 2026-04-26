export interface GeneratedVenueEntry {
  id: string;
  name: string;
  street?: string;
  city?: string;
  location: string;
  url: string;
}

export interface GeneratedVenuesFile {
  generatedAt: string;
  venues: Record<string, GeneratedVenueEntry>;
}
