# RotaBoa (RotaMestra)

Aplicação web para importar planilhas de entregas (`.csv`, `.xlsx`, `.xls`), geocodificar endereços e montar uma rota otimizada com visualização em mapa.

## O que o app faz

- Importa planilhas com detecção flexível de colunas.
- Aceita endereço pronto ou coordenadas (`lat`/`lon`).
- Geocodifica endereços usando Nominatim (OpenStreetMap).
- Otimiza rota com OSRM (distância ou duração).
- Exibe rota no mapa, resumo operacional e lista de paradas.
- Possui modo de operação (motorista), histórico e persistência local.
- Suporte offline parcial com cache/PWA e fila de ações locais.

## Stack

- React 19 + Vite
- Leaflet + React-Leaflet
- PapaParse + SheetJS (`xlsx`)
- Framer Motion + Lucide React

## Requisitos

- Node.js (LTS recomendado)
- npm

## Como rodar

```bash
npm install
npm run dev
```

Depois abra a URL exibida pelo Vite (normalmente `http://localhost:5173`).

## Publicar como site

```bash
npm run build
```

Publique o conteúdo da pasta `dist/` em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, servidor próprio etc.).

## Instalar na área de trabalho (PWA)

- Abra o site no Chrome ou Edge.
- Vá em `Configurações` no app e clique em `Instalar app na área de trabalho`.
- Se o navegador não exibir prompt automático, use:
- iPhone/iPad (Safari): `Compartilhar -> Adicionar à Tela de Início`.
- Desktop (Chrome/Edge): menu do navegador -> `Instalar aplicativo`.

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm run preview     # preview da build
npm run lint        # lint
npm run test:logic  # teste da lógica de otimização
```

## Formato da planilha

A aplicação tenta mapear colunas automaticamente por sinônimos. Campos úteis:

- Endereço: `endereco`, `endereço`, `address`, `logradouro`, `destino`
- Número: `numero`, `número`, `num`
- Cidade/UF/CEP: `cidade`, `uf`, `cep`
- Coordenadas: `lat` e `lon` (ou `latitude`/`longitude`)
- Nome: `nome`, `cliente`, `destinatario`
- Prioridade: `prioridade` (`baixa`, `media`, `alta` ou valor numérico)
- Janela de entrega: `janela_inicio` / `janela_fim` (HH:mm) ou `janela` (ex.: `08:00-12:00`)
- Plataforma: `plataforma` (ex.: Shopee, Mercado Livre)
- Observação: `obs`, `observacao`, `referencia`

Se a planilha já vier com coordenadas válidas, a geocodificação é pulada para esses itens.

## Fluxo recomendado de uso

1. Importe o arquivo de entregas.
2. Defina origem, tipo de otimização (`distância` ou `tempo`) e se é ida e volta.
3. Execute a otimização.
4. Revise o mapa e os detalhes da rota.
5. Use o modo operação para marcar `entregue`/`falhou` durante a execução.

## Estrutura do projeto

```text
src/
├── components/          # UI, mapa e painéis
├── hooks/               # persistência local
├── utils/
│   ├── fileParser.js    # leitura e normalização de planilhas
│   ├── geocoding.js     # geocodificação
│   └── optimizer.js     # algoritmo e integração OSRM
├── App.jsx              # fluxo principal da aplicação
└── main.jsx             # bootstrap React
```

## Limitações e observações

- A geocodificação depende de serviço externo (Nominatim) e pode sofrer limitação por taxa.
- A otimização de custo viário depende do OSRM público e pode variar conforme disponibilidade/rede.
- Offline é parcial: recursos locais funcionam, mas geocodificação/roteamento exigem internet.
- Dados são persistidos no `localStorage` do navegador.

## Build de produção

```bash
npm run build
npm run preview
```

O output é gerado na pasta `dist/`.
