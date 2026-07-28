import type {Channel} from '@mattermost/types/channels';

import {fetchMissingChannels} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useChannel = makeUseEntity<Channel>({
    name: 'useChannel',
    fetch: (channelId: string) => fetchMissingChannels([channelId]),
    selector: getChannel,
});
