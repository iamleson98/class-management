import React from 'react';
import {useIntl} from 'react-intl';

export default function AddIcon() {
    const {formatMessage} = useIntl();
    return (
        <i
            className='fa fa-plus'
            title={formatMessage({id: 'generic_icons.add', defaultMessage: 'Add Icon'})}
        />
    );
}
