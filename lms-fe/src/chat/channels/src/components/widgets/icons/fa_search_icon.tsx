import React from 'react';
import {useIntl} from 'react-intl';

export default function SearchIcon() {
    const {formatMessage} = useIntl();

    return (
        <i
            className='fa fa-search'
            title={formatMessage({id: 'generic_icons.search', defaultMessage: 'Search Icon'})}
        />
    );
}
