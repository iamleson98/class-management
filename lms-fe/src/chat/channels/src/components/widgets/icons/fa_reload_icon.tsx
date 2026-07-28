import React from 'react';
import {useIntl} from 'react-intl';

export default function ReloadIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-refresh'
            title={formatMessage({id: 'generic_icons.reload', defaultMessage: 'Reload Icon'})}
        />
    );
}

