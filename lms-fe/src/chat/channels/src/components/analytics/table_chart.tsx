import React, {memo} from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

export type TableItem = {
    name: string;
    tip: string;
    value: React.ReactNode;
};
type Props = {
    title: React.ReactNode;
    data: TableItem[];
};

const TableChart = ({
    title,
    data,
}: Props) => (
    <div className='col-sm-6'>
        <div className='total-count recent-active-users'>
            <div className='title'>
                {title}
            </div>
            <div className='content'>
                <table>
                    <tbody>
                        {
                            data.map((item) => (
                                <tr key={'table-entry-' + item.name}>
                                    <td>
                                        <WithTooltip
                                            title={item.tip}
                                        >
                                            <span>{item.name}</span>
                                        </WithTooltip>
                                    </td>
                                    <td>{item.value}</td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default memo(TableChart);
