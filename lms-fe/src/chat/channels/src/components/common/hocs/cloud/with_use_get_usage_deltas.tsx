import React from 'react';
import type {ComponentType} from 'react';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';

function withUseGetUsageDelta<T>(WrappedComponent: ComponentType<T>) {
    return (props: T) => {
        const usageDeltas = useGetUsageDeltas();

        return (
            <WrappedComponent
                usageDeltas={usageDeltas}
                {...props}
            />
        );
    };
}

export default withUseGetUsageDelta;
