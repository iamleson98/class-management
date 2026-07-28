import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Audit} from '@mattermost/types/audits';
import type {Channel} from '@mattermost/types/channels';

import {getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from 'types/store';

import AuditRow from '../audit_row/audit_row';
import holders from '../holders';

type Props = {
    audit: Audit;
    actionURL: string;
    showUserId: boolean;
    showIp: boolean;
    showSession: boolean;
    channelObj?: Channel | null;
};

export default function ChannelCreateDirectRow({
    audit,
    actionURL,
    showUserId,
    showIp,
    showSession,
    channelObj,
}: Props) {
    const intl = useIntl();

    const channelId = channelObj?.id ?? '';

    const desc = intl.formatMessage(holders.establishedDM, {
        username: useSelector((state: GlobalState) =>
            getDirectTeammate(state, channelId),
        )?.username,
    });
    return (
        <AuditRow
            audit={audit}
            actionURL={actionURL}
            desc={desc}
            showUserId={showUserId}
            showIp={showIp}
            showSession={showSession}
        />
    );
}
