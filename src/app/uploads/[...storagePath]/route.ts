import { NextResponse } from "next/server";

import {
  ImageNotFoundError,
  readStoredImage,
} from "@/server/services/image-storage.service";

/**
 * 업로드 사진 서빙 — 업로드 루트가 public/ 밖이라 라우트가 읽어 내보낸다.
 * 운영에서는 nginx가 /uploads/ 를 alias로 먼저 서빙하므로 이 라우트는 사실상
 * 개발에서만 돈다(nginx 설정이 빠져도 동작하는 폴백이기도 하다).
 * 매물 사진은 비로그인도 봐야 하므로 인증이 없다. 경로 이탈은
 * image-storage(resolveStoredImageFile)가 막는다 — 여기서 경로를 조립하지 않는다.
 */

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"; // 파일명에 랜덤 — 내용이 바뀌면 경로가 바뀐다

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storagePath: string[] }> },
) {
  const { storagePath } = await params;
  try {
    const fileBytes = await readStoredImage(storagePath.join("/"));
    return new NextResponse(new Uint8Array(fileBytes), {
      headers: {
        "Content-Type": "image/jpeg", // JPEG만 저장한다 (image-storage 참조)
        "Cache-Control": IMMUTABLE_CACHE,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (error instanceof ImageNotFoundError) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
