import {jest} from '@jest/globals';

const monacoMock: {
    editor: {
        create: jest.Mock;
        defineTheme: jest.Mock;
        setTheme: jest.Mock;
    };
    languages: {
        registerCompletionItemProvider: jest.Mock;
    };
} = {
    editor: {
        create: jest.fn(),
        defineTheme: jest.fn(),
        setTheme: jest.fn(),
    },
    languages: {
        registerCompletionItemProvider: jest.fn(),
    },
};

export default monacoMock;
