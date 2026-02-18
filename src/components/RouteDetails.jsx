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

const RouteDetails = ({ items, stopStatuses = {}, onMarkDone, onMarkFailed, onCopyAddress, onActionFeedback }) => {
    const [searchTerm, setSearchTerm] = React.useState('');

    if (!items || items.length === 0) return null;

    const openGoogleMaps = () => {
        if (items.length < 2) {
            onActionFeedback?.('Adicione pelo menos duas paradas para abrir no Google Maps.', 'info');
            return;
        }
        const origin = items[0].address;
        const waypoints = items.slice(1, -1).map((i) => i.address).join('|');
        const destination = items[items.length - 1].address;
        const waypointsParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openNextStopGoogleMaps = () => {
        const next = items.find((item, idx) => idx > 0 && (stopStatuses[String(item.id)] || 'pending') === 'pending');
        if (!next) {
            onActionFeedback?.('Nenhuma parada pendente para navegação.', 'info');
            return;
        }
        const destination = next.coords
            ? `${next.coords.lat},${next.coords.lon}`
            : next.address;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const exportCSV = () => {
        const headers = ['Ordem', 'Status', 'Endereço', 'Observação', 'Lat', 'Lon', 'Estimativa Chegada'];
        const rows = items.map((item, idx) => [
            idx + 1,
            idx === 0 ? 'partida' : (stopStatuses[String(item.id)] || 'pending'),
            `"${item.address.replace(/"/g, '""')}"`,
            `"${String(item.observation || '').replace(/"/g, '""')}"`,
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
        onActionFeedback?.('Arquivo CSV exportado com sucesso.', 'success');
    };

    const statusMeta = (item, idx) => {
        if (idx === 0) return { label: 'Partida', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        const value = stopStatuses[String(item.id)] || 'pending';
        if (value === 'done') return { label: 'Entregue', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        if (value === 'failed') return { label: 'Falha', color: '#ef4444', background: 'rgba(239, 68, 68, 0.06)' };
        return { label: 'Pendente', color: '#3b82f6', background: 'var(--bg)' };
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const indexedItems = items.map((item, idx) => ({ item, idx }));
    const filteredItems = indexedItems.filter(({ item, idx }) =>
        String(item.address || '').toLowerCase().includes(normalizedSearch) ||
        String(idx + 1).includes(normalizedSearch)
    );
    const showSearch = items.length > 20;
    const hasPendingStop = items.some((item, idx) => idx > 0 && (stopStatuses[String(item.id)] || 'pending') === 'pending');
    const hasRouteToOpen = items.length >= 2;

    const handlePrint = () => {
        if (items.length === 0) {
            onActionFeedback?.('Não há dados para imprimir.', 'info');
            return;
        }
        window.print();
    };

    return (
        <div className="route-details-wrap">
            <Card style={{ padding: '1rem' }}>
                <SectionHeader
                    title={(
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                            <MapPin size={17} color="var(--primary)" /> Lista de paradas
                        </span>
                    )}
                    actions={(
                        <Button variant="outline" className="btn-icon" onClick={exportCSV} title="Baixar CSV" aria-label="Baixar CSV">
                            <Download size={17} />
                        </Button>
                    )}
                />

                {showSearch && (
                    <div className="route-search-wrap">
                        <Search size={14} className="route-search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por endereço ou número da parada..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="route-search-input"
                        />
                    </div>
                )}

                <div className="route-stops-scroll custom-scroll">
                    {filteredItems.map(({ item, idx }) => {
                        const meta = statusMeta(item, idx);
                        const badgeTone = meta.label === 'Entregue' ? 'success' : meta.label === 'Falha' ? 'error' : meta.label === 'Pendente' ? 'warning' : 'info';
                        return (
                            <div key={item.id} className="route-stop-item" style={{ background: meta.background, borderColor: idx === 0 ? 'var(--success)' : undefined }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                                    <div className="route-stop-number" style={{ background: meta.color }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {idx === 0 ? 'Ponto de Partida' : item.address}
                                        </p>
                                        {idx > 0 && item.observation && (
                                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.08rem' }}>
                                                Ref.: {item.observation}
                                            </p>
                                        )}
                                        <StatusBadge tone={badgeTone} label={meta.label} />
                                    </div>
                                </div>
                                {idx > 0 && (
                                    <div className="route-stop-actions">
                                        <Button variant="success" size="sm" className="route-stop-mini-btn" onClick={() => onMarkDone?.(idx)}>
                                            <CheckCircle2 size={13} /> Entregue
                                        </Button>
                                        <Button variant="danger" size="sm" className="route-stop-mini-btn" onClick={() => onMarkFailed?.(idx)}>
                                            <XCircle size={13} /> Falha
                                        </Button>
                                        <Button variant="outline" size="sm" className="route-stop-mini-btn" onClick={() => onCopyAddress?.(item.address)}>
                                            <Copy size={13} /> Copiar endereço
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card style={{ padding: '0.9rem' }}>
                <SectionHeader title="Navegação externa" subtitle="Abra a próxima entrega ou a rota completa." />
                <div className="route-external-actions">
                    <Button variant="primary" onClick={openNextStopGoogleMaps} disabled={!hasPendingStop}>
                        <Navigation size={16} /> Navegar para próxima parada
                    </Button>
                    <Button variant="outline" onClick={openGoogleMaps} disabled={!hasRouteToOpen}>
                        <ExternalLink size={16} /> Abrir rota completa
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} style={{ gridColumn: '1 / -1' }} disabled={items.length === 0}>
                        Imprimir lista de paradas
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default RouteDetails;
