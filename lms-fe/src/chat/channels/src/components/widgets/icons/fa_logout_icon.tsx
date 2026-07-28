import React from 'react';
import {useIntl} from 'react-intl';

export default function LogoutIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-1x fa-angle-left'
            title={formatMessage({id: 'generic_icons.logout', defaultMessage: 'Logout Icon'})}
        />
    );
}
