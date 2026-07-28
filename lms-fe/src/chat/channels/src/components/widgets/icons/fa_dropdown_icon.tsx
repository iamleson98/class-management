import React from 'react';
import {useIntl} from 'react-intl';

export default function DropdownIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-angle-down'
            title={formatMessage({id: 'generic_icons.dropdown', defaultMessage: 'Dropdown Icon'})}
        />
    );
}
