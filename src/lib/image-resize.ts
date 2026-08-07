/**
 * 업로드 전 이미지 2종 생성 — 브라우저 Canvas (SPEC 수정 이력 #2, sharp 도입 금지).
 *
 * Canvas에는 픽셀만 옮겨진다 — EXIF(촬영 GPS 포함)가 여기서 소멸한다.
 * 상세주소 비공개(RULE-11)가 사진 메타데이터로 새지 않게 하는 실제 장치가 이 파일이다.
 * 그래서 PNG도 투명도 보존 없이 전부 JPEG로 재인코딩한다(매물 사진에 투명도는 무의미).
 *
 * `imageOrientation: "from-image"`: 없으면 휴대폰 세로 사진이 EXIF 회전을 잃고 눕는다.
 */

const DETAIL_MAX_PX = 1600; // PC 상세 2단 폭 ~800px × 레티나 2배
const THUMB_MAX_PX = 480; // 목록 카드·마커 미리보기 ~200px × 2~3배
const DETAIL_JPEG_QUALITY = 0.85;
const THUMB_JPEG_QUALITY = 0.8;

export type PropertyImagePair = { detailBlob: Blob; thumbBlob: Blob };

/** 원본보다 크게 늘리지 않는다 — 작은 이미지를 키우면 흐려지기만 한다 */
function fitWithin(width: number, height: number, maxPx: number) {
  if (width <= maxPx && height <= maxPx) return { width, height };
  const ratio = Math.min(maxPx / width, maxPx / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function drawToJpeg(bitmap: ImageBitmap, maxPx: number, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxPx);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지를 처리할 수 없습니다. 다른 브라우저에서 시도해 주세요.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("이미지를 변환하지 못했습니다. 다시 시도해 주세요.");
  return blob;
}

/** 원본 한 장 → 상세·썸네일 JPEG 쌍 */
export async function createPropertyImagePair(file: File): Promise<PropertyImagePair> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return {
      detailBlob: await drawToJpeg(bitmap, DETAIL_MAX_PX, DETAIL_JPEG_QUALITY),
      thumbBlob: await drawToJpeg(bitmap, THUMB_MAX_PX, THUMB_JPEG_QUALITY),
    };
  } finally {
    bitmap.close();
  }
}
