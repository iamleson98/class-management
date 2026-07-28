import React from 'react';
import type {ReactNode} from 'react';
import './separator.scss';

type Props = {
    children?: ReactNode;
};

const BasicSeparator = ({children}: Props) => {
    return (
        <div
            data-testid='basicSeparator'
            className='Separator BasicSeparator'
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

export default React.memo(BasicSeparator);
