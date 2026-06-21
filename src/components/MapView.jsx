import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { buildStopGroups } from '../utils/stopGrouping';

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

const LIGHT_TILE_PROVIDERS = [
    {
        key: 'carto-light',
        name: 'Carto Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd'
    },
    {
        key: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abc'
    },
    {
        key: 'esri',
        name: 'Esri',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
    }
];

const DARK_TILE_PROVIDERS = [
    {
        key: 'carto-dark',
        name: 'Carto Dark Matter',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd'
    },
    {
        key: 'osm-dark',
        name: 'OpenStreetMap Dark',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abc'
    }
];

const MapView = ({ items, routeGeometry, stopStatuses = {}, nextStopIndex = -1, deliveryCountMode = 'packages', isVisible = true, isDarkMode = false }) => {
    const [providerIdx, setProviderIdx] = useState(0);
    const [hasLoadedTile, setHasLoadedTile] = useState(false);
    const tileErrorCountRef = useRef(0);

    const providers = isDarkMode ? DARK_TILE_PROVIDERS : LIGHT_TILE_PROVIDERS;
    const activeIdx = Math.min(providerIdx, providers.length - 1);
    const provider = providers[activeIdx];

    const hasValidCoords = (item) =>
        Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));

    const itemIndexById = useMemo(() => {
        const map = new Map();
        items.forEach((item, idx) => map.set(String(item.id), idx));
        return map;
    }, [items]);

    const groupedStops = useMemo(() => {
        const groups = buildStopGroups(items);
        return groups
            .map((group) => {
                const packagesWithCoords = group.items.filter(hasValidCoords);
                if (packagesWithCoords.length === 0) return null;
                const firstPackage = packagesWithCoords[0];
                const stats = group.items.reduce((acc, pkg) => {
                    const statusValue = stopStatuses[String(pkg.id)] || 'pending';
                    if (statusValue === 'done') acc.done += 1;
                    else if (statusValue === 'failed') acc.failed += 1;
                    else acc.pending += 1;
                    return acc;
                }, { done: 0, failed: 0, pending: 0 });
                const hasNext = group.items.some((pkg) => String(pkg.id) === String(items[nextStopIndex]?.id));
                let status = 'pending';
                if (stats.pending === 0 && stats.failed > 0) status = 'failed';
                if (stats.pending === 0 && stats.failed === 0) status = 'done';
                if (hasNext) status = 'next';
                return {
                    id: `stop-group-${group.key}`,
                    stopOrder: group.stopOrder,
                    markerItem: firstPackage,
                    packages: group.items,
                    indices: group.indices,
                    stats,
                    status
                };
            })
            .filter(Boolean);
    }, [items, nextStopIndex, stopStatuses]);

    const coords = useMemo(() => {
        if (deliveryCountMode === 'stops') {
            const stopCoords = groupedStops.map((stop) => [stop.markerItem.coords.lat, stop.markerItem.coords.lon]);
            if (hasValidCoords(items[0])) {
                return [[items[0].coords.lat, items[0].coords.lon], ...stopCoords];
            }
            return stopCoords;
        }
        return items.filter(hasValidCoords).map((item) => [item.coords.lat, item.coords.lon]);
    }, [deliveryCountMode, groupedStops, items]);

    const polyline = useMemo(() => {
        if (!routeGeometry || !routeGeometry.coordinates) return null;
        return routeGeometry.coordinates.map((c) => [c[1], c[0]]);
    }, [routeGeometry]);

    const handleTileError = () => {
        tileErrorCountRef.current += 1;
        if (tileErrorCountRef.current < 8) return;
        tileErrorCountRef.current = 0;
        setHasLoadedTile(false);
        setProviderIdx((idx) => (idx + 1) % providers.length);
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

                {deliveryCountMode === 'stops' ? (
                    <>
                        {hasValidCoords(items[0]) && (
                            <Marker
                                key={`stop-start-${items[0].id}`}
                                position={[items[0].coords.lat, items[0].coords.lon]}
                                icon={L.divIcon({
                                    className: 'custom-div-icon',
                                    html: '<div style="background-color:#10b981;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:3px solid #fff;box-shadow:0 3px 6px rgba(0,0,0,0.3);">S</div>',
                                    iconSize: [30, 30],
                                    iconAnchor: [15, 15]
                                })}
                            >
                                <Popup>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ color: '#10b981' }}>INÍCIO</strong>
                                        <p style={{ margin: '5px 0 0', fontSize: '12px' }}>{items[0].address}</p>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                        {groupedStops.map((stop) => {
                        const markerColor = stop.status === 'done' ? '#10b981' : stop.status === 'failed' ? '#ef4444' : stop.status === 'next' ? '#f59e0b' : '#2563eb';
                        const markerSize = stop.status === 'next' ? 38 : 30;
                        const markerShadow = stop.status === 'next'
                            ? '0 0 0 6px rgba(245,158,11,0.22), 0 6px 12px rgba(0,0,0,0.35)'
                            : '0 3px 6px rgba(0,0,0,0.3)';
                        const pendingPackages = stop.packages.filter((pkg) => (stopStatuses[String(pkg.id)] || 'pending') === 'pending');
                        return (
                            <Marker
                                key={stop.id}
                                position={[stop.markerItem.coords.lat, stop.markerItem.coords.lon]}
                                icon={L.divIcon({
                                    className: 'custom-div-icon',
                                    html: `<div style="background-color:${markerColor};color:white;width:${markerSize}px;height:${markerSize}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:${markerShadow};">${stop.stopOrder}</div>`,
                                    iconSize: [markerSize, markerSize],
                                    iconAnchor: [markerSize / 2, markerSize / 2]
                                })}
                            >
                                <Popup>
                                    <div style={{ minWidth: '240px' }}>
                                        <strong style={{ color: markerColor }}>
                                            Parada {stop.stopOrder} · {stop.packages.length} pacote(s)
                                        </strong>
                                        <p style={{ margin: '5px 0 8px', fontSize: '12px' }}>{stop.markerItem.address}</p>
                                        <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b' }}>
                                            Pendentes agora: {pendingPackages.length}
                                        </p>
                                        <div style={{ display: 'grid', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                                            {(pendingPackages.length ? pendingPackages : stop.packages).map((pkg) => {
                                                const pkgStatus = stopStatuses[String(pkg.id)] || 'pending';
                                                const pkgLabel = pkgStatus === 'done' ? 'Entregue' : pkgStatus === 'failed' ? 'Não entregue' : 'Pendente';
                                                const pkgIdx = itemIndexById.get(String(pkg.id)) ?? -1;
                                                return (
                                                    <div key={pkg.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px' }}>
                                                        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700 }}>Pacote #{pkgIdx + 1}</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: '11px' }}>{pkg.address}</p>
                                                        {pkg.observation && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Ref.: {pkg.observation}</p>}
                                                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Status: {pkgLabel}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {pendingPackages.length > 0 && pendingPackages.length < stop.packages.length && (
                                            <details style={{ marginTop: '8px' }}>
                                                <summary style={{ cursor: 'pointer', fontSize: '11px', color: '#334155', fontWeight: 700 }}>
                                                    Ver todos os pacotes
                                                </summary>
                                                <div style={{ display: 'grid', gap: '6px', maxHeight: '120px', overflowY: 'auto', marginTop: '6px' }}>
                                                    {stop.packages.map((pkg) => {
                                                        const pkgStatus = stopStatuses[String(pkg.id)] || 'pending';
                                                        const pkgLabel = pkgStatus === 'done' ? 'Entregue' : pkgStatus === 'failed' ? 'Não entregue' : 'Pendente';
                                                        const pkgIdx = itemIndexById.get(String(pkg.id)) ?? -1;
                                                        return (
                                                            <div key={`all-${pkg.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px' }}>
                                                                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700 }}>Pacote #{pkgIdx + 1}</p>
                                                                <p style={{ margin: '2px 0 0', fontSize: '11px' }}>{pkg.address}</p>
                                                                {pkg.observation && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Ref.: {pkg.observation}</p>}
                                                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Status: {pkgLabel}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                    </>
                ) : (
                    items.map((item, idx) => {
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
                    })
                )}

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
                    <p>Aguardando endereços da planilha...</p>
                </div>
            )}

            <div className="map-overlay-card map-overlay-provider">
                Mapa base: {provider.name}
            </div>

            {!hasLoadedTile && (
                <div className="map-overlay-card map-overlay-warning">
                    <p>Carregando mapa. Se travar, toque em "Trocar mapa".</p>
                    <button
                        type="button"
                        className="map-overlay-button"
                        onClick={() => {
                            setHasLoadedTile(false);
                            tileErrorCountRef.current = 0;
                            setProviderIdx((idx) => (idx + 1) % providers.length);
                        }}
                    >
                        Trocar mapa
                    </button>
                </div>
            )}
        </div>
    );
};

export default MapView;
