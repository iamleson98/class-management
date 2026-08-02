

import React from 'react';
import {FormattedMessage} from 'react-intl';

interface Props {
    enabled: boolean,
}

const ChannelHeaderMenuButton = (props: Props) => {
    if (props.enabled) {
        return (
            <FormattedMessage defaultMessage='Disable calls'/>
        );
    }
    return (
        <FormattedMessage defaultMessage='Enable calls'/>
    );
};

export default ChannelHeaderMenuButton;
