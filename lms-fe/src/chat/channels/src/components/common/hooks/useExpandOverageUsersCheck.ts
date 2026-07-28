import {defineMessage} from 'react-intl';

const cta = defineMessage({
    id: 'licensingPage.overageUsersBanner.cta',
    defaultMessage: 'Contact Sales',
});

export const useExpandOverageUsersCheck = () => {
    return {
        cta,
    };
};
