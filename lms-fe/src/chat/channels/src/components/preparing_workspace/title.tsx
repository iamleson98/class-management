import React from 'react';

import './title.scss';

type Props = {
    children: React.ReactNode | React.ReactNodeArray;
};
const Title = (props: Props) => {
    return (<h1 className='PreparingWorkspaceTitle'>
        {props.children}
    </h1>);
};

export default Title;
