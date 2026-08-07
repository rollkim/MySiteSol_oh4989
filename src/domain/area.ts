/**
 * 면적 표기. exclusiveArea/supplyArea는 numeric 컬럼이라 drizzle에서 **string**으로 온다.
 * 전용면적(㎡)은 법정 필수, 평 병기는 40~60대 주 사용자층의 관례 단위 대응.
 */

const PYEONG_PER_SQM = 3.3058;

export function formatArea(sqmString: string): string {
  const sqm = Number(sqmString);
  if (!Number.isFinite(sqm) || sqm < 0) {
    throw new Error(`면적 값이 아닙니다: ${sqmString}`);
  }
  const pyeong = sqm / PYEONG_PER_SQM;
  // 84.9 → "84.9", 33.0 → "33" (트레일링 .0 제거)
  const sqmText = String(Number(sqm.toFixed(1)));
  const pyeongText = String(Number(pyeong.toFixed(1)));
  return `${sqmText}㎡ (${pyeongText}평)`;
}
