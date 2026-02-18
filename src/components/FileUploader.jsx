import React, { useRef, useState } from 'react';
import { CloudUpload, Upload } from 'lucide-react';
import Card from './ui/Card';

const FileUploader = ({ onUpload, onValidationError }) => {
    const fileInputRef = useRef(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragActive(true);
    };

    const handleDragLeave = () => {
        setIsDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            validateAndUpload(e.target.files[0]);
        }
    };

    const validateAndUpload = (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['csv', 'xlsx', 'xls'].includes(ext)) {
            onUpload(file);
        } else {
            onValidationError?.('Formato inválido. Envie CSV ou Excel.');
        }
    };

    return (
        <Card className="animate-fade-in" style={{ padding: '0.5rem' }}>
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                role="button"
                tabIndex={0}
                aria-label="Selecionar arquivo de entregas"
                title="Selecionar arquivo de entregas"
                className={`upload-zone ${isDragActive ? 'upload-zone-active' : ''}`}
            >
                {isDragActive && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(59, 130, 246, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <CloudUpload size={52} style={{ animation: 'float 1.5s ease-in-out infinite' }} color="var(--primary)" />
                    </div>
                )}

                <div className="upload-icon-wrapper">
                    <Upload size={32} />
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Importar planilha de entregas
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '280px', margin: '0 auto', lineHeight: 1.5 }}>
                    Arraste um arquivo <b>CSV</b> ou <b>Excel</b>, ou clique para selecionar.
                </p>

                <div className="upload-format-badges">
                    <span className="upload-format-badge">CSV</span>
                    <span className="upload-format-badge">XLSX</span>
                    <span className="upload-format-badge">XLS</span>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".csv, .xlsx, .xls"
                    onChange={handleChange}
                />
            </div>
        </Card>
    );
};

export default FileUploader;
