import React from 'react';
import {
    Navigation,
    MapPin,
    Clock,
    Download,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Copy
} from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import SectionHeader from './ui/SectionHeader';
import StatusBadge from './ui/StatusBadge';

const RouteDetails = ({ items, info, stopStatuses = {}, onMarkDone, onMarkFailed, onCopyAddress }) => {
    const fuelPrice = 5.80;
    const autonomy = 12;

    if (!items || items.length === 0) return null;

    const totalKmNum = info?.distance ? (info.distance / 1000) : 0;
    const totalKm = totalKmNum.toFixed(1);
    const totalMinutes = info?.duration ? Math.round(info.duration / 60) : 0;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const estimatedFuelCost = (totalKmNum / autonomy) * fuelPrice;
    const estimatedDeliveryTime = totalMinutes + (items.length * 5);

    const openGoogleMaps = () => {
        if (items.length < 2) return;
        const origin = items[0].address;
        const waypoints = items.slice(1, -1).map((i) => i.address).join('|');
        const destination = items[items.length - 1].address;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const openWaze = () => {
        const next = items.find((item, idx) => idx > 0 && stopStatuses[String(item.id)] !== 'done');
        if (!next?.coords) return;
        const stop = `${next.coords.lat},${next.coords.lon}`;
        const url = `https://waze.com/ul?ll=${stop}&navigate=yes`;
        window.open(url, '_blank');
    };

    const exportCSV = () => {
        const headers = ['Ordem', 'Status', 'Endereço', 'Lat', 'Lon', 'Estimativa Chegada'];
        const rows = items.map((item, idx) => [
            idx + 1,
            idx === 0 ? 'partida' : (stopStatuses[String(item.id)] || 'pending'),
            `"${item.address.replace(/"/g, '""')}"`,
            item.coords?.lat || '',
            item.coords?.lon || '',
            `+${idx * 5} min`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'rota_profissional_mestra.csv');
        link.click();
    };

    const statusMeta = (item, idx) => {
        if (idx === 0) return { label: 'Partida', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)' };
        const value = stopStatuses[String(item.id)] || 'pending';
        if (value === 'done') return { label: 'Entregue', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)' };
        if (value === 'failed') return { label: 'Falhou', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' };
        return { label: 'Pendente', color: '#2563eb', background: 'var(--bg)' };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>DISTÂNCIA TOTAL</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalKm} km</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                        <Clock size={10} /> {hours}h {mins}m direção
                    </div>
                </div>
                <div className="card" style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '1rem' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>CUSTO DE COMBUSTÍVEL</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>R$ {estimatedFuelCost.toFixed(2)}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>Ref: R$ {fuelPrice.toFixed(2)}/L</div>
                </div>
            </div>

            <div className="card" style={{ padding: '0.75rem', background: '#eff6ff' }}>
                <div style={{ fontSize: '0.78rem', color: '#1e40af' }}>
                    Tempo total estimado com paradas: <b>{Math.floor(estimatedDeliveryTime / 60)}h {estimatedDeliveryTime % 60}m</b>.
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Button variant="primary" onClick={openGoogleMaps}>
                    <ExternalLink size={18} /> Google Maps
                </Button>
                <Button variant="outline" onClick={openWaze}>
                    <Navigation size={18} /> Navegar no Waze
                </Button>
            </div>

            <Card style={{ padding: '1rem' }}>
                <SectionHeader
                    title={(
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                            <MapPin size={18} color="var(--primary)" /> Sequência de Entregas
                        </span>
                    )}
                    actions={(
                        <Button variant="outline" className="btn-icon" onClick={exportCSV} title="Exportar para Excel/CSV">
                            <Download size={18} />
                        </Button>
                    )}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '460px', overflowY: 'auto' }}>
                    {items.map((item, idx) => {
                        const meta = statusMeta(item, idx);
                        const badgeTone = meta.label === 'Entregue' ? 'success' : meta.label === 'Falhou' ? 'error' : meta.label === 'Pendente' ? 'warning' : 'info';
                        return (
                            <div key={item.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.55rem',
                                padding: '0.75rem',
                                borderRadius: '10px',
                                background: meta.background,
                                border: `1px solid ${idx === 0 ? 'var(--success)' : 'var(--border)'}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: meta.color,
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
                                            {idx === 0 ? 'Ponto de Partida' : item.address}
                                        </p>
                                        <StatusBadge tone={badgeTone} label={meta.label} />
                                    </div>
                                </div>
                                {idx > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
                                        <Button variant="outline" size="sm" onClick={() => onCopyAddress?.(item.address)}>
                                            <Copy size={14} /> Copiar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => onMarkDone?.(idx)}>
                                            <CheckCircle2 size={14} /> Concluir
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => onMarkFailed?.(idx)}>
                                            <XCircle size={14} /> Falha
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Rota calculada com OSRM e acompanhamento operacional.
                </p>
            </div>
        </div>
    );
};

export default RouteDetails;
