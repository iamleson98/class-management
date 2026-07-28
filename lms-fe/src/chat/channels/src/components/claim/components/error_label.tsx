import React, {memo} from 'react';

type ErrorLabelProps = {
    errorText?: string | JSX.Element;
};

const ErrorLabel = ({errorText}: ErrorLabelProps) => (errorText ? (
    <div className='form-group has-error'>
        <label className='control-label'>{errorText}</label>
    </div>
) : null);

export default memo(ErrorLabel);
