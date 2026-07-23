package enterprise

import (
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/iamleson98/sitename/server/v8/enterprise/metrics"
	// Needed to ensure the init() method in the EE gets run
	// _ "github.com/iamleson98/sitename/server/v8/enterprise/elasticsearch"

	// to register lms API endpoints
	_ "github.com/iamleson98/sitename/server/v8/channels/api4/lms_api"
)
