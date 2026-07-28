import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertBanner from 'components/alert_banner';

export default function ScheduledPostError() {
    return (
        <AlertBanner
            mode='danger'
            className='scheduledPostListErrorIndicator'
            message={
                <FormattedMessage
                    id='scheduled_post.panel.error_indicator.message'
                    defaultMessage='One of your scheduled drafts cannot be sent.'
                />
            }
        />
    );
}
