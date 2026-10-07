export type Settings = {
  name: string;
  language: "en" | "ka";
  city: string;
  timeZone: string;
  currency: string;
};

export const DEFAULT_SETTINGS: Settings = {
  name: "LA",
  language: "en",
  city: "Tbilisi",
  timeZone: "Asia/Tbilisi",
  currency: "GEL",
};
