declare module "shpjs" {
  export type ShpResult = GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];
  export default function parseShapefile(source: ArrayBuffer): Promise<ShpResult>;
}
