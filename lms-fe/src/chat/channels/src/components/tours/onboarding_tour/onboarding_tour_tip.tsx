import React from 'react';

import {ChannelsTourTip, TutorialTourName} from 'components/tours';
import type {ChannelsTourTipProps} from 'components/tours';

const OnboardingTourTip = (props: Omit<ChannelsTourTipProps, 'tourCategory'>) => {
    return (
        <ChannelsTourTip
            {...props}
            tourCategory={TutorialTourName.ONBOARDING_TUTORIAL_STEP}
        />
    );
};

export default OnboardingTourTip;
