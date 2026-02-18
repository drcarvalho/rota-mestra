import React from 'react';
import {
    Navigation,
    MapPin,
    Download,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Copy,
    Search
} from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import SectionHeader from './ui/SectionHeader';
import StatusBadge from './ui/StatusBadge';

const RouteDetails = ({ items, stopStatuses = {}, onMarkDone, onMarkFailed, onCopyAddress }) => {
    const [searchTerm, setSearchTerm] = React.useState('');

    if (!items || items.length === 0) return null;

    const openGoogleMaps = () => {
        if (items.length < 2) return;
        const origin = items[0].address;
        const waypoints = items.slice(1, -1).map((i) => i.address).join('|');
        const destination = items[items.length - 1].address;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openWaze = () => {
        const next = items.find((item, idx) => idx > 0 && stopStatuses[String(item.id)] !== 'done');
        if (!next?.coords) return;
        const stop = `${next.coords.lat},${next.coords.lon}`;
        const url = `https://waze.com/ul?ll=${stop}&navigate=yes`;
        window.open(url, '_blank', 'noopener,noreferrer');
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
        if (idx === 0) return { label: 'Partida', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        const value = stopStatuses[String(item.id)] || 'pending';
        if (value === 'done') return { label: 'Entregue', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        if (value === 'failed') return { label: 'Falhou', color: '#ef4444', background: 'rgba(239, 68, 68, 0.06)' };
        return { label: 'Pendente', color: '#3b82f6', background: 'var(--bg)' };
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const indexedItems = items.map((item, idx) => ({ item, idx }));
    const filteredItems = indexedItems.filter(({ item, idx }) =>
        String(item.address || '').toLowerCase().includes(normalizedSearch) ||
        String(idx + 1).includes(normalizedSearch)
    );

    const handlePrint = () => {
        window.print();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'fadeInScale 0.5s ease' }}>
            {/* Route Sequence */}
            <Card style={{ padding: '1rem' }}>
                <SectionHeader
                    title={(
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                            <MapPin size={17} color="var(--primary)" /> Sequência
                        </span>
                    )}
                    actions={(
                        <Button variant="outline" className="btn-icon" onClick={exportCSV} title="Exportar CSV">
                            <Download size={17} />
                        </Button>
                    )}
                />

                {/* Search Bar */}
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar endereço ou parada..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem 0.6rem 2rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            fontSize: '0.8rem',
                            background: 'var(--bg)',
                            color: 'var(--text-main)',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '460px', overflowY: 'auto' }} className="custom-scroll">
                    {filteredItems.map(({ item, idx }) => {
                        const meta = statusMeta(item, idx);
                        const badgeTone = meta.label === 'Entregue' ? 'success' : meta.label === 'Falhou' ? 'error' : meta.label === 'Pendente' ? 'warning' : 'info';
                        return (
                            <div key={item.id} className="route-stop-item" style={{
                                background: meta.background,
                                borderColor: idx === 0 ? 'var(--success)' : undefined
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                                    <div className="route-stop-number" style={{ background: meta.color }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {idx === 0 ? 'Ponto de Partida' : item.address}
                                        </p>
                                        <StatusBadge tone={badgeTone} label={meta.label} />
                                    </div>
                                </div>
                                {idx > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                                        <Button variant="outline" size="sm" onClick={() => onCopyAddress?.(item.address)}>
                                            <Copy size={13} /> Copiar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => onMarkDone?.(idx)}>
                                            <CheckCircle2 size={13} /> Marcar entregue
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => onMarkFailed?.(idx)}>
                                            <XCircle size={13} /> Marcar não entregue
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card style={{ padding: '0.9rem' }}>
                <SectionHeader title="Abrir em aplicativos" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <Button variant="primary" onClick={openWaze}>
                        <Navigation size={16} /> Abrir no Waze
                    </Button>
                    <Button variant="outline" onClick={openGoogleMaps}>
                        <ExternalLink size={16} /> Abrir no Google Maps
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} style={{ gridColumn: '1 / -1' }}>
                        Imprimir comprovante
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default RouteDetails;
