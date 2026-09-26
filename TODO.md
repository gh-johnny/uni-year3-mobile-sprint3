# PITLANE · Ford Challenge — Sprint 3 (Mobile Development & IoT) — TODO

> **Como retomar numa sessão nova, sem contexto:** leia a seção _0. Contexto_, depois procure o primeiro
> item `[ ]` na _Seção 2_. Cada fase termina num **GATE** com critérios objetivos. Um gate só fica `✅` com
> evidência colada no _Log de evidências_ (Seção 3). Todo commit vai no nome do João (config git local), **sem
> co-author de IA**.

---

## 0. Contexto

| Item | Valor |
|---|---|
| Disciplina | Mobile Development and IoT — FIAP 3º ano, Challenge Ford 2026 |
| Entrega | Sprint 3 — **27/09/2026** (via Teams) |
| Fonte | `../Ford_V2.pdf` (slide "SPRINT 3 - MOBILE DEVELOPMENT AND IOT") |
| Equipe | João Marcelo Furtado Romero RM555199 · Matheus Rivera Montovaneli RM555499 · André Nakamatsu Rocha RM555004 |
| Stack | Expo SDK 57 · RN 0.86 · React 19.2 · Expo Router 57 · TypeScript strict |

### O que o professor pede (Sprint 3 — Mobile)
1. **APK** final e publicável, com **todos os fluxos do desafio Ford escolhido funcionando sem erros**.
2. **Identidade visual consolidada**: componentes, cores, tipografia e UX consistentes em todas as telas.
3. **Produto finalizado**: código organizado, **README completo** e **demonstração visual de todas as telas**.
4. **Build APK via EAS Build** (ou equivalente), instalando e rodando em device/emulador.

### Desafio escolhido → **Desafio 02 — VIN Share / Service Share (retenção no pós-venda)**
- **Por quê:** a entrega mobile anterior do grupo (`../../../challenge/entregas/mobile/ford`) já era um
  app companion (agendamento de serviço, VIN scanner). Mantemos a continuidade do tema. **Se o grupo tiver
  escolhido o Desafio 01, isso é uma mudança de direção e precisa ser sinalizada.**
- Os 3 pilares do Desafio 02 viram as 2 personas do app:
  | Pilar do desafio | Onde vive no app |
  |---|---|
  | Análise e visualização (Service Share por concessionária, modelo, idade do veículo, tipo de serviço, anomalias) | **Advisor → Pulse** |
  | Leads + modelagem preditiva (risco de sair da rede, leads proativos) | **Advisor → Radar + Lead sheet** (modelo de churn explicável on-device) |
  | Jornada do cliente (lembretes, ofertas, agendamento, visão 360°) | **Owner → Garage, Booking, Pass, Dealers** |

### Produto: **Pitlane** — _"Every Ford comes back home."_
Pitlane é onde o carro volta pra ser cuidado. App local-first com duas personas:
- **Owner (cliente Ford):** garagem com saúde do veículo e previsão da próxima revisão, agendamento na
  rede oficial (concessionária mais próxima via GPS + bússola), passe de serviço com QR, histórico,
  ofertas personalizadas, cadastro de veículo por **scan de VIN com a câmera** (dígito verificador ISO 3779).
- **Advisor (consultor de pós-venda):** painel **Pulse** do Service Share com cortes e detecção de
  anomalias; **Radar** de retenção com score de churn explicável (contribuição por feature), pipeline de
  leads e ações de contato que entram numa **outbox** sincronizada (local-first).

---

## 1. Decisões de arquitetura (ADR-lite) — append-only

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Clean Architecture / Hexagonal** em 4 camadas: `domain` (TS puro) → `application` (use cases + ports) → `infrastructure` (adapters: SQLite, SecureStore, sensores) → `presentation` (design system, features, presenters) | Regras isoladas e 100% testáveis sem RN; adapters trocáveis |
| D2 | **Local-first**: SQLite (`expo-sqlite`) é a fonte da verdade; escritas geram eventos na **outbox**; `SyncEngine` drena com retry/backoff exponencial para um `RemoteGateway` (HTTP se `EXPO_PUBLIC_API_URL` existir, senão simulado) | Funciona offline, UX instantânea, demonstra padrão Outbox |
| D3 | **Zustand** só para estado de UI/sessão/preferências (persistido em `expo-sqlite/kv-store`); dados de domínio vêm de repositories via use cases | Separação estado de UI × estado de domínio |
| D4 | **Zod** para env vars (`src/config/env.ts`) e formulários (**react-hook-form** + `@hookform/resolvers/zod`) | Falha cedo, tipos inferidos |
| D5 | **Animações com Reanimated 4 (UI thread)** em vez de GSAP | GSAP roda na JS thread e não tem integração nativa com RN; Reanimated roda worklets na UI thread (60/120fps). GSAP descartado conscientemente |
| D6 | Bottom sheets e modais **nativos** via Expo Router (`presentation: 'formSheet' \| 'modal'`) — nada de `Alert.alert` | UI nativa + componentizado; feedback via Toast/Dialog do design system |
| D7 | i18n **próprio e tipado** (`Translator` + dicionários `en`/`pt-BR`; pt-BR é checado em compile-time contra o shape do `en`) + `Intl` para número/data | Zero chave faltando, 100% testável, sem runtime pesado |
| D8 | DI por **Composition Root** (`AppContainer.create(...)` static factory) exposto via React Context | Sem singletons globais; testes injetam fakes |
| D9 | Repositórios testados com **SQL real** via `sql.js` (WASM) atrás do port `SqlDatabase` | Testa as queries de verdade no Jest, sem device |
| D10 | Ícones próprios (SVG, `react-native-svg`) no componente `Icon` do DS; QR code renderizado pelo nosso componente a partir da matriz do `qrcode` | Identidade própria, sem dependência visual de terceiros |
| D11 | Modelo de churn = **regressão logística com coeficientes calibrados em dados sintéticos**, por trás da interface `ChurnModel` (Strategy) | Explicável (contribuição por feature) e plugável com o modelo da disciplina de IA/ML |
| D12 | Dados sintéticos **determinísticos** (PRNG com seed via env) para concessionárias, frota, histórico | Demo reprodutível; mesmos números nas screenshots e nos testes |

---

## 2. Plano (chaves → itens). Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` feito · `✅` gate aprovado

### P0 — Descoberta e plano
- [x] P0.1 Ler `Ford_V2.pdf` e extrair requisitos do Sprint 3 Mobile
- [x] P0.2 Identificar desafio do grupo (entrega anterior → Desafio 02)
- [x] P0.3 Conceito de produto, personas, arquitetura, decisões D1–D12
- [x] P0.4 Criar este TODO
- ✅ **GATE P0** — plano escrito e commitado

### P1 — Fundação de tooling
- [x] P1.1 Limpar template (`src/app/explore.tsx`, componentes demo, assets expo)
- [x] P1.2 Instalar deps via `npx expo install` (sqlite, haptics, location, camera, local-auth, secure-store, crypto, network, localization, svg, fonts, zustand, zod, rhf)
- [x] P1.3 Jest (`jest-expo`, RNTL, `sql.js`), `jest.config.js` com **threshold global 95%**
- [x] P1.4 ESLint (`expo lint`) + scripts `typecheck`, `test`, `test:cov`, `doctor`, `verify`
- [x] P1.5 `src/config/env.ts` com Zod + testes
- [x] P1.6 `app.json`: nome Pitlane, package `com.fiap.pitlane`, permissões (câmera, localização), plugins
- ✅ **GATE P1 (aprovado)** — `npm run verify` (tsc + lint + jest) verde; `npx expo-doctor` sem erros

### P2 — Domain (TS puro)
- [x] P2.1 Shared kernel: `Result`, `Guard`, `ValueObject`, `Entity`, `Collection` (first-class collections), `DomainError`, `Clock`, `Id`
- [x] P2.2 Value objects: `Vin` (ISO 3779 check digit, WMI Ford), `GeoPoint` (Haversine, bearing), `Mileage`, `Email`, `Money`, `Percentage`, `TimeSlot`
- [x] P2.3 Entidades: `Vehicle`, `Dealer`, `ServiceRecord`, `Appointment` (state machine), `Customer`, `User`/`Role`, `Lead` (pipeline), `Outreach`
- [x] P2.4 Collections: `Vehicles`, `ServiceHistory`, `Dealers`, `Leads`, `Appointments`
- [x] P2.5 Serviços de domínio: `MaintenancePlanner` (próxima revisão por km/tempo), `ServiceShareCalculator` (cortes), `AnomalyDetector` (z-score), `LogisticChurnModel` + `ChurnExplanation`, `LeadSpecification`s
- [x] P2.6 Builders: `AppointmentBuilder`, test data builders
- ✅ **GATE P2 (aprovado)** — domain 100% coberto, tsc verde

### P3 — Infrastructure
- [ ] P3.1 Port `SqlDatabase` + adapter `ExpoSqliteDatabase` + `SqlJsDatabase` (testes)
- [ ] P3.2 Migrations versionadas (`PRAGMA user_version`)
- [ ] P3.3 Seed determinístico (`SeededRandom`, `FleetGenerator`) + seeder idempotente
- [ ] P3.4 Repositories SQLite (+ mappers row↔domain)
- [ ] P3.5 Outbox + `SyncEngine` (backoff exponencial) + `RemoteGateway` (HTTP / simulado)
- [ ] P3.6 Adapters de plataforma: `SecureSessionStorage`, `PasswordHasher` (expo-crypto), `HapticsService`, `LocationService`, `BiometricService`, `NetworkMonitor`, `CameraPermission`
- ✅ **GATE P3** — repos testados com SQL real; cobertura ≥95%

### P4 — Application (use cases)
- [ ] P4.1 Auth: `SignIn`, `SignOut`, `RestoreSession`, `UnlockWithBiometrics`
- [ ] P4.2 Owner: `GetGarage`, `ListDealersNearby`, `BookAppointment`, `CancelAppointment`, `GetServiceHistory`, `RegisterVehicleByVin`, `GetOffers`
- [ ] P4.3 Advisor: `GetServiceSharePulse`, `GetRetentionRadar`, `GetLeadDetail`, `LogOutreach`, `AdvanceLead`
- [ ] P4.4 `AppContainer` (composition root) + `EventBus`
- ✅ **GATE P4** — use cases testados com fakes

### P5 — Design system + i18n + tema
- [ ] P5.1 Tokens: paleta Ford (light/dark), tipografia (Barlow / Barlow Condensed / JetBrains Mono), spacing, radii, elevation, motion
- [ ] P5.2 `ThemeProvider` (system/light/dark) + `useTheme`
- [ ] P5.3 Primitivos: `Text`, `Button` (primary/secondary/ghost/outline/danger × sm/md/lg), `IconButton`, `Card`, `Badge`, `Chip`, `Input`, `SegmentedControl`, `Switch`, `ListItem`, `Avatar`, `Divider`, `Skeleton`, `EmptyState`, `Screen`, `Toast`, `ProgressRing`, `Sparkline`, `BarList`, `Icon`, `QrCode`, `PressableScale`
- [ ] P5.4 i18n tipado `en`/`pt-BR` + formatters
- [ ] P5.5 Haptics semânticos (`tap`, `select`, `success`, `warning`, `heartbeat`)
- ✅ **GATE P5** — todos os componentes com testes de render/variantes

### P6 — Features Owner
- [ ] P6.1 Sign-in (intro animada, escolha de persona, RHF+Zod, biometria)
- [ ] P6.2 Tab bar flutuante própria (indicador animado + haptic)
- [ ] P6.3 Garage (hero do veículo, anel de saúde, próxima revisão prevista, ticket do agendamento, ofertas)
- [ ] P6.4 Booking (modal multi-step: serviço → concessionária por distância → data/slot → revisão → confirmação animada)
- [ ] P6.5 Service Pass (formSheet com QR para check-in)
- [ ] P6.6 History (timeline)
- [ ] P6.7 Dealers (lista por distância + **bússola** apontando pra concessionária via heading do GPS)
- [ ] P6.8 VIN scan (câmera + digitação manual validada)
- [ ] P6.9 Vehicle detail (ficha técnica — Ranger Raptor)
- ✅ **GATE P6** — fluxos Owner testados (render + navegação)

### P7 — Features Advisor
- [ ] P7.1 Pulse (KPI Service Share animado, tendência 12m, cortes por concessionária/modelo/idade/serviço, anomalias)
- [ ] P7.2 Radar (varredura animada com blips por risco + lista filtrável por Specification)
- [ ] P7.3 Lead sheet (formSheet: explicação do score, ações → outbox, avanço de pipeline)
- ✅ **GATE P7** — fluxos Advisor testados

### P8 — Transversal
- [ ] P8.1 Settings (tema, idioma, haptics, biometria, sync center, reset demo, sair)
- [ ] P8.2 Design System showcase (tela navegável com todas as variantes)
- [ ] P8.3 Indicador de sync/offline global
- ✅ **GATE P8**

### P9 — Branding
- [ ] P9.1 Ícone, adaptive icon, splash (SVG → PNG via `rsvg-convert`)
- ✅ **GATE P9** — `expo-doctor` verde

### P10 — Qualidade final
- [ ] P10.1 Cobertura global ≥95% (statements/branches/functions/lines)
- [ ] P10.2 `npm run verify` + `npx expo-doctor` verdes
- ✅ **GATE P10**

### P11 — Build APK
- [ ] P11.1 `eas.json` (perfil `preview` → APK)
- [ ] P11.2 Build (EAS cloud ou `eas build --local` / gradle) e instalação em emulador
- [ ] P11.3 Screenshots de todas as telas
- ✅ **GATE P11** — APK instala e abre

### P12 — Documentação
- [ ] P12.1 README completo (integrantes, desafio, arquitetura com diagrama, telas, como rodar/testar/buildar, decisões)
- ✅ **GATE P12 / ENTREGA**

---

## 3. Log de evidências (append-only)

- **2026-09-25 · P0** — PDF lido (21 págs). Requisitos mobile no slide 13. Desafio 02 inferido pela entrega mobile anterior do grupo (companion app c/ agendamento e VIN). EAS logado (`eas whoami` ok). Android SDK local presente (platforms 35/36, JDK 17), sem system image de emulador ainda.
- **2026-09-25 · P1** — Template removido. Deps via `npx expo install` (SDK 57). Jest: `jest-expo` + RNTL **v14** (render/userEvent são **async**, `await render()`); RNTL 14 exige peer `test-renderer` → fixado em `~1.2.0` (react-reconciler 0.33 = React 19.2; 1.3 pede React 19.3). Resolver `react-native-worklets/jest/resolver` + `setUpTests()` do Reanimated. TS 6 não auto-inclui `@types` → `types: ["jest","node"]`. Env com Zod (`src/config/env.ts`, `.env.example`). **Evidência:** `tsc` limpo · `expo lint` ok · env tests 9/9 · cobertura env 100% · `expo-doctor` **21/21 checks passed**.
  - Nota: saída de comandos passa por um wrapper que resume (ex.: `PASS (9) FAIL (0)`); cobertura lida de `coverage/coverage-summary.json`.
- **2026-09-25 · P2** — Domain em TS puro (zero import de RN): shared kernel (`Result`, `DomainError`, `ValueObject`, `Entity`, `Collection` genérica com self-type, `Specification`, `Clock`, `Money`, `Percentage`), VOs (`Vin` c/ dígito verificador ISO 3779 + WMI Ford→país + ano-modelo; `GeoPoint` Haversine/bearing; `Mileage`, `Email` c/ máscara LGPD, `TimeSlot`), entidades (`Vehicle`, `Dealer`, `Customer`, `User`+`Role` RBAC, `ServiceRecord`, `Appointment` state machine, `Lead` pipeline, `Outreach`), collections (`Vehicles`, `Dealers`, `ServiceHistory`, `Appointments`, `Leads`), serviços (`MaintenancePlanner` 2 relógios km/tempo, `SlotPlanner` c/ almoço/sábado/baias, `ServiceShareCalculator` 4 cortes + tendência, `AnomalyDetector` z-score, `ChurnFeatureExtractor` + `LogisticChurnModel` explicável, `NextBestActions`, `OfferEngine`), builders (`AppointmentBuilder` + test data builders em `__fixtures__`). Ficha técnica **Ranger Raptor** idêntica ao slide do kick-off (completude 100%, campos ausentes explícitos → alinhado ao Desafio 01 também).
  - **Evidência:** 104 testes · cobertura domain **100% stmts / 100% branches / 100% funcs / 100% lines** · `tsc` limpo · lint ok. TZ dos testes fixado em `America/Sao_Paulo` (jest.config.js).
  - Dica: rodar `node node_modules/jest/bin/jest.js` direto mostra a saída crua (o `npx` passa por wrapper que resume).
