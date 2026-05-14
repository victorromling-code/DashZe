# Dashboard All Business — Funil + Metas

Dashboard único (React + Vite) que reúne, em abas:

- **Funil de Vendas** — funil receptivo/prospectivo do Kommo (Zé André) + ranking de consultores
- **Metas** — OKRs/metas por setor no ClickUp (Comercial, Correlaize, CS, RH, Financeiro)
- **Mural de Avisos** — avisos internos (ClickUp)
- **Aniversariantes** — aniversários da equipe (ClickUp)
- **Eventos** — próximos eventos (ClickUp)

## Arquitetura

- **Frontend**: React + Vite (`src/`)
- **Backend**: Supabase Edge Functions (`supabase/functions/`) — fazem proxy para as APIs do
  Kommo e do ClickUp, mantendo os tokens seguros no servidor
- O frontend chama as Edge Functions via `@supabase/supabase-js` (`src/lib/api.js`)

## Setup

### 1. Frontend

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

### 2. Supabase (Edge Functions)

Pré-requisitos (uma vez): instalar a [CLI do Supabase](https://supabase.com/docs/guides/cli)
e rodar `supabase login`.

Os secrets do Kommo/ClickUp ficam em `supabase/functions.env` (copie de
`functions.env.example`; já vem fora do git). Para aplicar secrets + publicar as 7 funções:

```powershell
pwsh supabase/deploy.ps1
```

Ou manualmente:

```bash
supabase secrets set --project-ref nowckxkcwlzbmjfyinfu --env-file supabase/functions.env
supabase functions deploy kommo clickup goals tasks avisos eventos aniversariantes --project-ref nowckxkcwlzbmjfyinfu
```

Funções disponíveis: `kommo`, `clickup`, `goals`, `tasks`, `avisos`, `eventos`, `aniversariantes`.
As funções `kommo` e `clickup` recebem `{ endpoint }` no corpo da requisição; as demais não recebem parâmetros.

### 3. Lovable

O projeto é compatível com o Lovable: importe pelo GitHub, conecte o Supabase e
defina as variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Os secrets das
Edge Functions (KOMMO/CLICKUP) são configurados no painel do Supabase.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — ESLint
