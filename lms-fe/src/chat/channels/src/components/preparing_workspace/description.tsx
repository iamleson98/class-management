import React from 'react';

import './description.scss';

type Props = {
    children: React.ReactNode | React.ReactNodeArray;
};

const Description = (props: Props) => {
    return (<p className='PreparingWorkspaceDescription'>
        {props.children}
    </p>);
};

export default Description;
