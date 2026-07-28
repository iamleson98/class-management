import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';

import type {ThunkActionFunc} from 'types/store';

export function getMembershipForEntities(teamId: string, userId: string, channelId?: string): ThunkActionFunc<unknown> {
    return (dispatch) => {
        return Promise.all([
            dispatch(getTeamMember(teamId, userId)),
            channelId && dispatch(getChannelMember(channelId, userId)),
        ]);
    };
}
