package api4

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/iamleson98/sitename/server/public/model"
	"github.com/iamleson98/sitename/server/v8/channels/app"
	"github.com/iamleson98/sitename/server/v8/channels/manualtesting"
	"github.com/iamleson98/sitename/server/v8/channels/web"
	_ "github.com/mattermost/go-i18n/i18n"
)

type Routes struct {
	Root     *chi.Mux // ''
	APIRoot  *chi.Mux // 'api/v4'
	APIRoot5 *chi.Mux // 'api/v5'

	Booking *chi.Mux // 'api/v4/booking'

	LMS *chi.Mux // 'api/v4/lms'

	Users          *chi.Mux // 'api/v4/users'
	User           *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}'
	UserByUsername *chi.Mux // 'api/v4/users/username/{username:[A-Za-z0-9\\_\\-\\.]+}'
	UserByEmail    *chi.Mux // 'api/v4/users/email/{email:.+}'

	Bots *chi.Mux // 'api/v4/bots'
	Bot  *chi.Mux // 'api/v4/bots/{bot_user_id:[A-Za-z0-9]+}'

	Teams              *chi.Mux // 'api/v4/teams'
	TeamsForUser       *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams'
	Team               *chi.Mux // 'api/v4/teams/{team_id:[A-Za-z0-9]+}'
	TeamForUser        *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}'
	UserThreads        *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/threads'
	UserThread         *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/threads/{thread_id:[A-Za-z0-9]+}'
	TeamByName         *chi.Mux // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}'
	TeamMembers        *chi.Mux // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members'
	TeamMember         *chi.Mux // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	TeamMembersForUser *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/members'

	Channels                 *chi.Mux // 'api/v4/channels'
	Channel                  *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelForUser           *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelByName            *chi.Mux // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelByNameForTeamName *chi.Mux // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelsForTeam          *chi.Mux // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels'
	ChannelMembers           *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members'
	ChannelMember            *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	ChannelMembersForUser    *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/channels/members'
	ChannelModerations       *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/moderations'
	ChannelCategories        *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/channels/categories'
	ChannelBookmarks         *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/bookmarks'
	ChannelBookmark          *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/bookmarks/{bookmark_id:[A-Za-z0-9]+}'

	Posts           *chi.Mux // 'api/v4/posts'
	Post            *chi.Mux // 'api/v4/posts/{post_id:[A-Za-z0-9]+}'
	PostsForChannel *chi.Mux // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/posts'
	PostsForUser    *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts'
	PostForUser     *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Files *chi.Mux // 'api/v4/files'
	File  *chi.Mux // 'api/v4/files/{file_id:[A-Za-z0-9]+}'

	Uploads *chi.Mux // 'api/v4/uploads'
	Upload  *chi.Mux // 'api/v4/uploads/{upload_id:[A-Za-z0-9]+}'

	Plugins *chi.Mux // 'api/v4/plugins'
	Plugin  *chi.Mux // 'api/v4/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}'

	PublicFile *chi.Mux // '/files/{file_id:[A-Za-z0-9]+}/public'

	Commands *chi.Mux // 'api/v4/commands'
	Command  *chi.Mux // 'api/v4/commands/{command_id:[A-Za-z0-9]+}'

	Hooks         *chi.Mux // 'api/v4/hooks'
	IncomingHooks *chi.Mux // 'api/v4/hooks/incoming'
	IncomingHook  *chi.Mux // 'api/v4/hooks/incoming/{hook_id:[A-Za-z0-9]+}'
	OutgoingHooks *chi.Mux // 'api/v4/hooks/outgoing'
	OutgoingHook  *chi.Mux // 'api/v4/hooks/outgoing/{hook_id:[A-Za-z0-9]+}'

	OAuth     *chi.Mux // 'api/v4/oauth'
	OAuthApps *chi.Mux // 'api/v4/oauth/apps'
	OAuthApp  *chi.Mux // 'api/v4/oauth/apps/{app_id:[A-Za-z0-9]+}'

	SAML       *chi.Mux // 'api/v4/saml'
	Compliance *chi.Mux // 'api/v4/compliance'
	Cluster    *chi.Mux // 'api/v4/cluster'

	Image *chi.Mux // 'api/v4/image'

	LDAP *chi.Mux // 'api/v4/ldap'

	Elasticsearch *chi.Mux // 'api/v4/elasticsearch'

	DataRetention *chi.Mux // 'api/v4/data_retention'

	Brand *chi.Mux // 'api/v4/brand'

	System *chi.Mux // 'api/v4/system'

	Jobs *chi.Mux // 'api/v4/jobs'

	Recaps *chi.Mux // 'api/v4/recaps'

	Preferences *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/preferences'

	Public *chi.Mux // 'api/v4/public'

	Reactions *chi.Mux // 'api/v4/reactions'

	Roles   *chi.Mux // 'api/v4/roles'
	Schemes *chi.Mux // 'api/v4/schemes'

	Emojis      *chi.Mux // 'api/v4/emoji'
	Emoji       *chi.Mux // 'api/v4/emoji/{emoji_id:[A-Za-z0-9]+}'
	EmojiByName *chi.Mux // 'api/v4/emoji/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	ReactionByNameForPostForUser *chi.Mux // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	TermsOfService *chi.Mux // 'api/v4/terms_of_service'
	Groups         *chi.Mux // 'api/v4/groups'

	Cloud *chi.Mux // 'api/v4/cloud'

	Imports *chi.Mux // 'api/v4/imports'
	Import  *chi.Mux // 'api/v4/imports/{import_name:.+\\.zip}'

	Exports *chi.Mux // 'api/v4/exports'
	Export  *chi.Mux // 'api/v4/exports/{export_name:.+\\.zip}'

	RemoteCluster        *chi.Mux // 'api/v4/remotecluster'
	SharedChannels       *chi.Mux // 'api/v4/sharedchannels'
	ChannelForRemote     *chi.Mux // 'api/v4/remotecluster/{remote_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	SharedChannelRemotes *chi.Mux // 'api/v4/remotecluster/{remote_id:[A-Za-z0-9]+}/sharedchannelremotes'

	Permissions *chi.Mux // 'api/v4/permissions'

	Usage *chi.Mux // 'api/v4/usage'

	HostedCustomer *chi.Mux // 'api/v4/hosted_customer'

	Drafts *chi.Mux // 'api/v4/drafts'

	IPFiltering *chi.Mux // 'api/v4/ip_filtering'

	Reports *chi.Mux // 'api/v4/reports'

	OutgoingOAuthConnections *chi.Mux // 'api/v4/oauth/outgoing_connections'
	OutgoingOAuthConnection  *chi.Mux // 'api/v4/oauth/outgoing_connections/{outgoing_oauth_connection_id:[A-Za-z0-9]+}'

	CustomProfileAttributes       *chi.Mux // 'api/v4/custom_profile_attributes'
	CustomProfileAttributesFields *chi.Mux // 'api/v4/custom_profile_attributes/fields'
	CustomProfileAttributesField  *chi.Mux // 'api/v4/custom_profile_attributes/fields/{field_id:[A-Za-z0-9]+}'
	CustomProfileAttributesValues *chi.Mux // 'api/v4/custom_profile_attributes/values'

	AuditLogs *chi.Mux // 'api/v4/audit_logs'

	AccessControlPolicies *chi.Mux // 'api/v4/access_control_policies'
	AccessControlPolicy   *chi.Mux // 'api/v4/access_control_policies/{policy_id:[A-Za-z0-9]+}'

	ContentFlagging *chi.Mux // 'api/v4/content_flagging'

	Agents      *chi.Mux // 'api/v4/agents'
	LLMServices *chi.Mux // 'api/v4/llmservices'
	Limits      *chi.Mux // 'api/v4/limits'
}

type API struct {
	srv        *app.Server
	BaseRoutes *Routes
}

func Init(srv *app.Server) (*API, error) {
	api := &API{
		srv:        srv,
		BaseRoutes: &Routes{},
	}

	api.BaseRoutes.Root = srv.Router

	api.BaseRoutes.APIRoot = chi.NewRouter()
	srv.Router.Mount(model.APIURLSuffix, api.BaseRoutes.APIRoot)

	// api.BaseRoutes.APIRoot5 = srv.Router.PathPrefix(model.APIURLSuffixV5).Subrouter()
	api.BaseRoutes.APIRoot5 = chi.NewRouter()
	srv.Router.Mount(model.APIURLSuffixV5, api.BaseRoutes.APIRoot5)

	// api.BaseRoutes.Booking = api.BaseRoutes.APIRoot.PathPrefix("/booking").Subrouter()
	api.BaseRoutes.Booking = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/booking", api.BaseRoutes.Booking)

	// api.BaseRoutes.LMS = api.BaseRoutes.APIRoot.PathPrefix("/lms").Subrouter()
	api.BaseRoutes.LMS = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/lms", api.BaseRoutes.LMS)

	// api.BaseRoutes.Users = api.BaseRoutes.APIRoot.PathPrefix("/users").Subrouter()
	api.BaseRoutes.Users = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/users", api.BaseRoutes.Users)

	// api.BaseRoutes.User = api.BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.User = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.User)

	// api.BaseRoutes.UserByUsername = api.BaseRoutes.Users.PathPrefix("/username/{username:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	api.BaseRoutes.UserByUsername = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/username/{username:[A-Za-z0-9\\_\\-\\.]+}", api.BaseRoutes.UserByUsername)

	// api.BaseRoutes.UserByEmail = api.BaseRoutes.Users.PathPrefix("/email/{email:.+}").Subrouter()
	api.BaseRoutes.UserByEmail = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/email/{email:.+}", api.BaseRoutes.UserByEmail)

	// api.BaseRoutes.Bots = api.BaseRoutes.APIRoot.PathPrefix("/bots").Subrouter()
	api.BaseRoutes.Bots = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/bots", api.BaseRoutes.Bots)

	// api.BaseRoutes.Bot = api.BaseRoutes.APIRoot.PathPrefix("/bots/{bot_user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Bot = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/bots/{bot_user_id:[A-Za-z0-9]+}", api.BaseRoutes.Bot)

	// api.BaseRoutes.Teams = api.BaseRoutes.APIRoot.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.Teams = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/teams", api.BaseRoutes.Teams)

	// api.BaseRoutes.TeamsForUser = api.BaseRoutes.User.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.TeamsForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/teams", api.BaseRoutes.TeamsForUser)

	// api.BaseRoutes.Team = api.BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Team = chi.NewRouter()
	api.BaseRoutes.Teams.Mount("/{team_id:[A-Za-z0-9]+}", api.BaseRoutes.Team)

	// api.BaseRoutes.TeamForUser = api.BaseRoutes.TeamsForUser.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamForUser = chi.NewRouter()
	api.BaseRoutes.TeamsForUser.Mount("/{team_id:[A-Za-z0-9]+}", api.BaseRoutes.TeamForUser)

	// api.BaseRoutes.UserThreads = api.BaseRoutes.TeamForUser.PathPrefix("/threads").Subrouter()
	api.BaseRoutes.UserThreads = chi.NewRouter()
	api.BaseRoutes.TeamForUser.Mount("/threads", api.BaseRoutes.UserThreads)

	// api.BaseRoutes.UserThread = api.BaseRoutes.TeamForUser.PathPrefix("/threads/{thread_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.UserThread = chi.NewRouter()
	api.BaseRoutes.TeamForUser.Mount("/threads/{thread_id:[A-Za-z0-9]+}", api.BaseRoutes.UserThread)

	// api.BaseRoutes.TeamByName = api.BaseRoutes.Teams.PathPrefix("/name/{team_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.TeamByName = chi.NewRouter()
	api.BaseRoutes.Teams.Mount("/name/{team_name:[A-Za-z0-9_-]+}", api.BaseRoutes.TeamByName)

	// api.BaseRoutes.TeamMembers = api.BaseRoutes.Team.PathPrefix("/members").Subrouter()
	api.BaseRoutes.TeamMembers = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/members", api.BaseRoutes.TeamMembers)

	// api.BaseRoutes.TeamMember = api.BaseRoutes.TeamMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamMember = chi.NewRouter()
	api.BaseRoutes.TeamMembers.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.TeamMember)

	// api.BaseRoutes.TeamMembersForUser = api.BaseRoutes.User.PathPrefix("/teams/members").Subrouter()
	api.BaseRoutes.TeamMembersForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/teams/members", api.BaseRoutes.TeamMembersForUser)

	// api.BaseRoutes.Channels = api.BaseRoutes.APIRoot.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.Channels = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/channels", api.BaseRoutes.Channels)

	// api.BaseRoutes.Channel = api.BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Channel = chi.NewRouter()
	api.BaseRoutes.Channels.Mount("/{channel_id}", api.BaseRoutes.Channel)

	// api.BaseRoutes.ChannelForUser = api.BaseRoutes.User.PathPrefix("/channels/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/channels/{channel_id}", api.BaseRoutes.ChannelForUser)

	// api.BaseRoutes.ChannelByName = api.BaseRoutes.Team.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelByName = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/channels/name/{channel_name:[A-Za-z0-9_-]+}", api.BaseRoutes.ChannelByName)

	// api.BaseRoutes.ChannelByNameForTeamName = api.BaseRoutes.TeamByName.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelByNameForTeamName = chi.NewRouter()
	api.BaseRoutes.TeamByName.Mount("/channels/name/{channel_name:[A-Za-z0-9_-]+}", api.BaseRoutes.ChannelByNameForTeamName)

	// api.BaseRoutes.ChannelsForTeam = api.BaseRoutes.Team.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.ChannelsForTeam = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/channels", api.BaseRoutes.ChannelsForTeam)

	// api.BaseRoutes.ChannelMembers = api.BaseRoutes.Channel.PathPrefix("/members").Subrouter()
	api.BaseRoutes.ChannelMembers = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/members", api.BaseRoutes.ChannelMembers)

	// api.BaseRoutes.ChannelMember = api.BaseRoutes.ChannelMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelMember = chi.NewRouter()
	api.BaseRoutes.ChannelMembers.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.ChannelMember)

	// api.BaseRoutes.ChannelMembersForUser = api.BaseRoutes.User.PathPrefix("/teams/{team_id:[A-Za-z0-9]+}/channels/members").Subrouter()
	api.BaseRoutes.ChannelMembersForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/teams/{team_id:[A-Za-z0-9]+}/channels/members", api.BaseRoutes.ChannelMembersForUser)

	// api.BaseRoutes.ChannelModerations = api.BaseRoutes.Channel.PathPrefix("/moderations").Subrouter()
	api.BaseRoutes.ChannelModerations = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/moderations", api.BaseRoutes.ChannelModerations)

	// api.BaseRoutes.ChannelCategories = api.BaseRoutes.User.PathPrefix("/teams/{team_id:[A-Za-z0-9]+}/channels/categories").Subrouter()
	api.BaseRoutes.ChannelCategories = chi.NewRouter()
	api.BaseRoutes.User.Mount("/teams/{team_id:[A-Za-z0-9]+}/channels/categories", api.BaseRoutes.ChannelCategories)

	// api.BaseRoutes.ChannelBookmarks = api.BaseRoutes.Channel.PathPrefix("/bookmarks").Subrouter()
	api.BaseRoutes.ChannelBookmarks = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/bookmarks", api.BaseRoutes.ChannelBookmarks)

	// api.BaseRoutes.ChannelBookmark = api.BaseRoutes.ChannelBookmarks.PathPrefix("/{bookmark_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelBookmark = chi.NewRouter()
	api.BaseRoutes.ChannelBookmarks.Mount("/{bookmark_id:[A-Za-z0-9]+}", api.BaseRoutes.ChannelBookmark)

	// api.BaseRoutes.Posts = api.BaseRoutes.APIRoot.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.Posts = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/posts", api.BaseRoutes.Posts)

	// api.BaseRoutes.Post = api.BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Post = chi.NewRouter()
	api.BaseRoutes.Posts.Mount("/{post_id:[A-Za-z0-9]+}", api.BaseRoutes.Post)

	// api.BaseRoutes.PostsForChannel = api.BaseRoutes.Channel.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.PostsForChannel = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/posts", api.BaseRoutes.PostsForChannel)

	// api.BaseRoutes.PostsForUser = api.BaseRoutes.User.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.PostsForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/posts", api.BaseRoutes.PostsForUser)

	// api.BaseRoutes.PostForUser = api.BaseRoutes.PostsForUser.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.PostForUser = chi.NewRouter()
	api.BaseRoutes.PostsForUser.Mount("/{post_id:[A-Za-z0-9]+}", api.BaseRoutes.PostForUser)

	// api.BaseRoutes.Files = api.BaseRoutes.APIRoot.PathPrefix("/files").Subrouter()
	api.BaseRoutes.Files = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/files", api.BaseRoutes.Files)

	// api.BaseRoutes.File = api.BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.File = chi.NewRouter()
	api.BaseRoutes.Files.Mount("/{file_id:[A-Za-z0-9]+}", api.BaseRoutes.File)

	// api.BaseRoutes.PublicFile = api.BaseRoutes.Root.PathPrefix("/files/{file_id:[A-Za-z0-9]+}/public").Subrouter()
	api.BaseRoutes.PublicFile = chi.NewRouter()
	api.BaseRoutes.Root.Mount("/files/{file_id:[A-Za-z0-9]+}/public", api.BaseRoutes.PublicFile)

	// api.BaseRoutes.Uploads = api.BaseRoutes.APIRoot.PathPrefix("/uploads").Subrouter()
	api.BaseRoutes.Uploads = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/uploads", api.BaseRoutes.Uploads)

	// api.BaseRoutes.Upload = api.BaseRoutes.Uploads.PathPrefix("/{upload_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Upload = chi.NewRouter()
	api.BaseRoutes.Uploads.Mount("/{upload_id:[A-Za-z0-9]+}", api.BaseRoutes.Upload)

	// api.BaseRoutes.Plugins = api.BaseRoutes.APIRoot.PathPrefix("/plugins").Subrouter()
	api.BaseRoutes.Plugins = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/plugins", api.BaseRoutes.Plugins)

	// api.BaseRoutes.Plugin = api.BaseRoutes.Plugins.PathPrefix("/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	api.BaseRoutes.Plugin = chi.NewRouter()
	api.BaseRoutes.Plugins.Mount("/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", api.BaseRoutes.Plugin)

	// api.BaseRoutes.Commands = api.BaseRoutes.APIRoot.PathPrefix("/commands").Subrouter()
	api.BaseRoutes.Commands = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/commands", api.BaseRoutes.Commands)

	// api.BaseRoutes.Command = api.BaseRoutes.Commands.PathPrefix("/{command_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Command = chi.NewRouter()
	api.BaseRoutes.Commands.Mount("/{command_id:[A-Za-z0-9]+}", api.BaseRoutes.Command)

	// api.BaseRoutes.Hooks = api.BaseRoutes.APIRoot.PathPrefix("/hooks").Subrouter()
	api.BaseRoutes.Hooks = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/hooks", api.BaseRoutes.Hooks)

	// api.BaseRoutes.IncomingHooks = api.BaseRoutes.Hooks.PathPrefix("/incoming").Subrouter()
	api.BaseRoutes.IncomingHooks = chi.NewRouter()
	api.BaseRoutes.Hooks.Mount("/incoming", api.BaseRoutes.IncomingHooks)

	// api.BaseRoutes.IncomingHook = api.BaseRoutes.IncomingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.IncomingHook = chi.NewRouter()
	api.BaseRoutes.IncomingHooks.Mount("/{hook_id:[A-Za-z0-9]+}", api.BaseRoutes.IncomingHook)

	// api.BaseRoutes.OutgoingHooks = api.BaseRoutes.Hooks.PathPrefix("/outgoing").Subrouter()
	api.BaseRoutes.OutgoingHooks = chi.NewRouter()
	api.BaseRoutes.Hooks.Mount("/outgoing", api.BaseRoutes.OutgoingHooks)

	// api.BaseRoutes.OutgoingHook = api.BaseRoutes.OutgoingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.OutgoingHook = chi.NewRouter()
	api.BaseRoutes.OutgoingHooks.Mount("/{hook_id:[A-Za-z0-9]+}", api.BaseRoutes.OutgoingHook)

	// api.BaseRoutes.SAML = api.BaseRoutes.APIRoot.PathPrefix("/saml").Subrouter()
	api.BaseRoutes.SAML = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/saml", api.BaseRoutes.SAML)

	// api.BaseRoutes.OAuth = api.BaseRoutes.APIRoot.PathPrefix("/oauth").Subrouter()
	api.BaseRoutes.OAuth = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/oauth", api.BaseRoutes.OAuth)

	// api.BaseRoutes.OAuthApps = api.BaseRoutes.OAuth.PathPrefix("/apps").Subrouter()
	api.BaseRoutes.OAuthApps = chi.NewRouter()
	api.BaseRoutes.OAuth.Mount("/apps", api.BaseRoutes.OAuthApps)

	// api.BaseRoutes.OAuthApp = api.BaseRoutes.OAuthApps.PathPrefix("/{app_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.OAuthApp = chi.NewRouter()
	api.BaseRoutes.OAuthApps.Mount("/{app_id:[A-Za-z0-9]+}", api.BaseRoutes.OAuthApp)

	// api.BaseRoutes.Compliance = api.BaseRoutes.APIRoot.PathPrefix("/compliance").Subrouter()
	api.BaseRoutes.Compliance = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/compliance", api.BaseRoutes.Compliance)

	// api.BaseRoutes.Cluster = api.BaseRoutes.APIRoot.PathPrefix("/cluster").Subrouter()
	api.BaseRoutes.Cluster = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/cluster", api.BaseRoutes.Cluster)

	// api.BaseRoutes.LDAP = api.BaseRoutes.APIRoot.PathPrefix("/ldap").Subrouter()
	api.BaseRoutes.LDAP = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/ldap", api.BaseRoutes.LDAP)

	// api.BaseRoutes.Brand = api.BaseRoutes.APIRoot.PathPrefix("/brand").Subrouter()
	api.BaseRoutes.Brand = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/brand", api.BaseRoutes.Brand)

	// api.BaseRoutes.System = api.BaseRoutes.APIRoot.PathPrefix("/system").Subrouter()
	api.BaseRoutes.System = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/system", api.BaseRoutes.System)

	// api.BaseRoutes.Preferences = api.BaseRoutes.User.PathPrefix("/preferences").Subrouter()
	api.BaseRoutes.Preferences = chi.NewRouter()
	api.BaseRoutes.User.Mount("/preferences", api.BaseRoutes.Preferences)

	// api.BaseRoutes.Public = api.BaseRoutes.APIRoot.PathPrefix("/public").Subrouter()
	api.BaseRoutes.Public = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/public", api.BaseRoutes.Public)

	// api.BaseRoutes.Reactions = api.BaseRoutes.APIRoot.PathPrefix("/reactions").Subrouter()
	api.BaseRoutes.Reactions = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/reactions", api.BaseRoutes.Reactions)

	// api.BaseRoutes.Jobs = api.BaseRoutes.APIRoot.PathPrefix("/jobs").Subrouter()
	api.BaseRoutes.Jobs = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/jobs", api.BaseRoutes.Jobs)

	// api.BaseRoutes.Recaps = api.BaseRoutes.APIRoot.PathPrefix("/recaps").Subrouter()
	api.BaseRoutes.Recaps = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/recaps", api.BaseRoutes.Recaps)

	// api.BaseRoutes.Elasticsearch = api.BaseRoutes.APIRoot.PathPrefix("/elasticsearch").Subrouter()
	api.BaseRoutes.Elasticsearch = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/elasticsearch", api.BaseRoutes.Elasticsearch)

	// api.BaseRoutes.DataRetention = api.BaseRoutes.APIRoot.PathPrefix("/data_retention").Subrouter()
	api.BaseRoutes.DataRetention = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/data_retention", api.BaseRoutes.DataRetention)

	// api.BaseRoutes.Emojis = api.BaseRoutes.APIRoot.PathPrefix("/emoji").Subrouter()
	api.BaseRoutes.Emojis = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/emoji", api.BaseRoutes.Emojis)

	// api.BaseRoutes.Emoji = api.BaseRoutes.APIRoot.PathPrefix("/emoji/{emoji_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Emoji = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/emoji/{emoji_id:[A-Za-z0-9]+}", api.BaseRoutes.Emoji)

	// api.BaseRoutes.EmojiByName = api.BaseRoutes.Emojis.PathPrefix("/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}").Subrouter()
	api.BaseRoutes.EmojiByName = chi.NewRouter()
	api.BaseRoutes.Emojis.Mount("/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}", api.BaseRoutes.EmojiByName)

	// api.BaseRoutes.ReactionByNameForPostForUser = api.BaseRoutes.PostForUser.PathPrefix("/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}").Subrouter()
	api.BaseRoutes.ReactionByNameForPostForUser = chi.NewRouter()
	api.BaseRoutes.PostForUser.Mount("/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}", api.BaseRoutes.ReactionByNameForPostForUser)

	// api.BaseRoutes.Roles = api.BaseRoutes.APIRoot.PathPrefix("/roles").Subrouter()
	api.BaseRoutes.Roles = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/roles", api.BaseRoutes.Roles)

	// api.BaseRoutes.Schemes = api.BaseRoutes.APIRoot.PathPrefix("/schemes").Subrouter()
	api.BaseRoutes.Schemes = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/schemes", api.BaseRoutes.Schemes)

	// api.BaseRoutes.Image = api.BaseRoutes.APIRoot.PathPrefix("/image").Subrouter()
	api.BaseRoutes.Image = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/image", api.BaseRoutes.Image)

	// api.BaseRoutes.TermsOfService = api.BaseRoutes.APIRoot.PathPrefix("/terms_of_service").Subrouter()
	api.BaseRoutes.TermsOfService = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/terms_of_service", api.BaseRoutes.TermsOfService)

	// api.BaseRoutes.Groups = api.BaseRoutes.APIRoot.PathPrefix("/groups").Subrouter()
	api.BaseRoutes.Groups = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/groups", api.BaseRoutes.Groups)

	// api.BaseRoutes.Cloud = api.BaseRoutes.APIRoot.PathPrefix("/cloud").Subrouter()
	api.BaseRoutes.Cloud = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/cloud", api.BaseRoutes.Cloud)

	// api.BaseRoutes.Imports = api.BaseRoutes.APIRoot.PathPrefix("/imports").Subrouter()
	api.BaseRoutes.Imports = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/imports", api.BaseRoutes.Imports)

	// api.BaseRoutes.Import = api.BaseRoutes.Imports.PathPrefix("/{import_name:.+\\.zip}").Subrouter()
	api.BaseRoutes.Import = chi.NewRouter()
	api.BaseRoutes.Imports.Mount("/{import_name:.+\\.zip}", api.BaseRoutes.Import)

	// api.BaseRoutes.Exports = api.BaseRoutes.APIRoot.PathPrefix("/exports").Subrouter()
	api.BaseRoutes.Exports = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/exports", api.BaseRoutes.Exports)

	// api.BaseRoutes.Export = api.BaseRoutes.Exports.PathPrefix("/{export_name:.+\\.zip}").Subrouter()
	api.BaseRoutes.Export = chi.NewRouter()
	api.BaseRoutes.Exports.Mount("/{export_name:.+\\.zip}", api.BaseRoutes.Export)

	// api.BaseRoutes.RemoteCluster = api.BaseRoutes.APIRoot.PathPrefix("/remotecluster").Subrouter()
	api.BaseRoutes.RemoteCluster = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/remotecluster", api.BaseRoutes.RemoteCluster)

	// api.BaseRoutes.SharedChannels = api.BaseRoutes.APIRoot.PathPrefix("/sharedchannels").Subrouter()
	api.BaseRoutes.SharedChannels = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/sharedchannels", api.BaseRoutes.SharedChannels)

	// api.BaseRoutes.SharedChannelRemotes = api.BaseRoutes.RemoteCluster.PathPrefix("/{remote_id:[A-Za-z0-9]+}/sharedchannelremotes").Subrouter()
	api.BaseRoutes.SharedChannelRemotes = chi.NewRouter()
	api.BaseRoutes.RemoteCluster.Mount("/{remote_id:[A-Za-z0-9]+}/sharedchannelremotes", api.BaseRoutes.SharedChannelRemotes)

	// api.BaseRoutes.ChannelForRemote = api.BaseRoutes.RemoteCluster.PathPrefix("/{remote_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelForRemote = chi.NewRouter()
	api.BaseRoutes.RemoteCluster.Mount("/{remote_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}", api.BaseRoutes.ChannelForRemote)

	// api.BaseRoutes.Permissions = api.BaseRoutes.APIRoot.PathPrefix("/permissions").Subrouter()
	api.BaseRoutes.Permissions = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/permissions", api.BaseRoutes.Permissions)

	// api.BaseRoutes.Usage = api.BaseRoutes.APIRoot.PathPrefix("/usage").Subrouter()
	api.BaseRoutes.Usage = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/usage", api.BaseRoutes.Usage)

	// api.BaseRoutes.HostedCustomer = api.BaseRoutes.APIRoot.PathPrefix("/hosted_customer").Subrouter()
	api.BaseRoutes.HostedCustomer = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/hosted_customer", api.BaseRoutes.HostedCustomer)

	// api.BaseRoutes.Drafts = api.BaseRoutes.APIRoot.PathPrefix("/drafts").Subrouter()
	api.BaseRoutes.Drafts = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/drafts", api.BaseRoutes.Drafts)

	// api.BaseRoutes.IPFiltering = api.BaseRoutes.APIRoot.PathPrefix("/ip_filtering").Subrouter()
	api.BaseRoutes.IPFiltering = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/ip_filtering", api.BaseRoutes.IPFiltering)

	// api.BaseRoutes.Reports = api.BaseRoutes.APIRoot.PathPrefix("/reports").Subrouter()
	api.BaseRoutes.Reports = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/reports", api.BaseRoutes.Reports)

	// api.BaseRoutes.OutgoingOAuthConnections = api.BaseRoutes.APIRoot.PathPrefix("/oauth/outgoing_connections").Subrouter()
	api.BaseRoutes.OutgoingOAuthConnections = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/oauth/outgoing_connections", api.BaseRoutes.OutgoingOAuthConnections)

	// api.BaseRoutes.OutgoingOAuthConnection = api.BaseRoutes.OutgoingOAuthConnections.PathPrefix("/{outgoing_oauth_connection_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.OutgoingOAuthConnection = chi.NewRouter()
	api.BaseRoutes.OutgoingOAuthConnections.Mount("/{outgoing_oauth_connection_id:[A-Za-z0-9]+}", api.BaseRoutes.OutgoingOAuthConnection)

	// api.BaseRoutes.CustomProfileAttributes = api.BaseRoutes.APIRoot.PathPrefix("/custom_profile_attributes").Subrouter()
	api.BaseRoutes.CustomProfileAttributes = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/custom_profile_attributes", api.BaseRoutes.CustomProfileAttributes)

	// api.BaseRoutes.CustomProfileAttributesFields = api.BaseRoutes.CustomProfileAttributes.PathPrefix("/fields").Subrouter()
	api.BaseRoutes.CustomProfileAttributesFields = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributes.Mount("/fields", api.BaseRoutes.CustomProfileAttributesFields)

	// api.BaseRoutes.CustomProfileAttributesField = api.BaseRoutes.CustomProfileAttributesFields.PathPrefix("/{field_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.CustomProfileAttributesField = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributesFields.Mount("/{field_id:[A-Za-z0-9]+}", api.BaseRoutes.CustomProfileAttributesField)

	// api.BaseRoutes.CustomProfileAttributesValues = api.BaseRoutes.CustomProfileAttributes.PathPrefix("/values").Subrouter()
	api.BaseRoutes.CustomProfileAttributesValues = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributes.Mount("/values", api.BaseRoutes.CustomProfileAttributesValues)

	// api.BaseRoutes.AuditLogs = api.BaseRoutes.APIRoot.PathPrefix("/audit_logs").Subrouter()
	api.BaseRoutes.AuditLogs = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/audit_logs", api.BaseRoutes.AuditLogs)

	// api.BaseRoutes.AccessControlPolicies = api.BaseRoutes.APIRoot.PathPrefix("/access_control_policies").Subrouter()
	api.BaseRoutes.AccessControlPolicies = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/access_control_policies", api.BaseRoutes.AccessControlPolicies)

	// api.BaseRoutes.AccessControlPolicy = api.BaseRoutes.APIRoot.PathPrefix("/access_control_policies/{policy_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.AccessControlPolicy = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/access_control_policies/{policy_id:[A-Za-z0-9]+}", api.BaseRoutes.AccessControlPolicy)

	// api.BaseRoutes.ContentFlagging = api.BaseRoutes.APIRoot.PathPrefix("/content_flagging").Subrouter()
	api.BaseRoutes.ContentFlagging = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/content_flagging", api.BaseRoutes.ContentFlagging)

	// api.BaseRoutes.Agents = api.BaseRoutes.APIRoot.PathPrefix("/agents").Subrouter()
	api.BaseRoutes.Agents = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/agents", api.BaseRoutes.Agents)

	// api.BaseRoutes.LLMServices = api.BaseRoutes.APIRoot.PathPrefix("/llmservices").Subrouter()
	api.BaseRoutes.LLMServices = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/llmservices", api.BaseRoutes.LLMServices)

	api.BaseRoutes.Limits = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/limits", api.BaseRoutes.Limits)

	api.InitUser()
	api.InitBot()
	api.InitTeam()
	api.InitChannel()
	api.InitPost()
	api.InitFile()
	api.InitUpload()
	api.InitSystem()
	api.InitConfig()
	api.InitWebhook()
	api.InitPreference()
	api.InitSaml()
	api.InitCompliance()
	api.InitCluster()
	api.InitLdap()
	api.InitElasticsearch()
	api.InitDataRetention()
	api.InitBrand()
	api.InitJob()
	api.InitRecap()
	api.InitCommand()
	api.InitStatus()
	api.InitWebSocket()
	api.InitEmoji()
	api.InitOAuth()
	api.InitReaction()
	api.InitPlugin()
	api.InitRole()
	api.InitScheme()
	api.InitImage()
	api.InitTermsOfService()
	api.InitGroup()
	api.InitAction()
	api.InitCloud()
	api.InitImport()
	api.InitRemoteCluster()
	api.InitSharedChannels()
	api.InitPermissions()
	api.InitExport()
	api.InitUsage()
	api.InitHostedCustomer()
	api.InitDrafts()
	api.InitIPFiltering()
	api.InitChannelBookmarks()
	api.InitReports()
	api.InitOutgoingOAuthConnection()
	api.InitClientPerformanceMetrics()
	api.InitScheduledPost()
	api.InitCustomProfileAttributes()
	api.InitAuditLogging()
	api.InitAccessControlPolicy()
	api.InitContentFlagging()
	api.InitAgents()
	api.InitLimits()

	// register LMS api
	if initLmsApiFunc != nil {
		initLmsApiFunc(api)
	}

	// If we allow testing then listen for manual testing URL hits
	if *srv.Config().ServiceSettings.EnableTesting {
		// api.BaseRoutes.Root.Handle("/manualtest", api.APIHandler(manualtesting.ManualTest)).Methods(http.MethodGet)
		api.BaseRoutes.Root.Method(http.MethodGet, "/manualtest", api.APIHandler(manualtesting.ManualTest))
	}

	srv.Router.Handle("/api/v4/{anything:.*}", http.HandlerFunc(api.Handle404))

	InitLocal(srv)

	return api, nil
}

func InitLocal(srv *app.Server) *API {
	api := &API{
		srv:        srv,
		BaseRoutes: &Routes{},
	}

	api.BaseRoutes.Root = srv.LocalRouter
	// api.BaseRoutes.APIRoot = srv.LocalRouter.PathPrefix(model.APIURLSuffix).Subrouter()
	api.BaseRoutes.APIRoot = chi.NewRouter()
	srv.LocalRouter.Mount(model.APIURLSuffix, api.BaseRoutes.APIRoot)

	// api.BaseRoutes.Users = api.BaseRoutes.APIRoot.PathPrefix("/users").Subrouter()
	api.BaseRoutes.Users = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/users", api.BaseRoutes.Users)

	// api.BaseRoutes.User = api.BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.User = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.User)

	// api.BaseRoutes.UserByUsername = api.BaseRoutes.Users.PathPrefix("/username/{username:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	api.BaseRoutes.UserByUsername = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/username/{username:[A-Za-z0-9\\_\\-\\.]+}", api.BaseRoutes.UserByUsername)

	// api.BaseRoutes.UserByEmail = api.BaseRoutes.Users.PathPrefix("/email/{email:.+}").Subrouter()
	api.BaseRoutes.UserByEmail = chi.NewRouter()
	api.BaseRoutes.Users.Mount("/email/{email:.+}", api.BaseRoutes.UserByEmail)

	// api.BaseRoutes.Bots = api.BaseRoutes.APIRoot.PathPrefix("/bots").Subrouter()
	api.BaseRoutes.Bots = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/bots", api.BaseRoutes.Bots)

	// api.BaseRoutes.Bot = api.BaseRoutes.APIRoot.PathPrefix("/bots/{bot_user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Bot = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/bots/{bot_user_id:[A-Za-z0-9]+}", api.BaseRoutes.Bot)

	// api.BaseRoutes.Teams = api.BaseRoutes.APIRoot.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.Teams = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/teams", api.BaseRoutes.Teams)

	// api.BaseRoutes.Team = api.BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Team = chi.NewRouter()
	api.BaseRoutes.Teams.Mount("/{team_id:[A-Za-z0-9]+}", api.BaseRoutes.Team)

	// api.BaseRoutes.TeamByName = api.BaseRoutes.Teams.PathPrefix("/name/{team_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.TeamByName = chi.NewRouter()
	api.BaseRoutes.Teams.Mount("/name/{team_name:[A-Za-z0-9_-]+}", api.BaseRoutes.TeamByName)

	// api.BaseRoutes.TeamMembers = api.BaseRoutes.Team.PathPrefix("/members").Subrouter()
	api.BaseRoutes.TeamMembers = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/members", api.BaseRoutes.TeamMembers)

	// api.BaseRoutes.TeamMember = api.BaseRoutes.TeamMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamMember = chi.NewRouter()
	api.BaseRoutes.TeamMembers.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.TeamMember)

	// api.BaseRoutes.Channels = api.BaseRoutes.APIRoot.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.Channels = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/channels", api.BaseRoutes.Channels)

	// api.BaseRoutes.Channel = api.BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Channel = chi.NewRouter()
	api.BaseRoutes.Channels.Mount("/{channel_id:[A-Za-z0-9]+}", api.BaseRoutes.Channel)

	// api.BaseRoutes.ChannelByName = api.BaseRoutes.Team.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelByName = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/channels/name/{channel_name:[A-Za-z0-9_-]+}", api.BaseRoutes.ChannelByName)

	// api.BaseRoutes.ChannelByNameForTeamName = api.BaseRoutes.TeamByName.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelByNameForTeamName = chi.NewRouter()
	api.BaseRoutes.TeamByName.Mount("/channels/name/{channel_name:[A-Za-z0-9_-]+}", api.BaseRoutes.ChannelByNameForTeamName)

	// api.BaseRoutes.ChannelsForTeam = api.BaseRoutes.Team.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.ChannelsForTeam = chi.NewRouter()
	api.BaseRoutes.Team.Mount("/channels", api.BaseRoutes.ChannelsForTeam)

	// api.BaseRoutes.ChannelMembers = api.BaseRoutes.Channel.PathPrefix("/members").Subrouter()
	api.BaseRoutes.ChannelMembers = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/members", api.BaseRoutes.ChannelMembers)

	// api.BaseRoutes.ChannelMember = api.BaseRoutes.ChannelMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelMember = chi.NewRouter()
	api.BaseRoutes.ChannelMembers.Mount("/{user_id:[A-Za-z0-9]+}", api.BaseRoutes.ChannelMember)

	// api.BaseRoutes.ChannelMembersForUser = api.BaseRoutes.User.PathPrefix("/teams/{team_id:[A-Za-z0-9]+}/channels/members").Subrouter()
	api.BaseRoutes.ChannelMembersForUser = chi.NewRouter()
	api.BaseRoutes.User.Mount("/teams/{team_id:[A-Za-z0-9]+}/channels/members", api.BaseRoutes.ChannelMembersForUser)

	// api.BaseRoutes.Plugins = api.BaseRoutes.APIRoot.PathPrefix("/plugins").Subrouter()
	api.BaseRoutes.Plugins = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/plugins", api.BaseRoutes.Plugins)

	// api.BaseRoutes.Plugin = api.BaseRoutes.Plugins.PathPrefix("/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	api.BaseRoutes.Plugin = chi.NewRouter()
	api.BaseRoutes.Plugins.Mount("/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", api.BaseRoutes.Plugin)

	// api.BaseRoutes.Commands = api.BaseRoutes.APIRoot.PathPrefix("/commands").Subrouter()
	api.BaseRoutes.Commands = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/commands", api.BaseRoutes.Commands)

	// api.BaseRoutes.Command = api.BaseRoutes.Commands.PathPrefix("/{command_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Command = chi.NewRouter()
	api.BaseRoutes.Commands.Mount("/{command_id:[A-Za-z0-9]+}", api.BaseRoutes.Command)

	// api.BaseRoutes.Hooks = api.BaseRoutes.APIRoot.PathPrefix("/hooks").Subrouter()
	api.BaseRoutes.Hooks = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/hooks", api.BaseRoutes.Hooks)

	// api.BaseRoutes.IncomingHooks = api.BaseRoutes.Hooks.PathPrefix("/incoming").Subrouter()
	api.BaseRoutes.IncomingHooks = chi.NewRouter()
	api.BaseRoutes.Hooks.Mount("/incoming", api.BaseRoutes.IncomingHooks)

	// api.BaseRoutes.IncomingHook = api.BaseRoutes.IncomingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.IncomingHook = chi.NewRouter()
	api.BaseRoutes.IncomingHooks.Mount("/{hook_id:[A-Za-z0-9]+}", api.BaseRoutes.IncomingHook)

	// api.BaseRoutes.OutgoingHooks = api.BaseRoutes.Hooks.PathPrefix("/outgoing").Subrouter()
	api.BaseRoutes.OutgoingHooks = chi.NewRouter()
	api.BaseRoutes.Hooks.Mount("/outgoing", api.BaseRoutes.OutgoingHooks)

	// api.BaseRoutes.OutgoingHook = api.BaseRoutes.OutgoingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.OutgoingHook = chi.NewRouter()
	api.BaseRoutes.OutgoingHooks.Mount("/{hook_id:[A-Za-z0-9]+}", api.BaseRoutes.OutgoingHook)

	// api.BaseRoutes.Groups = api.BaseRoutes.APIRoot.PathPrefix("/groups").Subrouter()
	api.BaseRoutes.Groups = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/groups", api.BaseRoutes.Groups)

	// api.BaseRoutes.LDAP = api.BaseRoutes.APIRoot.PathPrefix("/ldap").Subrouter()
	api.BaseRoutes.LDAP = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/ldap", api.BaseRoutes.LDAP)

	// api.BaseRoutes.System = api.BaseRoutes.APIRoot.PathPrefix("/system").Subrouter()
	api.BaseRoutes.System = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/system", api.BaseRoutes.System)

	// api.BaseRoutes.Preferences = api.BaseRoutes.User.PathPrefix("/preferences").Subrouter()
	api.BaseRoutes.Preferences = chi.NewRouter()
	api.BaseRoutes.User.Mount("/preferences", api.BaseRoutes.Preferences)

	// api.BaseRoutes.Posts = api.BaseRoutes.APIRoot.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.Posts = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/posts", api.BaseRoutes.Posts)

	// api.BaseRoutes.Post = api.BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Post = chi.NewRouter()
	api.BaseRoutes.Posts.Mount("/{post_id:[A-Za-z0-9]+}", api.BaseRoutes.Post)

	// api.BaseRoutes.PostsForChannel = api.BaseRoutes.Channel.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.PostsForChannel = chi.NewRouter()
	api.BaseRoutes.Channel.Mount("/posts", api.BaseRoutes.PostsForChannel)

	// api.BaseRoutes.Roles = api.BaseRoutes.APIRoot.PathPrefix("/roles").Subrouter()
	api.BaseRoutes.Roles = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/roles", api.BaseRoutes.Roles)

	// api.BaseRoutes.Uploads = api.BaseRoutes.APIRoot.PathPrefix("/uploads").Subrouter()
	api.BaseRoutes.Uploads = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/uploads", api.BaseRoutes.Uploads)

	// api.BaseRoutes.Upload = api.BaseRoutes.Uploads.PathPrefix("/{upload_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Upload = chi.NewRouter()
	api.BaseRoutes.Uploads.Mount("/{upload_id:[A-Za-z0-9]+}", api.BaseRoutes.Upload)

	// api.BaseRoutes.Imports = api.BaseRoutes.APIRoot.PathPrefix("/imports").Subrouter()
	api.BaseRoutes.Imports = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/imports", api.BaseRoutes.Imports)

	// api.BaseRoutes.Import = api.BaseRoutes.Imports.PathPrefix("/{import_name:.+\\.zip}").Subrouter()
	api.BaseRoutes.Import = chi.NewRouter()
	api.BaseRoutes.Imports.Mount("/{import_name:.+\\.zip}", api.BaseRoutes.Import)

	// api.BaseRoutes.Exports = api.BaseRoutes.APIRoot.PathPrefix("/exports").Subrouter()
	api.BaseRoutes.Exports = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/exports", api.BaseRoutes.Exports)

	// api.BaseRoutes.Export = api.BaseRoutes.Exports.PathPrefix("/{export_name:.+\\.zip}").Subrouter()
	api.BaseRoutes.Export = chi.NewRouter()
	api.BaseRoutes.Exports.Mount("/{export_name:.+\\.zip}", api.BaseRoutes.Export)

	// api.BaseRoutes.Jobs = api.BaseRoutes.APIRoot.PathPrefix("/jobs").Subrouter()
	api.BaseRoutes.Jobs = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/jobs", api.BaseRoutes.Jobs)

	// api.BaseRoutes.SAML = api.BaseRoutes.APIRoot.PathPrefix("/saml").Subrouter()
	api.BaseRoutes.SAML = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/saml", api.BaseRoutes.SAML)

	// api.BaseRoutes.CustomProfileAttributes = api.BaseRoutes.APIRoot.PathPrefix("/custom_profile_attributes").Subrouter()
	api.BaseRoutes.CustomProfileAttributes = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/custom_profile_attributes", api.BaseRoutes.CustomProfileAttributes)

	// api.BaseRoutes.CustomProfileAttributesFields = api.BaseRoutes.CustomProfileAttributes.PathPrefix("/fields").Subrouter()
	api.BaseRoutes.CustomProfileAttributesFields = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributes.Mount("/fields", api.BaseRoutes.CustomProfileAttributesFields)

	// api.BaseRoutes.CustomProfileAttributesField = api.BaseRoutes.CustomProfileAttributesFields.PathPrefix("/{field_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.CustomProfileAttributesField = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributesFields.Mount("/{field_id:[A-Za-z0-9]+}", api.BaseRoutes.CustomProfileAttributesField)

	// api.BaseRoutes.CustomProfileAttributesValues = api.BaseRoutes.CustomProfileAttributes.PathPrefix("/values").Subrouter()
	api.BaseRoutes.CustomProfileAttributesValues = chi.NewRouter()
	api.BaseRoutes.CustomProfileAttributes.Mount("/values", api.BaseRoutes.CustomProfileAttributesValues)

	// api.BaseRoutes.AccessControlPolicies = api.BaseRoutes.APIRoot.PathPrefix("/access_control_policies").Subrouter()
	api.BaseRoutes.AccessControlPolicies = chi.NewRouter()
	api.BaseRoutes.APIRoot.Mount("/access_control_policies", api.BaseRoutes.AccessControlPolicies)

	// api.BaseRoutes.AccessControlPolicy = api.BaseRoutes.APIRoot.PathPrefix("/access_control_policies/{policy_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.AccessControlPolicy = chi.NewRouter()
	api.BaseRoutes.AccessControlPolicies.Mount("/{policy_id:[A-Za-z0-9]+}", api.BaseRoutes.AccessControlPolicy)

	api.InitUserLocal()
	api.InitTeamLocal()
	api.InitChannelLocal()
	api.InitConfigLocal()
	api.InitWebhookLocal()
	api.InitPluginLocal()
	api.InitCommandLocal()
	api.InitBotLocal()
	api.InitGroupLocal()
	api.InitLdapLocal()
	api.InitSystemLocal()
	api.InitPostLocal()
	api.InitPreferenceLocal()
	api.InitRoleLocal()
	api.InitUploadLocal()
	api.InitImportLocal()
	api.InitExportLocal()
	api.InitJobLocal()
	api.InitSamlLocal()
	api.InitCustomProfileAttributesLocal()
	api.InitAccessControlPolicyLocal()

	srv.LocalRouter.Handle("/api/v4/{anything:.*}", http.HandlerFunc(api.Handle404))

	return api
}

func (api *API) Handle404(w http.ResponseWriter, r *http.Request) {
	app := app.New(app.ServerConnector(api.srv.Channels()))
	web.Handle404(app, w, r)
}

var ReturnStatusOK = web.ReturnStatusOK

var initLmsApiFunc func(api *API) error

// RegisterInitLmsApiFunc allows the LMS API package to register its init function.
func RegisterInitLmsApiFunc(f func(api *API) error) {
	initLmsApiFunc = f
}
