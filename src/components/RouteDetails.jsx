import React, { useState, useEffect } from 'react';
import {
    Navigation,
    MapPin,
    Clock,
    Route as RouteIcon,
    Download,
    ExternalLink,
    ChevronRight,
    Info,
    DollarSign,
    Fuel
} from 'lucide-react';

const RouteDetails = ({ items, info }) => {
    const [fuelPrice, setFuelPrice] = useState(5.80); // Default Brazilian price approx
    const [autonomy, setAutonomy] = useState(12); // 12 km/L average

    if (!items || items.length === 0) return null;

    const totalKmNum = info?.distance ? (info.distance / 1000) : 0;
    const totalKm = totalKmNum.toFixed(1);
    const totalMinutes = info?.duration ? Math.round(info.duration / 60) : 0;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Professional Cost Estimation
    const estimatedFuelCost = (totalKmNum / autonomy) * fuelPrice;
    const estimatedDeliveryTime = totalMinutes + (items.length * 5); // Adding 5 mins per delivery

    const openGoogleMaps = () => {
        if (items.length < 2) return;
        const origin = items[0].address;
        const waypoints = items.slice(1, -1).map(i => i.address).join('|');
        const destination = items[items.length - 1].address;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const openWaze = () => {
        if (items.length < 2 || !items[1].coords) return;
        const stop = `${items[1].coords.lat},${items[1].coords.lon}`;
        const url = `https://waze.com/ul?ll=${stop}&navigate=yes`;
        window.open(url, '_blank');
    };

    const exportCSV = () => {
        const headers = ['Ordem', 'Endereço', 'Lat', 'Lon', 'Estimativa Chegada'];
        const rows = items.map((item, idx) => [
            idx + 1,
            `"${item.address.replace(/"/g, '""')}"`,
            item.coords?.lat || '',
            item.coords?.lon || '',
            `+${idx * 5} min`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'rota_profissional_mestra.csv');
        link.click();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.5s ease' }}>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>ROTA TOTAL</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalKm} km</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                        <Clock size={10} inline /> {hours}h {mins}m direção
                    </div>
                </div>
                <div className="card" style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '1rem' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>CUSTO COMBUSTÍVEL</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>R$ {estimatedFuelCost.toFixed(2)}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                        Ref: R$ {fuelPrice.toFixed(2)}/L
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#eff6ff' }}>
                <div style={{ background: 'white', p: '8px', borderRadius: '8px', boxShadow: 'var(--shadow)' }}>
                    <Info size={16} color="var(--primary)" />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                    Tempo total estimado com as entregas: <b>{Math.floor(estimatedDeliveryTime / 60)}h {estimatedDeliveryTime % 60}m</b>.
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={openGoogleMaps}>
                    <ExternalLink size={18} /> Google Maps
                </button>
                <button className="btn btn-outline" onClick={openWaze}>
                    <Navigation size={18} /> Abrir Waze
                </button>
            </div>

            {/* Stop List */}
            <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                        <MapPin size={18} color="var(--primary)" /> Sequência Otimizada
                    </h4>
                    <button className="btn btn-outline btn-icon" onClick={exportCSV} title="Exportar para Excel/CSV">
                        <Download size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {items.map((item, idx) => (
                        <div key={item.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            background: idx === 0 ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)',
                            border: `1px solid ${idx === 0 ? 'var(--success)' : 'var(--border)'}`,
                        }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: idx === 0 ? 'var(--success)' : 'var(--primary)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                flexShrink: 0
                            }}>
                                {idx + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {idx === 0 ? '🏠 Ponto de Partida' : item.address}
                                </p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {idx === 0 ? 'Início da jornada' : `Parada ${idx}`}
                                </p>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Calculado via OSRM Trip API (Professional TSP Engine)
                </p>
            </div>
        </div>
    );
};

export default RouteDetails;
