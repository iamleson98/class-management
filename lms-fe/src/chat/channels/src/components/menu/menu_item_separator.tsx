import {Divider} from '@mui/material';
import type {DividerProps} from '@mui/material';
import type {ElementType} from 'react';
import React from 'react';

/**
 * A horizontal separator for use in menus.
 * @example
 * <Menu.Container>
 *   <Menu.Item>
 *   <Menu.Separator />
 * </Menu.Container>
 */
export function MenuItemSeparator(props: DividerProps & {component?: ElementType}) {
    return (
        <Divider
            aria-orientation='vertical'
            {...props}
        />
    );
}
