import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

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

function EnsureMapResize({ isVisible }) {
    const map = useMap();
    useEffect(() => {
        const runInvalidate = () => {
            try {
                map.invalidateSize();
            } catch {
                // noop
            }
        };

        const t1 = setTimeout(runInvalidate, 150);
        const t2 = setTimeout(runInvalidate, 700);

        const onResize = () => runInvalidate();
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        document.addEventListener('visibilitychange', onResize);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            document.removeEventListener('visibilitychange', onResize);
        };
    }, [map]);

    useEffect(() => {
        if (!isVisible) return;
        const timer = setTimeout(() => {
            try {
                map.invalidateSize();
            } catch {
                // noop
            }
        }, 120);
        return () => clearTimeout(timer);
    }, [isVisible, map]);

    return null;
}

const TILE_PROVIDERS = [
    {
        key: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abc'
    },
    {
        key: 'carto',
        name: 'Carto',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd'
    },
    {
        key: 'esri',
        name: 'Esri',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
    }
];

const MapView = ({ items, routeGeometry, stopStatuses = {}, nextStopIndex = -1, isVisible = true }) => {
    const [providerIdx, setProviderIdx] = useState(0);
    const [hasLoadedTile, setHasLoadedTile] = useState(false);
    const tileErrorCountRef = useRef(0);

    const hasValidCoords = (item) =>
        Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));

    const coords = useMemo(() => {
        return items.filter(hasValidCoords).map((item) => [item.coords.lat, item.coords.lon]);
    }, [items]);

    const polyline = useMemo(() => {
        if (!routeGeometry || !routeGeometry.coordinates) return null;
        return routeGeometry.coordinates.map((c) => [c[1], c[0]]);
    }, [routeGeometry]);

    const provider = TILE_PROVIDERS[providerIdx];
    const handleTileError = () => {
        tileErrorCountRef.current += 1;
        if (tileErrorCountRef.current < 8) return;
        tileErrorCountRef.current = 0;
        setHasLoadedTile(false);
        setProviderIdx((idx) => Math.min(idx + 1, TILE_PROVIDERS.length - 1));
    };

    return (
        <div className="map-canvas-wrap">
            <MapContainer
                center={[-22.3156, -49.0606]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
            >
                <TileLayer
                    key={provider.key}
                    attribution={provider.attribution}
                    url={provider.url}
                    subdomains={provider.subdomains}
                    eventHandlers={{
                        tileerror: handleTileError,
                        tileload: () => setHasLoadedTile(true)
                    }}
                />
                <EnsureMapResize isVisible={isVisible} />

                {items.map((item, idx) => {
                    if (!hasValidCoords(item)) return null;
                    const status = idx === 0 ? 'start' : (stopStatuses[String(item.id)] || 'pending');
                    const isNext = idx === nextStopIndex;
                    const markerColor = status === 'done' ? '#10b981' : status === 'failed' ? '#ef4444' : isNext ? '#f59e0b' : '#2563eb';
                    const markerSize = isNext ? 34 : 28;

                    return (
                        <Marker
                            key={`stop-${item.id}-${idx}`}
                            position={[item.coords.lat, item.coords.lon]}
                            icon={L.divIcon({
                                className: 'custom-div-icon',
                                html: `<div style="background-color:${idx === 0 ? '#10b981' : markerColor};color:white;width:${markerSize}px;height:${markerSize}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 3px 6px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                                iconSize: [markerSize, markerSize],
                                iconAnchor: [markerSize / 2, markerSize / 2]
                            })}
                        >
                            <Popup>
                                <div style={{ textAlign: 'center' }}>
                                    <strong style={{ color: idx === 0 ? '#10b981' : markerColor }}>
                                        {idx === 0 ? 'INÍCIO' : isNext ? `PRÓXIMA ${idx + 1}` : `ENTREGA ${idx + 1}`}
                                    </strong>
                                    <p style={{ margin: '5px 0 0', fontSize: '12px' }}>{item.address}</p>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {polyline && (
                    <>
                        {/* Base Route Line */}
                        <Polyline
                            positions={polyline}
                            color="var(--primary)"
                            weight={6}
                            opacity={0.3}
                        />
                        {/* Animated Flow Line */}
                        <Polyline
                            positions={polyline}
                            color="var(--primary)"
                            weight={5}
                            opacity={0.8}
                            dashArray="1, 15"
                            className="leaflet-ant-path"
                        />
                    </>
                )}

                {coords.length > 0 && <ChangeView bounds={coords} />}
            </MapContainer>

            {items.length === 0 && (
                <div className="map-overlay-card map-overlay-empty">
                    <p>Aguardando endereços...</p>
                </div>
            )}

            <div className="map-overlay-card map-overlay-provider">
                Mapa base: {provider.name}
            </div>

            {!hasLoadedTile && (
                <div className="map-overlay-card map-overlay-warning">
                    <p>Carregando mapa. Se não abrir, toque em "Alterar base".</p>
                    <button
                        className="map-overlay-button"
                        onClick={() => {
                            setHasLoadedTile(false);
                            tileErrorCountRef.current = 0;
                            setProviderIdx((idx) => (idx + 1) % TILE_PROVIDERS.length);
                        }}
                    >
                        Alterar base
                    </button>
                </div>
            )}
        </div>
    );
};

export default MapView;
