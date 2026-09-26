# Pitlane — Makefile
#
# `make` sem argumentos mostra a ajuda. Convenção dos nomes:
#   <alvo>        roda DENTRO do container (paridade com o CI)
#   <alvo>-local  roda direto no host (precisa de Node/JDK instalados)
#
# Qualquer alvo aceita sobrescrever variáveis: `make up METRO_PORT=8082 EXPO_HOST_IP=192.168.0.10`.

.DEFAULT_GOAL := help
SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c

COMPOSE    ?= docker compose
DOCKER     ?= docker
NPM        ?= npm
IMAGE      ?= pitlane
PROFILES   := --profile tools --profile sync --profile reports
CONFIRM    ?= 0

# cores ANSI (desligue com NO_COLOR=1)
ifndef NO_COLOR
  B := \033[1m
  C := \033[36m
  Y := \033[33m
  G := \033[32m
  R := \033[0m
endif

.PHONY: help \
        install-local start-local typecheck-local lint-local test-local cov-local doctor-local verify-local bundle-local branding deps-fix \
        build build-dev build-check rebuild images size \
        test lint typecheck doctor verify bundle shell shell-dev \
        up up-attached down restart logs ps sync-up sync-events coverage coverage-down \
        export-coverage export-bundle \
        lint-dockerfile lint-workflows compose-config check-infra ci-local \
        apk-local eas-validate eas-dev eas-prod \
        clean docker-clean prune versions doctor-env

##@ Ajuda

help: ## Lista os comandos disponíveis (alvo padrão)
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(B)Pitlane$(R) — comandos do Makefile\n\nUso: make $(C)<alvo>$(R) [VAR=valor]\n"} \
	  /^[a-zA-Z0-9_.-]+:.*##/ { printf "  $(C)%-18s$(R) %s\n", $$1, $$2 } \
	  /^##@/ { printf "\n$(B)%s$(R)\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@printf "\nDica: $(Y)make ci-local$(R) reproduz o pipeline inteiro (infra + verify) sem sair da máquina.\n\n"

##@ Local (host — precisa de Node 22)

install-local: ## npm ci (instalação estrita pelo lockfile)
	$(NPM) ci

start-local: ## Sobe o Metro/Expo no host
	npx expo start

typecheck-local: ## tsc --noEmit
	$(NPM) run typecheck

lint-local: ## expo lint
	$(NPM) run lint

test-local: ## Jest (sem cobertura)
	$(NPM) test

cov-local: ## Jest + cobertura com gate de 95%
	$(NPM) run test:cov

doctor-local: ## expo-doctor
	npx expo-doctor

verify-local: ## typecheck + lint + testes/cobertura + doctor (o que o CI roda)
	$(NPM) run verify
	npx expo-doctor

bundle-local: ## expo export (bundle Hermes do Android) em ./dist-ci
	npx expo export --platform android --output-dir dist-ci

branding: ## Regenera ícone/splash a partir de assets/branding/*.svg (rsvg-convert)
	./scripts/branding.sh

deps-fix: ## Alinha dependências às versões do SDK (expo install --fix)
	npx expo install --fix

##@ Docker — imagens

build: ## Constrói TODAS as imagens (dev, tools, mock-api)
	$(COMPOSE) $(PROFILES) build

build-dev: ## Constrói só a imagem do servidor de desenvolvimento
	$(COMPOSE) build app

build-check: ## docker build --target check (typecheck+lint+testes: falha o build se algo quebrar)
	$(DOCKER) build --target check --progress=plain -t $(IMAGE):check .

rebuild: ## Reconstrói tudo do zero, sem cache
	$(COMPOSE) $(PROFILES) build --no-cache --pull

images: ## Lista as imagens do projeto
	@$(DOCKER) images --filter "reference=$(IMAGE)*" --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'

size: ## Tamanho de cada camada da imagem dev
	@$(DOCKER) history --human --format 'table {{.Size}}\t{{.CreatedBy}}' $(IMAGE):dev | cut -c1-110 | head -25

##@ Docker — rodando DENTRO do container

test: ## Testes + gate de cobertura (≥95%) no container (relatório em ./coverage)
	@mkdir -p coverage
	$(COMPOSE) run --rm --build test

lint: ## expo lint no container
	$(COMPOSE) run --rm --build lint

typecheck: ## tsc --noEmit no container
	$(COMPOSE) run --rm --build typecheck

doctor: ## expo-doctor no container
	$(COMPOSE) run --rm --build doctor

verify: ## typecheck + lint + testes + doctor no container (= job `verify` do CI)
	@mkdir -p coverage
	$(COMPOSE) run --rm --build verify

bundle: ## expo export no container → ./dist/android
	@mkdir -p dist
	$(COMPOSE) run --rm --build bundle

shell: ## Shell bash numa imagem "tools" descartável (código baked, igual ao CI)
	$(COMPOSE) run --rm --build --entrypoint bash test

shell-dev: ## Shell no container de dev que já está rodando (make up)
	$(COMPOSE) exec app bash

##@ Docker — ambiente de desenvolvimento

up: ## Sobe o Metro em segundo plano (http://localhost:8081) — defina EXPO_HOST_IP p/ celular
	$(COMPOSE) up -d --build app
	@printf "$(G)Metro no ar$(R): http://localhost:$${METRO_PORT:-8081}  ·  logs: make logs  ·  parar: make down\n"

up-attached: ## Sobe o Metro em primeiro plano, interativo (teclas r/a/i do Expo funcionam)
	$(COMPOSE) up --build app

down: ## Derruba tudo (mantém volumes)
	$(COMPOSE) $(PROFILES) down --remove-orphans

restart: ## Reinicia o Metro
	$(COMPOSE) restart app

logs: ## Acompanha os logs do Metro
	$(COMPOSE) logs -f --tail=100 app

ps: ## Status dos containers
	$(COMPOSE) $(PROFILES) ps -a

sync-up: ## Sobe a API mock da outbox (:4000); aponte EXPO_PUBLIC_API_URL para ela e rode `make up`
	$(COMPOSE) --profile sync up -d --build mock-api
	@printf "$(G)mock-api$(R) em http://localhost:$${MOCK_API_PORT:-4000}  ·  no emulador Android use http://10.0.2.2:$${MOCK_API_PORT:-4000}\n"

sync-events: ## Mostra os eventos que a API mock recebeu (JSON)
	@curl -fsS http://localhost:$${MOCK_API_PORT:-4000}/events | (command -v jq >/dev/null && jq . || cat)

coverage: ## Serve o relatório HTML de cobertura em http://localhost:8080 (rode `make test` antes)
	@test -d coverage/lcov-report || { echo "Sem relatório: rode 'make test' (ou 'make cov-local') primeiro."; exit 1; }
	$(COMPOSE) --profile reports up -d coverage
	@printf "$(G)Cobertura$(R): http://localhost:$${COVERAGE_PORT:-8080}\n"

coverage-down: ## Para o servidor do relatório de cobertura
	$(COMPOSE) --profile reports stop coverage

##@ Docker — artefatos via BuildKit (--output, sem volume)

export-coverage: ## Roda o gate no build e exporta o relatório para ./coverage
	$(DOCKER) build --target coverage --output type=local,dest=coverage .

export-bundle: ## Exporta o bundle Hermes do Android para ./dist/android
	$(DOCKER) build --target bundle-out --output type=local,dest=dist/android .

##@ Qualidade da infraestrutura

lint-dockerfile: ## hadolint nos Dockerfiles (via container)
	$(DOCKER) run --rm -i hadolint/hadolint hadolint --ignore DL3008 - < Dockerfile
	$(DOCKER) run --rm -i hadolint/hadolint hadolint - < docker/mock-api/Dockerfile

lint-workflows: ## actionlint nos workflows do GitHub Actions (via container)
	$(DOCKER) run --rm -v "$$PWD":/repo -w /repo rhysd/actionlint:latest -color

compose-config: ## Valida o compose.yml (todos os perfis)
	$(COMPOSE) $(PROFILES) config -q && printf "$(G)compose.yml OK$(R)\n"

check-infra: lint-workflows lint-dockerfile compose-config ## Workflows + Dockerfiles + compose

ci-local: check-infra verify ## Reproduz o pipeline: infra + verify no container (sem EAS)
	@printf "\n$(G)$(B)pipeline local OK$(R) — só falta o CI de verdade + build EAS\n"

##@ Android / EAS (não roda nada caro sem CONFIRM=1)

apk-local: ## APK release via prebuild + Gradle (precisa de JDK 17 + Android SDK/NDK)
	@test -n "$${ANDROID_HOME:-}" || { echo "Defina ANDROID_HOME (Android SDK)."; exit 1; }
	cp package.json .package.json.bak
	npx expo prebuild -p android --no-install
	mv .package.json.bak package.json # o prebuild reescreve os scripts android/ios
	cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
	@printf "$(G)APK$(R): android/app/build/outputs/apk/release/app-release.apk\n"

eas-validate: ## Valida os workflows do EAS (precisa de `eas init` + login)
	npx eas-cli workflow:validate .eas/workflows/dev.yml
	npx eas-cli workflow:validate .eas/workflows/production.yml

eas-dev: ## Build EAS de dev (APK) — o CI faz isso em `develop`. Exige CONFIRM=1
ifeq ($(CONFIRM),1)
	npx eas-cli workflow:run .eas/workflows/dev.yml --non-interactive --wait
else
	@printf "$(Y)Dry-run$(R). Rodaria: eas workflow:run .eas/workflows/dev.yml --non-interactive --wait\n   Para executar de verdade: make eas-dev CONFIRM=1\n"
endif

eas-prod: ## Build EAS de produção (APK + AAB) — o CI faz isso em `main`. Exige CONFIRM=1
ifeq ($(CONFIRM),1)
	npx eas-cli workflow:run .eas/workflows/production.yml --non-interactive --wait
else
	@printf "$(Y)Dry-run$(R). Rodaria: eas workflow:run .eas/workflows/production.yml --non-interactive --wait\n   Para executar de verdade: make eas-prod CONFIRM=1\n"
endif

##@ Limpeza e diagnóstico

clean: ## Remove artefatos locais (coverage, dist, dist-ci)
	rm -rf coverage dist dist-ci

docker-clean: ## Derruba containers/volumes do projeto e remove as imagens pitlane:*
	$(COMPOSE) $(PROFILES) down --volumes --remove-orphans
	-$(DOCKER) rmi $$($(DOCKER) images --filter "reference=$(IMAGE)*" -q | sort -u) 2>/dev/null

prune: ## Remove imagens dangling (libera espaço no Docker)
	$(DOCKER) image prune -f

versions: ## Versões das ferramentas
	@printf "node    %s\nnpm     %s\n" "$$(node -v 2>/dev/null || echo -)" "$$(npm -v 2>/dev/null || echo -)"
	@printf "docker  %s\n" "$$($(DOCKER) --version 2>/dev/null || echo -)"
	@printf "compose %s\n" "$$($(COMPOSE) version --short 2>/dev/null || echo -)"
	@printf "make    %s\n" "$$($(MAKE) --version | head -1)"

doctor-env: ## Confere o ambiente: daemon do Docker, arquivos de env, portas
	@$(DOCKER) info >/dev/null 2>&1 && printf "$(G)✔$(R) daemon do Docker acessível\n" || { printf "✘ daemon do Docker indisponível\n"; exit 1; }
	@test -f .env.local && printf "$(G)✔$(R) .env.local encontrado\n" || printf "$(Y)•$(R) sem .env.local (ok: usa os padrões do .env.example)\n"
	@for p in 8081 4000 8080; do (ss -ltn 2>/dev/null | grep -q ":$$p " && printf "$(Y)•$(R) porta $$p em uso\n") || printf "$(G)✔$(R) porta $$p livre\n"; done
