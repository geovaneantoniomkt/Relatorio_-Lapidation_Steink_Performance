# Lapidation × Steink Performance

Repositório de gestão da conta **Lapidation Clinic** (Steink Performance / Geovane Antonio).

## Conteúdo

| Arquivo | O que é |
|---|---|
| [`BRIEFING-LAPIDATION.md`](BRIEFING-LAPIDATION.md) | Briefing consolidado do cliente — empresa, produtos, público, funil, acessos, restrições, verba e pendências. Extraído da reunião de kickoff. |
| [`ficha-rapida-lapidation.html`](ficha-rapida-lapidation.html) | **Consulta rápida.** Todos os pontos principais em cards pesquisáveis — abre no navegador, funciona offline. Tecle `/` para buscar, `Esc` para limpar. |
| [`briefing-lapidation.html`](briefing-lapidation.html) | Mesmo briefing em versão navegável (índice lateral, filtro de pendências por responsável). Abrir no navegador. |
| `reunioes/` | Registros brutos das reuniões (resumo + transcrição), para consulta e rastreabilidade. |
| [`DASHBOARD.md`](DASHBOARD.md) | **Dashboard de performance** (Meta Ads + orgânico) — arquitetura, configuração dos segredos, deploy no Cloudflare Pages e checklist de segurança. Código em `public/`, `functions/`, `scripts/` e `.github/workflows/`. |

## Status do projeto

Proposta e contrato **aceitos**. Campanhas no Meta Ads no ar desde 08/09/2026 (conta `1505849358224649`). Google Ads ainda não criado.

## Dashboard

Site protegido por senha no Cloudflare Pages, atualizado todo dia às 7h pelo GitHub Actions. Ver [`DASHBOARD.md`](DASHBOARD.md) para configurar (`META_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` nos secrets; `DASHBOARD_PASSWORD` e `SESSION_SECRET` no Cloudflare).

> ⚠️ Este repositório contém dados cadastrais do cliente. Recomendado deixá-lo **privado**.
