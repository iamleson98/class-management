// Code automatically generated;
// DO NOT EDIT

package utils

type AddressColumn string

const (
	AddressID               AddressColumn = "id"
	AddressCreateat         AddressColumn = "createat"
	AddressUpdateat         AddressColumn = "updateat"
	AddressFirstname        AddressColumn = "firstname"
	AddressLastname         AddressColumn = "lastname"
	AddressEmail            AddressColumn = "email"
	AddressCompanyName      AddressColumn = "company_name"
	AddressStreetAddress1   AddressColumn = "street_address_1"
	AddressStreetAddress2   AddressColumn = "street_address_2"
	AddressCityID           AddressColumn = "city_id"
	AddressCountry          AddressColumn = "country"
	AddressPostalCode       AddressColumn = "postal_code"
	AddressPhone            AddressColumn = "phone"
	AddressLocation         AddressColumn = "location"
	AddressUserID           AddressColumn = "user_id"
	AddressTransportBrandID AddressColumn = "transport_brand_id"
)

func (c AddressColumn) IsValid() bool {
	switch c {
	case AddressID:
		return true
	case AddressCreateat:
		return true
	case AddressUpdateat:
		return true
	case AddressFirstname:
		return true
	case AddressLastname:
		return true
	case AddressEmail:
		return true
	case AddressCompanyName:
		return true
	case AddressStreetAddress1:
		return true
	case AddressStreetAddress2:
		return true
	case AddressCityID:
		return true
	case AddressCountry:
		return true
	case AddressPostalCode:
		return true
	case AddressPhone:
		return true
	case AddressLocation:
		return true
	case AddressUserID:
		return true
	case AddressTransportBrandID:
		return true
	default:
		return false
	}
}

type TransportBrandColumn string

const (
	TransportBrandID            TransportBrandColumn = "id"
	TransportBrandCreateat      TransportBrandColumn = "createat"
	TransportBrandUpdateat      TransportBrandColumn = "updateat"
	TransportBrandDeleteat      TransportBrandColumn = "deleteat"
	TransportBrandName          TransportBrandColumn = "name"
	TransportBrandDescription   TransportBrandColumn = "description"
	TransportBrandEmail         TransportBrandColumn = "email"
	TransportBrandPhone         TransportBrandColumn = "phone"
	TransportBrandVehicleTypes  TransportBrandColumn = "vehicle_types"
	TransportBrandRepresentorID TransportBrandColumn = "representor_id"
	TransportBrandAddressID     TransportBrandColumn = "address_id"
)

func (c TransportBrandColumn) IsValid() bool {
	switch c {
	case TransportBrandID:
		return true
	case TransportBrandCreateat:
		return true
	case TransportBrandUpdateat:
		return true
	case TransportBrandDeleteat:
		return true
	case TransportBrandName:
		return true
	case TransportBrandDescription:
		return true
	case TransportBrandEmail:
		return true
	case TransportBrandPhone:
		return true
	case TransportBrandVehicleTypes:
		return true
	case TransportBrandRepresentorID:
		return true
	case TransportBrandAddressID:
		return true
	default:
		return false
	}
}

type VehicleColumn string

const (
	VehicleID                  VehicleColumn = "id"
	VehicleCreateat            VehicleColumn = "createat"
	VehicleUpdateat            VehicleColumn = "updateat"
	VehicleDeleteat            VehicleColumn = "deleteat"
	VehicleName                VehicleColumn = "name"
	VehicleNote                VehicleColumn = "note"
	VehicleMaker               VehicleColumn = "maker"
	VehicleLicensePlate        VehicleColumn = "license_plate"
	VehicleVerifiedAt          VehicleColumn = "verified_at"
	VehicleType                VehicleColumn = "type"
	VehiclePhone               VehicleColumn = "phone"
	VehicleDriverID            VehicleColumn = "driver_id"
	VehicleDriverSupporterID   VehicleColumn = "driver_supporter_id"
	VehicleSupervisorID        VehicleColumn = "supervisor_id"
	VehicleTotalSeatsAvailable VehicleColumn = "total_seats_available"
)

func (c VehicleColumn) IsValid() bool {
	switch c {
	case VehicleID:
		return true
	case VehicleCreateat:
		return true
	case VehicleUpdateat:
		return true
	case VehicleDeleteat:
		return true
	case VehicleName:
		return true
	case VehicleNote:
		return true
	case VehicleMaker:
		return true
	case VehicleLicensePlate:
		return true
	case VehicleVerifiedAt:
		return true
	case VehicleType:
		return true
	case VehiclePhone:
		return true
	case VehicleDriverID:
		return true
	case VehicleDriverSupporterID:
		return true
	case VehicleSupervisorID:
		return true
	case VehicleTotalSeatsAvailable:
		return true
	default:
		return false
	}
}

type SeatColumn string

const (
	SeatID        SeatColumn = "id"
	SeatNumber    SeatColumn = "number"
	SeatVehicleID SeatColumn = "vehicle_id"
	SeatCreateat  SeatColumn = "createat"
	SeatUpdateat  SeatColumn = "updateat"
	SeatDeleteat  SeatColumn = "deleteat"
	SeatPrice     SeatColumn = "price"
)

func (c SeatColumn) IsValid() bool {
	switch c {
	case SeatID:
		return true
	case SeatNumber:
		return true
	case SeatVehicleID:
		return true
	case SeatCreateat:
		return true
	case SeatUpdateat:
		return true
	case SeatDeleteat:
		return true
	case SeatPrice:
		return true
	default:
		return false
	}
}

type TripColumn string

const (
	TripID         TripColumn = "id"
	TripRouteID    TripColumn = "route_id"
	TripVehicleID  TripColumn = "vehicle_id"
	TripStartAt    TripColumn = "start_at"
	TripEndAt      TripColumn = "end_at"
	TripStatus     TripColumn = "status"
	TripFailReason TripColumn = "fail_reason"
)

func (c TripColumn) IsValid() bool {
	switch c {
	case TripID:
		return true
	case TripRouteID:
		return true
	case TripVehicleID:
		return true
	case TripStartAt:
		return true
	case TripEndAt:
		return true
	case TripStatus:
		return true
	case TripFailReason:
		return true
	default:
		return false
	}
}

type RouteColumn string

const (
	RouteID                RouteColumn = "id"
	RouteCreateat          RouteColumn = "createat"
	RouteUpdateat          RouteColumn = "updateat"
	RouteDeleteat          RouteColumn = "deleteat"
	RouteName              RouteColumn = "name"
	RouteDescription       RouteColumn = "description"
	RouteStartCityID       RouteColumn = "start_city_id"
	RouteDestinationCityID RouteColumn = "destination_city_id"
	RouteTransportBrandID  RouteColumn = "transport_brand_id"
)

func (c RouteColumn) IsValid() bool {
	switch c {
	case RouteID:
		return true
	case RouteCreateat:
		return true
	case RouteUpdateat:
		return true
	case RouteDeleteat:
		return true
	case RouteName:
		return true
	case RouteDescription:
		return true
	case RouteStartCityID:
		return true
	case RouteDestinationCityID:
		return true
	case RouteTransportBrandID:
		return true
	default:
		return false
	}
}

type UserColumn string

const (
	UserID                 UserColumn = "id"
	UserCreateat           UserColumn = "createat"
	UserUpdateat           UserColumn = "updateat"
	UserDeleteat           UserColumn = "deleteat"
	UserUsername           UserColumn = "username"
	UserPassword           UserColumn = "password"
	UserAuthdata           UserColumn = "authdata"
	UserAuthservice        UserColumn = "authservice"
	UserEmail              UserColumn = "email"
	UserEmailverified      UserColumn = "emailverified"
	UserNickname           UserColumn = "nickname"
	UserFirstname          UserColumn = "firstname"
	UserLastname           UserColumn = "lastname"
	UserRoles              UserColumn = "roles"
	UserAllowmarketing     UserColumn = "allowmarketing"
	UserProps              UserColumn = "props"
	UserNotifyprops        UserColumn = "notifyprops"
	UserLastpasswordupdate UserColumn = "lastpasswordupdate"
	UserLastpictureupdate  UserColumn = "lastpictureupdate"
	UserFailedattempts     UserColumn = "failedattempts"
	UserLocale             UserColumn = "locale"
	UserMfaactive          UserColumn = "mfaactive"
	UserMfasecret          UserColumn = "mfasecret"
	UserPosition           UserColumn = "position"
	UserTimezone           UserColumn = "timezone"
	UserRemoteid           UserColumn = "remoteid"
	UserLastlogin          UserColumn = "lastlogin"
	UserMfausedtimestamps  UserColumn = "mfausedtimestamps"
	UserAddressID          UserColumn = "address_id"
	UserPhone              UserColumn = "phone"
)

func (c UserColumn) IsValid() bool {
	switch c {
	case UserID:
		return true
	case UserCreateat:
		return true
	case UserUpdateat:
		return true
	case UserDeleteat:
		return true
	case UserUsername:
		return true
	case UserPassword:
		return true
	case UserAuthdata:
		return true
	case UserAuthservice:
		return true
	case UserEmail:
		return true
	case UserEmailverified:
		return true
	case UserNickname:
		return true
	case UserFirstname:
		return true
	case UserLastname:
		return true
	case UserRoles:
		return true
	case UserAllowmarketing:
		return true
	case UserProps:
		return true
	case UserNotifyprops:
		return true
	case UserLastpasswordupdate:
		return true
	case UserLastpictureupdate:
		return true
	case UserFailedattempts:
		return true
	case UserLocale:
		return true
	case UserMfaactive:
		return true
	case UserMfasecret:
		return true
	case UserPosition:
		return true
	case UserTimezone:
		return true
	case UserRemoteid:
		return true
	case UserLastlogin:
		return true
	case UserMfausedtimestamps:
		return true
	case UserAddressID:
		return true
	case UserPhone:
		return true
	default:
		return false
	}
}

type ReservationColumn string

const (
	ReservationID                              ReservationColumn = "id"
	ReservationUserID                          ReservationColumn = "user_id"
	ReservationScheduleID                      ReservationColumn = "schedule_id"
	ReservationPickupLocation                  ReservationColumn = "pickup_location"
	ReservationDestinationLocation             ReservationColumn = "destination_location"
	ReservationNumOfAdults                     ReservationColumn = "num_of_adults"
	ReservationNumOfKids                       ReservationColumn = "num_of_kids"
	ReservationCreateat                        ReservationColumn = "createat"
	ReservationUpdateat                        ReservationColumn = "updateat"
	ReservationDeleteat                        ReservationColumn = "deleteat"
	ReservationCancelAt                        ReservationColumn = "cancel_at"
	ReservationCancelReason                    ReservationColumn = "cancel_reason"
	ReservationStatus                          ReservationColumn = "status"
	ReservationReservationPlacementConfirmedAt ReservationColumn = "reservation_placement_confirmed_at"
	ReservationReservationPlacementConfirmedBy ReservationColumn = "reservation_placement_confirmed_by"
	ReservationUserSatisfactionScore           ReservationColumn = "user_satisfaction_score"
	ReservationUserSatisfactionNote            ReservationColumn = "user_satisfaction_note"
	ReservationParentReservationID             ReservationColumn = "parent_reservation_id"
)

func (c ReservationColumn) IsValid() bool {
	switch c {
	case ReservationID:
		return true
	case ReservationUserID:
		return true
	case ReservationScheduleID:
		return true
	case ReservationPickupLocation:
		return true
	case ReservationDestinationLocation:
		return true
	case ReservationNumOfAdults:
		return true
	case ReservationNumOfKids:
		return true
	case ReservationCreateat:
		return true
	case ReservationUpdateat:
		return true
	case ReservationDeleteat:
		return true
	case ReservationCancelAt:
		return true
	case ReservationCancelReason:
		return true
	case ReservationStatus:
		return true
	case ReservationReservationPlacementConfirmedAt:
		return true
	case ReservationReservationPlacementConfirmedBy:
		return true
	case ReservationUserSatisfactionScore:
		return true
	case ReservationUserSatisfactionNote:
		return true
	case ReservationParentReservationID:
		return true
	default:
		return false
	}
}

type ScheduleColumn string

const (
	ScheduleID        ScheduleColumn = "id"
	ScheduleCreateat  ScheduleColumn = "createat"
	ScheduleUpdateat  ScheduleColumn = "updateat"
	ScheduleDeleteat  ScheduleColumn = "deleteat"
	ScheduleName      ScheduleColumn = "name"
	ScheduleStartTime ScheduleColumn = "start_time"
	ScheduleRouteID   ScheduleColumn = "route_id"
	ScheduleAddressID ScheduleColumn = "address_id"
)

func (c ScheduleColumn) IsValid() bool {
	switch c {
	case ScheduleID:
		return true
	case ScheduleCreateat:
		return true
	case ScheduleUpdateat:
		return true
	case ScheduleDeleteat:
		return true
	case ScheduleName:
		return true
	case ScheduleStartTime:
		return true
	case ScheduleRouteID:
		return true
	case ScheduleAddressID:
		return true
	default:
		return false
	}
}

type ChannelColumn string

const (
	ChannelId                  ChannelColumn = "id"
	ChannelCreateAt            ChannelColumn = "create_at"
	ChannelUpdateAt            ChannelColumn = "update_at"
	ChannelDeleteAt            ChannelColumn = "delete_at"
	ChannelTeamId              ChannelColumn = "team_id"
	ChannelType                ChannelColumn = "type"
	ChannelDisplayName         ChannelColumn = "display_name"
	ChannelName                ChannelColumn = "name"
	ChannelHeader              ChannelColumn = "header"
	ChannelPurpose             ChannelColumn = "purpose"
	ChannelLastPostAt          ChannelColumn = "last_post_at"
	ChannelTotalMsgCount       ChannelColumn = "total_msg_count"
	ChannelExtraUpdateAt       ChannelColumn = "extra_update_at"
	ChannelCreatorId           ChannelColumn = "creator_id"
	ChannelSchemeId            ChannelColumn = "scheme_id"
	ChannelProps               ChannelColumn = "props"
	ChannelGroupConstrained    ChannelColumn = "group_constrained"
	ChannelAutoTranslation     ChannelColumn = "autotranslation"
	ChannelShared              ChannelColumn = "shared"
	ChannelTotalMsgCountRoot   ChannelColumn = "total_msg_count_root"
	ChannelPolicyID            ChannelColumn = "policy_id"
	ChannelLastRootPostAt      ChannelColumn = "last_root_post_at"
	ChannelBannerInfo          ChannelColumn = "banner_info"
	ChannelPolicyEnforced      ChannelColumn = "policy_enforced"
	ChannelPolicyIsActive      ChannelColumn = "policy_is_active"
	ChannelDefaultCategoryName ChannelColumn = "default_category_name"
)

func (c ChannelColumn) IsValid() bool {
	switch c {
	case ChannelId:
		return true
	case ChannelCreateAt:
		return true
	case ChannelUpdateAt:
		return true
	case ChannelDeleteAt:
		return true
	case ChannelTeamId:
		return true
	case ChannelType:
		return true
	case ChannelDisplayName:
		return true
	case ChannelName:
		return true
	case ChannelHeader:
		return true
	case ChannelPurpose:
		return true
	case ChannelLastPostAt:
		return true
	case ChannelTotalMsgCount:
		return true
	case ChannelExtraUpdateAt:
		return true
	case ChannelCreatorId:
		return true
	case ChannelSchemeId:
		return true
	case ChannelProps:
		return true
	case ChannelGroupConstrained:
		return true
	case ChannelAutoTranslation:
		return true
	case ChannelShared:
		return true
	case ChannelTotalMsgCountRoot:
		return true
	case ChannelPolicyID:
		return true
	case ChannelLastRootPostAt:
		return true
	case ChannelBannerInfo:
		return true
	case ChannelPolicyEnforced:
		return true
	case ChannelPolicyIsActive:
		return true
	case ChannelDefaultCategoryName:
		return true
	default:
		return false
	}
}

type PostColumn string

const (
	PostId            PostColumn = "id"
	PostCreateAt      PostColumn = "create_at"
	PostUpdateAt      PostColumn = "update_at"
	PostEditAt        PostColumn = "edit_at"
	PostDeleteAt      PostColumn = "delete_at"
	PostIsPinned      PostColumn = "is_pinned"
	PostUserId        PostColumn = "user_id"
	PostChannelId     PostColumn = "channel_id"
	PostRootId        PostColumn = "root_id"
	PostOriginalId    PostColumn = "original_id"
	PostMessage       PostColumn = "message"
	PostMessageSource PostColumn = "message_source"
	PostType          PostColumn = "type"
	PostProps         PostColumn = "props"
	PostHashtags      PostColumn = "hashtags"
	PostFileIds       PostColumn = "file_ids"
	PostPendingPostId PostColumn = "pending_post_id"
	PostHasReactions  PostColumn = "has_reactions"
	PostRemoteId      PostColumn = "remote_id"
	PostReplyCount    PostColumn = "reply_count"
	PostLastReplyAt   PostColumn = "last_reply_at"
	PostParticipants  PostColumn = "participants"
	PostIsFollowing   PostColumn = "is_following"
	PostMetadata      PostColumn = "metadata"
)

func (c PostColumn) IsValid() bool {
	switch c {
	case PostId:
		return true
	case PostCreateAt:
		return true
	case PostUpdateAt:
		return true
	case PostEditAt:
		return true
	case PostDeleteAt:
		return true
	case PostIsPinned:
		return true
	case PostUserId:
		return true
	case PostChannelId:
		return true
	case PostRootId:
		return true
	case PostOriginalId:
		return true
	case PostMessage:
		return true
	case PostMessageSource:
		return true
	case PostType:
		return true
	case PostProps:
		return true
	case PostHashtags:
		return true
	case PostFileIds:
		return true
	case PostPendingPostId:
		return true
	case PostHasReactions:
		return true
	case PostRemoteId:
		return true
	case PostReplyCount:
		return true
	case PostLastReplyAt:
		return true
	case PostParticipants:
		return true
	case PostIsFollowing:
		return true
	case PostMetadata:
		return true
	default:
		return false
	}
}

type ThreadColumn string

const (
	ThreadPostId       ThreadColumn = "id"
	ThreadChannelId    ThreadColumn = "channel_id"
	ThreadReplyCount   ThreadColumn = "reply_count"
	ThreadLastReplyAt  ThreadColumn = "last_reply_at"
	ThreadParticipants ThreadColumn = "participants"
	ThreadDeleteAt     ThreadColumn = "delete_at"
	ThreadTeamId       ThreadColumn = "team_id"
)

func (c ThreadColumn) IsValid() bool {
	switch c {
	case ThreadPostId:
		return true
	case ThreadChannelId:
		return true
	case ThreadReplyCount:
		return true
	case ThreadLastReplyAt:
		return true
	case ThreadParticipants:
		return true
	case ThreadDeleteAt:
		return true
	case ThreadTeamId:
		return true
	default:
		return false
	}
}

type StatusColumn string

const (
	StatusUserId         StatusColumn = "user_id"
	StatusStatus         StatusColumn = "status"
	StatusManual         StatusColumn = "manual"
	StatusLastActivityAt StatusColumn = "last_activity_at"
	StatusActiveChannel  StatusColumn = "active_channel"
	StatusDNDEndTime     StatusColumn = "dnd_end_time"
)

func (c StatusColumn) IsValid() bool {
	switch c {
	case StatusUserId:
		return true
	case StatusStatus:
		return true
	case StatusManual:
		return true
	case StatusLastActivityAt:
		return true
	case StatusActiveChannel:
		return true
	case StatusDNDEndTime:
		return true
	default:
		return false
	}
}

type SessionColumn string

const (
	SessionId             SessionColumn = "id"
	SessionToken          SessionColumn = "token"
	SessionCreateAt       SessionColumn = "create_at"
	SessionExpiresAt      SessionColumn = "expires_at"
	SessionLastActivityAt SessionColumn = "last_activity_at"
	SessionUserId         SessionColumn = "user_id"
	SessionDeviceId       SessionColumn = "device_id"
	SessionRoles          SessionColumn = "roles"
	SessionIsOAuth        SessionColumn = "is_oauth"
	SessionExpiredNotify  SessionColumn = "expired_notify"
	SessionProps          SessionColumn = "props"
	SessionTeamMembers    SessionColumn = "team_members"
	SessionLocal          SessionColumn = "local"
)

func (c SessionColumn) IsValid() bool {
	switch c {
	case SessionId:
		return true
	case SessionToken:
		return true
	case SessionCreateAt:
		return true
	case SessionExpiresAt:
		return true
	case SessionLastActivityAt:
		return true
	case SessionUserId:
		return true
	case SessionDeviceId:
		return true
	case SessionRoles:
		return true
	case SessionIsOAuth:
		return true
	case SessionExpiredNotify:
		return true
	case SessionProps:
		return true
	case SessionTeamMembers:
		return true
	case SessionLocal:
		return true
	default:
		return false
	}
}

type RoleColumn string

const (
	RoleId            RoleColumn = "id"
	RoleName          RoleColumn = "name"
	RoleDisplayName   RoleColumn = "display_name"
	RoleDescription   RoleColumn = "description"
	RoleCreateAt      RoleColumn = "create_at"
	RoleUpdateAt      RoleColumn = "update_at"
	RoleDeleteAt      RoleColumn = "delete_at"
	RolePermissions   RoleColumn = "permissions"
	RoleSchemeManaged RoleColumn = "scheme_managed"
	RoleBuiltIn       RoleColumn = "built_in"
)

func (c RoleColumn) IsValid() bool {
	switch c {
	case RoleId:
		return true
	case RoleName:
		return true
	case RoleDisplayName:
		return true
	case RoleDescription:
		return true
	case RoleCreateAt:
		return true
	case RoleUpdateAt:
		return true
	case RoleDeleteAt:
		return true
	case RolePermissions:
		return true
	case RoleSchemeManaged:
		return true
	case RoleBuiltIn:
		return true
	default:
		return false
	}
}

type ReactionColumn string

const (
	ReactionUserId    ReactionColumn = "user_id"
	ReactionPostId    ReactionColumn = "post_id"
	ReactionEmojiName ReactionColumn = "emoji_name"
	ReactionCreateAt  ReactionColumn = "create_at"
	ReactionUpdateAt  ReactionColumn = "update_at"
	ReactionDeleteAt  ReactionColumn = "delete_at"
	ReactionRemoteId  ReactionColumn = "remote_id"
	ReactionChannelId ReactionColumn = "channel_id"
)

func (c ReactionColumn) IsValid() bool {
	switch c {
	case ReactionUserId:
		return true
	case ReactionPostId:
		return true
	case ReactionEmojiName:
		return true
	case ReactionCreateAt:
		return true
	case ReactionUpdateAt:
		return true
	case ReactionDeleteAt:
		return true
	case ReactionRemoteId:
		return true
	case ReactionChannelId:
		return true
	default:
		return false
	}
}

type JobColumn string

const (
	JobId             JobColumn = "id"
	JobType           JobColumn = "type"
	JobPriority       JobColumn = "priority"
	JobCreateAt       JobColumn = "create_at"
	JobStartAt        JobColumn = "start_at"
	JobLastActivityAt JobColumn = "last_activity_at"
	JobStatus         JobColumn = "status"
	JobProgress       JobColumn = "progress"
	JobData           JobColumn = "data"
)

func (c JobColumn) IsValid() bool {
	switch c {
	case JobId:
		return true
	case JobType:
		return true
	case JobPriority:
		return true
	case JobCreateAt:
		return true
	case JobStartAt:
		return true
	case JobLastActivityAt:
		return true
	case JobStatus:
		return true
	case JobProgress:
		return true
	case JobData:
		return true
	default:
		return false
	}
}

type ColumnValidator interface {
	IsValid() bool
}
