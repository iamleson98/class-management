import React, {useCallback} from 'react';

type Props = {
    name: string;
    checked: boolean;
    label: string | JSX.Element;
    updateOption: (checked: boolean, name: string) => void;
};

function FilterCheckbox({
    name,
    checked,
    label,
    updateOption,
}: Props) {
    const toggleOption = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        updateOption(!checked, name);
    }, [name, checked, updateOption]);

    return (
        <div
            className='FilterList_checkbox'
            onClick={toggleOption}
        >
            <label>
                {checked &&
                    <input
                        type='checkbox'
                        id={name}
                        name={name}
                        defaultChecked={true}
                    />
                }

                {!checked &&
                    <input
                        type='checkbox'
                        id={name}
                        name={name}
                        defaultChecked={false}
                    />
                }
                {label}
            </label>
        </div>
    );
}

export default React.memo(FilterCheckbox);
