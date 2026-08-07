import { NextResponse } from "next/server";

import { readAdminSessionUserId } from "@/server/auth/admin-session";
import {
  ImageTooLargeError,
  MAX_IMAGE_BYTES,
  storePropertyImagePair,
  UnsupportedImageTypeError,
} from "@/server/services/image-storage.service";

/**
 * 매물 사진 업로드 — multipart라 tRPC(JSON 직렬화 전제)가 아니라 라우트 핸들러다.
 * adminProcedure가 하던 방어(세션 판독)를 여기서 직접 한다. DB 재확인은 하지 않는다
 * — adminProcedure와 같은 수준으로 맞춘다(컨텍스트 주석 참조).
 *
 * FormData 규약: detail[i]와 thumb[i]가 한 장의 사진이다. 클라(ImageUploader)가
 * Canvas로 2종을 만들어 쌍으로 보낸다. 경로만 돌려주고 property_images 연결은
 * 매물 저장 때 한 번에 한다.
 */

const MAX_PAIRS_PER_REQUEST = 10;

export async function POST(request: Request) {
  const adminUserId = await readAdminSessionUserId(request.headers.get("cookie"));
  if (adminUserId === null) {
    return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "업로드 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const detailFiles = formData.getAll("detail").filter((entry): entry is File => entry instanceof File);
  const thumbFiles = formData.getAll("thumb").filter((entry): entry is File => entry instanceof File);

  if (detailFiles.length === 0 || detailFiles.length !== thumbFiles.length) {
    return NextResponse.json(
      { message: "상세·썸네일 쌍이 맞지 않습니다. 새로고침 후 다시 시도해 주세요." },
      { status: 400 },
    );
  }
  if (detailFiles.length > MAX_PAIRS_PER_REQUEST) {
    return NextResponse.json(
      { message: `한 번에 ${MAX_PAIRS_PER_REQUEST}장까지 올릴 수 있습니다.` },
      { status: 400 },
    );
  }
  // 저장 전에 전량 검사 — 절반만 저장되고 실패하면 고아 파일이 남는다
  for (const file of [...detailFiles, ...thumbFiles]) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ message: "이미지 한 장은 10MB까지입니다." }, { status: 400 });
    }
    if (file.type !== "image/jpeg") {
      return NextResponse.json({ message: "JPEG 이미지만 올릴 수 있습니다." }, { status: 400 });
    }
  }

  const now = new Date();
  const storedImages = [];
  try {
    for (let pairIndex = 0; pairIndex < detailFiles.length; pairIndex++) {
      storedImages.push(
        await storePropertyImagePair({
          detailBytes: await detailFiles[pairIndex].arrayBuffer(),
          thumbBytes: await thumbFiles[pairIndex].arrayBuffer(),
          mimeType: detailFiles[pairIndex].type,
          now,
        }),
      );
    }
  } catch (error) {
    if (error instanceof UnsupportedImageTypeError || error instanceof ImageTooLargeError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ images: storedImages });
}
