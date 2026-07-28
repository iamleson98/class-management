import React from 'react';
import './separator.scss';
import './notification-separator.scss';

type Props = {
    children?: React.ReactNode;
};

const NotificationSeparator = ({children}: Props) => {
    return (
        <div
            className='Separator NotificationSeparator'
            data-testid='NotificationSeparator'
        >
            <hr className='separator__hr'/>
            {children && (
                <div className='separator__text'>
                    {children}
                </div>
            )}
        </div>
    );
};

export default React.memo(NotificationSeparator);

