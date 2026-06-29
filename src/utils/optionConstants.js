// ERP 조합(combinations) 기반 상품의 옵션별 사진을 매칭할 때 사용하는 고정 그룹명.
// 옵션 그룹(optionGroups)이 없는 상품은 이 sentinel 그룹명 + 조합 이름으로 사진을 저장/조회한다.
// ProductForm(등록) 과 OptionModal(키오스크) 가 반드시 같은 값을 써야 매칭된다.
export const COMBINATION_GROUP = '__combination__';
