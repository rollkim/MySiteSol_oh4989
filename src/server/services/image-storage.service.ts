import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 매물 사진 저장 — 로컬 디스크, 릴리스 폴더 밖(재배포에도 남는다).
 *
 * 저장 경로: {UPLOAD_DIR}/properties/{yyyymm}/{hex24}.jpg (+ 같은 이름 -thumb.jpg)
 * 상세·썸네일 2종은 브라우저 Canvas가 만들어 보낸다(SPEC 수정 이력 #2) —
 * 서버는 검증·저장만 한다. Canvas 재인코딩이 EXIF(촬영 GPS)를 제거하므로
 * 상세주소 비공개 원칙(RULE-11)이 사진 메타데이터로 새지 않는다.
 *
 * JPEG만 받는 이유: 정상 경로(등록 폼)는 항상 JPEG를 보낸다. 다른 형식이 왔다는
 * 것은 화면을 우회해 API를 직접 두드렸다는 뜻이다.
 * 월 폴더로 쪼개는 이유: 한 디렉토리에 수만 개가 쌓이면 파일시스템 조회가 느려진다.
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // Canvas 축소 후 실측 수백 KB — 10MB는 우회 공격 방어선

export class UnsupportedImageTypeError extends Error {
  constructor() {
    super("JPEG 이미지만 올릴 수 있습니다.");
    this.name = "UnsupportedImageTypeError";
  }
}
export class ImageTooLargeError extends Error {
  constructor() {
    super("이미지 한 장은 10MB까지 올릴 수 있습니다.");
    this.name = "ImageTooLargeError";
  }
}
export class ImageNotFoundError extends Error {
  constructor(readonly storagePath: string) {
    super(`이미지를 찾을 수 없습니다: ${storagePath}`);
    this.name = "ImageNotFoundError";
  }
}

const DEFAULT_UPLOAD_DIR_NAME = "oh4989-uploads";

/**
 * 업로드 루트 — 항상 프로젝트 밖. 운영에서 UPLOAD_DIR가 없으면 기본값으로 넘어가지
 * 않고 멈춘다(릴리스 폴더 옆에 조용히 쌓이면 다음 배포 때 "사진이 사라졌다"가 된다).
 * 개발 기본값: 프로젝트 옆 oh4989-uploads (C:\_Hope\Ohsite\oh4989-uploads).
 */
function getUploadRootDir(): string {
  const configuredDir = process.env.UPLOAD_DIR;
  if (configuredDir) return path.resolve(configuredDir);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "UPLOAD_DIR가 설정되지 않았습니다. 절대경로(예: /home/oh4989/shared/uploads)를 지정해 주세요.",
    );
  }
  return path.join(path.dirname(process.cwd()), DEFAULT_UPLOAD_DIR_NAME);
}

/**
 * 저장 상대경로 → 실제 파일 경로. **경로 이탈 방어의 유일한 지점** —
 * 정규화한 절대경로가 루트 밖이면 우리 파일이 아니다. 여기 말고 어디서도
 * 업로드 경로를 직접 조립하지 않는다.
 */
export function resolveStoredImageFile(storagePath: string): string {
  const rootDir = getUploadRootDir();
  const resolved = path.resolve(rootDir, storagePath);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (!resolved.startsWith(rootWithSep)) throw new ImageNotFoundError(storagePath);
  return resolved;
}

export type StoredPropertyImagePair = { filePath: string; thumbPath: string };

/** 상세+썸네일 쌍 저장. 같은 hex 이름을 공유해 디스크에서 짝을 추적할 수 있다 */
/** JPEG 매직바이트(SOI: FF D8 FF) — 선언 MIME은 위조 가능하므로 내용을 본다 */
function isJpegBytes(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 3) return false;
  const head = new Uint8Array(bytes, 0, 3);
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export async function storePropertyImagePair(input: {
  detailBytes: ArrayBuffer;
  thumbBytes: ArrayBuffer;
  mimeType: string;
  now: Date;
}): Promise<StoredPropertyImagePair> {
  if (input.mimeType !== "image/jpeg") throw new UnsupportedImageTypeError();
  // Content-Type 헤더는 클라이언트 선언일 뿐 — 실제 바이트가 JPEG인지 확인한다.
  // 위조 파일(HTML·SVG 등)이 .jpg로 저장되면 서빙 경로가 스크립트 배달 통로가 된다
  if (!isJpegBytes(input.detailBytes) || !isJpegBytes(input.thumbBytes)) {
    throw new UnsupportedImageTypeError();
  }
  if (
    input.detailBytes.byteLength > MAX_IMAGE_BYTES ||
    input.thumbBytes.byteLength > MAX_IMAGE_BYTES
  ) {
    throw new ImageTooLargeError();
  }

  const yearMonth = `${input.now.getFullYear()}${String(input.now.getMonth() + 1).padStart(2, "0")}`;
  const baseName = randomBytes(12).toString("hex"); // 24 hex — 파일명 재생성(경로 이탈·덮어쓰기 차단)
  const filePath = `properties/${yearMonth}/${baseName}.jpg`;
  const thumbPath = `properties/${yearMonth}/${baseName}-thumb.jpg`;

  const detailAbsolute = resolveStoredImageFile(filePath);
  await mkdir(path.dirname(detailAbsolute), { recursive: true });
  await writeFile(detailAbsolute, Buffer.from(input.detailBytes));
  await writeFile(resolveStoredImageFile(thumbPath), Buffer.from(input.thumbBytes));

  return { filePath, thumbPath };
}

/** 서빙 라우트용 — 없으면 ImageNotFoundError(404로 번역된다) */
export async function readStoredImage(storagePath: string): Promise<Buffer> {
  const absolutePath = resolveStoredImageFile(storagePath);
  try {
    return await readFile(absolutePath);
  } catch {
    throw new ImageNotFoundError(storagePath);
  }
}

/** "이미 없음"과 "실패"를 구분해 돌려준다 — 실패한 파일을 잊으면 영구 고아가 된다 */
export async function deleteStoredImage(
  storagePath: string,
): Promise<"deleted" | "missing" | "failed"> {
  let absolutePath: string;
  try {
    absolutePath = resolveStoredImageFile(storagePath);
  } catch {
    return "missing"; // 루트 밖을 가리키는 경로 — 애초에 우리가 쓴 파일이 아니다
  }
  try {
    await unlink(absolutePath);
    return "deleted";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    return "failed";
  }
}
