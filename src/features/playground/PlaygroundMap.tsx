import { useEffect, useRef, useState } from "react";
import type { LatLngBoundsExpression, LeafletMouseEvent } from "leaflet";
import { MapContainer, Polygon, Polyline, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { GeoJsonGeometry } from "../aois/geometry";
import { leafletRings, type LonLat } from "./playgroundView";

export type DrawMode = "polygon" | "rectangle" | null;

type Props = {
  mode: DrawMode;
  draft: LonLat[];
  onDraft: (points: LonLat[]) => void;
  onFinish: (points: LonLat[]) => void;
  area: GeoJsonGeometry | null;
  trimBox: number[] | null;          // [west, south, east, north]
  onMoveTrim: (center: LonLat) => void;
  parts: { geometry: GeoJsonGeometry; label: string }[];
};

function Fit({ area }: { area: GeoJsonGeometry | null }) {
  const map = useMap();
  const key = area ? JSON.stringify(area.coordinates).slice(0, 200) : "";
  useEffect(() => {
    const rings = leafletRings(area);
    const points = rings.flat();
    if (points.length) map.fitBounds(points as LatLngBoundsExpression, { padding: [24, 24] });
    // Fit once per new area, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function Drawing({ mode, draft, onDraft, onFinish }: Pick<Props, "mode" | "draft" | "onDraft" | "onFinish">) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (!mode) return;
      const point: LonLat = [event.latlng.lng, event.latlng.lat];
      if (mode === "rectangle") {
        if (draft.length === 0) onDraft([point]);
        else onFinish([draft[0]!, point]);
        return;
      }
      onDraft([...draft, point]);
    },
    dblclick(event: LeafletMouseEvent) {
      if (mode === "polygon" && draft.length >= 3) { event.originalEvent.preventDefault(); onFinish(draft); }
    },
  });
  if (!mode || draft.length === 0) return null;
  const latlngs = draft.map(([lng, lat]) => [lat, lng] as [number, number]);
  return mode === "polygon"
    ? <Polyline positions={latlngs} pathOptions={{ color: "#0B5CAD", dashArray: "4 4", weight: 2 }} />
    : null;
}

/** The trimmed box can be dragged with the mouse (keyboard users have the move buttons next to the map). */
function DraggableBox({ box, onMove }: { box: number[]; onMove: (center: LonLat) => void }) {
  const map = useMap();
  const [offset, setOffset] = useState<[number, number]>([0, 0]);
  const start = useRef<{ lng: number; lat: number } | null>(null);
  const [west, south, east, north] = box as [number, number, number, number];
  useEffect(() => setOffset([0, 0]), [west, south, east, north]);
  useMapEvents({
    mousemove(event) {
      if (!start.current) return;
      setOffset([event.latlng.lng - start.current.lng, event.latlng.lat - start.current.lat]);
    },
    mouseup() {
      if (!start.current) return;
      start.current = null;
      map.dragging.enable();
      onMove([(west + east) / 2 + offset[0], (south + north) / 2 + offset[1]]);
    },
  });
  return <Rectangle bounds={[[south + offset[1], west + offset[0]], [north + offset[1], east + offset[0]]]}
    pathOptions={{ color: "#0B5CAD", weight: 2, dashArray: "6 4", fillOpacity: 0.12 }}
    eventHandlers={{ mousedown(event) { start.current = { lng: event.latlng.lng, lat: event.latlng.lat }; map.dragging.disable(); } }} />;
}

const PART_COLORS = ["#0B5CAD", "#1E7A46", "#B86A00", "#5B4BB7", "#A3231B", "#0B4F96"];

export function PlaygroundMap({ mode, draft, onDraft, onFinish, area, trimBox, onMoveTrim, parts }: Props) {
  return (
    <div className="fr-pg-map">
      <MapContainer center={[-7.9, 38.9]} zoom={8} scrollWheelZoom doubleClickZoom={false} className="leaflet-fill">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit area={area} />
        <Drawing mode={mode} draft={draft} onDraft={onDraft} onFinish={onFinish} />
        {leafletRings(area).map((ring, index) => <Polygon key={index} positions={ring} pathOptions={{ color: "#0F1B2A", weight: 2, fillOpacity: parts.length ? 0 : 0.08 }} />)}
        {parts.map((part, index) => leafletRings(part.geometry).map((ring, ringIndex) => (
          <Polygon key={`${index}-${ringIndex}`} positions={ring} pathOptions={{ color: PART_COLORS[index % PART_COLORS.length], weight: 2, fillOpacity: 0.18 }}>
            {ringIndex === 0 ? <Tooltip permanent direction="center" className="fr-pg-label">{part.label}</Tooltip> : null}
          </Polygon>
        )))}
        {trimBox ? <DraggableBox box={trimBox} onMove={onMoveTrim} /> : null}
      </MapContainer>
    </div>
  );
}
