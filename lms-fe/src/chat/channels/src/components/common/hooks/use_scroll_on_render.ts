import React from 'react';

// useScrollOnRender hook is used to scroll to the element when it is rendered
// Attach the returned ref to the element you want to scroll to.
export function useScrollOnRender() {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (ref.current) {
            ref.current.scrollIntoView({behavior: 'smooth'});
        }
    }, []);

    return ref;
}
