import React from 'react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const SettingsPanel = ({ onClearWorkspace, onClearHistory }) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader title="Preferencias" />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                O sistema salva automaticamente seu progresso no navegador.
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <Button variant="outline" onClick={onClearWorkspace}>
                    Limpar sessao salva
                </Button>
                <Button variant="outline" onClick={onClearHistory}>
                    Limpar historico de rotas
                </Button>
            </div>
        </Card>
    );
};

export default SettingsPanel;
