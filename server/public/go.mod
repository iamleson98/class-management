module github.com/iamleson98/sitename/server/public

go 1.27.0

require (
	github.com/aarondl/null/v8 v8.1.3
	github.com/aarondl/sqlboiler/v4 v4.19.7
	github.com/aarondl/strmangle v0.0.9
	github.com/blang/semver/v4 v4.0.0
	github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a
	github.com/francoispqt/gojay v1.2.13
	github.com/friendsofgo/errors v0.9.2
	github.com/goccy/go-yaml v1.19.2
	github.com/golang/mock v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.3
	github.com/hashicorp/go-hclog v1.6.3
	github.com/hashicorp/go-multierror v1.1.1
	github.com/hashicorp/go-plugin v1.7.0
	github.com/iamleson98/sitename/server/v8 v8.0.0-20251014075701-833e0125320d
	github.com/lib/pq v1.12.3
	github.com/mattermost/go-i18n v1.11.1-0.20211013152124-5c415071e404
	github.com/mattermost/gosaml2 v0.10.0
	github.com/mattermost/ldap v3.0.4+incompatible
	github.com/mattermost/logr/v2 v2.0.22
	github.com/nicksnyder/go-i18n/v2 v2.6.0
	github.com/paulmach/orb v0.13.0
	github.com/pborman/uuid v1.2.1
	github.com/pkg/errors v0.9.1
	github.com/shopspring/decimal v1.4.0
	github.com/sirupsen/logrus v1.9.4
	github.com/stretchr/testify v1.11.1
	github.com/tinylib/msgp v1.6.4
	github.com/vmihailenco/msgpack/v5 v5.4.1
	golang.org/x/crypto v0.52.0
	golang.org/x/mod v0.35.0
	golang.org/x/net v0.55.0
	golang.org/x/oauth2 v0.36.0
	golang.org/x/text v0.37.0
	golang.org/x/tools v0.44.0
)

require (
	github.com/aarondl/inflect v0.0.2 // indirect
	github.com/aarondl/randomize v0.0.2 // indirect
	github.com/beevik/etree v1.6.0 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/ericlagergren/decimal v0.0.0-20190420051523-6335edbaa640 // indirect
	github.com/fatih/color v1.19.0 // indirect
	github.com/gofrs/uuid v4.2.0+incompatible // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/yamux v0.1.2 // indirect
	github.com/jonboulle/clockwork v0.5.0 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.22 // indirect
	github.com/oklog/run v1.2.0 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/philhofer/fwd v1.2.0 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/rogpeppe/go-internal v1.13.1 // indirect
	github.com/russellhaering/goxmldsig v1.6.0 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/stretchr/objx v0.5.3 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	github.com/wiggin77/merror v1.0.5 // indirect
	github.com/wiggin77/srslog v1.0.1 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.45.0 // indirect
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260504160031-60b97b32f348 // indirect
	google.golang.org/grpc v1.81.0 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/iamleson98/sitename/server/v8 => ./..

// Hack to prevent the willf/bitset module from being upgraded to 1.2.0.
// They changed the module path from github.com/willf/bitset to
// github.com/bits-and-blooms/bitset and a couple of dependent repos are yet
// to update their module paths.
exclude (
	github.com/RoaringBitmap/roaring v0.7.0
	github.com/RoaringBitmap/roaring v0.7.1
	github.com/dyatlov/go-opengraph v0.0.0-20210112100619-dae8665a5b09
	github.com/willf/bitset v1.2.0
)
