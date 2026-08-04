// Wrapper module to install mockery for mock generation targets.
//
// mockery v3.7.2 pins golang.org/x/tools v0.42.0, which cannot load packages
// built with Go 1.27 ("internal error: package ... without types"). Bump
// x/tools via the replace below until mockery ships a newer pin. Do not add
// this module to go.work.
module github.com/iamleson98/sitename/server/v8/tools/mockery

go 1.27rc2

require github.com/vektra/mockery/v3 v3.7.2

replace golang.org/x/tools => golang.org/x/tools v0.48.0
