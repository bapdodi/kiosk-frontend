import { createRequestId } from './requestId.js';

const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.,!?。！？]/g, '');

export function isVoiceOrderConfirmation(text) {
    const value = clean(text);
    if (!value || value.length < 1) return false;

    // 부정, 취소, 수정, 보류 의사가 포함되어 있으면 절대 확답이 아님
    if (/(아니|취소|잠깐|잠시|빼|수정|바꿔|변경|다른|보류|다시|아직|글쎄|마세요|마요|하지마|말아|안돼|안해|안할)/.test(value)) {
        return false;
    }

    // 1) 순수 긍정 / 확인 / 이상없음 표현 (예: 네, 맞아, 맞아요, 네 맞아요, 네 확인했습니다, 확인했어요, 됐습니다 등)
    const exactAffirmative = /^(네|예|응|어)(맞아|맞아요|맞습니다|맞구요|맞아맞아|좋아|좋아요|확인|확인했어|확인했어요|확인했습니다|됐어|됐어요|됐습니다|이상없어|이상없어요|이상없습니다)?$|^(맞아|맞아요|맞습니다|맞구요|맞아맞아|좋아|좋아요|확인|확인했어|확인했어요|확인했습니다|됐어|됐어요|됐습니다|이상없어|이상없어요|이상없습니다)$/;
    if (exactAffirmative.test(value)) return true;

    // 2) 주문 / 접수 / 진행 / 확정 동작을 요구하는 복합 표현
    //    예: "네 맞아요 주문해주세요", "네 주문해주세요", "이대로 접수해주세요", "주문할게요", "진행해주세요"
    const actionPattern = /^(네|예|응|어|맞아|맞아요|맞습니다|좋아|좋아요|확인했어|확인했어요|확인했습니다)?(그대로|이대로|그렇게|바로|얼른)?(주문|접수|진행|확정)(해|해줘|해줘요|해주세요|해줄래|해줄래요|할게|할게요|할래|할래요|드려요|드립니다|부탁해|부탁해요|부탁드립니다)$/;
    if (actionPattern.test(value)) return true;

    // 3) 대답 후 지시 (예: "네 그렇게 해주세요", "그렇게 해줘", "이대로 해주세요", "네 부탁드립니다")
    const requestPattern = /^(네|예|응|어|맞아|맞아요|맞습니다|좋아|좋아요)?(그대로|이대로|그렇게|바로)(해|해줘|해줘요|해주세요|할게|할게요|부탁해|부탁해요|부탁드립니다)$/;
    if (requestPattern.test(value)) return true;

    // 4) 부탁 표현 (예: "네 부탁드립니다", "잘 부탁드려요")
    const politePattern = /^(네|예|응)?(잘)?(부탁해|부탁해요|부탁드립니다)$/;
    if (politePattern.test(value)) return true;

    // 5) 긍정 + 맞아요 조합 (예: "네 맞아요", "응 맞아", "네 맞습니다")
    const generalConfirm = /^(네|예|응|어)?(맞아|맞아요|맞습니다)(주문|접수|진행)?(해|해줘|해주세요|할게|할게요)?$/;
    if (generalConfirm.test(value)) return true;

    return false;
}

export function voiceCheckoutFingerprint(buyer, cart) {
    return JSON.stringify([buyer?.erpCustomerCode, buyer?.customerName,
        cart.map(i => [String(i.cartId), i.erpCode, i.name, i.selectedOption, i.quantity])]);
}

/** Requires a fresh human utterance after the review readback; a model tool call alone cannot submit. */
export class VoiceCheckoutConfirmation {
    constructor(kind = 'order') {
        this.kind = kind;
        this.userTurn = 0;
        this.prepareTurn = 0;
        this.role = null;
        this.userText = '';
        this.review = null;
        this.userFinished = true;
        this.modelText = '';
    }

    transcript(role, text, finished = true) {
        if (!text && !(role === 'user' && finished)) return;
        if (role === 'user') {
            if (this.role !== 'user') {
                this.userTurn++;
                this.userText = '';
            }
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
        if (this.review?.spoken && this.review.readyAfterTurn == null) {
            const cleaned = clean(this.modelText);
            const matches = this.kind === 'order'
                ? /(주문|접수|진행|완료|확인).*(까요|겠어요|겠습니까|실래요|실까요|되셨나요|맞으신가요|맞나요|어떠세요)/.test(cleaned)
                : /(장바구니|새로|주문|상품).*(비울|지울|삭제|초기화|다시|새로).*(까요|겠어요|겠습니까|실래요|실까요)/.test(cleaned);
            if (matches) this.review.readyAfterTurn = this.userTurn;
        }
    }

    prepare(buyer, cart, now = Date.now()) {
        this.modelText = '';
        this.userText = '';
        this.prepareTurn = this.userTurn;
        if ((this.kind === 'order' && !buyer) || !cart.length) {
            throw new Error('상호 또는 비회원 선택과 상품 담기를 먼저 완료해 주세요.');
        }
        this.review = {
            id: createRequestId(),
            fingerprint: voiceCheckoutFingerprint(buyer, cart),
            created: now,
            spoken: false,
            readyAfterTurn: null,
        };
        return this.review.id;
    }

    confirm(reviewId, buyer, cart, now = Date.now()) {
        const review = this.review;
        if (!review || review.id !== reviewId || now - review.created > 120000
            || review.fingerprint !== voiceCheckoutFingerprint(buyer, cart)) {
            throw new Error('주문 내용이 바뀌었거나 확인 시간이 지났습니다. prepare_review로 다시 확인해 주세요.');
        }

        // review가 발화되기 전의 발화나 prepare 이전의 발화는 거부
        const spokenAfterPrepare = this.userTurn > this.prepareTurn;
        const validConfirmation = this.kind === 'order'
            ? isVoiceOrderConfirmation(this.userText)
            : /^(네|예|응|비워줘|비워주세요|네비워주세요|전부비워주세요|삭제해주세요|지워주세요|다시시작해주세요|네다시시작해주세요|새로시작해주세요|네비워|네지워|네삭제)$/.test(clean(this.userText));

        if (!review.spoken || review.readyAfterTurn == null || !spokenAfterPrepare
            || !this.userFinished || !validConfirmation) {
            throw new Error(this.kind === 'order'
                ? '주문 내역을 읽은 뒤 손님에게 주문을 접수할지 물어보고 명확한 확답을 받아 주세요.'
                : '장바구니를 비울지 물어보고 손님의 새로운 확답을 받아 주세요.');
        }
        this.review = null;
    }

    reset() {
        this.review = null;
        this.userText = '';
        this.role = null;
    }
}
