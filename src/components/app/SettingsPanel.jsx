import React from 'react';
import { 
    Settings, Trash2, History, Moon, Sun, LayoutGrid, Download, CheckCircle2,
    Cpu, Database, Smartphone, Activity
} from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const SettingsPanel = ({
    onClearWorkspace,
    onClearHistory,
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
        <Card className="animate-fade-in settings-card-premium">
            <SectionHeader
                title={(
                    <span className="settings-title-glow">
                        <Settings size={18} className="icon-pulse" /> Ajustes do Sistema
                    </span>
                )}
                subtitle="Configure e limpe dados do seu workspace"
            />

            <div className="settings-body-premium">
                {/* 1. CONFIGURAÇÕES DA ROTA */}
                <div className="settings-section">
                    <h4 className="settings-section-title">
                        <Cpu size={14} /> Mecanismo de Rota
                    </h4>
                    <div className="settings-section-content">
                        <div className="config-option-premium">
                            <label className="config-label-premium">Modo de Geocodificação</label>
                            <select 
                                value={geocodeMode} 
                                onChange={(e) => onChangeGeocodeMode(e.target.value)}
                                className="premium-select"
                            >
                                <option value="fast">Rápido (Recomendado - OSM)</option>
                                <option value="accurate">Preciso (Osm/Lookup extra)</option>
                            </select>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onClearGeocodeCache} 
                            className="premium-action-btn"
                        >
                            <Trash2 size={13} /> Limpar cache de busca
                        </Button>
                    </div>
                </div>

                {/* 2. PREFERÊNCIAS & APP */}
                <div className="settings-section">
                    <h4 className="settings-section-title">
                        <Smartphone size={14} /> Preferências & Instalação
                    </h4>
                    <div className="settings-section-content grid-2-columns">
                        <Button variant="outline" size="sm" onClick={onToggleTheme} className="premium-action-btn justify-start">
                            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                            {isDarkMode ? 'Tema Claro' : 'Tema Escuro'}
                        </Button>
                        {!isAppInstalled ? (
                            <Button variant="primary" size="sm" onClick={onInstallApp} className="premium-action-btn justify-start">
                                <Download size={14} /> Instalar no Celular
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" disabled className="premium-action-btn justify-start text-success">
                                <CheckCircle2 size={14} /> App Instalado
                            </Button>
                        )}
                    </div>
                </div>

                {/* 3. DIAGNÓSTICO E PERFORMANCE */}
                <div className="settings-section">
                    <h4 className="settings-section-title">
                        <Activity size={14} /> Métricas da Última Otimização
                    </h4>
                    <div className="metrics-grid-premium">
                        <div className="metric-box-premium">
                            <span className="metric-box-value">
                                {Math.round((geocodeMetrics?.durationMs || 0) / 1000)}s
                            </span>
                            <span className="metric-box-label">Tempo Gasto</span>
                        </div>
                        <div className="metric-box-premium">
                            <span className="metric-box-value">
                                {geocodeMetrics?.uniqueAddresses || 0}
                            </span>
                            <span className="metric-box-label">Endereços</span>
                        </div>
                        <div className="metric-box-premium">
                            <span className="metric-box-value">
                                {geocodeMetrics?.cacheHits || 0}
                            </span>
                            <span className="metric-box-label">Cache Hits</span>
                        </div>
                        <div className="metric-box-premium">
                            <span className="metric-box-value text-success-light">
                                {geocodeMetrics?.successCount || 0}
                            </span>
                            <span className="metric-box-label">Sucessos</span>
                        </div>
                    </div>
                </div>

                {/* 4. DADOS E SEGURANÇA */}
                <div className="settings-section">
                    <h4 className="settings-section-title">
                        <Database size={14} /> Armazenamento Local
                    </h4>
                    <div className="settings-section-content grid-2-columns">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onClearWorkspace} 
                            className="premium-action-btn justify-start btn-danger-soft"
                        >
                            <Trash2 size={14} /> Limpar Rota
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onClearHistory} 
                            className="premium-action-btn justify-start btn-danger-soft"
                        >
                            <History size={14} /> Limpar Histórico
                        </Button>
                    </div>
                </div>

                {/* FOOTER QUICK ACTION */}
                <div className="settings-section-footer">
                    <Button variant="primary" onClick={onBackToOptimizer} fullWidth className="premium-back-btn">
                        <LayoutGrid size={15} /> Voltar ao Planejamento
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SettingsPanel;
