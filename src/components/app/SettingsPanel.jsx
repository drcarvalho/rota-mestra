import React from 'react';
import { Settings, Trash2, History, Moon, Sun, LayoutGrid, Download, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const SettingsPanel = ({
    onClearWorkspace,
    onClearHistory,
    onOpenHistory,
    onBackToOptimizer,
    onToggleTheme,
    isDarkMode,
    onInstallApp,
    isAppInstalled,
    geocodeMode,
    onChangeGeocodeMode,
    geocodeMetrics,
    onClearGeocodeCache
}) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={17} color="var(--primary)" /> Ajustes
                    </span>
                )}
                subtitle="Ajuste o app e limpe dados quando precisar."
            />

            <div className="settings-body">
                <p className="settings-intro">
                    Opções rápidas do dia a dia.
                </p>

                <div className="config-option">
                    <span className="config-label">Modo de geocodificação</span>
                    <select value={geocodeMode} onChange={(e) => onChangeGeocodeMode(e.target.value)}>
                        <option value="fast">Rápido (recomendado)</option>
                        <option value="accurate">Preciso (mais lento)</option>
                    </select>
                </div>

                <div className="settings-metrics">
                    <p><b>Última execução:</b> {Math.round((geocodeMetrics?.durationMs || 0) / 1000)}s</p>
                    <p><b>Endereços únicos:</b> {geocodeMetrics?.uniqueAddresses || 0} · <b>2ª fase:</b> {geocodeMetrics?.secondPassLookups || 0}</p>
                    <p><b>Cache:</b> {geocodeMetrics?.cacheHits || 0} hit(s) / {geocodeMetrics?.cacheMisses || 0} miss(es)</p>
                    <p><b>Requests:</b> {geocodeMetrics?.networkRequests || 0} · <b>Sucesso:</b> {geocodeMetrics?.successCount || 0} · <b>Falha:</b> {geocodeMetrics?.errorCount || 0}</p>
                </div>

                {/* Actions */}
                <div className="settings-actions">
                    <Button variant="outline" onClick={onBackToOptimizer} fullWidth>
                        <LayoutGrid size={15} /> Voltar para início
                    </Button>
                    <Button variant="outline" onClick={onOpenHistory} fullWidth>
                        <History size={15} /> Ver histórico
                    </Button>
                    <Button variant="outline" onClick={onToggleTheme} fullWidth>
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                        {isDarkMode ? 'Usar tema claro' : 'Usar tema escuro'}
                    </Button>
                    {!isAppInstalled && (
                        <Button variant="primary" onClick={onInstallApp} fullWidth>
                            <Download size={15} /> Instalar app no celular
                        </Button>
                    )}
                    {isAppInstalled && (
                        <Button variant="outline" disabled fullWidth>
                            <CheckCircle2 size={15} /> App já instalado
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClearGeocodeCache} fullWidth>
                        <Trash2 size={15} /> Limpar cache de geocodificação
                    </Button>
                    <Button variant="outline" onClick={onClearWorkspace} fullWidth>
                        <Trash2 size={15} /> Limpar rota atual
                    </Button>
                    <Button variant="outline" onClick={onClearHistory} fullWidth>
                        <History size={15} /> Limpar histórico
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SettingsPanel;
