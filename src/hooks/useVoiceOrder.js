import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { VoiceInputStatus } from '../utils/voiceInputStatus';
import { matchesCustomerSearch } from '../utils/search';
import { VoiceCheckoutConfirmation } from '../utils/voiceCheckout';
import { LiveOrderSession } from '../utils/liveOrderSession';
import { getOptionGroups } from '../utils/productOptions';
import { publicVoiceCart, resolveVoiceSelectionUpdate, resolveVoiceLine, searchVoiceProducts, validateVoiceQuantity, voiceOptions } from '../utils/voiceOrder';

/** A single call follows the existing kiosk screens; cart buttons only control its lifetime. */
export function useVoiceOrder({ enabled, products, cart, onAdd, onQuantity, onSearch, onProduct, onSelect, onReview, getScreen, customers, onStart, onCustomerSearch, onCustomer, getCheckout, onSubmit, ui }) {
    const input = useMemo(() => new VoiceInputStatus(), []);
    const [state, setState] = useState('idle');
    const [error, setError] = useState('');
    const [available, setAvailable] = useState(false);
    const session = useRef(null);
    const heardRole = useRef(null);
    const confirmation = useRef(new VoiceCheckoutConfirmation());
    const draftConfirmation = useRef(new VoiceCheckoutConfirmation('cart'));
    const draftAction = useRef(null);
    const latest = useRef(null);
    useEffect(() => { latest.current = { products, cart, onAdd, onQuantity, onSearch, onProduct, onSelect, onReview, getScreen, customers, onStart, onCustomerSearch, onCustomer, getCheckout, onSubmit, ui }; });
    useEffect(() => {
        const abort = new AbortController();
        fetch('/api/order-voice/status', { signal: abort.signal }).then(res => res.ok ? res.json() : null)
            .then(result => setAvailable(result?.available === true)).catch(() => {});
        return () => abort.abort();
    }, []);

    const stop = useCallback(() => {
        session.current?.close();
        session.current = null;
        confirmation.current.reset();
        draftConfirmation.current.reset();
        draftAction.current = null;
        input.reset();
        setState('idle');
    }, [input]);
    useEffect(() => {
        // Cleanup ends calls on idle/reset/completion, not on product/cart/review navigation.
        if (enabled) return () => {
            session.current?.close();
            session.current = null;
            setState('idle');
        };
    }, [enabled]);
    useEffect(() => {
        const hide = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', hide);
        return () => { document.removeEventListener('visibilitychange', hide); session.current?.close(); };
    }, [stop]);

    const tool = async (name, args) => {
        const current = latest.current;
        if (current.getCheckout().completedOrder && !['get_screen', 'get_cart', 'navigate_screen', 'end_call'].includes(name)) {
            return { submitted: true, ...current.getCheckout().completedOrder };
        }
        switch (name) {
            case 'navigate_screen':
                confirmation.current.reset();
                draftConfirmation.current.reset();
                draftAction.current = null;
                return { screen: current.ui.navigate(args.target, args.resetSearch === true), navigated: true, cartPreserved: true };
            case 'get_categories':
                return { categories: current.ui.categories() };
            case 'select_category':
                confirmation.current.reset();
                draftConfirmation.current.reset();
                draftAction.current = null;
                return current.ui.category(args.mainCategoryId, args.subCategoryId);
            case 'get_product_list': {
                const offset = args.offset ?? 0;
                if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('목록 위치를 다시 확인해 주세요.');
                const list = current.ui.listProducts();
                return { total: list.length, products: list.slice(offset, offset + 12).map((p, index) => ({ position: offset + index + 1, productId: String(p.id), name: p.name, specification: p.gyu })) };
            }
            case 'open_list_product': {
                const list = current.ui.listProducts();
                if (!Number.isInteger(args.position) || args.position < 1 || args.position > list.length) throw new Error('실제 상품 목록의 번호를 선택해 주세요.');
                const product = list[args.position - 1];
                current.onProduct(product);
                return { productId: String(product.id), name: product.name, opened: true };
            }
            case 'update_product_selection':
            case 'add_current_selection': {
                const screen = current.getScreen();
                const id = args.productId ?? screen.selectedProduct?.productId;
                const product = current.products.find(p => String(p.id) === id && !p.deletedAt);
                if (!product) throw new Error('먼저 상품을 열어 주세요.');
                const selected = resolveVoiceSelectionUpdate(product, screen.selectedProduct, args);
                if (name === 'update_product_selection') {
                    current.ui.selection(product, selected);
                    return { selected: true, added: false, ...selected };
                }
                if (!selected.optionId) throw new Error('선택하지 않은 규격을 먼저 확인해 주세요.');
                const { option } = resolveVoiceLine(current.products, String(product.id), selected.optionId, selected.quantity);
                current.cart = current.onAdd(product, [option.line], { [option.line.id]: selected.quantity });
                return { added: true, cart: publicVoiceCart(current.cart) };
            }
            case 'show_product_image':
                return current.ui.image(args.action, args.index);
            case 'scroll_screen':
                return current.ui.scroll(args.direction, args.area || 'screen');
            case 'prepare_clear_cart': {
                const action = args.action || 'clear_cart';
                if (!['clear_cart', 'reset_order'].includes(action)) throw new Error('비울 내용을 다시 말씀해 주세요.');
                const checkout = current.getCheckout();
                confirmation.current.reset();
                if (!checkout.cart.length) {
                    current.ui.clear(action);
                    return { cleared: true, cart: [], instruction: '장바구니가 이미 비어 있어 요청한 화면으로 이동했습니다.' };
                }
                const confirmationId = draftConfirmation.current.prepare(checkout.buyer, checkout.cart);
                draftAction.current = action;
                return { confirmationId, action, cart: publicVoiceCart(checkout.cart), cleared: false,
                    instruction: action === 'reset_order' ? '장바구니와 상호 선택을 초기화하고 새로 시작할까요?라고 묻고 새 확답을 받으세요.' : '장바구니를 모두 비울까요?라고 묻고 새 확답을 받으세요.' };
            }
            case 'confirm_clear_cart': {
                const checkout = current.getCheckout();
                draftConfirmation.current.confirm(args.confirmationId, checkout.buyer, checkout.cart);
                const action = draftAction.current;
                draftAction.current = null;
                current.ui.clear(action);
                current.cart = [];
                confirmation.current.reset();
                return { cleared: true, action, cart: [] };
            }
            case 'end_call':
                return { endCall: true, instruction: '통화를 마친다고 짧게 안내하세요. 주문 내역은 그대로 유지됩니다.' };

            case 'search_customers': {
                if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 80) throw new Error('상호명을 짧게 말씀해 주세요.');
                current.onCustomerSearch(args.query);
                return { customers: current.customers.filter(c => String(c.CODE) !== '1196' && matchesCustomerSearch(c.NAME || '', args.query))
                    .slice(0, 10).map(c => ({ customerCode: String(c.CODE), name: c.NAME })) };
            }
            case 'select_customer': {
                const customer = current.customers.find(c => String(c.CODE) === args.customerCode);
                if (!customer) throw new Error('실제 등록된 상호를 검색해서 선택해 주세요. 비회원은 1196입니다.');
                current.onCustomer(customer);
                confirmation.current.reset();
                draftConfirmation.current.reset();
                draftAction.current = null;
                return { selected: true, name: customer.NAME, guest: String(customer.CODE) === '1196' };
            }
            case 'search_products': {
                if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 100) {
                    throw new Error('검색할 상품명을 짧게 말씀해 주세요.');
                }
                const found = searchVoiceProducts(current.products, args.query);
                current.onSearch(args.query, found);
                return { products: found.map((p, index) => ({ position: index + 1, productId: String(p.id), name: p.name, specification: p.gyu })) };
            }
            case 'get_product_options': {
                const product = current.products.find(p => String(p.id) === args.productId && !p.deletedAt);
                if (!product) throw new Error('상품을 다시 검색해 주세요.');
                current.onProduct(product);
                return { productId: String(product.id), name: product.name,
                    groups: getOptionGroups(product).map(g => ({ name: g.name, label: g.displayLabel, values: g.values.map(value => ({ value, label: g.valueLabels?.[value] || value })) })),
                    options: voiceOptions(product).map(o => ({ optionId: o.optionId, label: o.label })) };
            }
            case 'select_product_option': {
                const { product, option } = resolveVoiceLine(current.products, args.productId, args.optionId, args.quantity);
                current.onSelect(product, option, args.quantity);
                return { selected: true, added: false, name: product.name, option: option.label, quantity: args.quantity };
            }
            case 'add_to_cart': {
                const { product, option } = resolveVoiceLine(current.products, args.productId, args.optionId, args.quantity);
                current.onSelect(product, option, args.quantity);
                const next = current.onAdd(product, [option.line], { [option.line.id]: args.quantity });
                current.cart = next;
                return { added: true, cart: publicVoiceCart(next) };
            }
            case 'get_screen':
                return { ...current.getScreen(), cart: publicVoiceCart(current.cart) };
            case 'get_cart':
                return { cart: publicVoiceCart(current.cart) };
            case 'set_cart_quantity': {
                validateVoiceQuantity(args.quantity, true);
                const item = current.cart.find(i => String(i.cartId) === args.cartId);
                if (!item) throw new Error('장바구니를 다시 확인해 주세요.');
                current.onQuantity(item.cartId, args.quantity);
                current.cart = args.quantity === 0 ? current.cart.filter(i => i !== item)
                    : current.cart.map(i => i === item ? { ...i, quantity: args.quantity } : i);
                return { updated: true, cart: publicVoiceCart(current.cart) };
            }
            case 'prepare_review': {
                draftConfirmation.current.reset();
                draftAction.current = null;
                const checkout = current.getCheckout();
                const reviewId = confirmation.current.prepare(checkout.buyer, checkout.cart);
                current.onReview();
                return { reviewId, buyer: checkout.buyer.customerName, cart: publicVoiceCart(checkout.cart), submitted: false,
                    instruction: '상호, 상품명, 규격, 수량을 모두 음성으로 읽고 주문 접수할까요?라고 물으세요. 이후 손님의 새롭고 명확한 확답이 있어야 confirm_order를 호출할 수 있습니다.' };
            }
            case 'confirm_order': {
                const checkout = current.getCheckout();
                confirmation.current.confirm(args.reviewId, checkout.buyer, checkout.cart);
                const result = await current.onSubmit(checkout.buyer, { silent: true });
                if (!result.submitted) throw new Error(result.error || '주문을 접수하지 못했습니다. 내역을 다시 확인한 뒤 재시도해 주세요.');
                return { ...result, instruction: '서버에서 주문이 접수됐습니다. 주문번호를 음성으로 안내하고 통화를 마무리하세요.' };
            }
            default: throw new Error('지원하지 않는 기능입니다.');
        }
    };
    const toggle = () => {
        if (session.current) { stop(); return; }
        if (!enabled || !available) return;
        setError('');
        input.reset();
        confirmation.current.reset();
        draftConfirmation.current.reset();
        draftAction.current = null;
        latest.current.onStart();
        const call = new LiveOrderSession({
            onState: setState, onError: message => { setError(message); session.current = null; },
            onTool: tool,
            onInputStatus: input.update,
            onTranscript: (role, text, finished) => {
                draftConfirmation.current.transcript(role, text, finished);
                confirmation.current.transcript(role, text, finished);
                if (role === 'user' && text) input.update({ heard: ((heardRole.current === 'user' ? input.getSnapshot().heard : '') + text).slice(-160), warning: '' });
                heardRole.current = role;
            },
            onTurnComplete: () => { confirmation.current.assistantFinished(); draftConfirmation.current.assistantFinished(); },
            onFinish: () => { session.current = null; confirmation.current.reset(); },
        });
        session.current = call;
        call.start();
    };
    const complete = result => { confirmation.current.reset(); session.current?.completeOrder(result); };
    const selectMicrophone = deviceId => session.current?.switchMicrophone(deviceId);
    const finishUtterance = () => session.current?.finishUtterance();
    return { input, selectMicrophone, finishUtterance, complete, available: available && enabled, state: enabled ? state : 'idle', error, toggle, stop };
}
