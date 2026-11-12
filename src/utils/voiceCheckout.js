import { createRequestId } from './requestId.js';

const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.,!?。！？]/g, '');
export function isVoiceOrderConfirmation(text) {
    const value = clean(text);
    return /^(네|예|응|맞아|맞아요|맞습니다|좋아요|확인|확인했어요|확인했습니다|주문해|주문해줘|주문해주세요|주문할게요|접수해주세요|그대로주문해주세요|이대로주문해주세요|주문확정|확정해주세요|네주문해주세요|네접수해주세요|네맞아요|네그대로주문해주세요|네이대로주문해주세요|예주문해주세요)$/.test(value);
}
export function voiceCheckoutFingerprint(buyer, cart) {
    return JSON.stringify([buyer?.erpCustomerCode, buyer?.customerName,
        cart.map(i => [String(i.cartId), i.erpCode, i.name, i.selectedOption, i.quantity])]);
}

/** Requires a fresh human utterance after the review readback; a model tool call alone cannot submit. */
export class VoiceCheckoutConfirmation {
    constructor() { this.userTurn = 0; this.role = null; this.userText = ''; this.review = null; this.userFinished = true; this.modelText = ''; }
    transcript(role, text, finished = true) {
        if (!text && !(role === 'user' && finished)) return;
        if (role === 'user') {
            if (this.role !== 'user') { this.userTurn++; this.userText = ''; }
            this.userText = (this.userText + (text || '')).slice(-1000);
            this.userFinished = finished;
        }
        if (role === 'model') {
            if (this.role !== 'model') this.modelText = '';
            this.modelText += text || '';
        }
        this.role = role;
        if (role === 'model' && this.review) this.review.spoken = true;
    }
    assistantFinished() {
        if (this.review?.spoken && this.review.readyAfterTurn == null && /(주문|접수).*(까요|겠어요|겠습니까|실래요)/.test(clean(this.modelText))) this.review.readyAfterTurn = this.userTurn;
    }
    prepare(buyer, cart, now = Date.now()) {
        this.modelText = '';
        if (!buyer || !cart.length) throw new Error('상호 또는 비회원 선택과 상품 담기를 먼저 완료해 주세요.');
        this.review = { id: createRequestId(), fingerprint: voiceCheckoutFingerprint(buyer, cart),
            created: now, spoken: false, readyAfterTurn: null };
        return this.review.id;
    }
    confirm(reviewId, buyer, cart, now = Date.now()) {
        const review = this.review;
        if (!review || review.id !== reviewId || now - review.created > 120000
            || review.fingerprint !== voiceCheckoutFingerprint(buyer, cart)) {
            throw new Error('주문 내용이 바뀌었거나 확인 시간이 지났습니다. prepare_review로 다시 확인해 주세요.');
        }
        if (review.readyAfterTurn == null || this.userTurn <= review.readyAfterTurn || !this.userFinished || !isVoiceOrderConfirmation(this.userText)) {
            throw new Error('주문 내역을 읽은 뒤 손님에게 주문을 접수할지 물어보고 명확한 확답을 받아 주세요.');
        }
        this.review = null;
    }
    reset() { this.review = null; this.userText = ''; this.role = null; }
}
