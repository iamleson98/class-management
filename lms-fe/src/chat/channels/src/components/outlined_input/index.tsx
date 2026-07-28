import {OutlinedInput as MUIOutlineInput} from '@mui/material';
import type {OutlinedInputProps} from '@mui/material';
import React from 'react';

/**
 * A horizontal separator for use in menus.
 * @example
 * <OutlineInput
 *   data-testid='my-input'
 *   size='small|medium
 *   value=10
 *   onChange={myChangeHandler}
 *   error=true
 *   disabled=false
 * />
 */

export function OutlinedInput(props: OutlinedInputProps) {
    return (
        <MUIOutlineInput
            {...props}
        />
    );
}
