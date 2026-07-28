import React from 'react';

type Props = {
    name: string;
    dangerous?: boolean;
};

export function ActionsMenuIcon({name, dangerous}: Props) {
    const colorClass = dangerous ? 'MenuItem__compass-icon-dangerous' : 'MenuItem__compass-icon';
    return (
        <span
            className={`${name} ${colorClass}`}
            aria-hidden={true}
        />
    );
}
