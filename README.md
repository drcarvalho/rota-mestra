# RotaBoa (RotaMestra)

Aplicação web para importar planilhas de entregas e gerar uma rota otimizada com visualização em mapa, fluxo de operação para motorista e persistência local.

## Funcionalidades

- Importação de planilhas `.csv`, `.xlsx` e `.xls`.
- Geocodificação de endereços com fallback e normalização.
- Otimização de rota com estratégia híbrida:
  - solução exata (Held-Karp) para conjuntos pequenos;
  - heurística (nearest-neighbor + 2-opt) para conjuntos maiores;
  - uso de OSRM para matriz de custos, rota e geometria.
- Modo motorista com ações rápidas (entregue/falhou/navegar).
- Integração direta com Waze.
- Fila de ações offline com sincronização ao voltar conexão.
- Histórico de rotas salvo em `localStorage`.

## Stack

- React 19 + Vite
- Leaflet + React-Leaflet
- Lucide React
- PapaParse + SheetJS
- Framer Motion

## Scripts

```bash
npm run dev       # ambiente de desenvolvimento
npm run build     # build de produção
npm run preview   # preview local da build
npm run lint      # lint do projeto
npm run test:logic
```

## Como rodar

1. Instale dependências:
   ```bash
   npm install
   ```
2. Inicie o projeto:
   ```bash
   npm run dev
   ```
3. Abra a URL exibida pelo Vite (normalmente `http://localhost:5173`).

## Estrutura resumida

```text
src/
├── components/      # interface e módulos visuais
├── hooks/           # persistência e utilitários de estado
├── utils/           # parser, geocoding e otimização
├── App.jsx          # fluxo principal da aplicação
└── App.css          # estilos globais e tema
```
