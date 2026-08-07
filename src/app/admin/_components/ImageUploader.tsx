"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { createPropertyImagePair } from "@/lib/image-resize";

/**
 * 매물 사진 업로더 — 선택 즉시 Canvas 2종 생성 → 업로드 → 경로를 폼 상태에 쌓는다.
 * property_images 연결은 매물 저장 때 서버가 한 번에 한다(배열 순서 = sortOrder).
 * 제어 컴포넌트: 순서·삭제까지 전부 부모(PropertyForm)의 value가 진실이다.
 */

export type FormImage = { id?: number; filePath: string; thumbPath: string };

export function ImageUploader({
  value,
  onChange,
}: {
  value: FormImage[];
  onChange: (nextImages: FormImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        // EXIF(GPS 포함)는 여기서 소멸한다 — 원본은 서버로 가지 않는다(RULE-11)
        const pair = await createPropertyImagePair(file);
        formData.append("detail", pair.detailBlob, "detail.jpg");
        formData.append("thumb", pair.thumbBlob, "thumb.jpg");
      }
      const response = await fetch("/api/admin/property-images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "업로드에 실패했습니다.");
      }
      const body = (await response.json()) as {
        images: { filePath: string; thumbPath: string }[];
      };
      onChange([...value, ...body.images]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // 같은 파일 재선택 허용
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= value.length) return;
    const nextImages = [...value];
    [nextImages[index], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[index]];
    onChange(nextImages);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        id="property-image-input"
        onChange={(event) => void handleFilesSelected(event.target.files)}
      />
      <label
        htmlFor="property-image-input"
        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[9px] border border-[#d0d5dd] bg-white px-3.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#f9fafb]"
      >
        <ImagePlus className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {isUploading ? "올리는 중…" : "사진 선택 (여러 장 가능)"}
      </label>
      <p className="mt-1.5 text-xs text-[#98a2b3]">
        원본은 브라우저에서 축소·재인코딩되어 위치정보(EXIF)가 제거된 뒤 올라갑니다.
      </p>
      {uploadError && (
        <p role="alert" className="mt-2 text-xs font-medium text-[#d92d20]">
          {uploadError}
        </p>
      )}

      {value.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((image, index) => (
            <li
              key={image.thumbPath}
              className="overflow-hidden rounded-[10px] border border-[#e4e7ec] bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
              <img
                src={`/uploads/${image.thumbPath}`}
                alt={`매물 사진 ${index + 1}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                {index === 0 ? (
                  <span className="rounded-[5px] bg-[#eff4ff] px-1.5 py-0.5 font-bold text-[#2563eb]">
                    대표
                  </span>
                ) : (
                  <span className="font-semibold text-[#98a2b3]">{index + 1}번</span>
                )}
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`${index + 1}번 사진 앞으로`}
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    className="flex size-7 items-center justify-center rounded-[5px] border border-[#e4e7ec] text-[#475467] hover:bg-[#f2f4f7] disabled:opacity-40"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${index + 1}번 사진 뒤로`}
                    onClick={() => moveImage(index, 1)}
                    disabled={index === value.length - 1}
                    className="flex size-7 items-center justify-center rounded-[5px] border border-[#e4e7ec] text-[#475467] hover:bg-[#f2f4f7] disabled:opacity-40"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${index + 1}번 사진 삭제`}
                    onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                    className="flex size-7 items-center justify-center rounded-[5px] border border-[#fecdca] text-[#d92d20] hover:bg-[#fef3f2]"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
