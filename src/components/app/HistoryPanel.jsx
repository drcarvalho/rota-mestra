import React from 'react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const HistoryPanel = ({ routeHistory, onClear, onLoad }) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title="Historico de Rotas"
                actions={(
                    <Button variant="outline" size="sm" onClick={onClear} disabled={routeHistory.length === 0}>
                        Limpar historico
                    </Button>
                )}
            />
            {routeHistory.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma rota salva ainda.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto' }}>
                {routeHistory.map((entry) => (
                    <button
                        key={entry.id}
                        className="btn btn-outline"
                        style={{ justifyContent: 'space-between', width: '100%', textAlign: 'left' }}
                        onClick={() => onLoad(entry)}
                    >
                        <span>{entry.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.items?.length || 0} paradas</span>
                    </button>
                ))}
            </div>
        </Card>
    );
};

export default HistoryPanel;
