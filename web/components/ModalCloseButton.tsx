type Props = {
  onClick: () => void;
};

export function ModalCloseButton({ onClick }: Props) {
  return (
    <button type="button" className="modal-close" onClick={onClick} aria-label="閉じる">
      <span aria-hidden="true">×</span>
    </button>
  );
}
