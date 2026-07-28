import React from 'react';
import {useIntl} from 'react-intl';

export default function EditIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='icon-pencil-outline'
            aria-hidden='true'
            title={formatMessage({id: 'generic_icons.edit', defaultMessage: 'Edit Icon'})}
        />
    );
}

