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

> **Atenção:** este repositório é privado. No plano gratuito do GitHub, o **GitHub Pages
> não serve repositório privado**, então as instruções antigas de publicar por
> *Settings → Pages* deixaram de valer e a URL `karinbraun.github.io/App-Claude/` saiu
> do ar.

No computador, o app continua rodando pelo servidor local da seção anterior.

Para voltar a usar no celular, três caminhos, nenhum escolhido até agora:

- **Cloudflare Pages** ou **Netlify**: os dois fazem deploy de repositório privado no
  plano gratuito. É a saída mais rápida, e a URL muda.
- **GitHub Pro** (em torno de US$ 4 por mês): reativa o Pages em repositório privado,
  sem mudar estrutura nem URL.
- **Repositório separado**: manter só o app num repositório público, com o material
  privado em outro.

> O arquivo `.nojekyll` na raiz faz o GitHub servir os arquivos exatamente como estão
> (sem o processamento Jekyll), o que é o recomendado para um PWA. Ele fica onde está,
> caso o Pages volte a ser usado.

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
