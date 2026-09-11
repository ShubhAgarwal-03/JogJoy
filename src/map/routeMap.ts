import L from "leaflet";
import { RunPoint } from "../state/types";

/** Thin wrapper isolating Leaflet so nothing else imports it directly. */
export class RouteMap {
  private map: L.Map;
  private polyline: L.Polyline;
  private startMarker: L.CircleMarker | null = null;
  private finishMarker: L.CircleMarker | null = null;

  constructor(containerId: string) {
    this.map = L.map(containerId, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([0, 0], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(this.map);

    this.polyline = L.polyline([], {
      color: "#FF6A3D",
      weight: 4,
      lineCap: "round",
    }).addTo(this.map);
  }

  /** Redraws the full route (called on live updates during a run, or once for a saved run). */
  setRoute(points: RunPoint[]): void {
    if (points.length === 0) return;

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    this.polyline.setLatLngs(latLngs);

    if (this.startMarker) this.map.removeLayer(this.startMarker);
    if (this.finishMarker) this.map.removeLayer(this.finishMarker);

    const first = points[0];
    const last = points[points.length - 1];

    this.startMarker = L.circleMarker([first.lat, first.lng], {
      radius: 6,
      color: "#2ECC71",
      fillColor: "#2ECC71",
      fillOpacity: 1,
    }).addTo(this.map);

    if (points.length > 1) {
      this.finishMarker = L.circleMarker([last.lat, last.lng], {
        radius: 6,
        color: "#FF6A3D",
        fillColor: "#FF6A3D",
        fillOpacity: 1,
      }).addTo(this.map);
    }

    if (points.length > 1) {
      this.map.fitBounds(this.polyline.getBounds(), { padding: [24, 24] });
    } else {
      this.map.setView([first.lat, first.lng], 16);
    }
  }

  /** Leaflet needs an explicit size recalculation if its container was hidden when created. */
  invalidateSize(): void {
    this.map.invalidateSize();
  }

  destroy(): void {
    this.map.remove();
  }
}