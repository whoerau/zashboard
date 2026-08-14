export const resolveGeoIPDatabaseURL = (configuredURL: string, defaultURL: string): string =>
  configuredURL.trim() || defaultURL
