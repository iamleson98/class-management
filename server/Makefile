.PHONY: build package run stop run-client run-server run-node run-haserver stop-haserver stop-client stop-server restart restart-server restart-client restart-haserver start-docker update-docker clean-dist clean nuke check-style check-client-style check-server-style check-unit-tests test dist run-client-tests setup-run-client-tests cleanup-run-client-tests test-client build-linux build-osx build-freebsd build-windows package-prep package-linux package-osx package-windows internal-test-web-client vet run-server-for-web-client-tests diff-config prepackaged-plugins prepackaged-binaries test-server test-server-ee test-server-elasticsearch test-server-opensearch test-server-quick test-server-race test-mmctl-unit test-mmctl-e2e test-mmctl test-mmctl-coverage mmctl-build mmctl-docs new-migration migrations-extract test-public mocks-public run-server-faketime default-roles-permissions generated

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

ifeq ($(OS),Windows_NT)
        PLATFORM := Windows
else
        PLATFORM := $(shell uname)
endif


define LICENSE_HEADER
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

endef

IS_CI ?= false
# Build Flags
BUILD_NUMBER ?= $(BUILD_NUMBER:)
BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)
BUILD_TAGS =


# Docker
export COMPOSE_PROJECT_NAME=sitename-server

# If we don't set the build number it defaults to dev
ifeq ($(BUILD_NUMBER),)
        BUILD_DATE := n/a
        BUILD_NUMBER := dev
endif

# Go test sum configuration
GOTESTSUM_FORMAT ?= testname
GOTESTSUM_JUNITFILE ?= report.xml
GOTESTSUM_JSONFILE ?= gotestsum.json

# Go test coverage
ENABLE_COVERAGE ?= false
ifeq ($(ENABLE_COVERAGE),true)
COVERAGE_FLAG = -coverprofile=cover.out -covermode=atomic
endif

# mmctl
MMCTL_BUILD_TAGS =
MMCTL_TESTFLAGS ?= -timeout 30m
MMCTL_PKG = github.com/sitename/sitename/server/v8/cmd/mmctl/commands
MMCTL_BUILD_DATE = $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
MMCTL_GIT_COMMIT = $(shell git rev-parse HEAD)
ifeq ($(OS),Windows_NT)
MMCTL_GIT_TREE_STATE = clean
else
MMCTL_GIT_TREE_STATE = $(shell if [ -n "$$(git status --porcelain 2>/dev/null)" ]; then echo "dirty"; else echo "clean"; fi)
endif
MMCTL_COMMIT_DATE = $(shell TZ=UTC git log -1 --date=format-local:'%Y-%m-%dT%H:%M:%SZ' --format='%cd' 2>/dev/null || echo "dev")
MMCTL_LDFLAGS += -X "$(MMCTL_PKG).buildDate=$(MMCTL_BUILD_DATE)"
MMCTL_LDFLAGS += -X "$(MMCTL_PKG).gitCommit=$(MMCTL_GIT_COMMIT)"
MMCTL_LDFLAGS += -X "$(MMCTL_PKG).gitTreeState=$(MMCTL_GIT_TREE_STATE)"
MMCTL_LDFLAGS += -X "$(MMCTL_PKG).commitDate=$(MMCTL_COMMIT_DATE)"

# Enterprise
BUILD_ENTERPRISE_DIR ?= ../../enterprise
BUILD_ENTERPRISE ?= true
BUILD_ENTERPRISE_READY = false
BUILD_TYPE_NAME = team
BUILD_HASH_ENTERPRISE = none
ifneq ($(wildcard $(BUILD_ENTERPRISE_DIR)/.),)
        MMCTL_TESTFLAGS += -ldflags '-X "$(MMCTL_PKG).EnableEnterpriseTests=true" -X "github.com/sitename/sitename/server/public/model.BuildEnterpriseReady=true"'
        MMCTL_BUILD_TAGS += enterprise

  ifeq ($(BUILD_ENTERPRISE),true)
        BUILD_ENTERPRISE_READY = true
        BUILD_TYPE_NAME = enterprise
        BUILD_HASH_ENTERPRISE = $(shell cd $(BUILD_ENTERPRISE_DIR) && git rev-parse HEAD)
        BUILD_TAGS += enterprise
  else
        BUILD_ENTERPRISE_READY = false
        BUILD_TYPE_NAME = team
  endif
else
        BUILD_ENTERPRISE_READY = false
        BUILD_TYPE_NAME = team
endif

FIPS_ENABLED ?= false
ifeq ($(FIPS_ENABLED),true)
        BUILD_TYPE_NAME := $(BUILD_TYPE_NAME)-fips
endif

# Clean up the old means of importing enterprise source, if it exists
ifneq ($(wildcard channels/imports/imports.go),)
        IGNORE := $(shell rm -f channels/imports/imports.go)
endif

# Source available, already included with enterprise but also available during development.
ifeq ($(BUILD_NUMBER),dev)
        BUILD_TAGS += sourceavailable
endif

# Webapp
BUILD_WEBAPP_DIR ?= ../webapp
BUILD_WEBAPP_DIR_WIN := $(subst /,\,$(BUILD_WEBAPP_DIR))

# We need current user's UID for `run-haserver` so docker compose does not run server
# as root and mess up file permissions for devs. When running like this HOME will be blank
# and docker will add '/', so we need to set the go-build cache location or we'll get
# permission errors on build as it tries to create a cache in filesystem root.
ifeq ($(OS),Windows_NT)
export CURRENT_UID = 1000:1000
else
export CURRENT_UID = $(shell id -u):$(shell id -g)
endif
ifeq ($(HOME),/)
        export XDG_CACHE_HOME = /tmp/go-cache/
endif

# Go Flags
# Use -buildvcs=false to avoid embedding VCS info which can cause false positives in container scanning tools
export GOFLAGS ?= -buildvcs=false
# We need to export GOBIN to allow it to be set
# for processes spawned from the Makefile
export GOBIN ?= $(CURDIR)/bin
GO ?= go

# mockery is built through the tools/mockery wrapper module, which overrides
# golang.org/x/tools with a version able to load packages on Go 1.27 (the pin
# bundled with mockery v3 cannot parse Go 1.27 export data). GOWORK=off because
# the wrapper module is intentionally not part of go.work.
MOCKERY_BUILD = cd tools/mockery && GOWORK=off $(GO) build -o $(GOBIN)/mockery github.com/vektra/mockery/v3

ifeq ($(FIPS_ENABLED),true)
        BUILD_TAGS += requirefips
        MMCTL_BUILD_TAGS += requirefips
endif

        DELVE ?= $(GOBIN)/dlv
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.BuildNumber=$(BUILD_NUMBER)"
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.BuildDate=$(BUILD_DATE)"
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.BuildHash=$(BUILD_HASH)"
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)"
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)"

GO_MAJOR_VERSION = $(shell $(GO) version | cut -c 14- | cut -d' ' -f1 | cut -d'.' -f1 | sed 's/[^0-9].*//')
GO_MINOR_VERSION = $(shell $(GO) version | cut -c 14- | cut -d' ' -f1 | cut -d'.' -f2 | sed 's/[^0-9].*//')
MINIMUM_SUPPORTED_GO_MAJOR_VERSION = 1
MINIMUM_SUPPORTED_GO_MINOR_VERSION = 15
GO_VERSION_VALIDATION_ERR_MSG = Golang version is not supported, please update to at least $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION).$(MINIMUM_SUPPORTED_GO_MINOR_VERSION)
GO_COMPATIBILITY_TEST_VERSIONS := 1.22.7 1.23.6

# GOOS/GOARCH of the build host, used to determine whether we're cross-compiling or not
BUILDER_GOOS_GOARCH="$(shell $(GO) env GOOS)_$(shell $(GO) env GOARCH)"

PLATFORM_FILES="./cmd/sitename"

# Output paths
DIST_ROOT=dist
DIST_PATH=$(DIST_ROOT)/sitename
DIST_PATH_LIN_AMD64=$(DIST_ROOT)/linux_amd64/sitename
DIST_PATH_LIN_ARM64=$(DIST_ROOT)/linux_arm64/sitename
DIST_PATH_OSX_AMD64=$(DIST_ROOT)/darwin_amd64/sitename
DIST_PATH_OSX_ARM64=$(DIST_ROOT)/darwin_arm64/sitename
DIST_PATH_FREEBSD_AMD64=$(DIST_ROOT)/freebsd_amd64/sitename
DIST_PATH_FREEBSD_ARM64=$(DIST_ROOT)/freebsd_arm64/sitename
DIST_PATH_WIN=$(DIST_ROOT)/windows/sitename

# Packages lists
TE_PACKAGES=$(shell $(GO) list ./public/...) $(shell $(GO) list ./... | grep -vE 'server/v8/cmd/mmctl')
MMCTL_PACKAGES=$(shell $(GO) list ./... | grep -E 'server/v8/cmd/mmctl')

TEMPLATES_DIR=templates

# Plugins Packages
PLUGIN_PACKAGES ?= $(PLUGIN_PACKAGES:)
PLUGIN_PACKAGES += mattermost-plugin-calls-v1.12.0
PLUGIN_PACKAGES += mattermost-plugin-github-v2.7.1
PLUGIN_PACKAGES += mattermost-plugin-gitlab-v1.13.0
PLUGIN_PACKAGES += mattermost-plugin-jira-v4.7.1
PLUGIN_PACKAGES += mattermost-plugin-playbooks-v2.10.0
PLUGIN_PACKAGES += mattermost-plugin-servicenow-v2.4.0
PLUGIN_PACKAGES += mattermost-plugin-zoom-v1.13.0
PLUGIN_PACKAGES += mattermost-plugin-agents-v2.4.1
PLUGIN_PACKAGES += mattermost-plugin-boards-v9.3.0-rc2
PLUGIN_PACKAGES += mattermost-plugin-user-survey-v1.1.1
PLUGIN_PACKAGES += mattermost-plugin-mscalendar-v1.6.1
PLUGIN_PACKAGES += mattermost-plugin-msteams-meetings-v2.4.1
PLUGIN_PACKAGES += mattermost-plugin-metrics-v0.7.0
PLUGIN_PACKAGES += mattermost-plugin-channel-export-v1.3.0

# Overwrite the definition of PLUGIN_PACKAGES with the list of FIPS-ready plugins
# Note that the '+' in the file name is encoded as %2B for the URL we use to
# download the package from to work. This will no longer be needed when we unify
# the way we pre-package FIPS and non-FIPS plugins.
ifeq ($(FIPS_ENABLED),true)
        PLUGIN_PACKAGES  = mattermost-plugin-playbooks-v2.10.0%2B090a26d-fips
        PLUGIN_PACKAGES += mattermost-plugin-agents-v2.4.1%2Bad98a52-fips
        PLUGIN_PACKAGES += mattermost-plugin-boards-v9.3.0-rc2%2B5880c13-fips
endif

EE_PACKAGES=$(shell $(GO) list $(BUILD_ENTERPRISE_DIR)/...)

ifeq ($(BUILD_ENTERPRISE_READY),true)
  ALL_PACKAGES=$(TE_PACKAGES) $(EE_PACKAGES)
else
  ALL_PACKAGES=$(TE_PACKAGES)
endif

CONFIG_FILE_PATH ?= ./config/config.json

all: run ## Alias for 'run'.

-include config.override.mk

# Make sure not to modify an overridden ENABLED_DOCKER_SERVICES variable
DOCKER_SERVICES_OVERRIDE=false
ifneq (,$(ENABLED_DOCKER_SERVICES))
  $(info ENABLED_DOCKER_SERVICES has been overridden)
  DOCKER_SERVICES_OVERRIDE=true
endif

include config.mk
include build/*.mk
include public/Makefile

LDFLAGS += -X "github.com/sitename/sitename/server/public/model.MockCWS=$(MM_ENABLE_CWS_MOCK)"
LDFLAGS += -X "github.com/sitename/sitename/server/public/model.MattermostGiphySdkKey=$(MM_GIPHY_SDK_KEY)"

RUN_IN_BACKGROUND ?=
ifeq ($(RUN_SERVER_IN_BACKGROUND),true)
        RUN_IN_BACKGROUND := &
endif

DOCKER_COMPOSE_OVERRIDE=
ifneq ("$(wildcard ./docker-compose.override.yaml)","")
  DOCKER_COMPOSE_OVERRIDE=-f docker-compose.override.yaml
endif


# Support for pgvector postgres image
MM_USE_PGVECTOR ?= false
ifeq ($(MM_USE_PGVECTOR),true)
  $(info Using pgvector/pgvector image for PostgreSQL)
  DOCKER_COMPOSE_OVERRIDE := -f docker-compose.pgvector.yml $(DOCKER_COMPOSE_OVERRIDE)
endif

ifneq ($(DOCKER_SERVICES_OVERRIDE),true)
  ifeq (,$(findstring rustfs,$(ENABLED_DOCKER_SERVICES)))
    TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) rustfs
  endif
  ifeq (,$(findstring azurite,$(ENABLED_DOCKER_SERVICES)))
    TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) azurite
  endif
  ifeq ($(BUILD_ENTERPRISE_READY),true)
    ifeq (,$(findstring openldap,$(ENABLED_DOCKER_SERVICES)))
      TEMP_DOCKER_SERVICES:=$(TEMP_DOCKER_SERVICES) openldap
    endif
  endif
  ENABLED_DOCKER_SERVICES:=$(ENABLED_DOCKER_SERVICES) $(TEMP_DOCKER_SERVICES)
endif

# Dev dependencies live in build/docker-compose.dev.yml (a single Postgres on
# the dev credentials config/config.json expects: mmuser:mostest@mattermost_test).
# Set MM_NO_DOCKER=true to skip if you run your own database.
DEV_COMPOSE := build/docker-compose.dev.yml

start-docker: setup-go-work ## Starts the docker containers for local development.
ifeq ($(MM_NO_DOCKER),true)
        @echo No Docker Enabled: skipping docker start
else
        @echo "Starting dev dependencies: postgres, rustfs, prometheus  [$(DEV_COMPOSE)]"
        docker compose -f $(DEV_COMPOSE) up -d --wait
        docker compose -f $(DEV_COMPOSE) --profile setup run --rm rustfs-init || true
endif

update-docker: setup-go-work stop-docker start-docker ## Recreates the dev dependency containers.

run-haserver:
        @echo "The HA-cluster docker topology (haproxy + leader/follower) has been removed."

stop-haserver:
        @echo "The HA-cluster docker topology (haproxy + leader/follower) has been removed."

stop-docker: ## Stops the docker containers for local development.
ifeq ($(MM_NO_DOCKER),true)
        @echo No Docker Enabled: skipping docker stop
else
        @echo Stopping dev dependencies
        docker compose -f $(DEV_COMPOSE) stop
endif

clean-docker: ## Deletes the docker containers for local development.
ifeq ($(MM_NO_DOCKER),true)
        @echo No Docker Enabled: skipping docker clean
else
        @echo Removing dev dependencies (and their volumes)
        docker compose -f $(DEV_COMPOSE) down -v
endif

plugin-checker: setup-go-work
        $(GO) run $(GOFLAGS) ./public/plugin/checker

prepackaged-plugins: ## Populate the prepackaged-plugins directory.
        @echo Downloading prepackaged plugins: $(PLUGIN_PACKAGES)
        mkdir -p prepackaged_plugins
        @cd prepackaged_plugins && for plugin_package in $(PLUGIN_PACKAGES) ; do \
                curl -f -O -L https://plugins.releases.mattermost.com/release/$$plugin_package.tar.gz; \
                curl -f -O -L https://plugins.releases.mattermost.com/release/$$plugin_package.tar.gz.sig; \
        done

prepackaged-binaries: ## Populate the prepackaged-binaries to the bin directory
ifeq ($(OS),Windows_NT)
        @if exist bin\mmctl (echo "MMCTL already exists in bin/mmctl, not compiling.") else (echo "Skipping MMCTL build on Windows for run-server.")
else
ifeq ($(wildcard bin/mmctl),bin/mmctl)
        @echo "MMCTL already exists in bin/mmctl, not compiling."
else
        $(MAKE) mmctl-build
endif
endif

golang-versions: ## Install Golang versions used for compatibility testing (e.g. plugins)
        @for version in $(GO_COMPATIBILITY_TEST_VERSIONS); do \
                $(GO) install golang.org/dl/go$$version@latest && \
                $(GOBIN)/go$$version download; \
        done
        export GO_COMPATIBILITY_TEST_VERSIONS="${GO_COMPATIBILITY_TEST_VERSIONS}"

golangci-lint: setup-go-work ## Run golangci-lint on codebase
        $(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
ifeq ($(BUILD_ENTERPRISE_READY),true)
        $(GOBIN)/golangci-lint run ./... ./public/... $(BUILD_ENTERPRISE_DIR)/...
else
        $(GOBIN)/golangci-lint run ./... ./public/...
endif

i18n-extract: ## Extract strings for translation from the source code
        cd ../tools/mmgotool && $(GO) install .
        $(GOBIN)/mmgotool i18n extract --portal-dir=""

i18n-check: ## Exit on empty translation strings and translation source strings
        cd ../tools/mmgotool && $(GO) install .
        $(GOBIN)/mmgotool i18n clean-empty --portal-dir="" --check
        $(GOBIN)/mmgotool i18n check-empty-src --portal-dir=""

store-mocks: setup-go-work ## Creates mock files.
ifeq ($(OS),Windows_NT)
        @powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; Push-Location tools/mockery; try { $$env:GOWORK='off'; $(GO) build -o $(GOBIN)\mockery.exe github.com/vektra/mockery/v3 } finally { Pop-Location }; $$serverMod='go.mod'; $$serverBak='go.mod.mockery.bak'; Copy-Item $$serverMod $$serverBak -Force; try { (Get-Content $$serverMod -Raw) -replace '(?m)^[ \t]*(replace[ \t]+)?github\.com/mattermost/mattermost/server/public => \./public\r?\n','' | Set-Content $$serverMod -NoNewline; $$env:GOWORK='off'; & '$(GOBIN)\mockery.exe' --config channels/store/.mockery.yaml } finally { Move-Item -Force $$serverBak $$serverMod }"
else
        @set -e; \
        cp -f go.mod go.mod.mockery.bak; \
        cleanup() { mv -f go.mod.mockery.bak go.mod; }; \
        trap cleanup EXIT; \
        sed -i.bak '/^[[:space:]]*\(replace[[:space:]]\{1,\}\)\{0,1\}github\.com\/mattermost\/mattermost\/server\/public => \.\/public$$/d' go.mod; rm -f go.mod.bak; \
        ($(MOCKERY_BUILD)); \
        GOWORK=off $(GOBIN)/mockery --config channels/store/.mockery.yaml
endif

cache-mocks: setup-go-work
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config platform/services/cache/.mockery.yaml


store-layers: setup-go-work ## Generate layers for the store
        $(GO) generate $(GOFLAGS) ./channels/store

new-migration: ## Creates a new migration. Run with make new-migration name=<>
        $(GO) install github.com/mattermost/morph/cmd/morph@1e0640c
        @echo "Generating new migration for postgres"
        $(GOBIN)/morph new script $(name) --driver postgres --dir channels/db/migrations --sequence

filestore-mocks: setup-go-work ## Creates mock files.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config platform/shared/filestore/.mockery.yaml

ldap-mocks: setup-go-work ## Creates mock files for ldap.
        $(GO) install github.com/vektra/mockery/v2/...@v2.53.4
        $(GOBIN)/mockery --dir $(BUILD_ENTERPRISE_DIR)/ldap --all --inpackage --note 'Regenerate this file using `make ldap-mocks`.'

plugin-mocks: setup-go-work ## Creates mock files for plugins.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config public/plugin/.mockery.yaml

einterfaces-mocks: setup-go-work ## Creates mock files for einterfaces.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config einterfaces/.mockery.yaml

searchengine-mocks: setup-go-work ## Creates mock files for searchengines.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config platform/services/searchengine/.mockery.yaml

sharedchannel-mocks: setup-go-work ## Creates mock files for shared channels.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config platform/services/sharedchannel/.mockery.yaml

misc-mocks: setup-go-work ## Creates mocks for misc interfaces.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config channels/utils/.mockery.yaml

email-mocks: setup-go-work ## Creates mocks for misc interfaces.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config channels/app/email/.mockery.yaml

platform-mocks: setup-go-work ## Creates mocks for platform interfaces.
        $(MOCKERY_BUILD)
        $(GOBIN)/mockery --config channels/app/platform/.mockery.yaml

mmctl-mocks: setup-go-work ## Creates mocks for mmctl
        $(GO) install github.com/golang/mock/mockgen@v1.6.0
        $(GOBIN)/mockgen -destination=cmd/mmctl/mocks/client_mock.go -copyright_file=cmd/mmctl/mocks/copyright.txt -package=mocks github.com/sitename/sitename/server/v8/cmd/mmctl/client Client

pluginapi: setup-go-work ## Generates api and hooks glue code for plugins
        cd ./public && $(GO) generate $(GOFLAGS) ./plugin

default-roles-permissions: start-docker ## Generates default_roles_permissions.js by snapshotting a live database.
        $(GO) run $(GOFLAGS) ./scripts/default_permissions_generator \
                -out ../e2e-tests/cypress/tests/support/api/default_roles_permissions.js

mocks: store-mocks filestore-mocks ldap-mocks plugin-mocks einterfaces-mocks searchengine-mocks sharedchannel-mocks misc-mocks email-mocks platform-mocks mmctl-mocks mocks-public cache-mocks

layers: store-layers pluginapi

generated: mocks layers default-roles-permissions

check-prereqs-enterprise: setup-go-work ## Checks prerequisite software status for enterprise.
ifeq ($(BUILD_ENTERPRISE_READY),true)
        ./scripts/prereq-check-enterprise.sh
endif

setup-go-work: export BUILD_ENTERPRISE_READY := $(BUILD_ENTERPRISE_READY)
setup-go-work: ## Sets up your go.work file
ifneq ($(SKIP_SETUP_GO_WORK),true)
ifeq ($(OS),Windows_NT)
        @powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; if (Test-Path go.work) { Copy-Item go.work go.work.bak -Force }; Remove-Item go.work -ErrorAction SilentlyContinue; $(GO) work init; $(GO) work use .; $(GO) work use ./public; if ('$(BUILD_ENTERPRISE_READY)' -eq 'true') { $(GO) work use '$(BUILD_ENTERPRISE_DIR)' }; if (Test-Path go.work.bak) { Remove-Item go.work.bak -Force }; Write-Output 'Created go.work file'"
else
        @set -e; \
        if [ -f go.work ]; then cp -p go.work go.work.bak; fi; \
        rm -f go.work; \
        $(GO) work init; \
        $(GO) work use .; \
        $(GO) work use ./public; \
        if [ "$(BUILD_ENTERPRISE_READY)" = "true" ]; then \
                $(GO) work use $(BUILD_ENTERPRISE_DIR); \
        fi; \
        if [ -f go.work.bak ] && cmp -s go.work go.work.bak; then \
                mv go.work.bak go.work; \
        else \
                rm -f go.work.bak; \
                echo "Created go.work file"; \
        fi
endif
endif

check-style: plugin-checker vet golangci-lint ## Runs style/lint checks

gotestsum:
        $(GO) install gotest.tools/gotestsum@v1.13.0

test-compile: setup-go-work gotestsum ## Compile tests.
        @echo COMPILE TESTS

        for package in $(TE_PACKAGES) $(EE_PACKAGES); do \
                $(GO) test $(GOFLAGS) -c $$package; \
        done

modules-tidy: ## Tidy Go modules
        mv enterprise/external_imports.go enterprise/external_imports.go.orig
        -$(GO) mod tidy
        -cd public && $(GO) mod tidy
        mv enterprise/external_imports.go.orig enterprise/external_imports.go

test-server-pre: check-prereqs-enterprise start-docker gotestsum golang-versions ## Runs tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
        @echo Running all tests
else
        @echo Running only TE tests
endif

test-server-race: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-race: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-race: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-race: test-server-pre
ifeq ($(IS_CI),true)
        GOMAXPROCS=4 $(GOBIN)/gotestsum --rerun-fails=3 --packages="$(TE_PACKAGES) $(EE_PACKAGES)" -- -race $(GOFLAGS) -timeout=3h
else
        $(GOBIN)/gotestsum --rerun-fails=3 --packages="$(TE_PACKAGES) $(EE_PACKAGES)" -- -race $(GOFLAGS) -timeout=3h
endif
ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
          @echo Stopping temporary docker services
          docker compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server: test-server-pre
        $(GOBIN)/gotestsum --rerun-fails=3 --packages="$(TE_PACKAGES) $(EE_PACKAGES)" -- $(GOFLAGS) -timeout=90m $(COVERAGE_FLAG)
ifneq ($(IS_CI),true)
  ifneq ($(MM_NO_DOCKER),true)
    ifneq ($(TEMP_DOCKER_SERVICES),)
          @echo Stopping temporary docker services
          docker compose stop $(TEMP_DOCKER_SERVICES)
    endif
  endif
endif

test-server-ee: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-ee: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-ee: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-ee: check-prereqs-enterprise start-docker gotestsum ## Runs EE tests.
        @echo Running only EE tests
        $(GOBIN)/gotestsum --packages="$(EE_PACKAGES)" -- $(GOFLAGS) -timeout=20m

ES_PACKAGES=$(shell $(GO) list ./enterprise/elasticsearch/...)

test-server-elasticsearch: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-elasticsearch: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-elasticsearch: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-elasticsearch: check-prereqs-enterprise start-docker gotestsum ## Runs Elasticsearch tests.
        @echo Running only Elasticsearch tests
        $(GOBIN)/gotestsum --rerun-fails=3 --packages="$(ES_PACKAGES)" -- $(GOFLAGS) -timeout=20m

OS_PACKAGES=$(shell $(GO) list ./enterprise/elasticsearch/opensearch/...)

test-server-opensearch: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-opensearch: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-opensearch: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-opensearch: check-prereqs-enterprise start-docker gotestsum ## Runs OpenSearch tests.
        @echo Running only OpenSearch tests
        $(GOBIN)/gotestsum --rerun-fails=3 --packages="$(OS_PACKAGES)" -- $(GOFLAGS) -timeout=20m

test-server-quick: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-server-quick: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-server-quick: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-server-quick: check-prereqs-enterprise ## Runs only quick tests.
ifeq ($(BUILD_ENTERPRISE_READY),true)
        @echo Running all tests
        $(GOBIN)/gotestsum --packages="$(TE_PACKAGES) $(EE_PACKAGES)" -- $(GOFLAGS) -short
else
        @echo Running only TE tests
        $(GOBIN)/gotestsum --packages="$(TE_PACKAGES)" -- $(GOFLAGS) -short
endif

internal-test-web-client: setup-go-work ## Runs web client tests.
        $(GO) run $(GOFLAGS) $(PLATFORM_FILES) test web_client_tests

run-server-for-web-client-tests: setup-go-work ## Tests the server for web client.
        $(GO) run $(GOFLAGS) $(PLATFORM_FILES) test web_client_tests_server

test-client: ## Test client app.
        @echo Running client tests

        cd $(BUILD_WEBAPP_DIR) && $(MAKE) test

test: test-server test-client ## Runs all checks and tests below (except race detection and postgres).

cover: ## Runs the golang coverage tool. You must run the unit tests first.
        @echo Opening coverage info in browser. If this failed run make test first

        $(GO) tool cover -html=cover.out
        $(GO) tool cover -html=ecover.out

test-data: export MM_SERVICESETTINGS_ENABLELOCALMODE := true
test-data: run-server inject-test-data stop-server ## start a local instance and add test data to it.

inject-test-data: # add test data to the local instance.
        @if ! ./scripts/wait-for-system-start.sh; then \
                make stop-server; \
        fi

        bin/mmctl config set TeamSettings.MaxUsersPerTeam 100 --local
        bin/mmctl sampledata -u 60 --local

        @echo You may need to restart the Mattermost server before using the following
        @echo ========================================================================
        @echo Login with a system admin account username=sysadmin password=Sys@dmin-sample1
        @echo Login with a regular account username=user-1 password=SampleUs@r-1
        @echo ========================================================================

test-mmctl-unit: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-mmctl-unit: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-mmctl-unit: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-mmctl-unit: check-prereqs-enterprise gotestsum
        @echo Running mmctl unit tests
        $(GOBIN)/gotestsum --packages="$(MMCTL_PACKAGES)" -- -tags 'unit $(MMCTL_BUILD_TAGS)' $(MMCTL_TESTFLAGS)

test-mmctl-e2e: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-mmctl-e2e: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-mmctl-e2e: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-mmctl-e2e: check-prereqs-enterprise gotestsum start-docker
        @echo Running mmctl e2e tests
        $(GOBIN)/gotestsum --packages="$(MMCTL_PACKAGES)" -- -tags 'e2e $(MMCTL_BUILD_TAGS)' $(MMCTL_TESTFLAGS)

test-mmctl: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-mmctl: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-mmctl: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-mmctl: check-prereqs-enterprise gotestsum start-docker
        @echo Running all mmctl tests
        $(GOBIN)/gotestsum --packages="$(MMCTL_PACKAGES)" -- -tags 'unit e2e $(MMCTL_BUILD_TAGS)' $(MMCTL_TESTFLAGS)

test-mmctl-coverage: export GOTESTSUM_FORMAT := $(GOTESTSUM_FORMAT)
test-mmctl-coverage: export GOTESTSUM_JUNITFILE := $(GOTESTSUM_JUNITFILE)
test-mmctl-coverage: export GOTESTSUM_JSONFILE := $(GOTESTSUM_JSONFILE)
test-mmctl-coverage: check-prereqs-enterprise gotestsum start-docker
        @echo Running all mmctl tests with coverage
        $(GOBIN)/gotestsum --packages="$(MMCTL_PACKAGES)" -- -tags 'unit e2e $(MMCTL_BUILD_TAGS)' -coverprofile=mmctlcover.out $(MMCTL_TESTFLAGS)
        $(GO) tool cover -html=mmctlcover.out

ifeq ($(OS),Windows_NT)
validate-go-version: ## Validates the installed version of go against Mattermost's minimum requirement.
        @echo Skipping Go version validation on Windows.
else
validate-go-version: ## Validates the installed version of go against Mattermost's minimum requirement.
        @if [ $(GO_MAJOR_VERSION) -gt $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION) ]; then \
                exit 0 ;\
        elif [ $(GO_MAJOR_VERSION) -lt $(MINIMUM_SUPPORTED_GO_MAJOR_VERSION) ]; then \
                echo '$(GO_VERSION_VALIDATION_ERR_MSG)';\
                exit 1; \
        elif [ $(GO_MINOR_VERSION) -lt $(MINIMUM_SUPPORTED_GO_MINOR_VERSION) ] ; then \
                echo '$(GO_VERSION_VALIDATION_ERR_MSG)';\
                exit 1; \
        fi
endif

build-templates: ## Compile all mjml email templates
        cd $(TEMPLATES_DIR) && $(MAKE) build

run-server: stop-server setup-go-work prepackaged-binaries validate-go-version start-docker client ## Starts the server (kills existing first).
        @echo Running sitename for development
ifeq ($(MM_USE_PGVECTOR),true)
        @echo With pgvector PostgreSQL support enabled
endif

ifeq ($(OS),Windows_NT)
        @if not exist $(BUILD_WEBAPP_DIR_WIN)\channels\dist\files mkdir $(BUILD_WEBAPP_DIR_WIN)\channels\dist\files
        $(GO) build $(GOFLAGS) -tags "$(BUILD_TAGS)" -o "$(GOBIN)\sitename-dev.exe" $(PLATFORM_FILES)
ifeq ($(RUN_SERVER_IN_BACKGROUND),true)
        @start /B "" "$(GOBIN)\sitename-dev.exe"
else
        "$(GOBIN)\sitename-dev.exe"
endif
else
        mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
        $(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' $(PLATFORM_FILES) $(RUN_IN_BACKGROUND)
endif

run-server-faketime: setup-go-work prepackaged-binaries validate-go-version start-docker client ## Starts the server with FAKETIME.
ifndef FAKETIME
        $(error FAKETIME is not set. Usage: make run-server-faketime FAKETIME="+30d")
endif
        @if [ "$$(uname)" = "Darwin" ]; then \
                LIBFAKETIME="$$(brew --prefix libfaketime 2>/dev/null)/lib/faketime/libfaketime.1.dylib"; \
        else \
                for p in /usr/lib/x86_64-linux-gnu/faketime /usr/lib/aarch64-linux-gnu/faketime /usr/lib/faketime /usr/lib64/faketime; do \
                        if [ -f "$$p/libfaketime.so.1" ]; then LIBFAKETIME="$$p/libfaketime.so.1"; break; fi; \
                done; \
        fi; \
        [ -f "$$LIBFAKETIME" ] || { echo "Error: libfaketime not found. Install it with your package manager."; exit 1; }; \
        echo "Building sitename..."; \
        $(GO) build $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' -o $(GOBIN)/sitename-faketime $(PLATFORM_FILES); \
        echo "Running sitename with FAKETIME=$(FAKETIME) (libfaketime: $$LIBFAKETIME)"; \
        mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files; \
        if [ "$$(uname)" = "Darwin" ]; then \
                DYLD_INSERT_LIBRARIES="$$LIBFAKETIME" DYLD_FORCE_FLAT_NAMESPACE=1 FAKETIME="$(FAKETIME)" FAKETIME_NO_CACHE=1 \
                        $(GOBIN)/sitename-faketime $(RUN_IN_BACKGROUND) \
        else \
                LD_PRELOAD="$$LIBFAKETIME" FAKETIME="$(FAKETIME)" FAKETIME_NO_CACHE=1 \
                        $(GOBIN)/sitename-faketime $(RUN_IN_BACKGROUND) \
        fi

run-server-pgvector: ## Starts the server with pgvector PostgreSQL image.
        @MM_USE_PGVECTOR=true $(MAKE) run-server

debug-server: stop-server setup-go-work start-docker ## Compile and start server using delve.
        mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
        $(DELVE) debug $(PLATFORM_FILES) --build-flags="-ldflags '\
                        -X github.com/sitename/sitename/server/public/model.BuildNumber=$(BUILD_NUMBER)\
                        -X \"github.com/sitename/sitename/server/public/model.BuildDate=$(BUILD_DATE)\"\
                        -X github.com/sitename/sitename/server/public/model.BuildHash=$(BUILD_HASH)\
                        -X github.com/sitename/sitename/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
                        -X github.com/sitename/sitename/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'\
                        -tags '$(BUILD_TAGS)'"

debug-server-headless: stop-server setup-go-work start-docker ## Debug server from within an IDE like VSCode or IntelliJ.
        mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files
        $(DELVE) debug --headless --listen=:2345 --api-version=2 --accept-multiclient $(PLATFORM_FILES) --build-flags="-ldflags '\
                        -X github.com/sitename/sitename/server/public/model.BuildNumber=$(BUILD_NUMBER)\
                        -X \"github.com/sitename/sitename/server/public/model.BuildDate=$(BUILD_DATE)\"\
                        -X github.com/sitename/sitename/server/public/model.BuildHash=$(BUILD_HASH)\
                        -X github.com/sitename/sitename/server/public/model.BuildHashEnterprise=$(BUILD_HASH_ENTERPRISE)\
                        -X github.com/sitename/sitename/server/public/model.BuildEnterpriseReady=$(BUILD_ENTERPRISE_READY)'\
                        -tags '$(BUILD_TAGS)'"

run-node: export MM_SERVICESETTINGS_SITEURL=http://localhost:8066
run-node: export MM_SERVICESETTINGS_LISTENADDRESS=:8066
run-node: export MM_SERVICESETTINGS_ENABLELOCALMODE=true
run-node: export MM_SERVICESETTINGS_LOCALMODESOCKETLOCATION=/var/tmp/sitename_local_node.socket
run-node: export MM_SQLSETTINGS_DRIVERNAME=postgres
run-node: export MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest@localhost/mattermost_node_test?sslmode=disable&sslmode=disable&connect_timeout=10&binary_parameters=yes

run-node: setup-go-work start-docker ## Runs a shared channel node.
        @echo Running sitename node

        $(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' $(PLATFORM_FILES) $(RUN_IN_BACKGROUND)

run-cli: setup-go-work start-docker ## Runs CLI.
        @echo Running sitename for development
        @echo Example should be like 'make ARGS="-version" run-cli'

        $(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' $(PLATFORM_FILES) ${ARGS}

run-client: client ## Runs the webapp.
        @echo Running sitename client for development

        cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

client: ## Sets up a symlink to the compiled files generated by the web app
        @echo Setting up symlink to client directory

ifeq ($(OS),Windows_NT)
        -if exist client rmdir /S /Q client
        cmd /c mklink /J client "$(BUILD_WEBAPP_DIR_WIN)\channels\dist" > NUL
else
        ln -nfs $(BUILD_WEBAPP_DIR)/channels/dist client
endif

run-client-fullmap: client ## Legacy alias to run-client
        @echo Running sitename client for development

        cd $(BUILD_WEBAPP_DIR) && $(MAKE) run

run: run-server run-client ## Runs the server and webapp.

run-pgvector: ## Runs the server and webapp with pgvector PostgreSQL image.
        @MM_USE_PGVECTOR=true $(MAKE) run

run-fullmap: run-server run-client ## Legacy alias to run

stop-server: ## Stops the server and cleans up.
        @echo Stopping sitename

ifneq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
        @pkill -9 -f "sitename-dev" 2>/dev/null || true
        @pkill -9 -f "go run.*sitename" 2>/dev/null || true
        @pkill -9 -f "go-build.*sitename" 2>/dev/null || true
        @sleep 0.5
        @lsof -ti :8065 2>/dev/null | xargs kill -9 2>/dev/null || true
        @rm -f $(GOBIN)/sitename-dev
        @echo Server stopped and cleaned up.
else
        -taskkill /F /IM go.exe > NUL 2>&1
        -taskkill /F /IM sitename.exe > NUL 2>&1
        -taskkill /F /IM sitename-dev.exe > NUL 2>&1
        @echo Server stopped and cleaned up.
endif

stop-client: ## Stops the webapp.
        @echo Stopping sitename client

        cd $(BUILD_WEBAPP_DIR) && $(MAKE) stop

stop: stop-server stop-client stop-docker ## Stops server, client and the docker compose.

restart: restart-server restart-client ## Restarts the server and webapp.

restart-server: | stop-server run-server ## Restarts the sitename server to pick up development change.

restart-server-pgvector: ## Restarts the server with pgvector PostgreSQL image.
        @MM_USE_PGVECTOR=true $(MAKE) restart-server

restart-haserver:
        @echo Restarting sitename in an HA topology

        docker compose restart follower2
        docker compose restart follower
        docker compose restart leader
        docker compose restart haproxy

restart-client: | stop-client run-client ## Restarts the webapp.

run-job-server: setup-go-work ## Runs the background job server.
        @echo Running job server for development
        $(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' $(PLATFORM_FILES) jobserver &

config-ldap: ## Configures LDAP.
        @echo "The local LDAP/Keycloak dev tooling has been removed from this project."

config-saml: ## Configures SAML.
        @echo "The local SAML/Keycloak dev tooling has been removed from this project."

config-openid: ## Configures OpenID.
        @echo "The local OpenID/Keycloak dev tooling has been removed from this project."

config-reset: setup-go-work ## Resets the config/config.json file to the default production values.
        @echo Resetting configuration to production default
        rm -f config/config.json
        OUTPUT_CONFIG=$(PWD)/config/config.json $(GO) run $(GOFLAGS) -tags production ./scripts/config_generator

diff-config: ## Compares default configuration between two sitename versions
        @./scripts/diff-config.sh

clean: setup-go-work stop-docker ## Clean up everything except persistent server data.
        @echo Cleaning

        rm -Rf $(DIST_ROOT)
        $(GO) clean $(GOFLAGS) -i ./...

        cd $(BUILD_WEBAPP_DIR) && $(MAKE) clean

        find . -type d -name data | xargs rm -rf
        rm -rf logs

        rm -f sitename.log
        rm -f sitename.log.jsonl
        rm -f npm-debug.log
        rm -f .prepare-go
        rm -f cover.out
        rm -f ecover.out
        rm -f *.out
        rm -f *.test
        rm -f channels/imports/imports.go
        rm -f cmd/sitename/cprofile*.out

nuke: clean clean-docker ## Clean plus removes persistent server data.
        @echo BOOM

        rm -rf data
        rm -f go.work go.work.sum

setup-mac: ## Adds macOS hosts entries for Docker.
        echo $$(boot2docker ip 2> /dev/null) dockerhost | sudo tee -a /etc/hosts

update-dependencies: ## Uses go get -u to update all the dependencies while holding back any that require it.
        @echo Updating Dependencies

ifeq ($(BUILD_ENTERPRISE_READY),true)
        @echo Enterprise repository detected, temporarily removing external_imports.go
        mv enterprise/external_imports.go enterprise/external_imports.go.orig
endif

        # Update all dependencies (does not update across major versions)
        $(GO) get -u ./...

        # Tidy up
        $(GO) mod tidy

ifeq ($(BUILD_ENTERPRISE_READY),true)
        mv enterprise/external_imports.go.orig enterprise/external_imports.go
endif

vet: setup-go-work ## Run sitename go vet specific checks
        cd ../tools/sitename-govet && $(GO) install .
        $(GO) vet -vettool=$(GOBIN)/sitename-govet \
                -structuredLogging \
                -inconsistentReceiverName \
                -emptyStrCmp \
                -tFatal \
                -configtelemetry \
                -errorAssertions \
                -requestCtxNaming \
                -license \
                -inconsistentReceiverName.ignore=session_serial_gen.go,team_member_serial_gen.go,user_serial_gen.go,utils_serial_gen.go \
                -noSelectStar \
                -concurrentIndex \
                -concurrentIndex.path=./channels/db/migrations/ \
                -concurrentIndex.minMigration=166 \
                ./...
ifeq ($(BUILD_ENTERPRISE_READY),true)
  ifneq ($(MM_NO_ENTERPRISE_LINT),true)
        $(GO) vet -vettool=$(GOBIN)/sitename-govet -structuredLogging -inconsistentReceiverName -emptyStrCmp -tFatal -configtelemetry -errorAssertions -requestCtxNaming -enterpriseLicense $(BUILD_ENTERPRISE_DIR)/...
  endif
endif

vet-api: export GO := $(GO)
vet-api: export GOBIN := $(GOBIN)
vet-api: export ROOT := $(ROOT)
vet-api: ## Run sitename go vet to verify api4 documentation, currently not passing
        cd ../tools/sitename-govet && $(GO) install .
        make -C ../api build
        ./scripts/vet-api-check.sh

gen-serialized: export LICENSE_HEADER:=$(LICENSE_HEADER)
gen-serialized: setup-go-work ## Generates serialization methods for hot structs
        # This tool only works at a file level, not at a package level.
        # There will be some warnings about "unresolved identifiers",
        # but that is because of the above problem. Since we are generating
        # methods for all the relevant files at a package level, all
        # identifiers will be resolved. An alternative to remove the warnings
        # would be to temporarily move all the structs to the same file,
        # but that involves a lot of manual work.
        $(GO) install github.com/tinylib/msgp@v1.1.6
        $(GOBIN)/msgp -file=./public/model/utils.go -tests=false -o=./public/model/utils_serial_gen.go
        @echo "$$LICENSE_HEADER" > tmp.go
        @cat ./public/model/utils_serial_gen.go >> tmp.go
        @mv tmp.go ./public/model/utils_serial_gen.go
        $(GOBIN)/msgp -file=./public/model/session.go -tests=false -o=./public/model/session_serial_gen.go
        @echo "$$LICENSE_HEADER" > tmp.go
        @cat ./public/model/session_serial_gen.go >> tmp.go
        @mv tmp.go ./public/model/session_serial_gen.go
        $(GOBIN)/msgp -file=./public/model/user.go -tests=false -o=./public/model/user_serial_gen.go
        @echo "$$LICENSE_HEADER" > tmp.go
        @cat ./public/model/user_serial_gen.go >> tmp.go
        @mv tmp.go ./public/model/user_serial_gen.go
        $(GOBIN)/msgp -file=./public/model/team_member.go -tests=false -o=./public/model/team_member_serial_gen.go
        @echo "$$LICENSE_HEADER" > tmp.go
        @cat ./public/model/team_member_serial_gen.go >> tmp.go
        @mv tmp.go ./public/model/team_member_serial_gen.go

sqlboiler: setup-go-work ## Generate ORM models from PostgreSQL using sqlboiler
        $(GO) install github.com/aarondl/sqlboiler/v4@latest
        $(GO) install github.com/aarondl/sqlboiler/v4/drivers/sqlboiler-psql@latest
        PATH="$(GOBIN):$${PATH}" $(GOBIN)/sqlboiler psql --config sqlboiler.toml

todo: ## Display TODO and FIXME items in the source code.
        @! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+'
ifeq ($(BUILD_ENTERPRISE_READY),true)
        @! ag --ignore Makefile --ignore-dir runtime '(TODO|XXX|FIXME|"FIX ME")[: ]+' $(BUILD_ENTERPRISE_DIR)/
endif

mmctl-build: setup-go-work ## Compiles and generates the mmctl binary
        $(GO) build $(GOFLAGS) -trimpath -ldflags '$(MMCTL_LDFLAGS)' -o bin/mmctl ./cmd/mmctl

mmctl-docs: setup-go-work ## Generate the mmctl docs
        rm -rf ./cmd/mmctl/docs
        cd ./cmd/mmctl && $(GO) run mmctl.go docs

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
        @grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
        @echo
        @echo You can modify the default settings for this Makefile creating a file config.mk based on the default-config.mk
        @echo

migrations-extract:
        @echo Listing migration files
        @echo "# Autogenerated file to synchronize migrations sequence in the PR workflow, please do not edit." > channels/db/migrations/migrations.list
        find channels/db/migrations -maxdepth 2 -mindepth 2 | sort >> channels/db/migrations/migrations.list

test-local-filestore: setup-go-work # Run tests for local filestore
        $(GO) test ./platform/shared/filestore -run '^TestLocalFileBackend' -v