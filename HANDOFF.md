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

## 3. Estado atual (2026-09-26 — todas as fases P0–P12 fechadas)
| Fase | Estado |
|---|---|
| P0–P4 plano, tooling, domain, infra, application | ✅ |
| P5–P8 design system, i18n, Owner, Advisor, transversal | ✅ todas as rotas/telas implementadas **e testadas**; percorridas no emulador (APK release) |
| P9 branding | ✅ `assets/branding/*.svg` → `scripts/branding.sh` |
| P10 qualidade | ✅ `npm run verify` exit 0 · 348 testes · cobertura 99,3 / 95,9 / 99,4 / 99,5 (stmts/branches/funcs/lines) · `expo-doctor` 21/21 |
| P11 APK | ✅ build **local (Gradle)**; `eas.json` (perfil `preview`) pronto, mas o **build EAS não foi executado** |
| P12 README | ✅ com galeria (`docs/screenshots`) |

APK entregável: `dist/pitlane.apk` (85 MB, arm64-v8a + x86_64, assinado com a chave de debug do template; `dist/` e `android/` estão no `.gitignore`).

Ver o log de evidências no fim do `TODO.md` (inclui os 5 defeitos que só o emulador revelou).

## 4. O que falta (fora do código)
1. **Subir o APK + README/screenshots no Teams** até 27/09/2026 (o enunciado pede a entrega via Teams).
2. Opcional: rodar `npm run build:apk` (EAS logado) para ter também o artefato "oficial" via EAS Build.
3. Recomendado: instalar o APK num **device físico** e conferir o que o emulador não cobre — leitura real do
   código de barras do VIN, seta da bússola girando com o magnetômetro e biometria.
4. Gravar/roteirizar a demonstração (fluxos: Owner agenda → passe QR; Advisor vê Pulse/Radar → contata lead → outbox).
5. **Ativar o CI/CD** (arquivos prontos, nunca executados): criar o repo no GitHub, branch `develop`, permissão
   "Allow GitHub Actions to create and approve pull requests", secrets `EXPO_TOKEN` (+ `PR_BOT_TOKEN`), environments
   `development`/`production`, branch protection e `eas init`. Checklist completo em README §11.
6. Containers: `make help` (Docker/Compose/Makefile prontos e validados — README §12). `make ci-local` reproduz o pipeline localmente.

### Gotchas aprendidos nesta sessão
- `expo prebuild` reescreve os scripts `android`/`ios` do `package.json` → `git checkout package.json` depois.
  Builds seguintes: `prebuild` **sem** `--clean` preserva o cache nativo (1º build 28 min, incremental ~20 min).
- Worklets do Reanimated **não podem chamar funções JS comuns** (crash "Tried to synchronously call a Remote Function"):
  use a diretiva `'worklet'` ou inline. O Jest não pega isso — só o dispositivo.
- Hermes/Android ignora `Intl.NumberFormat` com `notation: 'compact'`; `ClipPath` com `Rect` animado não reinvalida no Android.
- RNTL v14 é assíncrono em tudo: `await` em `render`, `renderHook`, `fireEvent`, `act`, `unmount` (sem `await` o `act` vaza).
- Emulador headless: `emulator -avd pitlane -no-window -gpu swiftshader_indirect` com `ANDROID_AVD_HOME=~/.config/.android/avd`.
  `uiautomator dump` falha em telas com animação infinita (Radar) — use toques por coordenada nelas.

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
  test-utils/                   createTestContainer (sql.js + crypto Node), fakes
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
```
Gotchas: RNTL v14 é async e exige `test-renderer@~1.2.0` (React 19.2); TZ dos testes fixo em
`America/Sao_Paulo`; TS 6 precisa de `types: ["jest","node"]`; importar i18n sempre de `@/presentation/i18n`
(o index registra os dicionários).
