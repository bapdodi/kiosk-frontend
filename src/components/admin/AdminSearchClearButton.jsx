const AdminSearchClearButton = ({ value, onClear }) => {
    if (!value) return null;

    return (
        <button
            type="button"
            className="admin-search-clear-btn"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
            aria-label="검색어 지우기"
            title="검색어 지우기"
        >
            ×
        </button>
    );
};

export default AdminSearchClearButton;
