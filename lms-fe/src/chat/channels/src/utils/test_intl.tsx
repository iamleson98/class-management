import type {ReactNode} from 'react';
import React from 'react';
import {IntlProvider, createIntl} from 'react-intl';

export const defaultIntl = createIntl({
    locale: 'en',
    defaultLocale: 'en',
    messages: {},
});

export const wrapIntl = (children?: ReactNode) => <IntlProvider {...defaultIntl}>{children}</IntlProvider>;
