import React from 'react';
import { Clock, Trash2, MapPin } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const HistoryPanel = ({ routeHistory, onClear, onLoad }) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={17} color="var(--primary)" /> Histórico de Rotas
                    </span>
                )}
                actions={(
                    <Button variant="outline" size="sm" onClick={onClear} disabled={routeHistory.length === 0}>
                        <Trash2 size={14} /> Limpar
                    </Button>
                )}
            />
            {routeHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <Clock size={32} color="var(--border)" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma rota salva ainda.</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Rotas otimizadas aparecerão aqui.</p>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
                {routeHistory.map((entry) => (
                    <button
                        key={entry.id}
                        className="btn btn-outline"
                        style={{ justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '0.7rem 0.9rem' }}
                        onClick={() => onLoad(entry)}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={14} color="var(--primary)" />
                            <span>{entry.title}</span>
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {entry.items?.length || 0} paradas
                        </span>
                    </button>
                ))}
            </div>
        </Card>
    );
};

export default HistoryPanel;
