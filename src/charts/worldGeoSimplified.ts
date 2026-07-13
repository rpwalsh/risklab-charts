// ============================================================================
// RiskLab Charts — Simplified World GeoJSON (110m Natural Earth, heavily simplified)
// Contains ~50 country polygons as very low-resolution outlines.
// Used as fallback when the user doesn't supply their own GeoJSON.
// Each feature has properties: { name, code } where code is ISO 3166-1 alpha-3.
// ============================================================================

/**
 * Minimal rectangle-approximation world map.
 * Each country is represented by a simplified bounding polygon.
 * Good enough for choropleth visualization at dashboard scale.
 */
export function getBuiltinWorldGeoJSON(): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: { name: string; code: string };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }>;
} {
  // Country approximate bounding polygons [lon, lat]
  // Simplified to 4–8 point polygons for tiny bundle size
  const countries: Array<{ name: string; code: string; bounds: [number, number, number, number] }> = [
    { name: 'United States', code: 'USA', bounds: [-125, 24, -66, 50] },
    { name: 'Canada', code: 'CAN', bounds: [-141, 42, -52, 72] },
    { name: 'Mexico', code: 'MEX', bounds: [-118, 14, -86, 33] },
    { name: 'Brazil', code: 'BRA', bounds: [-74, -34, -35, 6] },
    { name: 'Argentina', code: 'ARG', bounds: [-74, -56, -53, -21] },
    { name: 'Colombia', code: 'COL', bounds: [-79, -5, -67, 13] },
    { name: 'Chile', code: 'CHL', bounds: [-76, -56, -66, -17] },
    { name: 'United Kingdom', code: 'GBR', bounds: [-8, 50, 2, 59] },
    { name: 'France', code: 'FRA', bounds: [-5, 42, 8, 51] },
    { name: 'Germany', code: 'DEU', bounds: [6, 47, 15, 55] },
    { name: 'Spain', code: 'ESP', bounds: [-10, 36, 4, 44] },
    { name: 'Italy', code: 'ITA', bounds: [7, 36, 19, 47] },
    { name: 'Netherlands', code: 'NLD', bounds: [3, 51, 7, 54] },
    { name: 'Belgium', code: 'BEL', bounds: [3, 49, 6, 52] },
    { name: 'Switzerland', code: 'CHE', bounds: [6, 46, 10, 48] },
    { name: 'Austria', code: 'AUT', bounds: [10, 46, 17, 49] },
    { name: 'Poland', code: 'POL', bounds: [14, 49, 24, 55] },
    { name: 'Sweden', code: 'SWE', bounds: [11, 55, 24, 69] },
    { name: 'Norway', code: 'NOR', bounds: [5, 58, 31, 71] },
    { name: 'Ireland', code: 'IRL', bounds: [-11, 51, -6, 55] },
    { name: 'Russia', code: 'RUS', bounds: [27, 41, 180, 78] },
    { name: 'China', code: 'CHN', bounds: [73, 18, 135, 54] },
    { name: 'Japan', code: 'JPN', bounds: [129, 31, 146, 46] },
    { name: 'India', code: 'IND', bounds: [68, 6, 97, 36] },
    { name: 'South Korea', code: 'KOR', bounds: [126, 34, 130, 38] },
    { name: 'Indonesia', code: 'IDN', bounds: [95, -11, 141, 6] },
    { name: 'Thailand', code: 'THA', bounds: [97, 6, 106, 21] },
    { name: 'Vietnam', code: 'VNM', bounds: [102, 8, 110, 24] },
    { name: 'Philippines', code: 'PHL', bounds: [117, 5, 127, 21] },
    { name: 'Malaysia', code: 'MYS', bounds: [100, 1, 119, 8] },
    { name: 'Bangladesh', code: 'BGD', bounds: [88, 21, 93, 27] },
    { name: 'Pakistan', code: 'PAK', bounds: [61, 24, 77, 37] },
    { name: 'Turkey', code: 'TUR', bounds: [26, 36, 45, 42] },
    { name: 'Saudi Arabia', code: 'SAU', bounds: [35, 16, 55, 32] },
    { name: 'Israel', code: 'ISR', bounds: [34, 29, 36, 34] },
    { name: 'Egypt', code: 'EGY', bounds: [25, 22, 36, 32] },
    { name: 'Nigeria', code: 'NGA', bounds: [3, 4, 15, 14] },
    { name: 'South Africa', code: 'ZAF', bounds: [17, -35, 33, -22] },
    { name: 'Australia', code: 'AUS', bounds: [113, -44, 154, -10] },
    { name: 'Singapore', code: 'SGP', bounds: [103.6, 1.2, 104.0, 1.5] },
  ];

  return {
    type: 'FeatureCollection',
    features: countries.map(c => ({
      type: 'Feature' as const,
      id: c.code,
      properties: { name: c.name, code: c.code },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [c.bounds[0], c.bounds[1]],
          [c.bounds[2], c.bounds[1]],
          [c.bounds[2], c.bounds[3]],
          [c.bounds[0], c.bounds[3]],
          [c.bounds[0], c.bounds[1]],
        ]],
      },
    })),
  };
}
