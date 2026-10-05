import { MapContainer, Polygon, TileLayer, useMapEvents } from "react-leaflet";

function DrawEvents({ points, onChange }: { points: Array<[number, number]>; onChange: (points: Array<[number, number]>) => void }) {
  useMapEvents({
    click(event) { onChange([...points, [event.latlng.lng, event.latlng.lat]]); },
  });
  return points.length >= 2 ? <Polygon positions={points.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: "#32c48d", weight: 3 }} /> : null;
}

export function AoiDrawingMap({ points, onChange }: { points: Array<[number, number]>; onChange: (points: Array<[number, number]>) => void }) {
  return (
    <div className="aoi-draw-map">
      <MapContainer center={[-1.2864, 36.8172]} zoom={9} scrollWheelZoom className="leaflet-fill">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <DrawEvents points={points} onChange={onChange} />
      </MapContainer>
      <div className="map-instruction">Click the map to add vertices · {points.length} vertices</div>
    </div>
  );
}
