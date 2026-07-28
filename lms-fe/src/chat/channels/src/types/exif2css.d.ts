declare module 'exif2css' {
    interface CSS {
        transform: string;
        'transform-origin': string;
    }
    export default function exif2css(orientation: number): CSS;
}
