export interface GeneratedVenueEntry {
  id: string;
  name: string;
  street?: string;
  city?: string;
  location: string;
  email: string | null;
  url: string;
}

export interface GeneratedVenuesFile {
  generatedAt: string;
  venues: Record<string, GeneratedVenueEntry>;
}
