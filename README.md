---
title: Pitlane — Challenge Ford Sprint 3
status: experimental
created: 2026-09-25
last-updated: 2026-09-27
last-reviewed: 2026-09-27
---

# Pitlane — _Every Ford comes back home._

App mobile (Expo / React Native) para o **Desafio 02 da Ford — VIN Share / Service Share (retenção no pós-venda)**.

| | |
|---|---|
| **Instituição** | FIAP — Faculdade de Informática e Administração Paulista |
| **Disciplina** | Mobile Development and IoT — Challenge Ford 2026 |
| **Entrega** | Sprint 3 — 27/09/2026 |
| **Integrantes** | João Marcelo Furtado Romero — **RM555199** · Matheus Rivera Montovaneli — **RM555499** · André Nakamatsu Rocha — **RM555004** |
| **Stack** | Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router · TypeScript (strict) |
| **Pacote Android** | `br.com.fiap.pitlane` |
| **CI/CD** | GitHub Actions (`semantic branch → develop → main`) + EAS Build — [§11](#11-cicd--github-actions--eas-build) |
| **Containers** | Docker multi-stage · Compose · Makefile — [§12](#12-containers-docker--compose--makefile) |

> Pitlane é onde o carro volta para ser cuidado. Um único app local-first com **duas personas**: o **dono** do Ford e o **consultor de pós-venda**.

**Sumário** — [1. Desafio](#1-o-desafio-e-como-o-app-o-resolve) · [2. Requisitos da Sprint](#2-o-que-a-sprint-3-pede--onde-está-atendido) · [3. Funcionalidades](#3-funcionalidades) · [4. Telas](#4-telas) · [5. Rodar/testar/APK](#5-como-rodar-testar-e-gerar-o-apk) · [6. Arquitetura](#6-arquitetura) · [7. Decisões](#7-decisões-de-arquitetura) · [8. Churn](#8-modelo-de-retenção-churn) · [9. Qualidade](#9-qualidade-e-verificação) · [10. Identidade visual](#10-identidade-visual) · [11. CI/CD](#11-cicd--github-actions--eas-build) · [12. Containers](#12-containers-docker--compose--makefile) · [13. Convenções e JSDoc](#13-convenções-de-código-branches-commits-e-jsdoc) · [14. Licença](#14-licença)

---

## 1. O desafio e como o app o resolve

O Desafio 02 pede três pilares. Cada um vira uma parte concreta do app:

| Pilar do desafio | Onde vive no app |
|---|---|
| **Análise e visualização** — Service Share por concessionária, modelo, idade do veículo e tipo de serviço, com detecção de anomalias | **Advisor → Pulse** |
| **Leads e modelagem preditiva** — risco de o cliente deixar a rede; leads proativos | **Advisor → Radar** e **Lead sheet** (modelo de churn explicável, on-device) |
| **Jornada do cliente** — lembretes, ofertas, agendamento, visão 360° | **Owner → Garage, Booking, Pass, History, Dealers, Vehicle, Scan** |

**Service Share (VIN Share)**, como o app calcula: dos veículos do parque circulante, a fração que fez ao menos um serviço **pago** em uma concessionária Ford nos últimos 12 meses. O corte "por tipo de serviço" responde a outra pergunta: de todos os serviços de um tipo feitos pela frota, quantos ficaram na rede.

### Contas de demonstração

| Persona | E-mail | Senha |
|---|---|---|
| **Owner** (Ana Ribeiro) | `ana@pitlane.app` | `ford2026` |
| **Advisor** (Carlos Mendes · Ford Pinheiros) | `carlos@pitlane.app` | `ford2026` |

Os campos já vêm preenchidos na tela de login ao escolher a persona.

---

## 2. O que a Sprint 3 pede × onde está atendido

| Requisito (slide "Sprint 3 — Mobile Development and IoT") | Atendimento |
|---|---|
| **APK final**, com todos os fluxos do desafio funcionando sem erros | APK release validado na revisão anterior (ver [§5](#5-como-rodar-testar-e-gerar-o-apk)); a revisão visual atual foi compilada em debug e foi percorrida no emulador Android 15. Fluxos: agendamento completo, passe QR, cadastro por VIN, histórico, concessionárias, Pulse, Radar, Lead sheet, sync, tema/idioma. Os defeitos que só apareceram no dispositivo foram corrigidos ([§9](#9-qualidade-e-verificação)) |
| **Identidade visual consolidada** (componentes, cores, tipografia, UX) | Design system próprio (`src/presentation/design-system`): tokens, ~30 componentes, 45 ícones SVG, tema claro/escuro, tipografia Archivo Black / IBM Plex Sans / JetBrains Mono, tela-vitrine **Profile → Design system** ([§4](#4-telas)) |
| **Produto finalizado**: código organizado, README completo e demonstração visual de todas as telas | Arquitetura em 4 camadas ([§6](#6-arquitetura)), este README e a galeria de telas ([§4](#4-telas)) |
| **Build APK via EAS Build (ou equivalente)** | `eas.json` com perfil `preview` (→ APK) e `npm run build:apk`. O APK entregue foi compilado **localmente com Gradle** (equivalente), instalado e executado no emulador |

Recursos nativos/IoT usados de verdade: **câmera** (leitura do código de barras do VIN), **GPS** (concessionária mais próxima), **bússola/magnetômetro** (seta apontando para a concessionária), **biometria** (bloqueio do app), **haptics**, **SecureStore** (sessão JWT), **rede** (offline → pausa o sync; reconexão → drena) e **SQLite**.

---

## 3. Funcionalidades

### Owner (cliente Ford)
- **Garage** — carrossel de veículos com "tacômetro" de saúde de revisão (dois relógios: km e tempo), próxima revisão prevista, ticket do próximo agendamento, ofertas personalizadas, garantia, hodômetro e gasto na rede.
- **Booking** — modal em 4 passos: serviço → concessionária (ordenada por distância, GPS com _fallback_ para o endereço) → data/horário (baias reais, almoço, sábado até 12h) → revisão → confirmação animada. Agendar **fecha o ciclo de retenção**: o lead do veículo passa a `scheduled`.
- **Service pass** — sheet com **QR de check-in** e cancelamento com confirmação (regra de 2 h).
- **History** — linha do tempo unificada (serviços na rede, fora da rede e agendamentos).
- **Dealers** — lista por distância com **bússola** (seta = _bearing_ − _heading_), horário de funcionamento, agendar e ligar.
- **Scan de VIN** — câmera (code39/code128/datamatrix/QR/PDF417) ou digitação; decodificação **ISO 3779** ao vivo (WMI Ford → país, ano-modelo, dígito verificador).
- **Vehicle** — ficha técnica padronizada (campo ausente é mostrado como "Não disponível", nunca omitido) e histórico.

### Advisor (consultor de pós-venda)
- **Pulse** — Service Share da concessionária vs. rede, tendência de 12 meses, quatro cortes (concessionária, modelo, idade, serviço) com marcador da média da rede e **anomalias por z-score**.
- **Radar** — varredura animada com um _blip_ por lead (colorido por risco; quanto mais perto do centro, mais urgente) e lista filtrável (Críticos, Abertos, Fora da garantia, Contatáveis).
- **Lead sheet** — probabilidade de churn, **contribuição de cada feature** ("por que este cliente pode sair"), próxima melhor ação, contato (respeitando **LGPD**: sem consentimento, sem outreach) e pipeline (`new → contacted → scheduled → won/lost`, só os movimentos válidos aparecem).

### Transversal
- **Local-first**: SQLite é a fonte da verdade; toda escrita relevante entra numa **outbox** drenada com _retry_ e _backoff_ exponencial. **Sync center** e um indicador global (pílula) mostram o que está pendente/enviado.
- Tema **claro / escuro / sistema**, idioma **EN / PT-BR / sistema**, haptics e bloqueio biométrico configuráveis, _reset_ dos dados de demonstração.

---

## 4. Telas

Capturas de 27/09/2026 do build de desenvolvimento no emulador Android 15 (720 × 1600), com a identidade azul Ford e dados de demonstração. Incluem os temas claro/escuro e os idiomas EN/PT-BR; câmera e localização usam os recursos simulados do emulador.

### Owner

<table>
<tr>
<td align="center"><img src="docs/screenshots/owner-01-sign-in.png" alt="Login (persona)" width="190"><br><sub>Login (persona)</sub></td>
<td align="center"><img src="docs/screenshots/owner-02-garage.png" alt="Garage" width="190"><br><sub>Garage</sub></td>
<td align="center"><img src="docs/screenshots/owner-09-garage-next-visit.png" alt="Garage · próximo agendamento" width="190"><br><sub>Garage · próximo agendamento</sub></td>
<td align="center"><img src="docs/screenshots/owner-16-garage-dark-ptbr.png" alt="Garage · escuro · pt-BR" width="190"><br><sub>Garage · escuro · pt-BR</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-03-booking-service.png" alt="Booking 1/4 · serviço" width="190"><br><sub>Booking 1/4 · serviço</sub></td>
<td align="center"><img src="docs/screenshots/owner-04-booking-dealer.png" alt="Booking 2/4 · concessionária" width="190"><br><sub>Booking 2/4 · concessionária</sub></td>
<td align="center"><img src="docs/screenshots/owner-05-booking-slot.png" alt="Booking 3/4 · horário" width="190"><br><sub>Booking 3/4 · horário</sub></td>
<td align="center"><img src="docs/screenshots/owner-06-booking-review.png" alt="Booking 4/4 · revisão" width="190"><br><sub>Booking 4/4 · revisão</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-07-booking-success.png" alt="Confirmação" width="190"><br><sub>Confirmação</sub></td>
<td align="center"><img src="docs/screenshots/owner-08-service-pass.png" alt="Service pass (QR)" width="190"><br><sub>Service pass (QR)</sub></td>
<td align="center"><img src="docs/screenshots/owner-10-history.png" alt="History" width="190"><br><sub>History</sub></td>
<td align="center"><img src="docs/screenshots/owner-11-dealers-compass.png" alt="Dealers · bússola" width="190"><br><sub>Dealers · bússola</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-12-vehicle.png" alt="Vehicle" width="190"><br><sub>Vehicle</sub></td>
<td align="center"><img src="docs/screenshots/owner-13-vehicle-specs.png" alt="Ficha técnica" width="190"><br><sub>Ficha técnica</sub></td>
<td align="center"><img src="docs/screenshots/owner-14-scan-camera.png" alt="Scan · câmera" width="190"><br><sub>Scan · câmera</sub></td>
<td align="center"><img src="docs/screenshots/owner-15-scan-manual.png" alt="Scan · VIN manual" width="190"><br><sub>Scan · VIN manual</sub></td>
</tr>
</table>

### Advisor

<table>
<tr>
<td align="center"><img src="docs/screenshots/advisor-02-pulse.png" alt="Pulse" width="190"><br><sub>Pulse</sub></td>
<td align="center"><img src="docs/screenshots/advisor-03-pulse-trend.png" alt="Pulse · tendência" width="190"><br><sub>Pulse · tendência</sub></td>
<td align="center"><img src="docs/screenshots/advisor-04-pulse-breakdown.png" alt="Pulse · cortes" width="190"><br><sub>Pulse · cortes</sub></td>
<td align="center"><img src="docs/screenshots/advisor-09-pulse-dark.png" alt="Pulse · escuro" width="190"><br><sub>Pulse · escuro</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/advisor-05-radar.png" alt="Radar" width="190"><br><sub>Radar</sub></td>
<td align="center"><img src="docs/screenshots/advisor-06-radar-leads.png" alt="Radar · leads" width="190"><br><sub>Radar · leads</sub></td>
<td align="center"><img src="docs/screenshots/advisor-07-lead-sheet.png" alt="Lead sheet" width="190"><br><sub>Lead sheet</sub></td>
<td align="center"><img src="docs/screenshots/advisor-08-lead-contacted.png" alt="Contato → outbox" width="190"><br><sub>Contato → outbox</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/advisor-10-radar-dark.png" alt="Radar · escuro" width="190"><br><sub>Radar · escuro</sub></td>
<td align="center"><img src="docs/screenshots/advisor-11-pulse-ptbr.png" alt="Pulse · pt-BR" width="190"><br><sub>Pulse · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/advisor-12-radar-ptbr.png" alt="Radar · pt-BR" width="190"><br><sub>Radar · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/advisor-01-sign-in.png" alt="Login (advisor)" width="190"><br><sub>Login (advisor)</sub></td>
</tr>
</table>

### Compartilhadas

<table>
<tr>
<td align="center"><img src="docs/screenshots/shared-01-profile.png" alt="Profile" width="190"><br><sub>Profile</sub></td>
<td align="center"><img src="docs/screenshots/shared-05-profile-ptbr.png" alt="Profile · pt-BR" width="190"><br><sub>Profile · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/shared-02-sync-center.png" alt="Sync center" width="190"><br><sub>Sync center</sub></td>
<td align="center"><img src="docs/screenshots/shared-03-design-system.png" alt="Design system" width="190"><br><sub>Design system</sub></td>
</tr>
</table>

---

## 5. Como rodar, testar e gerar o APK

Pré-requisitos: Node 20+, JDK 17 e Android SDK (para o build local).

```bash
npm install
cp .env.example .env.local        # opcional — todas as variáveis são validadas por Zod
npx expo run:android              # dev build no emulador/dispositivo (ou instale o APK, ver abaixo)
```

### Qualidade

```bash
npm run typecheck                                  # tsc (strict)
npm run lint                                       # expo lint
npm run test:cov                                   # Jest + cobertura (threshold global de 95%)
npm run verify                                     # os três acima
npx expo-doctor                                    # 21/21 checks
```

> Sem Node instalado (ou para reproduzir o CI)? `make verify` roda tudo isso **dentro de um container** — ver [§12](#12-containers-docker--compose--makefile). `make help` lista os comandos.

### APK

**Via EAS Build** (perfil `preview` → APK instalável):

```bash
npm run build:apk          # = eas build -p android --profile preview
```

Os perfis de `eas.json` (`development`, `preview`, `production`, `production-apk`) e como o CI os usa estão em [§11](#11-cicd--github-actions--eas-build).

**Local (Gradle)** — o caminho usado para gerar o APK entregue:

```bash
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk
adb install -r app-release.apk
```

> O `android/` é gerado (Continuous Native Generation) e está no `.gitignore`. O APK local é assinado com a chave de debug do template — serve para instalação/avaliação, não para a Play Store.

### Variáveis de ambiente (`.env.example`)

| Variável | Padrão | Função |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` | ambiente |
| `EXPO_PUBLIC_API_URL` | _vazio_ | endpoint real (`POST /sync/events`, Bearer JWT). Vazio → gateway **simulado** |
| `EXPO_PUBLIC_SEED` | `2026` | semente do gerador de dados sintéticos (demo reprodutível) |
| `EXPO_PUBLIC_SYNC_INTERVAL_MS` | `15000` | intervalo do sync da outbox |
| `EXPO_PUBLIC_SIMULATED_FAILURE_RATE` | `0.15` | taxa de falha do gateway simulado (demonstra o _backoff_) |

### Ícone e splash

Fontes em `assets/branding/*.svg`; `scripts/branding.sh` (usa `rsvg-convert`) regenera os PNGs de `assets/images/`.

---

## 6. Arquitetura

Clean / Hexagonal em **4 camadas**. As dependências apontam sempre para dentro; `domain` é TypeScript puro (zero import de React Native).

```mermaid
flowchart TB
  subgraph presentation["presentation — UI"]
    direction LR
    app["src/app<br/>rotas Expo Router (re-exports)"] --> features["features/*<br/>telas"]
    features --> presenters["presenters<br/>domínio → view model"]
    features --> ds["design-system<br/>tokens · componentes · ícones"]
    features --> state["state (zustand)<br/>preferências · sessão · toasts"]
    features --> i18n["i18n tipado<br/>EN · PT-BR"]
  end
  subgraph application["application — casos de uso"]
    usecases["auth · garage · booking · register-vehicle · advisor"]
    ports["ports (interfaces)"]
    bus["EventBus · RetentionService"]
  end
  subgraph domain["domain — TS puro"]
    entities["entidades · VOs · collections"]
    rules["planners · Service Share · anomalias · churn"]
  end
  subgraph infrastructure["infrastructure — adapters"]
    sqlite["SQLite (expo-sqlite)<br/>repositórios + migrations"]
    outbox["Outbox + SyncEngine"]
    native["câmera · GPS/bússola · biometria<br/>haptics · rede · SecureStore · JWT"]
    container["AppContainer<br/>(composition root)"]
  end
  presentation --> application
  application --> domain
  infrastructure -. implementa .-> ports
  container --> usecases
```

```
src/
  domain/            VOs (Vin, GeoPoint, Money…), entidades, collections, Specifications,
                     MaintenancePlanner, ServiceShareCalculator, AnomalyDetector, LogisticChurnModel
  application/       ports, casos de uso, RetentionService, EventBus
  infrastructure/    repositórios SQLite + migrations, seed determinístico, JWT HS256, outbox/SyncEngine,
                     adapters nativos, container.ts (composition root)
  presentation/      app (bootstrap), design-system, i18n, state, hooks, presenters, navigation, features
  app/               rotas do Expo Router — finas, só re-exportam a tela
  test-utils/        container de teste (sql.js) + fakes de haptics/biometria/bússola/rede
```

**Padrões aplicados**: Repository, Composition Root / DI por contexto, Static Factory (`create/restore/for`), Builder (`AppointmentBuilder`, _test data builders_), Specification (filtros do Radar), Strategy (`ChurnModel`), Observer (`EventBus`), Outbox transacional, State Machine (`Appointment`, `Lead`, `BookingDraft`), Presenter, _first-class collections_, Result (erros como valores).

---

## 7. Decisões de arquitetura

| # | Decisão | Motivo |
|---|---|---|
| D1 | Clean/Hexagonal em 4 camadas | Regras isoladas e testáveis sem RN; adapters trocáveis |
| D2 | **Local-first**: SQLite como fonte da verdade + **outbox** com _retry/backoff_ exponencial para um `RemoteGateway` (HTTP se `EXPO_PUBLIC_API_URL`, senão simulado) | Funciona offline, UX instantânea, padrão Outbox demonstrável |
| D3 | Zustand só para estado de UI/sessão/preferências (persistido no `expo-sqlite/kv-store`) | Separa estado de UI de estado de domínio |
| D4 | Zod para _env vars_ e formulários (react-hook-form + resolver) | Falha cedo, tipos inferidos |
| D5 | Animações com **Reanimated 4 (UI thread)** em vez de GSAP | GSAP roda na thread JS e não tem integração nativa com RN; worklets rodam a 60/120 fps |
| D6 | Sheets e modais **nativos** via Expo Router (`formSheet`/`modal`); nenhum `Alert.alert` — feedback por toast + haptic e `ConfirmDialog` | UI nativa e componentizada |
| D7 | i18n **próprio e tipado**: pt-BR é checado em compilação contra o shape do `en`; `Intl` para número/data com _fallback_ | Nenhuma chave faltando; sem runtime pesado |
| D8 | DI por **Composition Root** exposto via React Context | Sem singletons globais; testes injetam fakes |
| D9 | Repositórios testados com **SQL real** via `sql.js` (WASM) atrás da porta `SqlDatabase` | Testa as queries de verdade no Jest |
| D10 | Ícones SVG próprios; **QR renderizado por nós** a partir da matriz do `qrcode` | Identidade própria, sem dependência visual de terceiros |
| D11 | Churn = **regressão logística** com coeficientes calibrados em dados sintéticos, atrás da interface `ChurnModel` | Explicável (contribuição por feature) e plugável com o modelo da disciplina de IA/ML |
| D12 | Dados sintéticos **determinísticos** (PRNG com semente) | Demo reprodutível; mesmos números nos testes e nas telas |

---

## 8. Modelo de retenção (churn)

Regressão logística, `p = σ(β₀ + Σ βᵢ·xᵢ)`. Cada `βᵢ·xᵢ` é a contribuição exata da feature no log-odds — é isso que a **Lead sheet** exibe como "por que este cliente pode sair".

| Feature | β | Leitura |
|---|---:|---|
| _intercepto_ | −3,60 | |
| `monthsSinceService` (≤ 36) | +0,075 | meses desde a última visita à rede |
| `warrantyExpired` | +0,80 | garantia vencida |
| `vehicleAge` | +0,08 | idade do veículo (anos) |
| `overdue` (≤ 3) | +0,50 | múltiplos do intervalo de revisão já rodados |
| `outsideVisits` (≤ 4) | +0,55 | visitas a oficinas independentes (24 meses) |
| `distance` (≤ 60 km) | +0,025 | distância até a concessionária |
| `connected` | −0,60 | veículo conectado (protege) |
| `detractor` | +0,85 | NPS baixo |

Faixas de risco: `critical ≥ 75%`, `high ≥ 55%`, `medium ≥ 30%`, `low` abaixo (leads começam em 30%). A **próxima melhor ação** segue um _playbook_ por causa dominante (lembrete de revisão, plano de fidelidade pós-garantia, _pick-up & delivery_, recuperação de serviço, oferta de retorno, convite de check-up).

**Calibração (sonda com a frota sintética de 640 veículos, semente 2026):** Service Share da rede **56,5 %** · Ford Pinheiros **62,9 %** · **Ford Guarulhos 25 %** → anomalia com **z = −3,02** · 26 leads em Pinheiros (6 low, 8 medium, 2 high, 10 critical) · ≈ **R$ 17,1 mil/ano** em risco. Os coeficientes foram recalibrados porque a primeira versão saturava em 99 %.

---

## 9. Qualidade e verificação

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` (strict) | limpo |
| `expo lint` | 0 mensagens |
| Jest | **348 testes** em 25 suítes, todos verdes |
| Cobertura (threshold global 95 %) | **99,09 %** statements · **95,42 %** branches · **99,15 %** functions · **99,31 %** linhas |
| `expo-doctor` | 21/21 checks |
| Android 15 no emulador | APK release da revisão anterior percorrido; revisão visual atual compilada em debug com Gradle |
| GitHub Actions (Node 22) | instalação estrita, typecheck, lint, cobertura, Expo Doctor e export Android/Hermes aprovados |
| Container Node 22 (`docker build --target check`) | `npm ci` estrito + typecheck + lint + 348 testes + gate de cobertura — verde na validação anterior à revisão visual |
| `expo-doctor` e `expo export` no container | 21/21 · bundle Hermes de 5,4 MB |
| Infra estática | `actionlint` (workflows), `hadolint` (Dockerfiles) e `docker compose config`: 0 problemas |

Como os testes rodam: domínio e casos de uso sobre **SQL real** (`sql.js`); telas com React Native Testing Library dirigidas por eventos de usuário; e um teste que sobe o **app inteiro** (`expo-router/testing-library`, rotas reais + _guards_ + tab bar + restauração de sessão + bloqueio biométrico) sobre o container real, com _fakes_ apenas para os módulos de dispositivo.

**O que só o dispositivo revelou** (e foi corrigido, com teste de regressão quando possível):
- **Crash ao abrir _Dealers_**: uma função JS comum era chamada dentro de um _worklet_ do Reanimated (o UI runtime não executa "remote functions"). Agora é um worklet.
- **Gráfico de tendência vazio no Pulse**: o _reveal_ com `ClipPath` animado não é reinvalidado no Android; trocado por _fade_ via `useAnimatedStyle`.
- **"R$17,403.6" em vez de "R$17,4 mil"**: o Hermes/Android ignora `notation: 'compact'` do `Intl`; o formato compacto agora é montado à mão.
- **Retorno ao login em Dealers/Booking**: a janela de permissão de localização era interpretada como saída do app e acionava o bloqueio biométrico. O pedido agora é acompanhado até o retorno da atividade, preservando a sessão durante a permissão.
- Relógio da status bar ilegível sobre o cabeçalho azul do login; "Last sync" incoerente com a outbox após reiniciar o app.

### Limitações conhecidas (transparência)
- A **leitura de código de barras** e a **bússola** foram validadas na lógica e nos testes, mas o emulador não tem câmera com cena real nem magnetômetro — a leitura real do VIN e a seta acompanhando o giro do aparelho devem ser conferidas em um device físico. A **biometria** também depende de hardware.
- O gateway de sync é **simulado** por padrão (15 % de falha, para exibir o _backoff_); a API real é opcional via `EXPO_PUBLIC_API_URL`.
- Todos os dados (frota, concessionárias, histórico, NPS) são **sintéticos e determinísticos**.
- O build via **EAS** está configurado (`eas.json`), mas o APK entregue foi gerado localmente com Gradle.

---

## 10. Identidade visual

Direção **telemetria de pista**: azul-marinho Ford (`#00095B`), azul luminoso (`#65B5FF`) e superfícies claras em branco azulado (`#F1F5FC`). **Archivo Black** dá peso aos títulos e indicadores; **IBM Plex Sans** mantém os textos legíveis; **JetBrains Mono** identifica códigos e pequenas legendas técnicas. Painéis com recortes, cantos assimétricos e um circuito abstrato em SVG compõem a identidade. O segmento percorre o circuito; os veículos mudam de escala e inclinação no carrossel; o dock e as etapas do agendamento respondem com animações. As animações Reanimated respeitam a preferência de movimento reduzido do sistema. Verde, ocre e vermelho preservam o significado dos estados. Referências de contexto: [app da Ford](https://www.fromtheroad.ford.com/us/en/articles/2025/redesigned-essential-your-new-ford-and-lincoln-apps) e [IBM Plex](https://www.ibm.com/plex/). Os tokens e componentes estão na tela **Profile → Design system**. A galeria acima registra essa revisão visual. Os assets do ícone e da abertura também usam a paleta azul e estão incluídos no novo build nativo de desenvolvimento.

---

## 11. CI/CD — GitHub Actions + EAS Build

Pipeline **adaptado do projeto `troca`** (`frontend/troca-mobile`): mesma ideia — um job `verify` que serve de portão, PRs de promoção abertos automaticamente e build EAS — reduzida de três ambientes (`dev → hom → main`) para **dois** (`develop → main`).

> Repositório: [gh-johnny/uni-year3-mobile-sprint3](https://github.com/gh-johnny/uni-year3-mobile-sprint3). Projeto EAS: [beo-johnny/pitlane](https://expo.dev/accounts/beo-johnny/projects/pitlane), vinculado em `app.json`. O `verify` já foi executado no GitHub; os builds EAS exigem `EXPO_TOKEN` nos secrets do repositório. A promoção para `main` depende do APK de desenvolvimento concluído.

### Fluxo

```mermaid
flowchart LR
  subgraph S1["1 · branch semântica"]
    A["feat/* · fix/* · chore/* …"] -->|push| V1{{"verify"}}
  end
  V1 -->|passou| PR1["PR → develop<br/>(aberto pelo CI)"]
  PR1 -.->|"o PR também roda verify"| M1(["merge em develop"])
  subgraph S2["2 · develop"]
    M1 --> V2{{"verify"}}
    V2 -->|passou| B1["EAS build dev<br/>(APK)"]
  end
  B1 -->|gerou| PR2["PR → main<br/>(aberto pelo CI)"]
  PR2 -.->|"o PR também roda verify"| M2(["merge em main (default)"])
  subgraph S3["3 · main"]
    M2 --> V3{{"verify"}}
    V3 -->|passou| B2["EAS build prod<br/>(AAB + APK)"]
  end
```

Nenhum PR é mesclado automaticamente — o CI **abre** o PR; a revisão e o merge são humanos.

### Jobs (`.github/workflows/ci.yml`)

| Job | Quando roda | Depende de | O que faz |
|---|---|---|---|
| `branch-name` | todo push/PR | — | Exige `<tipo>/<descricao-em-kebab>` (ou `main`/`develop`) |
| `verify` | todo push/PR | `branch-name` | `npm ci` → typecheck → lint → testes com **gate de cobertura ≥ 95 %** → `expo-doctor` → `expo export` (bundle Hermes). Publica o relatório de cobertura como artefato |
| `open-pr-develop` | push em branch semântica | `verify` | `gh pr create --base develop` (título = último commit) |
| `build-dev` | push em `develop` | `verify` | `eas workflow:run .eas/workflows/dev.yml` → **APK de desenvolvimento** |
| `open-pr-main` | push em `develop` | `build-dev` | `gh pr create --base main --head develop` |
| `build-prod` | push em `main` | `verify` | `eas workflow:run .eas/workflows/production.yml` → **AAB + APK de produção** |

Comportamentos deliberados: `concurrency` cancela execuções antigas da mesma branch (exceto em `develop`/`main`, para não matar um build EAS em andamento); `timeout-minutes` em todo job; `permissions` mínimas por job.

### Perfis do EAS (`eas.json`) e workflows (`.eas/workflows/`)

| Perfil | Saída | Usado por |
|---|---|---|
| `development` | APK interno (`EXPO_PUBLIC_APP_ENV=development`) | `.eas/workflows/dev.yml` ← job `build-dev` |
| `preview` | APK interno | `npm run build:apk` (entrega da Sprint) |
| `production` | **AAB** (`app-bundle`), `autoIncrement` | `.eas/workflows/production.yml` ← job `build-prod` |
| `production-apk` | **APK** (`extends: production`) | idem |

Um build do EAS gera **um** formato por perfil (o `buildType`), por isso "AAB + APK" são dois jobs no workflow de produção.

### Configuração do repositório e das esteiras

1. **Branches:** `main` é a default; `develop` é a branch de integração. Alterações partem de uma branch semântica e chegam às duas por PR, seguindo os gates acima.
2. **Actions → permissões:** _Settings → Actions → General → Workflow permissions_: **"Allow GitHub Actions to create and approve pull requests"** (em organização, habilitar também no nível da org — foi exatamente o bloqueio que o `troca` encontrou: `GitHub Actions is not permitted to create or approve pull requests`).
3. **Secrets:**
   - `EXPO_TOKEN` — token do expo.dev (obrigatório para `build-dev`/`build-prod`);
   - `PR_BOT_TOKEN` — PAT (ou GitHub App) com _Pull requests: read/write_. **Por quê:** PRs abertos com o `GITHUB_TOKEN` padrão _não disparam_ outros workflows, então o PR nasceria sem checks. Sem o secret o pipeline ainda funciona (cai no `github.token`), mas o PR não terá o `verify`.
4. **Environments** `development` e `production` (em _Settings → Environments_); em `production`, marque _Required reviewers_ para exigir aprovação antes do build de produção.
5. **Branch protection** em `develop` e `main`: exigir PR e os checks `semantic branch name` e `verify (typecheck · lint · test · doctor · build)`; bloquear push direto.
6. **Expo:** `app.json` já contém `owner` e `extra.eas.projectId`. Para administrar o projeto: `npx eas-cli login`; credenciais Android: `npx eas-cli credentials --platform android`. Não é preciso conectar o app do GitHub ao Expo: quem dispara o build é o próprio CI.

### Diferenças em relação ao `troca`

| `troca` | Pitlane | Por quê |
|---|---|---|
| `feat/*`/`fix/*` → `dev` → `hom` → `main` | branch semântica → `develop` → `main` | Pedido do fluxo (dois estágios) |
| Workflows do EAS com `on: push` (o app do EAS builda por conta própria) | Workflows **sem `on:`**, disparados pelo job do CI com `eas workflow:run --wait` | O build só acontece **se o `verify` passar** (com `on: push` ele rodaria em paralelo, ignorando o CI) |
| `gh pr create` com `github.token` | `PR_BOT_TOKEN` com _fallback_ para `github.token` | O PR precisa disparar os checks |
| PR de promoção logo após o `verify` | PR `develop → main` só **depois do APK dev** | Pedido do fluxo |
| Produção só APK | **AAB + APK** (dois perfis) | Play Store + instalação direta |
| Dev com `developmentClient` (exige `expo-dev-client`) | Dev = APK interno, sem _dev client_ | Não adiciona dependência nativa ao app; para trocar: `npx expo install expo-dev-client` + `developmentClient: true` |
| `appVersionSource: remote` | idem (`autoIncrement` só em produção) | O `versionCode` sobe sem commit no CI |
| `npm ci --legacy-peer-deps` | `npm ci` estrito | O lockfile do Pitlane instala limpo (comprovado no container) |
| lint + typecheck + test | + cobertura ≥ 95 % + `expo-doctor` + `expo export` | Pedido: build, testes e doctor |

### Reproduzir localmente

```bash
make ci-local             # infra (actionlint, hadolint, compose) + verify dentro do container
make eas-dev              # dry-run: só mostra o comando do build EAS de dev
make eas-dev CONFIRM=1    # executa de verdade (precisa de login/projeto Expo)
```

---

## 12. Containers (Docker · Compose · Makefile)

> Um app mobile **não precisa** de container — isto é por paridade com o CI, onboarding sem instalar Node e, sendo sincero, também um flex. Os alvos abaixo foram **executados e validados**, não só escritos (exceções: `make apk-local` e `make rebuild`, que não foram reexecutados).

### O que tem aqui

| Arquivo | Função |
|---|---|
| `Dockerfile` | Multi-stage (Node 22, usuário não-root, cache do npm via BuildKit, `HEALTHCHECK`) |
| `compose.yml` | Serviços e perfis (dev, ferramentas, cobertura, API mock) |
| `Makefile` | Atalhos auto-documentados (`make help`) |
| `docker/mock-api/` | API de mentira para a **outbox** (`POST /sync/events`, idempotente por `id`) |
| `.dockerignore` | Mantém `node_modules`, `android/`, `.git`, screenshots… fora do contexto |

**Estágios do `Dockerfile`**

| Alvo (`--target`) | O que faz |
|---|---|
| `deps` | `npm ci` — só refaz quando `package*.json` mudam |
| `source` | dependências + código (base das ferramentas) |
| `check` | typecheck + lint + testes + gate de cobertura — **o build falha se algo quebrar** |
| `coverage` | (scratch) exporta o relatório: `docker build --target coverage -o coverage .` |
| `bundle` / `bundle-out` | `expo export` (Hermes) / exporta o bundle: `docker build --target bundle-out -o dist/android .` |
| `dev` _(padrão)_ | Metro com hot reload na porta 8081 |

**Serviços do `compose.yml`**

| Serviço | Perfil | Comando / porta |
|---|---|---|
| `app` | _(padrão)_ | Metro (`:8081`), código-fonte montado como volume → hot reload |
| `typecheck` · `lint` · `test` · `doctor` · `verify` · `bundle` | `tools` | one-shots; código _baked_ na imagem (mesmo que o CI). `test`/`verify` gravam `./coverage` |
| `coverage` | `reports` | nginx servindo o HTML de cobertura em `:8080` |
| `mock-api` | `sync` | API mock da outbox em `:4000` (`FAIL_RATE` simula 503 para ver o _backoff_) |

### Comandos (`make help` lista todos)

| Comando | O que faz |
|---|---|
| `make build` | Constrói as imagens (dev, tools, mock-api) |
| `make test` | Testes + gate de cobertura **dentro do container** |
| `make lint` · `make typecheck` · `make doctor` | Idem, para cada verificação |
| `make verify` | typecheck + lint + testes + doctor (= job `verify` do CI) |
| `make bundle` | `expo export` no container → `./dist/android` |
| `make up` · `make down` · `make logs` | Metro em segundo plano · derruba tudo · logs |
| `make shell` · `make shell-dev` | Shell numa imagem descartável · no Metro em execução |
| `make sync-up` · `make sync-events` | Sobe a API mock · lista o que ela recebeu |
| `make coverage` | Serve o relatório em http://localhost:8080 |
| `make check-infra` | `actionlint` + `hadolint` + `compose config` (via container) |
| `make ci-local` | `check-infra` + `verify` — reproduz o pipeline sem sair da máquina |
| `make *-local` | Versões no host (`test-local`, `cov-local`, `verify-local`…) |
| `make apk-local` | APK release via prebuild + Gradle (precisa de JDK 17 + Android SDK) |
| `make eas-dev` · `make eas-prod` | Builds EAS — _dry-run_ por padrão, `CONFIRM=1` para executar |
| `make clean` · `make docker-clean` · `make prune` | Limpeza (artefatos · containers/imagens · dangling) |

```bash
# Metro para um celular na mesma rede (o celular precisa enxergar o host, não o container)
EXPO_HOST_IP=192.168.0.10 make up

# API mock da outbox + app apontando para ela (emulador Android: 10.0.2.2 = host)
make sync-up
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 make up
make sync-events
```

### Validação realizada

| Verificação | Resultado |
|---|---|
| `docker build --target check` (Node 22) | `npm ci` + typecheck + lint + 348 testes + cobertura 99,3 / 95,9 / 99,4 / 99,5 — verde |
| `make test` · `make doctor` · `make bundle` | verde · 21/21 · bundle de 5,4 MB |
| `make up` | Metro `healthy`; manifesto e bundle Android de desenvolvimento servidos (HTTP 200, ≈ 11,6 MB) |
| `make sync-up` | mock `healthy`; reenvio do mesmo evento → `duplicates: 1`; payload inválido → 400 |
| `make coverage` | nginx serve o relatório (99,27 % / 95,94 % / 99,37 % / 99,53 %) |
| `make export-bundle` · `make export-coverage` | artefatos saem do build direto para `dist/android` e `coverage/` (BuildKit `--output`) |
| `make build` · `make shell` · `make versions` · `make size` | exit 0; o shell roda como `node` (uid 1000) em Node 22 com `TZ=America/Sao_Paulo` |
| `make eas-dev` · `make eas-prod` | _dry-run_ imprime o comando; nada é enviado ao Expo sem `CONFIRM=1` |
| `actionlint` · `hadolint` · `docker compose config` | 0 problemas |

### Limitações

- **O APK/AAB não é gerado em container**: exige Android SDK + NDK (~5 GB). Quem builda é o EAS (§11) ou `make apk-local`.
- As imagens têm ≈ 1,6 GB (é o `node_modules` do React Native).
- A API mock usa HTTP em texto puro; o Android bloqueia isso em _release_ — use com builds de debug/desenvolvimento.
- `expo-doctor` é baixado pelo `npx` a cada execução (precisa de rede).

---

## 13. Convenções de código: branches, commits e JSDoc

### Branches e commits

- **Branch semântica:** `<tipo>/<descricao-em-kebab-case>` com `tipo` ∈ `feat · fix · docs · style · refactor · perf · test · build · ci · chore · revert · hotfix`. Ex.: `feat/passe-qr`, `fix/crash-dealers`. O job `branch-name` reprova qualquer outra coisa.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(presentation): …`, `fix: …`, `test: …`, `docs: …`. O título do PR aberto pelo CI é o do último commit, então mantenha-o semântico. Autoria: o nome de cada integrante, **sem** `Co-Authored-By` de IA.

### JSDoc

APIs públicas de domínio, aplicação e infraestrutura (e alguns hooks/presenters) têm JSDoc para que o **hover do editor** já explique o contrato — não é preciso abrir o arquivo. Comentários no código ficam em inglês (como o resto do código); este README, em português.

Convenções:

- Explique **o contrato e o porquê**, não repita o tipo TypeScript.
- Tags usadas: `@param`, `@returns`, `@throws`, `@typeParam`, `@example`, `@remarks` e `{@link}`.
- Códigos de erro do domínio aparecem em `@returns`/`@throws` (`booking.slotTaken`, `lead.noConsent`…) — são as chaves de `errors.*` no i18n.
- Todo `@example` deve ser verdadeiro (os números dos exemplos foram conferidos).

Onde há JSDoc detalhado:

| Camada | Símbolos |
|---|---|
| `domain/shared` | `Result` (todos os métodos) |
| `domain/vehicle` | `Vin` (`create`, `computeCheckDigit`, `withCheckDigit`, `modelYear`, `formatted`…) |
| `domain/geo` | `GeoPoint` (`create`, `distanceTo`, `bearingTo`) |
| `domain/service` | `MaintenancePlanner` (`forecast`, `statusFor`) |
| `domain/analytics` | `AnomalyDetector` (`segments`, `trendBreak`) |
| `domain/retention` | `LogisticChurnModel`, `RiskScore`, `Lead.registerContact` |
| `application/use-cases` | `BookAppointment`, `CancelAppointment`, `ListDealersNearby` |
| `infrastructure` | `SyncEngine` (`start`, `stop`, `setOnline`, `sync`, `subscribe`…), `AppContainer` |
| `presentation` | `useResult`, `Translator`, `Formatters` (`signedPoints`, `relative`), `BookingDraft`, `unwrapAngle` |

Exemplo real (`Vin.modelYear`):

```ts
/**
 * Decodes the model year from the 10th character. The code repeats every 30 years, so the
 * result is the most recent cycle that is not after `referenceYear + 1` (next model year).
 *
 * @param referenceYear - Usually the current year.
 * @returns The model year, or `null` when the 10th character is not a year code.
 * @example
 * Vin.restore('9BFZZZ540PB123456').modelYear(2026);  // 2023
 */
```

---

## 14. Licença

Projeto acadêmico (FIAP × Ford, 2026). Marcas e nomes de concessionárias/clientes usados nos dados são fictícios ou ilustrativos.
