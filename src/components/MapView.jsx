import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// CSS already imported in index.html for reliability

function ChangeView({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            try {
                map.fitBounds(bounds, { padding: [50, 50] });
            } catch (err) {
                console.warn('Map fitBounds error:', err);
            }
        }
    }, [bounds, map]);
    return null;
}

const MapView = ({ items, routeGeometry }) => {
    const hasValidCoords = (item) =>
        Boolean(
            item?.coords &&
            Number.isFinite(item.coords.lat) &&
            Number.isFinite(item.coords.lon)
        );

    const coords = useMemo(() => {
        return items
            .filter(hasValidCoords)
            .map(item => [item.coords.lat, item.coords.lon]);
    }, [items]);

    const polyline = useMemo(() => {
        if (!routeGeometry || !routeGeometry.coordinates) return null;
        return routeGeometry.coordinates.map(c => [c[1], c[0]]);
    }, [routeGeometry]);

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative', background: '#e5e7eb' }}>
            <MapContainer
                center={[-15.78, -47.93]}
                zoom={4}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {items.map((item, idx) => (
                    hasValidCoords(item) && (
                        <Marker
                            key={`stop-${item.id}-${idx}`}
                            position={[item.coords.lat, item.coords.lon]}
                            icon={L.divIcon({
                                className: 'custom-div-icon',
                                html: `<div style="background-color: ${idx === 0 ? '#10b981' : '#2563eb'}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                                iconSize: [28, 28],
                                iconAnchor: [14, 14]
                            })}
                        >
                            <Popup>
                                <div style={{ textAlign: 'center' }}>
                                    <strong style={{ color: idx === 0 ? 'var(--success)' : 'var(--primary)' }}>
                                        {idx === 0 ? '🏠 INÍCIO' : `ENTREGA ${idx + 1}`}
                                    </strong>
                                    <p style={{ margin: '5px 0 0', fontSize: '12px' }}>{item.address}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}

                {polyline && (
                    <Polyline
                        positions={polyline}
                        color="#2563eb"
                        weight={5}
                        opacity={0.7}
                        dashArray="10, 10"
                    />
                )}

                {coords.length > 0 && <ChangeView bounds={coords} />}
            </MapContainer>

            {items.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, textAlign: 'center', background: 'rgba(255,255,255,0.9)', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Aguardando endereços...</p>
                </div>
            )}
        </div>
    );
};

export default MapView;
