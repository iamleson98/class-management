import React from 'react';

import './page_body.scss';

type Props = {
    children: React.ReactNode | React.ReactNodeArray;
};

export default function PageBody(props: Props) {
    return (
        <div className='PreparingWorkspacePageBody'>
            {props.children}
        </div>
    );
}

