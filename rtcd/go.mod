module github.com/mattermost/rtcd

go 1.27rc2

require (
	git.mills.io/prologic/bitcask v1.0.2
	github.com/BurntSushi/toml v1.4.0
	github.com/gorilla/websocket v1.5.3
	github.com/grafana/pyroscope-go/godeltaprof v0.1.8
	github.com/iamleson98/sitename/server/public v0.0.0
	github.com/kelseyhightower/envconfig v1.4.0
	github.com/mattermost/logr/v2 v2.0.22
	github.com/pborman/uuid v1.2.1
	github.com/pion/ice/v4 v4.2.0
	github.com/pion/interceptor v0.1.44
	github.com/pion/logging v0.2.4
	github.com/pion/rtcp v1.2.16
	github.com/pion/rtp v1.10.1
	github.com/pion/stun/v3 v3.1.1
	github.com/pion/webrtc/v4 v4.2.6
	github.com/prometheus/client_golang v1.23.2
	github.com/prometheus/procfs v0.16.1
	github.com/stretchr/testify v1.11.1
	github.com/vmihailenco/msgpack/v5 v5.4.1
	golang.org/x/crypto v0.52.0
	golang.org/x/sys v0.45.0
	golang.org/x/time v0.12.0
)

replace github.com/pion/interceptor v0.1.44 => github.com/bgardner8008/interceptor v0.1.44-mm-mods

require (
	github.com/aarondl/inflect v0.0.2 // indirect
	github.com/aarondl/sqlboiler/v4 v4.19.7 // indirect
	github.com/aarondl/strmangle v0.0.9 // indirect
	github.com/abcum/lcp v0.0.0-20201209214815-7a3f3840be81 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/blang/semver/v4 v4.0.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a // indirect
	github.com/fatih/color v1.19.0 // indirect
	github.com/francoispqt/gojay v1.2.13 // indirect
	github.com/friendsofgo/errors v0.9.2 // indirect
	github.com/goccy/go-yaml v1.19.2 // indirect
	github.com/gofrs/flock v0.13.0 // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gopherjs/gopherjs v1.17.2 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-hclog v1.6.3 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/hashicorp/go-plugin v1.7.0 // indirect
	github.com/hashicorp/yamux v0.1.2 // indirect
	github.com/iamleson98/sitename/server/v8 v8.0.0-20251014075701-833e0125320d // indirect
	github.com/klauspost/compress v1.18.6 // indirect
	github.com/mattermost/go-i18n v1.11.1-0.20211013152124-5c415071e404 // indirect
	github.com/mattermost/ldap v3.0.4+incompatible // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.22 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/oklog/run v1.2.0 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/philhofer/fwd v1.2.0 // indirect
	github.com/pion/datachannel v1.6.0 // indirect
	github.com/pion/dtls/v3 v3.1.2 // indirect
	github.com/pion/mdns/v2 v2.1.0 // indirect
	github.com/pion/randutil v0.1.0 // indirect
	github.com/pion/sctp v1.9.2 // indirect
	github.com/pion/sdp/v3 v3.0.17 // indirect
	github.com/pion/srtp/v3 v3.0.10 // indirect
	github.com/pion/transport/v4 v4.0.1 // indirect
	github.com/pion/turn/v4 v4.1.4 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/plar/go-adaptive-radix-tree v1.0.4 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.66.1 // indirect
	github.com/sirupsen/logrus v1.9.4 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/tinylib/msgp v1.6.4 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	github.com/wiggin77/merror v1.0.5 // indirect
	github.com/wiggin77/srslog v1.0.1 // indirect
	github.com/wlynxg/anet v0.0.5 // indirect
	go.yaml.in/yaml/v2 v2.4.2 // indirect
	golang.org/x/exp v0.0.0-20250506013437-ce4c2cf36ca6 // indirect
	golang.org/x/mod v0.35.0 // indirect
	golang.org/x/net v0.55.0 // indirect
	golang.org/x/text v0.37.0 // indirect
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260504160031-60b97b32f348 // indirect
	google.golang.org/grpc v1.81.0 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/pion/ice/v4 => github.com/bgardner8008/ice/v4 v4.2.0-role-conflict-fix-v4

// Point at the fork's public module (sibling of this vendored copy) when building rtcd standalone.
replace github.com/iamleson98/sitename/server/public => ../server/public

// The fork's public/model imports the main server module (password hashers),
// so building rtcd standalone needs the server module resolved locally too.
replace github.com/iamleson98/sitename/server/v8 => ../server
