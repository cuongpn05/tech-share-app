import {
  ActionConfirmModal,
  ActionConfirmModalProps,
  ActionResultModal,
  ActionResultModalProps,
  ActionResultType,
  FeedbackModalTone,
  FeedbackSummaryItem,
} from '../common/ActionFeedbackModals';

export type EkycModalSummaryItem = FeedbackSummaryItem;
export type EkycModalTone = FeedbackModalTone;
export type EkycResultType = ActionResultType;
export type EkycConfirmModalProps = ActionConfirmModalProps;
export type EkycResultModalProps = ActionResultModalProps;

export const EkycConfirmModal = ActionConfirmModal;
export const EkycResultModal = ActionResultModal;

export default {
  EkycConfirmModal,
  EkycResultModal,
};
