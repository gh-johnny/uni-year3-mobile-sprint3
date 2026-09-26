# HANDOFF — Pitlane (Ford Challenge · Sprint 3 Mobile)

> Documento para um agente/pessoa **sem contexto** continuar o trabalho. Leia isto, depois o
> [`TODO.md`](./TODO.md) (plano com gates + log de evidências append-only). Fonte do enunciado:
> `../Ford_V2.pdf` (slide "SPRINT 3 - MOBILE DEVELOPMENT AND IOT"). Entrega: **27/09/2026**.

## 1. O que é
App Expo (SDK 57, RN 0.86, React 19.2, Expo Router, TS strict) para o **Desafio 02 da Ford — VIN/Service
Share (retenção no pós-venda)**. Duas personas:
- **Owner** (`ana@pitlane.app` / `ford2026`): garagem (saúde de revisão, ofertas), agendamento, passe QR,
  histórico, concessionárias (GPS + bússola), cadastro por scan de VIN.
- **Advisor** (`carlos@pitlane.app` / `ford2026`, Ford Pinheiros): Pulse (Service Share + cortes + anomalias),
  Radar (leads com churn explicável), Lead sheet (contato → outbox, pipeline).

Desafio escolhido por inferência (entrega mobile anterior do grupo em `../../../challenge/entregas/mobile/ford`).
Equipe (README/capa): João Marcelo Furtado Romero RM555199 · Matheus Rivera Montovaneli RM555499 · André Nakamatsu Rocha RM555004.

## 2. Regras de trabalho (pedidas pelo usuário)
- Commits **no nome do João** (git config local já está certo) e **sem `Co-Authored-By` de IA**.
- Commitar a cada item/fase do TODO e **appendar evidência** no log do `TODO.md`.
- Nada de `Alert.alert`: usar `useFeedback()` (toast + haptic) e `ConfirmDialog`.
- Tudo via design system (`src/presentation/design-system`), i18n EN + PT-BR, light/dark.
- Meta: **cobertura ≥95%** (threshold global no `jest.config.js`) + `expo-doctor` verde.
- Hook do ambiente bloqueia `rm -rf` → apagar arquivo a arquivo (`rm arquivo`, `rmdir`).
- Hook `guard-docs-write` pode bloquear escrita de `.md` via Bash (sugere a skill `/ai-agents:doc-forge`, indisponível
  aqui). Use `Write`/`Edit` nos docs; o usuário autorizou editar docs (2026-09-26).
- **Não executar o fluxo real do pipeline** sem pedido explícito: nada de `git push`, `eas build`, `eas init`,
  `eas workflow:run`. O usuário pediu só os arquivos (copiados/adaptados de `~/projects/work/troca`).
- Nunca `pkill -f "<padrão>"`/`pgrep -f` com texto que apareça no próprio comando: mata o shell da ferramenta (exit 144). Use PID.

## 3. Estado atual (2026-09-26 — todas as fases P0–P12 fechadas)
| Fase | Estado |
|---|---|
| P0–P4 plano, tooling, domain, infra, application | ✅ |
| P5–P8 design system, i18n, Owner, Advisor, transversal | ✅ todas as rotas/telas implementadas **e testadas**; percorridas no emulador (APK release) |
| P9 branding | ✅ `assets/branding/*.svg` → `scripts/branding.sh` |
| P10 qualidade | ✅ `npm run verify` exit 0 · 348 testes · cobertura 99,3 / 95,9 / 99,4 / 99,5 (stmts/branches/funcs/lines) · `expo-doctor` 21/21 |
| P11 APK | ✅ build **local (Gradle)**; `eas.json` (perfil `preview`) pronto, mas o **build EAS não foi executado** |
| P12 README | ✅ com galeria (`docs/screenshots`) |
| Pós-entrega: CI/CD | ✅ arquivos prontos e validados **estaticamente** (`actionlint`): `.github/workflows/ci.yml`, `.eas/workflows/{dev,production}.yml`, `eas.json` (perfis `development`/`preview`/`production`/`production-apk`). **Nunca executado** |
| Pós-entrega: containers | ✅ `Dockerfile`, `compose.yml`, `Makefile`, `docker/mock-api/` — **executados e validados** (ver TODO, entrada "CI/CD + containers + JSDoc") |
| Pós-entrega: JSDoc | ✅ 62 blocos em 16 arquivos (só comentários) |

### Ponto exato onde paramos (2026-09-26)
- Git: branches **`main`** (default) e **`develop`** (criada localmente, mesmo commit da `main`; sem divergência). **Nenhum remoto
  configurado** e nada foi enviado. Árvore de trabalho limpa.
- Repositório GitHub **ainda não existe/não está ligado**; portanto o pipeline nunca rodou e o `develop → main` nunca foi exercitado.
- Nenhum build EAS foi disparado e `eas init` **não** foi executado (o `app.json` ainda não tem `extra.eas.projectId`).
- Emulador e containers foram desligados; imagens Docker (~6 GB) ficaram no disco (`make docker-clean` remove).
- O APK entregável existe **só localmente** em `dist/pitlane.apk` (gitignored). **Não rode `make clean`** antes de copiá-lo/subi-lo:
  o alvo faz `rm -rf coverage dist dist-ci` e apagaria o APK. Ele é regenerável (`make apk-local`, ~20–30 min).

APK entregável: `dist/pitlane.apk` (85 MB, arm64-v8a + x86_64, assinado com a chave de debug do template; `dist/` e `android/` estão no `.gitignore`).

Ver o log de evidências no fim do `TODO.md` (inclui os 5 defeitos que só o emulador revelou).

## 4. O que falta (fora do código)
1. **Subir o APK + README/screenshots no Teams** até 27/09/2026 (o enunciado pede a entrega via Teams).
2. Opcional: rodar `npm run build:apk` (EAS logado) para ter também o artefato "oficial" via EAS Build.
3. Recomendado: instalar o APK num **device físico** e conferir o que o emulador não cobre — leitura real do
   código de barras do VIN, seta da bússola girando com o magnetômetro e biometria.
4. Gravar/roteirizar a demonstração (fluxos: Owner agenda → passe QR; Advisor vê Pulse/Radar → contata lead → outbox).
5. **Ativar o CI/CD** (arquivos prontos, nunca executados), nesta ordem — checklist completo em README §11:
   1. criar o repo no GitHub e `git remote add origin <url> && git push -u origin main develop`;
   2. Settings → Actions: "Allow GitHub Actions to create and approve pull requests" (na org também);
   3. secrets `EXPO_TOKEN` e `PR_BOT_TOKEN`; environments `development` e `production` (reviewers em prod);
   4. branch protection em `develop` e `main` (checks `semantic branch name` e `verify (typecheck · lint · test · doctor · build)`);
   5. `eas login` + `eas init` (vincula o `projectId`), depois `make eas-validate`;
   6. teste de fumaça: `git switch -c feat/teste-pipeline develop`, commit, push → deve rodar `verify` e abrir PR → `develop`.
   Só o passo 6 dispara o fluxo de verdade; `make eas-dev`/`make eas-prod` são *dry-run* sem `CONFIRM=1`.
6. Containers: `make help` (README §12). `make ci-local` reproduz o pipeline localmente (infra + verify no container).
7. Decisão em aberto: o build de **dev** do EAS é um APK interno *sem* `developmentClient`. Para um dev client de verdade:
   `npx expo install expo-dev-client` + `developmentClient: true` no perfil `development` (lição do `troca`).

### Gotchas aprendidos nesta sessão
- `expo prebuild` reescreve os scripts `android`/`ios` do `package.json` → `git checkout package.json` depois.
  Builds seguintes: `prebuild` **sem** `--clean` preserva o cache nativo (1º build 28 min, incremental ~20 min).
- Worklets do Reanimated **não podem chamar funções JS comuns** (crash "Tried to synchronously call a Remote Function"):
  use a diretiva `'worklet'` ou inline. O Jest não pega isso — só o dispositivo.
- Hermes/Android ignora `Intl.NumberFormat` com `notation: 'compact'`; `ClipPath` com `Rect` animado não reinvalida no Android.
- RNTL v14 é assíncrono em tudo: `await` em `render`, `renderHook`, `fireEvent`, `act`, `unmount` (sem `await` o `act` vaza).
- Emulador headless: `emulator -avd pitlane -no-window -gpu swiftshader_indirect` com `ANDROID_AVD_HOME=~/.config/.android/avd`.
  `uiautomator dump` falha em telas com animação infinita (Radar) — use toques por coordenada nelas.
- Docker: hadolint reprova o build também em `info` (usar `USER` numérico, `HEALTHCHECK`/`CMD` em forma exec); o `.dockerignore`
  exclui `docker/`, `Makefile` e `docs/screenshots`; pastas montadas (`coverage/`, `dist/`) precisam existir antes (o Makefile faz `mkdir -p`).
- PR aberto com `GITHUB_TOKEN` não dispara workflows — por isso o `PR_BOT_TOKEN`. `eas workflow:run` sem `--ref` envia o checkout local.

## 5. Mapa do código
```
src/
  config/env.ts                 Zod das EXPO_PUBLIC_* (.env.example)
  domain/                       TS puro: VOs, entidades, collections, specs, planners, analytics, churn
  application/                  ports, use cases (auth/garage/booking/register-vehicle/advisor), RetentionService, EventBus
  infrastructure/               SQLite repos + migrations, seed determinístico, JWT HS256/SecureStore, outbox SyncEngine,
                                adapters nativos, container.ts (composition root)
  presentation/
    app/                        bootstrap (produção), AppRoot (fonts, sessão, sync, lock), fonts
    design-system/              tokens, Theme, componentes, ícones (barrel: design-system/index.ts)
    i18n/                       Translator tipado, Formatters, dicionários EN/PT-BR
    state/                      zustand: preferences (persistido), session, toasts
    hooks/                      useI18n, useResult (reexecuta em eventos de domínio), useFeedback
    presenters/                 domain → view model (garage, booking, shared tones/icons)
    navigation/floating-tab-bar headless tabs expo-router/ui com pílula flutuante
    features/                   auth, garage, booking, pass, history, dealers, vehicle, scan, pulse, radar, lead, settings, sync, showcase
  app/                          rotas Expo Router (finas, só re-export)
  test-utils/                   createTestContainer (sql.js + crypto Node), fakes (render.tsx, router-mock.ts)
.github/workflows/ci.yml        pipeline: branch-name → verify → PR develop → build dev → PR main → build prod
.eas/workflows/                 dev.yml (APK dev) e production.yml (AAB + APK); sem `on:` — disparados pelo CI
eas.json                        perfis development / preview / production (aab) / production-apk
Dockerfile · compose.yml        multi-stage (check, coverage, bundle-out, dev) · perfis tools/sync/reports
Makefile                        `make help` — alvos locais (*-local) e dentro do container
docker/mock-api/                API mock da outbox (POST /sync/events)
scripts/branding.sh             SVG (assets/branding) → PNGs de ícone/splash
docs/screenshots/               galeria do README
```
Padrões: Clean/Hexagonal, Repository, Composition Root/DI por contexto, Static Factory (`create/restore/for`),
Builder (`AppointmentBuilder`, test data builders), Specification, Strategy (`ChurnModel`), Observer
(`EventBus`), Outbox, State machine (`Appointment`, `Lead`, `BookingDraft`), Presenter, first-class collections.

## 6. Comandos
```bash
npm run typecheck            # tsc
npm run lint                 # expo lint
node node_modules/jest/bin/jest.js src           # testes (saída crua; `npx jest` passa por wrapper que resume)
npm run test:cov             # cobertura com threshold 95% (passa: 99,3 / 95,9 / 99,4 / 99,5)
npx expo-doctor
npx expo export --platform android --output-dir <tmp>   # checa bundling
make help                    # todos os atalhos (Docker/Compose/EAS)
make ci-local                # actionlint + hadolint + compose + verify dentro do container (reproduz o pipeline)
make test | verify | up      # testes / verify / Metro — dentro do container
make apk-local               # APK release via prebuild + Gradle (JDK 17 + Android SDK)
```
Gotchas: RNTL v14 é async e exige `test-renderer@~1.2.0` (React 19.2); TZ dos testes fixo em
`America/Sao_Paulo`; TS 6 precisa de `types: ["jest","node"]`; importar i18n sempre de `@/presentation/i18n`
(o index registra os dicionários).
