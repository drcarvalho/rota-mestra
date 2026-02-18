import React, { useRef, useState } from 'react';
import { FileText, CheckCircle2, CloudUpload } from 'lucide-react';
import Card from './ui/Card';

const FileUploader = ({ onUpload }) => {
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
            alert('Envie um arquivo CSV ou Excel (.xlsx/.xls).');
        }
    };

    return (
        <Card className="animate-fade-in" style={{ padding: '0.5rem' }}>
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: '2px dashed var(--border)',
                    borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
                    borderRadius: '14px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDragActive ? 'var(--primary-light)' : 'rgba(var(--bg-rgb, 248, 250, 252), 0.5)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {isDragActive && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(37, 99, 235, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CloudUpload size={48} className="animate-bounce" color="var(--primary)" />
                    </div>
                )}

                <div style={{
                    margin: '0 auto 1.5rem',
                    width: '64px',
                    height: '64px',
                    background: 'var(--primary-light)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                }}>
                    <FileText size={32} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Importar arquivo de entregas
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '240px', margin: '0 auto' }}>
                    Arraste um arquivo <b>CSV</b> ou <b>Excel</b> ou clique para selecionar.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--border)', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>CSV</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--border)', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>XLSX</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--border)', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>XLS</span>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".csv, .xlsx, .xls"
                    onChange={handleChange}
                />
            </div>

            <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '2px' }}><CheckCircle2 size={16} color="var(--success)" /></div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        <b>Detecção automática:</b> o sistema identifica colunas de endereço, nome, CEP e coordenadas.
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default FileUploader;
