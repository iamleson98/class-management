import type {ActionResult} from 'mattermost-redux/types/actions';

export type SuccessResult = {data: any};

export type ErrorResult = {error: any};

export function isSuccess(result: ActionResult): result is SuccessResult {
    return 'data' in result && !isError(result);
}

export function isError(result: ActionResult): result is ErrorResult {
    return Boolean((result as ErrorResult).error);
}

export type ModalData<ModalProps> = {
    modalId: string;
    dialogProps?: Omit<ModalProps, 'onHide' | 'onExited'> & {onHide?: () => void; onExited?: () => void};
    dialogType: React.ElementType<ModalProps>;
};
