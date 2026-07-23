package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/iamleson98/sitename/server/public/model"
)

func TestMeProviderDoCommand(t *testing.T) {
	th := setup(t)

	mp := MeProvider{}

	msg := "hello"

	resp := mp.DoCommand(th.App, th.Context, &model.CommandArgs{}, msg)

	assert.Equal(t, model.CommandResponseTypeInChannel, resp.ResponseType)
	assert.Equal(t, model.PostTypeMe, resp.Type)
	assert.Equal(t, "*"+msg+"*", resp.Text)
}
