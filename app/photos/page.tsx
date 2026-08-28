"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Photo = {
  id: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
  url: string;
  uploader: string;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [myName, setMyName] = useState("");
  const [myUserId, setMyUserId] = useState("");

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      if (!mounted) {
        return;
      }

      setMyUserId(user.id);

      if (user.id === YOUNGHUN_ID) {
        setMyName("영훈");
      } else if (user.id === HEEJI_ID) {
        setMyName("희지");
      } else {
        setMyName("우리");
      }

      await loadPhotos();

      if (!mounted) {
        return;
      }

      channel = supabase
        .channel("photos-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "photos",
          },
          async (payload) => {
            console.log("🔥 사진 Realtime 수신:", payload);

            await loadPhotos();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "photos",
          },
          async (payload) => {
            console.log("🔥 사진 삭제 Realtime 수신:", payload);

            await loadPhotos();
          }
        )
        .subscribe((status) => {
          console.log("🔥 사진 Realtime 상태:", status);
        });
    }

    initialize();

    return () => {
      mounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadPhotos() {
    const { data: dbPhotos, error: dbError } = await supabase
      .from("photos")
      .select("id, file_name, uploaded_by, created_at")
      .order("created_at", {
        ascending: false,
      });

    if (dbError) {
      console.error("사진 DB 조회 오류:", dbError);
      return;
    }

    const { data: storageFiles, error: storageError } =
      await supabase.storage
        .from("photos")
        .list("", {
          sortBy: {
            column: "created_at",
            order: "desc",
          },
        });

    if (storageError) {
      console.error("사진 Storage 조회 오류:", storageError);
      return;
    }

    const dbPhotoMap = new Map<string, any>();

    for (const photo of dbPhotos || []) {
      dbPhotoMap.set(photo.file_name, photo);
    }

    const photoList: Photo[] = [];

    for (const file of storageFiles || []) {
      if (file.name === ".emptyFolderPlaceholder") {
        continue;
      }

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("photos")
          .createSignedUrl(file.name, 60 * 60);

      if (signedError) {
        console.error("사진 주소 생성 오류:", signedError);
        continue;
      }

      if (!signedData?.signedUrl) {
        continue;
      }

      const dbPhoto = dbPhotoMap.get(file.name);

      let uploader = "우리";
      let createdAt = file.created_at || new Date().toISOString();
      let photoId = file.name;
      let uploadedBy = "";

      if (dbPhoto) {
        uploader = getUploaderName(dbPhoto.uploaded_by);
        createdAt = dbPhoto.created_at;
        photoId = dbPhoto.id;
        uploadedBy = dbPhoto.uploaded_by;
      }

      photoList.push({
        id: photoId,
        file_name: file.name,
        uploaded_by: uploadedBy,
        created_at: createdAt,
        url: signedData.signedUrl,
        uploader,
      });
    }

    photoList.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

    setPhotos(photoList);
  }

  function getUploaderName(userId: string) {
    if (userId === YOUNGHUN_ID) {
      return "영훈";
    }

    if (userId === HEEJI_ID) {
      return "희지";
    }

    return "우리";
  }

  async function uploadPhoto(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!myUserId) {
      alert("로그인 정보를 확인하는 중입니다.");
      return;
    }

    setUploading(true);

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    let prefix = "photo";

    if (myName === "영훈") {
      prefix = "younghun";
    } else if (myName === "희지") {
      prefix = "heeji";
    }

    const fileName =
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 10) +
      "." +
      extension;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(fileName, file);

    if (uploadError) {
      console.error("사진 업로드 오류:", uploadError);

      alert(
        "사진 업로드 실패: " + uploadError.message
      );

      setUploading(false);
      event.target.value = "";
      return;
    }

    const { error: insertError } = await supabase
      .from("photos")
      .insert({
        file_name: fileName,
        uploaded_by: myUserId,
      });

    if (insertError) {
      console.error("사진 DB 저장 오류:", insertError);

      await supabase.storage
        .from("photos")
        .remove([fileName]);

      alert(
        "사진 정보 저장 실패: " + insertError.message
      );

      setUploading(false);
      event.target.value = "";
      return;
    }

    await loadPhotos();

    setUploading(false);
    event.target.value = "";
  }

  async function deletePhoto(photo: Photo) {
    const confirmed = window.confirm(
      "이 사진을 삭제할까요?"
    );

    if (!confirmed) {
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("photos")
      .remove([photo.file_name]);

    if (storageError) {
      console.error(
        "사진 파일 삭제 오류:",
        storageError
      );

      alert(
        "사진 삭제 실패: " + storageError.message
      );

      return;
    }

    if (photo.uploaded_by) {
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id);

      if (dbError) {
        console.error(
          "사진 DB 삭제 오류:",
          dbError
        );

        alert(
          "사진 기록 삭제 실패: " + dbError.message
        );

        return;
      }
    }

    setSelectedPhoto(null);

    await loadPhotos();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f8fc] text-[#30475b]">
      <div className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-10">

        <header className="mb-8">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="mb-4 text-sm text-[#a0948f]"
          >
            ← Home
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Photos
              </h1>

              <p className="mt-1 text-sm text-[#9b8f8a]">
                우리의 순간을 하나씩 담아두는 공간
              </p>
            </div>

            <label className="cursor-pointer rounded-2xl bg-[#edf6fc] px-5 py-3 font-semibold text-[#3d3532] transition hover:opacity-90">
              {uploading ? "업로드 중..." : "+ 사진 추가"}

              <input
                type="file"
                accept="image/*"
                onChange={uploadPhoto}
                className="hidden"
              />
            </label>
          </div>
        </header>

        {photos.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="text-center">
              <div className="text-6xl">
                📷
              </div>

              <p className="mt-5 text-lg font-semibold">
                아직 사진이 없어요.
              </p>

              <p className="mt-2 text-sm text-[#9b8f8a]">
                우리의 첫 번째 사진을 올려보세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <button
                  onClick={() => {
                    setSelectedPhoto(photo);
                  }}
                  className="group block aspect-square w-full overflow-hidden"
                >
                  <img
                    src={photo.url}
                    alt="우리의 사진"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </button>

                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#766b67]">
                      {photo.uploader}
                    </span>

                    <span className="text-xs text-[#b0a39e]">
                      ♥
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#b0a39e]">
                    {formatDate(photo.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5"
          onClick={() => {
            setSelectedPhoto(null);
          }}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <img
              src={selectedPhoto.url}
              alt="우리의 사진"
              className="max-h-[75vh] max-w-full rounded-2xl object-contain"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="rounded-xl bg-white px-4 py-2">
                <p className="text-sm font-semibold">
                  {selectedPhoto.uploader}의 사진
                </p>

                <p className="mt-1 text-xs text-[#a0948f]">
                  {formatDate(selectedPhoto.created_at)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    deletePhoto(selectedPhoto);
                  }}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-red-500"
                >
                  삭제
                </button>

                <button
                  onClick={() => {
                    setSelectedPhoto(null);
                  }}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}