/**
 * 구매자(상호) 표시명 해석.
 * ERP 코드 1 또는 이름이 '1'인 경우 비회원(일반 손님)으로 표시한다.
 */
export const getBuyerDisplayName = (buyer) => {
    if (!buyer) return '';
    const name = typeof buyer === 'string' ? buyer : buyer.customerName;
    const code = buyer && typeof buyer === 'object' ? buyer.erpCustomerCode : undefined;
    if (name === '1' || code === '1') {
        return '비회원';
    }
    return name || '';
};
