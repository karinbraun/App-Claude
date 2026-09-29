# App-Claude

Este repositório contém dois apps web independentes (PWA, offline, dados só no aparelho):

| App | Pasta | Endereço publicado |
|---|---|---|
| **Constância** — hábitos | raiz (`/`) | `https://karinbraun.github.io/App-Claude/` |
| **Presença** — faltas e viagens | `presenca/` | `https://karinbraun.github.io/App-Claude/presenca/` |

## Presença — faltas na faculdade × viagens a trabalho

Controla a presença mínima de **75% por disciplina, em horas-aula**, e simula o impacto de
viagens antes de aceitá-las. Limite de faltas = 25% da carga horária nominal
(40h → 10h; 80h → 20h).

- **Painel** — saldo de faltas por disciplina: registradas, previstas em viagens, saldo em
  horas e em encontros, presença projetada e status (dentro do limite / no limite / reprovaria).
- **Viagens** — informe saída e volta; antes de salvar, o app mostra as aulas do período,
  as horas perdidas e o saldo antes → depois em cada disciplina. Desmarque as aulas que você
  conseguirá assistir.
- **Aulas** — calendário mês a mês gerado da grade; registre falta total ou parcial.
- **Ajustes** — datas do semestre, disciplinas (carga, dias e horas-aula, cancelamentos,
  reposições), feriados/recessos, tema e backup.

Regras de cálculo: uma aula com falta registrada nunca conta de novo pela viagem; viagens
sobrepostas contam a aula uma vez; aulas de viagens já passadas continuam contando até você
registrá-las. Se as horas geradas pelo calendário diferirem da carga nominal, o app avisa.

Lógica em `presenca/js/model.js`, testada em `tests/presenca.test.mjs`.

---

# Constância — app de gestão de hábitos

Um app web para **acompanhar o check-in de vários hábitos ao mesmo tempo**. Bonito,
rápido, funciona **offline** e guarda tudo **no seu próprio aparelho** (sem login, sem
servidor, sem cadastro). Dá para **instalar na tela inicial** do celular ou do computador
como um app (PWA).

## O que ele faz

- **Hoje** — sua tela principal: marque vários hábitos de uma vez, com anel de progresso
  do dia, sequência (streak) de cada um e um botão "marcar todos".
- **Semana** — uma grade de hábitos × 7 dias para marcar muitos hábitos em vários dias,
  inclusive preencher dias passados.
- **Estatísticas** — mapa de calor (estilo "contribuições do GitHub"), sequência atual e
  recorde, taxa de adesão dos últimos 30 dias e conclusões por dia da semana.
- **Hábitos / Ajustes** — criar, editar, reordenar e arquivar hábitos; definir emoji, cor,
  **meta** (todo dia ou N vezes por semana) e **lembrete**; alternar tema claro/escuro;
  **exportar/importar** um backup dos dados.

## Como rodar no seu computador

O app não tem build nem dependências — são só arquivos estáticos. Ele precisa ser
**servido por http** (por causa dos módulos JavaScript e do modo offline); abrir o arquivo
direto com `file://` não funciona. Na pasta do projeto:

```bash
python3 -m http.server 8080
# depois abra http://localhost:8080 no navegador
```

(ou qualquer servidor estático, como `npx serve`).

## Como publicar (para usar no celular)

Como são arquivos estáticos, dá para hospedar de graça no **GitHub Pages**. Passo a passo
para este repositório:

1. No GitHub, abra **Settings → Pages**.
2. Em **Source**, escolha **"Deploy from a branch"**.
3. Em **Branch**, selecione `claude/academic-attendance-manager-lnrk86` (que contém os dois apps)
   e a pasta **`/ (root)`**.
4. Clique em **Save**.

Em cerca de 1 minuto a URL pública aparece na própria tela de *Pages* — algo como
`https://karinbraun.github.io/App-Claude/` (Constância) e `.../App-Claude/presenca/` (Presença). Abra a URL no celular e use o menu do
navegador → **"Adicionar à tela inicial"** para instalar como app. Cada novo envio (push)
para essa branch re-publica o site sozinho.

> O arquivo `.nojekyll` na raiz faz o GitHub servir os arquivos exatamente como estão
> (sem o processamento Jekyll), o que é o recomendado para um PWA.

Qualquer outro host estático (Netlify, Vercel, Cloudflare Pages) também funciona.

## Sobre os lembretes

Os lembretes disparam de forma confiável **enquanto o app está aberto ou instalado e em
uso**. Um aviso com o app **totalmente fechado** exigiria um servidor de push, o que este
app (100% no seu aparelho) não usa — é o custo de manter tudo local e privado. Ative os
lembretes em *Hábitos → Ajustes → Lembretes*.

## Backup dos dados

Como os dados ficam só neste aparelho, use *Ajustes → Backup* para **exportar** um arquivo
`.json` (guardar ou levar para outro aparelho) e **importar** de volta quando quiser.

## Desenvolvimento

- **Testes da lógica** (datas, streaks, metas): `node --test` (ou `npm test`). Sem
  dependências.
- **Estrutura**:
  - `js/model.js` — lógica pura (datas, streaks, metas, estatísticas), testável no Node.
  - `js/store.js` — estado + persistência no `localStorage` (única camada que toca o storage).
  - `js/charts.js` — gráficos em SVG feitos à mão (anel, mapa de calor, barras).
  - `js/notifications.js` — lembretes.
  - `js/views/*` — as quatro telas; `js/app.js` orquestra tudo.
- **Ícones**: gerados de `icons/*.svg` por `scripts/gen-icons.mjs` (usa o Chromium via
  Playwright — ferramenta de desenvolvimento, não é dependência do app).

Tudo em português (pt-BR).
