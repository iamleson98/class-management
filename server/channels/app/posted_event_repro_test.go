package app

// Temporary reproduction test for: "other users don't see new messages in
// real-time; only after reload". Verifies the server broadcasts the `posted`
// WebSocket event to a *different* channel member when a post is created via
// the same app-level path the API handler uses.

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestPostedEventReachesOtherChannelMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Two members of the basic (public) channel: BasicUser (sender) and
	// BasicUser2 (receiver). InitBasic only adds the channel creator, so
	// explicitly add the receiver too.
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)
	sender := th.BasicUser
	receiver := th.BasicUser2

	// Receiver holds an active WS connection (with postedAck=true, exactly
	// like the lms-fe client initializes it).
	messages, closeWS := connectFakeWebSocket(t, th, receiver.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted})
	defer closeWS()

	// Sender posts a regular message through the full CreatePost path.
	post, _, appErr2 := th.App.CreatePostMissingChannel(th.Context, &model.Post{
		UserId:    sender.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "hello from sender",
	}, true, true)
	require.Nil(t, appErr2)
	require.NotNil(t, post)

	// The receiver's connection must get the posted event.
	select {
	case received := <-messages:
		require.Equal(t, model.WebsocketEventPosted, received.EventType())
		assert.Equal(t, th.BasicChannel.Id, received.GetBroadcast().ChannelId)
		data := received.GetData()
		t.Logf("received posted event data keys: %v", data)
		postJSON, _ := data["post"].(string)
		assert.NotEmpty(t, postJSON, "posted event must carry the JSON post")
		t.Logf("SUCCESS: posted event delivered to other member")
	case <-time.After(5 * time.Second):
		t.Fatal("FAIL: receiver did not receive the posted event within 5s — server is not broadcasting it")
	}
}

func TestPostedEventReachesOtherMemberInPrivateChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Private channel (like the LMS class channel: type P), both users members.
	privateChannel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		Name:        "lms-class-" + model.NewId(),
		DisplayName: "LMS Class Channel",
		Type:        model.ChannelTypePrivate,
	}, false)
	require.Nil(t, appErr)

	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, privateChannel, false)
	require.Nil(t, appErr)

	messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventPosted})
	defer closeWS()

	_, _, appErr = th.App.CreatePostMissingChannel(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: privateChannel.Id,
		Message:   "private channel post",
	}, true, true)
	require.Nil(t, appErr)

	select {
	case received := <-messages:
		require.Equal(t, model.WebsocketEventPosted, received.EventType())
		assert.Equal(t, privateChannel.Id, received.GetBroadcast().ChannelId)
		t.Logf("SUCCESS: posted event delivered in private channel")
	case <-time.After(5 * time.Second):
		t.Fatal("FAIL: receiver did not receive the posted event in private channel")
	}
}

func TestTypingEventReachesOtherChannelMember(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// InitBasic only adds the channel creator; add the receiver so the hub's
	// channel-member gating delivers to them (matches a real two-user room).
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventTyping})
	defer closeWS()

	// The same call the server's webconn read pump makes when a client sends
	// a user_typing action.
	appErr = th.App.PublishUserTyping(th.BasicUser.Id, th.BasicChannel.Id, "")
	require.Nil(t, appErr)

	select {
	case received := <-messages:
		require.Equal(t, model.WebsocketEventTyping, received.EventType())
		t.Logf("SUCCESS: typing event delivered (sanity baseline)")
	case <-time.After(5 * time.Second):
		t.Fatal("FAIL: receiver did not receive the typing event either (hub issue)")
	}
}
