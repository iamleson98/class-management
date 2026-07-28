import React from 'react';

jest.mock('@tippyjs/react', () => ({
    __esModule: true,
    default: () => (<div id='tippyMock'/>),
}));
