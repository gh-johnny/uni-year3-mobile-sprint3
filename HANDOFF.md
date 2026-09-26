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

## 3. Estado atual (fim desta sessão)
| Fase | Estado |
|---|---|
| P0 plano · P1 tooling · P2 domain · P3 infra · P4 application | ✅ commitadas, 195 testes, ~99,8% cobertura nessas camadas |
| P5 design system / i18n / tema | código escrito, **sem testes** |
| P6 owner | feito: sign-in, tabs owner, garage, booking (**sem testes**). Faltam: pass, history, dealers, scan, vehicle, account |
| P7 advisor | **não iniciado** (use cases prontos: `getPulse`, `getRadar`, `getLeadDetail`, `contactLead`, `updateLeadStatus`) |
| P8–P12 | não iniciados |

Verificado agora: `tsc` limpo, `eslint src` limpo, `jest src` 195/195, `expo export --platform android` OK.

## 4. Próximos passos (ordem sugerida)
1. **Rotas faltantes** (o `_layout.tsx` raiz já declara todas; cada rota é um re-export de 1 linha como
   `src/app/booking.tsx`):
   - `src/app/(owner)/history.tsx` → timeline (`useCases.getTimeline`)
   - `src/app/(owner)/dealers.tsx` → lista + bússola (`listDealersNearby` + `services.heading.watch()` e
     `dealer.bearing`; seta = bearing − heading)
   - `src/app/(owner)/account.tsx` e `src/app/(advisor)/profile.tsx` → mesma tela de Settings
     (tema/idioma/haptics/biometria via `usePreferences`, sync center, design system, reset demo
     `container.resetDemoData()`, sign out `useCases.signOut` + `useSession.signedOut`)
   - `src/app/pass/[id].tsx` (formSheet) → `getServicePass` + `<QrCode value={checkInCode}>` + cancelar
     (`cancelAppointment` com `ConfirmDialog`)
   - `src/app/scan.tsx` → `expo-camera` `CameraView` (barcode code39/code128/datamatrix/qr) + entrada manual,
     form RHF+Zod → `registerVehicle`; decodificar VIN com `Vin` (isFord, assemblyCountry → `countries.*`,
     modelYear, hasValidCheckDigit). Dicionários já têm todas as chaves `scan.*`.
   - `src/app/vehicle/[id].tsx` → `getVehicleDetail` + `vehicle.model.specs.entries()` (campo nulo →
     `common.notAvailable`) + histórico
   - `src/app/(advisor)/pulse.tsx`, `radar.tsx`, `src/app/lead/[vehicleId].tsx`, `src/app/sync.tsx`,
     `src/app/design-system.tsx`
   Todas as strings já existem em `src/presentation/i18n/dictionaries/{en,pt-br}.ts`.
2. **Testes da camada de apresentação** (para o gate 95%): presenters são puros → testar direto;
   componentes com RNTL v14 (**`await render()`**, `userEvent` async). Criar `src/test-utils/render.tsx` que
   embrulha com `ServicesProvider` usando `createTestContainer()` (sql.js real) + fakes de
   haptics/biometrics/heading/network, e `SafeAreaProvider` com `initialMetrics`. No `jest/setup.ts`
   adicionar mocks: `expo-sqlite/kv-store` (Map em memória), `expo-localization` (`getLocales`),
   `react-native-safe-area-context/jest/mock`. Para rotas: `renderRouter` de `expo-router/testing-library`.
3. **Branding (P9)**: gerar ícone/adaptive/splash em SVG → PNG com `rsvg-convert` (disponível), substituir
   `assets/images/*` (ainda são do template Expo), rodar `npx expo-doctor`.
4. **APK (P11)**: criar `eas.json` com perfil `preview` (`android.buildType: "apk"`) e rodar
   `npm run build:apk` (EAS logado na conta do usuário) **ou** `npx expo prebuild -p android` +
   `cd android && ./gradlew assembleRelease` (Android SDK/NDK/JDK17 locais). Emulador: system image
   `system-images;android-35;google_apis;x86_64` já baixada e `/dev/kvm` acessível; falta
   `avdmanager create avd -n pitlane -k "system-images;android-35;google_apis;x86_64"` (sdkmanager/avdmanager em
   `~/Android/Sdk/cmdline-tools/latest/bin`) e `emulator -avd pitlane -no-window -gpu swiftshader_indirect`.
   Screenshots: `adb exec-out screencap -p > docs/screenshots/<tela>.png`.
5. **README (P12)**: integrantes, desafio, arquitetura (diagrama mermaid das 4 camadas), decisões D1–D12 do
   TODO, telas com screenshots, como rodar/testar/buildar, modelo de churn (coeficientes em
   `LogisticChurnModel.calibrated()`), números da calibração (seção P3+P4 do log).

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
    features/                   auth, garage, booking (demais pastas criadas vazias)
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
npm run test:cov             # cobertura com threshold 95% (hoje falha: presentation sem testes)
npx expo-doctor
npx expo export --platform android --output-dir <tmp>   # checa bundling
```
Gotchas: RNTL v14 é async e exige `test-renderer@~1.2.0` (React 19.2); TZ dos testes fixo em
`America/Sao_Paulo`; TS 6 precisa de `types: ["jest","node"]`; importar i18n sempre de `@/presentation/i18n`
(o index registra os dicionários).
