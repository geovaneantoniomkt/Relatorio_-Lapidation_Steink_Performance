# Dashboard de performance — Lapidation Clinic

Dashboard protegido por senha com dados do **Meta Ads** (conta `1505849358224649`) e do **orgânico**
(Página do Facebook `1352598281263785` + Instagram `@lapidation.clinic`). Google Ads entra quando a conta for criada.

```
GitHub Actions (todo dia 07:00 BRT)                 Cloudflare Pages
┌──────────────────────────────┐   wrangler deploy   ┌──────────────────────────────┐
│ scripts/fetch_meta.py        │ ──────────────────► │ functions/_middleware.js     │ ← senha + cabeçalhos
│  META_ACCESS_TOKEN (secret)  │   public/ + data/   │ public/index.html, app.js    │
│  → public/data/meta.json     │   (nunca vai p/ git)│ public/data/*.json           │ ← só com sessão válida
│  → public/data/organic.json  │                     └──────────────────────────────┘
└──────────────────────────────┘
```

Princípios de segurança:

- **O token do Meta nunca sai do GitHub Actions.** Ele só existe como *secret* do repositório; o site publicado não
  contém token nenhum e o navegador nunca fala com a API do Meta.
- **Os dados nunca entram no git.** `public/data/` está no `.gitignore`; o JSON é gerado na hora do deploy e enviado
  direto para o Cloudflare. (Importante porque o repositório é público.)
- **Tudo atrás de senha**, inclusive os JSONs: o middleware roda antes de qualquer arquivo estático.
- Sessão em cookie assinado (HMAC-SHA256), `HttpOnly`, `Secure`, `SameSite=Strict`, expira em 12 h.
- Comparação de senha em tempo constante, bloqueio de 15 min após 5 erros por IP, atraso em falhas, proteção CSRF
  (`Sec-Fetch-Site`/`Origin`), sem *open redirect* no `next`.
- Cabeçalhos: CSP estrita (`script-src 'self'`, sem inline), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: no-store` nos dados.
- Nenhuma dependência externa no front-end (sem CDN) — nada de terceiros roda na página.

---

## 1. Configurar o GitHub (uma vez)

Em **Settings → Secrets and variables → Actions**:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `META_ACCESS_TOKEN` | Token de usuário do sistema (System User) do Business "Lapidation Clinic" — ver §4 |
| Secret | `CLOUDFLARE_API_TOKEN` | Token da API do Cloudflare com permissão **Cloudflare Pages: Edit** (ver §2) |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare (aparece na barra lateral do painel) |
| Variable (opcional) | `CF_PAGES_PROJECT` | Nome do projeto Pages (padrão `lapidation-dashboard`) |
| Variable (opcional) | `META_API_VERSION` | Versão da Graph API (padrão `v23.0`) |

O workflow é `.github/workflows/update-dashboard.yml`. Ele roda:

- todo dia às **10:00 UTC (07:00 Brasília)**;
- manualmente em **Actions → Atualizar dashboard → Run workflow**;
- a cada push na branch `main` que altere `public/`, `functions/` ou `scripts/`.

> A branch padrão do repositório precisa ser `main` (Settings → General → Default branch) para o agendamento funcionar.
> Recomendação forte: tornar o repositório **privado** — ele contém o briefing do cliente com CNPJ e dados internos.

## 2. Criar o projeto no Cloudflare Pages (uma vez)

1. Painel Cloudflare → **Workers & Pages → Create → Pages → Upload assets** (ou "Direct Upload").
   Nome do projeto: `lapidation-dashboard`. Pode subir qualquer arquivo só para criar o projeto — o Actions substitui.
2. **Settings → Environment variables → Production**, adicionar como **Secret**:
   - `DASHBOARD_PASSWORD` — a senha de acesso (use 16+ caracteres; é o que a equipe vai digitar).
   - `SESSION_SECRET` — string aleatória longa (ex.: `openssl rand -base64 48`). Trocar essa chave derruba todas as sessões.
   - `SESSION_HOURS` (opcional) — duração da sessão em horas (padrão 12).
3. Criar o token da API: **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** ou template custom com
   permissão *Account · Cloudflare Pages · Edit*. Guardar em `CLOUDFLARE_API_TOKEN` no GitHub.
4. Rodar o workflow manualmente. A URL fica em `https://lapidation-dashboard.pages.dev` (dá para ligar um domínio próprio
   em **Custom domains**, ex. `dash.lapidation.com.br`).

### Camadas extras recomendadas (gratuitas)

- **Rate limit no WAF**: Security → WAF → Rate limiting rules → `URI Path equals /login` e método `POST`,
  máx. 10 requisições / 1 min por IP → *Block*. Protege contra força bruta mesmo entre vários servidores da Cloudflare.
- **Cloudflare Access (Zero Trust)** como segunda camada: Zero Trust → Access → Applications → Self-hosted, domínio do
  dashboard, política *Allow* por e-mail (OTP) para os e-mails da Lapidation e da Steink. Assim cada pessoa entra com o
  próprio e-mail e você pode revogar individualmente, além da senha compartilhada.
- Trocar `DASHBOARD_PASSWORD` sempre que alguém sair do projeto.

## 3. Rodar localmente

```bash
# 1) coletar dados (precisa do token)
set META_ACCESS_TOKEN=EAAB...       # PowerShell: $env:META_ACCESS_TOKEN="EAAB..."
python scripts/fetch_meta.py

# 2) subir o site com a camada de senha (cria .dev.vars com DASHBOARD_PASSWORD e SESSION_SECRET — está no .gitignore)
npm run dev        # http://localhost:8788
```

Sem Cloudflare (só para olhar o HTML): `python -m http.server 8000 -d public` — **sem senha**, use apenas localmente.

## 4. Token do Meta — como gerar e o que ele precisa

Use um **Usuário do Sistema** (System User) no Business Manager da Lapidation Clinic (`1362228392558499`),
com acesso à conta de anúncios, à Página e ao Instagram, e gere um token **sem expiração** com os escopos:

`ads_read` · `business_management` · `pages_read_engagement` · `pages_show_list` · `read_insights` ·
`instagram_basic` · `instagram_manage_insights`

Sem os escopos de Página/Instagram o coletor continua funcionando para o Meta Ads e registra o motivo em
"Avisos da última coleta" dentro do dashboard.

## 5. Estrutura

```
public/            site estático (index.html, app.js, styles.css, config.json, login.css)
public/data/       JSONs gerados — ignorados pelo git
functions/         _middleware.js (senha, sessão, cabeçalhos de segurança)
scripts/           fetch_meta.py (coletor; só biblioteca padrão do Python)
.github/workflows/ update-dashboard.yml (coleta + deploy diário)
wrangler.toml      configuração do Cloudflare Pages
```

`public/config.json` guarda metas e verba (sem segredos): custo por conversa, custo por visita ao perfil, CPM máximo
de topo de funil, CTR mínimo, frequência máxima, verba mensal. As metas também podem ser ajustadas no menu lateral do
dashboard (ficam salvas só no navegador de quem ajustou).

## 6. Seções do dashboard

| Seção | O que mostra |
|---|---|
| Visão executiva | Controle de verba (gasto, ritmo, projeção), KPIs com variação vs. período anterior, gráficos diários, histórico mensal, melhores criativos, dinheiro sem retorno, campanhas fora da meta e **alertas priorizados** |
| Meta Ads | Tabela de campanhas com status, orçamento, resultado, custo por resultado vs. meta e ação recomendada; conjuntos por campanha; idade/gênero, região e posicionamento (30 dias) |
| Criativos | Cards por anúncio com miniatura, gasto, resultados, custo, CTR, CPM e link para o anúncio publicado; filtro por campanha e qualidade |
| Orgânico | Instagram (seguidores, novos seguidores, alcance, visitas ao perfil, contas engajadas, visualizações, publicações) e Facebook (seguidores, alcance, engajamentos, posts) |
| Google Ads | Placeholder até a conta existir |
| Legendas | Definição de cada métrica, status e regra de qualidade |

## 7. Checklist de segurança executado

- [x] `/data/*.json` sem sessão → 401; `/` sem sessão → redireciona para `/login`
- [x] Senha errada → 401 com atraso; 5 erros → bloqueio de 15 min por IP
- [x] `next` malicioso (`//evil.com`, `https://evil.com`, `/\\evil.com`) → redireciona para `/`
- [x] POST com `Sec-Fetch-Site: cross-site` ou `Origin` de outro host → 403
- [x] Cookie `HttpOnly; Secure; SameSite=Strict`, assinado; alteração do payload invalida a sessão
- [x] CSP sem `unsafe-inline`; nenhum script/CSS externo; imagens só via `https:`
- [x] Token nunca aparece em logs (URLs com `access_token` são mascaradas no coletor)
- [x] Dados e `.dev.vars` no `.gitignore`
