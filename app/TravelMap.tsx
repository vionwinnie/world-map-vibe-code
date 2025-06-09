"use client";
import React, { useEffect, useRef, useState } from "react";

// Simple world topojson (110m, small)
const GEOJSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const getColor = (dates: { dateStart: string; dateEnd: string }[] | undefined) => {
  const visits = dates?.length || 0;
  if (!visits) return "#e0e0e0"; // never visited
  if (visits === 1) return "#7ec4cf"; // visited once
  return "#f49e4c"; // visited multiple times
};

function getCountryName(geo: any, travelData: any) {
  return travelData[geo.id]?.countryName || geo.properties.name || geo.id;
}

export default function TravelMap() {
  const [geos, setGeos] = useState<any[]>([]);
  const [travelData, setTravelData] = useState<{[key: string]: { dates: { dateStart: string; dateEnd: string }[]; photos: string[] }}>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverGeo, setHoverGeo] = useState<any>(null);
  const [cardPos, setCardPos] = useState<{x: number, y: number} | null>(null);
  const [sidebar, setSidebar] = useState<{iso: string, geo: any} | null>(null);
  const [sidebarComment, setSidebarComment] = useState<string>("");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const basePath = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_BASE_PATH || '') : '';
  console.log('Base path in browser:', basePath);

  useEffect(() => {
    // Fetch travel data
    fetch(`${basePath}/data/travel-data.json`)
      .then(res => res.json())
      .then(data => setTravelData(data));

    // Fetch geo data
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((topo) => {
        // Convert topojson to geojson
        // @ts-ignore
        import("topojson-client").then((topojson) => {
          const features = topojson.feature(
            topo,
            topo.objects.countries
          ).features;
          setGeos(features);
        });
      });
  }, []);

  // Fetch comment only when sidebar is opened
  useEffect(() => {
    if (!sidebar) {
      setSidebarComment("");
      return;
    }
    const commentFile = `${basePath}/comments/${sidebar.iso}.txt`;
    fetch(commentFile)
      .then((res) => {
        if (!res.ok) throw new Error("No comment");
        return res.text();
      })
      .then((txt) => setSidebarComment(txt))
      .catch(() => setSidebarComment(""));
  }, [sidebar]);

  // Basic equirectangular projection
  function project([lon, lat]: [number, number]) {
    const x = ((lon + 180) * 800) / 360;
    const y = ((90 - lat) * 400) / 180;
    return [x, y];
  }

  // Count visited countries
  const visitedCount = Object.keys(travelData).length;

  // Helper to check if a polygon ring is visible in the SVG bounds
  function isPolygonVisible(ring: [number, number][]) {
    return ring.some(([lon, lat]) => {
      const [x, y] = project([lon, lat]);
      return x >= 0 && x <= 800 && y >= 0 && y <= 400;
    });
  }

  return (
    <>
      <style>{`
        path[stroke="#fff"][stroke-width="0.5"] {
          shape-rendering: geometricPrecision;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", maxWidth: 900, margin: "0 auto", position: "relative" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>Winnie's Travel Map</h1>
          <div style={{ fontSize: 18, fontWeight: 500, background: '#f49e4c', color: '#fff', borderRadius: 24, padding: '8px 20px' }}>
            Countries visited: <span style={{ fontWeight: 700 }}>{visitedCount}</span>
          </div>
        </div>
        <svg ref={svgRef} viewBox="0 0 800 400" style={{ width: "100%", height: "auto", background: "#111", borderRadius: 16 }}>
          {geos.map((geo, i) => {
            const iso = geo.id;
            const data = travelData[iso as keyof typeof travelData];
            // Normalize coordinates: always array of rings
            const coords =
              geo.geometry.type === "Polygon"
                ? [geo.geometry.coordinates]
                : geo.geometry.coordinates;
            // Filter out degenerate rings and those outside bounds
            return coords
              .map((multi: any) => multi.filter((ring: any) => Array.isArray(ring) && ring.length > 2 && isPolygonVisible(ring)))
              .map((multi: any, idx: number) => (
                <path
                  key={iso + '-' + idx}
                  d={multi
                    .map(
                      (ring: any) =>
                        ring
                          .map(
                            ([lon, lat]: [number, number], j: number) =>
                              (j === 0 ? "M" : "L") + project([lon, lat]).join(",")
                          )
                          .join(" ") + " Z"
                    )
                    .join(" ")}
                  fill={getColor(data?.dates)}
                  stroke="#fff"
                  strokeWidth={0.5}
                  onMouseEnter={e => {
                    setHovered(iso);
                    setHoverGeo(geo);
                    // Get mouse position relative to SVG
                    const svgRect = svgRef.current?.getBoundingClientRect();
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    let x = e.clientX - (svgRect?.left ?? 0);
                    let y = e.clientY - (svgRect?.top ?? 0);
                    // Clamp card position to stay inside container
                    if (containerRect) {
                      const cardWidth = 240, cardHeight = 180;
                      x = Math.max(cardWidth / 2, Math.min(x, containerRect.width - cardWidth / 2));
                      y = Math.max(cardHeight, Math.min(y, containerRect.height - 10));
                    }
                    setCardPos({ x, y });
                  }}
                  onMouseMove={e => {
                    const svgRect = svgRef.current?.getBoundingClientRect();
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    let x = e.clientX - (svgRect?.left ?? 0);
                    let y = e.clientY - (svgRect?.top ?? 0);
                    if (containerRect) {
                      const cardWidth = 240, cardHeight = 180;
                      x = Math.max(cardWidth / 2, Math.min(x, containerRect.width - cardWidth / 2));
                      y = Math.max(cardHeight, Math.min(y, containerRect.height - 10));
                    }
                    setCardPos({ x, y });
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    setHoverGeo(null);
                    setCardPos(null);
                  }}
                  onDoubleClick={() => {
                    setSidebar({ iso, geo });
                  }}
                  style={{ cursor: "pointer", transition: "fill 0.2s" }}
                />
              ));
          })}
        </svg>
        {hovered && cardPos && travelData[hovered] && travelData[hovered].photos && travelData[hovered].photos.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: cardPos.x,
              top: cardPos.y,
              transform: "translate(-50%, -110%)",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              padding: 0,
              zIndex: 10,
              minWidth: 180,
              maxWidth: 240,
              pointerEvents: "none"
            }}
          >
            <div style={{ display: 'flex', gap: 4, padding: 8, justifyContent: 'center', alignItems: 'center' }}>
              {travelData[hovered].photos.map((p, i) => (
                <img
                  key={i}
                  src={`${basePath}${p}`}
                  alt={hovered + " photo"}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
              ))}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: '#222' }}>{getCountryName(hoverGeo, travelData)}</div>
            </div>
          </div>
        )}
        {sidebar && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 340,
            height: '100vh',
            background: '#fff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
            zIndex: 100,
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <button onClick={() => setSidebar(null)} style={{ alignSelf: 'flex-end', marginBottom: 16, background: '#eee', border: 'none', borderRadius: 8, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <h2 style={{ margin: 0, marginBottom: 8, color: '#222' }}>{getCountryName(sidebar.geo, travelData)} ({sidebar.iso})</h2>
            <div style={{ marginBottom: 12, color: '#888', fontSize: 15 }}>
              {travelData[sidebar.iso]?.dates.map((d, i) => (
                <div key={i}>Start: {d.dateStart}, End: {d.dateEnd}</div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              {travelData[sidebar.iso]?.photos.map((p, i) => (
                <img
                  key={i}
                  src={`${basePath}${p}`}
                  alt={sidebar.iso + " photo"}
                  style={{ width: '100%', borderRadius: 10, marginBottom: 8 }}
                />
              ))}
            </div>
            {sidebarComment && (
              <div style={{ fontStyle: 'italic', color: '#666', fontSize: 15 }}>{sidebarComment}</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
