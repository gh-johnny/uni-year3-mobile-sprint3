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

> Pitlane é onde o carro volta para ser cuidado. Um único app local-first com **duas personas**: o **dono** do Ford e o **consultor de pós-venda**.

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
| **APK final**, com todos os fluxos do desafio funcionando sem erros | APK release gerado (ver [§5](#5-como-rodar-testar-e-gerar-o-apk)) e **percorrido no emulador Android 15**: agendamento completo, passe QR, cadastro por VIN, histórico, concessionárias, Pulse, Radar, Lead sheet, sync, tema/idioma. Os defeitos que só apareceram no dispositivo foram corrigidos ([§9](#9-qualidade-e-verificação)) |
| **Identidade visual consolidada** (componentes, cores, tipografia, UX) | Design system próprio (`src/presentation/design-system`): tokens, ~30 componentes, 45 ícones SVG, tema claro/escuro, tipografia Barlow / Barlow Condensed / JetBrains Mono, tela-vitrine **Profile → Design system** ([§4](#4-telas)) |
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

Capturas do APK release rodando no emulador (Pixel 7, Android 15).

### Owner

<table>
<tr>
<td align="center"><img src="docs/screenshots/owner-01-sign-in.png" width="190"><br><sub>Login (persona)</sub></td>
<td align="center"><img src="docs/screenshots/owner-02-garage.png" width="190"><br><sub>Garage</sub></td>
<td align="center"><img src="docs/screenshots/owner-09-garage-next-visit.png" width="190"><br><sub>Garage · próximo agendamento</sub></td>
<td align="center"><img src="docs/screenshots/owner-16-garage-dark-ptbr.png" width="190"><br><sub>Garage · escuro · pt-BR</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-03-booking-service.png" width="190"><br><sub>Booking 1/4 · serviço</sub></td>
<td align="center"><img src="docs/screenshots/owner-04-booking-dealer.png" width="190"><br><sub>Booking 2/4 · concessionária</sub></td>
<td align="center"><img src="docs/screenshots/owner-05-booking-slot.png" width="190"><br><sub>Booking 3/4 · horário</sub></td>
<td align="center"><img src="docs/screenshots/owner-06-booking-review.png" width="190"><br><sub>Booking 4/4 · revisão</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-07-booking-success.png" width="190"><br><sub>Confirmação</sub></td>
<td align="center"><img src="docs/screenshots/owner-08-service-pass.png" width="190"><br><sub>Service pass (QR)</sub></td>
<td align="center"><img src="docs/screenshots/owner-10-history.png" width="190"><br><sub>History</sub></td>
<td align="center"><img src="docs/screenshots/owner-11-dealers-compass.png" width="190"><br><sub>Dealers · bússola</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/owner-12-vehicle.png" width="190"><br><sub>Vehicle</sub></td>
<td align="center"><img src="docs/screenshots/owner-13-vehicle-specs.png" width="190"><br><sub>Ficha técnica</sub></td>
<td align="center"><img src="docs/screenshots/owner-14-scan-camera.png" width="190"><br><sub>Scan · câmera</sub></td>
<td align="center"><img src="docs/screenshots/owner-15-scan-manual.png" width="190"><br><sub>Scan · VIN manual</sub></td>
</tr>
</table>

### Advisor

<table>
<tr>
<td align="center"><img src="docs/screenshots/advisor-02-pulse.png" width="190"><br><sub>Pulse</sub></td>
<td align="center"><img src="docs/screenshots/advisor-03-pulse-trend.png" width="190"><br><sub>Pulse · tendência</sub></td>
<td align="center"><img src="docs/screenshots/advisor-04-pulse-breakdown.png" width="190"><br><sub>Pulse · cortes</sub></td>
<td align="center"><img src="docs/screenshots/advisor-09-pulse-dark.png" width="190"><br><sub>Pulse · escuro</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/advisor-05-radar.png" width="190"><br><sub>Radar</sub></td>
<td align="center"><img src="docs/screenshots/advisor-06-radar-leads.png" width="190"><br><sub>Radar · leads</sub></td>
<td align="center"><img src="docs/screenshots/advisor-07-lead-sheet.png" width="190"><br><sub>Lead sheet</sub></td>
<td align="center"><img src="docs/screenshots/advisor-08-lead-contacted.png" width="190"><br><sub>Contato → outbox</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/advisor-10-radar-dark.png" width="190"><br><sub>Radar · escuro</sub></td>
<td align="center"><img src="docs/screenshots/advisor-11-pulse-ptbr.png" width="190"><br><sub>Pulse · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/advisor-12-radar-ptbr.png" width="190"><br><sub>Radar · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/advisor-01-sign-in.png" width="190"><br><sub>Login (advisor)</sub></td>
</tr>
</table>

### Compartilhadas

<table>
<tr>
<td align="center"><img src="docs/screenshots/shared-01-profile.png" width="190"><br><sub>Profile</sub></td>
<td align="center"><img src="docs/screenshots/shared-05-profile-ptbr.png" width="190"><br><sub>Profile · pt-BR</sub></td>
<td align="center"><img src="docs/screenshots/shared-02-sync-center.png" width="190"><br><sub>Sync center</sub></td>
<td align="center"><img src="docs/screenshots/shared-03-design-system.png" width="190"><br><sub>Design system</sub></td>
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

### APK

**Via EAS Build** (perfil `preview` → APK instalável):

```bash
npm run build:apk          # = eas build -p android --profile preview
```

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
| Cobertura (threshold global 95 %) | **99,3 %** statements · **95,9 %** branches · **99,4 %** functions · **99,5 %** linhas |
| `expo-doctor` | 21/21 checks |
| APK release no emulador (Android 15) | todos os fluxos das duas personas percorridos, sem crash no _logcat_ |

Como os testes rodam: domínio e casos de uso sobre **SQL real** (`sql.js`); telas com React Native Testing Library dirigidas por eventos de usuário; e um teste que sobe o **app inteiro** (`expo-router/testing-library`, rotas reais + _guards_ + tab bar + restauração de sessão + bloqueio biométrico) sobre o container real, com _fakes_ apenas para os módulos de dispositivo.

**O que só o dispositivo revelou** (e foi corrigido, com teste de regressão quando possível):
- **Crash ao abrir _Dealers_**: uma função JS comum era chamada dentro de um _worklet_ do Reanimated (o UI runtime não executa "remote functions"). Agora é um worklet.
- **Gráfico de tendência vazio no Pulse**: o _reveal_ com `ClipPath` animado não é reinvalidado no Android; trocado por _fade_ via `useAnimatedStyle`.
- **"R$17,403.6" em vez de "R$17,4 mil"**: o Hermes/Android ignora `notation: 'compact'` do `Intl`; o formato compacto agora é montado à mão.
- Relógio da status bar ilegível sobre o cabeçalho azul do login; "Last sync" incoerente com a outbox após reiniciar o app.

### Limitações conhecidas (transparência)
- A **leitura de código de barras** e a **bússola** foram validadas na lógica e nos testes, mas o emulador não tem câmera com cena real nem magnetômetro — a leitura real do VIN e a seta acompanhando o giro do aparelho devem ser conferidas em um device físico. A **biometria** também depende de hardware.
- O gateway de sync é **simulado** por padrão (15 % de falha, para exibir o _backoff_); a API real é opcional via `EXPO_PUBLIC_API_URL`.
- Todos os dados (frota, concessionárias, histórico, NPS) são **sintéticos e determinísticos**.
- O build via **EAS** está configurado (`eas.json`), mas o APK entregue foi gerado localmente com Gradle.

---

## 10. Identidade visual

Azul Ford (`#00095B`) como âncora, um único acento quente — o laranja "Code Orange" da Raptor (`#FF5F1F`) — e uma rampa de neutros azulados. Motivo recorrente: a **hachura de pit-lane** (`PitStripe`), usada em cartões-herói, separadores, no ícone do app e na splash. Tipografia: **Barlow Condensed** para títulos/números (aspecto de painel de instrumentos), **Barlow** para texto e **JetBrains Mono** para VIN e códigos. Movimento: molas curtas e amortecidas — "pit stop, não pula-pula". Tudo isso está navegável na tela **Profile → Design system**.

---

## 11. Licença

Projeto acadêmico (FIAP × Ford, 2026). Marcas e nomes de concessionárias/clientes usados nos dados são fictícios ou ilustrativos.
