// RegExp.escape is a new function in ES2025 which isn't defined in TypeScript yet. This should be removed when
// we upgrade to TS 6.0.
interface RegExpConstructor {
    escape(str: string): string;
}

