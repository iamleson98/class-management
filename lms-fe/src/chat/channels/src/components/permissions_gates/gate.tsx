import React from 'react';

type Props = {
    hasPermission: boolean;
    invert?: boolean;
    children: React.ReactNode;
};

const Gate = ({
    hasPermission,
    invert,
    children,
}: Props) => {
    if (hasPermission !== invert) {
        return <>{children}</>;
    }
    return null;
};

export default Gate;
