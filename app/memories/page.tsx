```tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type MemoryPart = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Memory = {
  id: string;
  title: string;
  content: string;
  part_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MemoryPhoto = {
  id: string;
  memory_id: string;
  file_path: string;
  file_name: string;
  created_by: string | null;
  created_at: string;
};

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const PHOTO_BUCKET = "memory-photos";

export default function MemoriesPage() {
  const [parts, setParts] = useState<MemoryPart[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  const [selectedPart, setSelectedPart] =
    useState<MemoryPart | null>(null);

  const [selectedMemory, setSelectedMemory] =
    useState<Memory | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [partName, setPartName] = useState("");
  const [editingPart, setEditingPart] =
    useState<MemoryPart | null>(null);

  const [myUserId, setMyUserId] = useState("");
  const [myName, setMyName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showPartModal, setShowPartModal] =
    useState(false);

  const [isCreating, setIsCreating] =
    useState(false);

  const [isEditing, setIsEditing] =
    useState(false);

  const [photoLoading, setPhotoLoading] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      if (!mounted) return;

      setMyUserId(user.id);

      if (user.id === YOUNGHUN_ID) {
        setMyName("영훈");
      } else if (user.id === HEEJI_ID) {
        setMyName("희지");
      } else {
        setMyName("우리");
      }

      await loadData();

      if (!mounted) return;

      channel = supabase
        .channel("memories-page-realtime")

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memories",
          },
          async () => {
            await loadMemories();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memory_parts",
          },
          async () => {
            await loadParts();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memory_photos",
          },
          async () => {
            await loadPhotos();
          }
        )

        .subscribe();

      setLoading(false);
    }

    initialize();

    return () => {
      mounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadData() {
    await Promise.all([
      loadParts(),
      loadMemories(),
      loadPhotos(),
    ]);
  }

  async function loadParts() {
    const { data, error } = await supabase
      .from("memory_parts")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("파트 조회 오류:", error);
      return;
    }

    const nextParts = data || [];

    setParts(nextParts);

    setSelectedPart((current) => {
      if (!current) {
        return nextParts[0] || null;
      }

      const exists = nextParts.find(
        (part) => part.id === current.id
      );

      return exists || nextParts[0] || null;
    });
  }

  async function loadMemories() {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error("메모 조회 오류:", error);
      return;
    }

    const nextMemories = data || [];

    setMemories(nextMemories);

    setSelectedMemory((current) => {
      if (!current) return null;

      const updated = nextMemories.find(
        (memory) => memory.id === current.id
      );

      if (!updated) {
        setTitle("");
        setContent("");
        setPhotos([]);
        return null;
      }

      if (!isEditing) {
        setTitle(updated.title);
        setContent(updated.content);
      }

      return updated;
    });
  }

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("memory_photos")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

  if (error) {
  console.error("========== MEMORY PHOTOS 조회 실패 ==========");
  console.error("error:", error);
  console.error("message:", error.message);
  console.error("details:", error.details);
  console.error("hint:", error.hint);
  console.error("code:", error.code);
  console.error("==============================================");

  alert(
    `사진 조회 실패\n\n` +
    `code: ${error.code || "-"}\n` +
    `message: ${error.message || "-"}\n` +
    `details: ${error.details || "-"}\n` +
    `hint: ${error.hint || "-"}`
  );

  return;
}

    setPhotos(data || []);
  }

  function getAuthorName(
    userId: string | null
  ) {
    if (userId === YOUNGHUN_ID) {
      return "영훈";
    }

    if (userId === HEEJI_ID) {
      return "희지";
    }

    return "우리";
  }

  function getPartMemories(
    partId: string
  ) {
    return memories
      .filter(
        (memory) =>
          memory.part_id === partId
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime()
      );
  }

  function getMemoryPhotos(
    memoryId: string
  ) {
    return photos.filter(
      (photo) =>
        photo.memory_id === memoryId
    );
  }

  function getPhotoUrl(
    filePath: string
  ) {
    const { data } =
      supabase.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function selectPart(part: MemoryPart) {
    setSelectedPart(part);
    setSelectedMemory(null);
    setIsCreating(false);
    setIsEditing(false);
    setTitle("");
    setContent("");
    setPendingPhotos([]);
  }

  function selectMemory(memory: Memory) {
    setSelectedMemory(memory);

    setIsCreating(false);

    // 메모를 클릭했을 때 바로 수정되지 않음
    setIsEditing(false);

    setTitle(memory.title);
    setContent(memory.content);

    setPendingPhotos([]);
  }

  function createNewMemory() {
    if (!selectedPart) {
      alert(
        "먼저 메모를 넣을 파트를 선택해주세요."
      );
      return;
    }

    setSelectedMemory(null);
    setIsCreating(true);
    setIsEditing(true);

    setTitle("");
    setContent("");
    setPendingPhotos([]);
  }

  function startEditing() {
    if (!selectedMemory) return;

    setIsEditing(true);
    setTitle(selectedMemory.title);
    setContent(selectedMemory.content);
    setPendingPhotos([]);
  }

  function cancelMemory() {
    setIsCreating(false);
    setIsEditing(false);

    setPendingPhotos([]);

    if (selectedMemory) {
      setTitle(selectedMemory.title);
      setContent(selectedMemory.content);
    } else {
      setSelectedMemory(null);
      setTitle("");
      setContent("");
    }
  }

  function openNewPartModal() {
    setEditingPart(null);
    setPartName("");
    setShowPartModal(true);
  }

  function openEditPartModal(
    part: MemoryPart
  ) {
    setEditingPart(part);
    setPartName(part.name);
    setShowPartModal(true);
  }

  async function savePart() {
    if (!partName.trim()) {
      alert("파트 이름을 입력해주세요.");
      return;
    }

    if (editingPart) {
      const { error } = await supabase
        .from("memory_parts")
        .update({
          name: partName.trim(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", editingPart.id);

      if (error) {
        alert(
          "파트 수정 실패: " +
            error.message
        );
        return;
      }

      setShowPartModal(false);
      await loadParts();
      return;
    }

    const { data, error } =
      await supabase
        .from("memory_parts")
        .insert({
          name: partName.trim(),
          created_by: myUserId,
        })
        .select()
        .single();

    if (error) {
      alert(
        "파트 생성 실패: " +
          error.message
      );
      return;
    }

    setShowPartModal(false);
    setPartName("");

    await loadParts();

    if (data) {
      setSelectedPart(data);
      setSelectedMemory(null);
      setIsCreating(false);
      setIsEditing(false);
    }
  }

  async function deletePart() {
    if (!editingPart) return;

    const partMemories =
      getPartMemories(
        editingPart.id
      );

    const confirmed = window.confirm(
      partMemories.length > 0
        ? `"${editingPart.name}" 파트와 안에 있는 ${partMemories.length}개의 메모를 모두 삭제할까요?`
        : `"${editingPart.name}" 파트를 삭제할까요?`
    );

    if (!confirmed) return;

    if (partMemories.length > 0) {
      const memoryIds =
        partMemories.map(
          (memory) => memory.id
        );

      const partPhotos =
        photos.filter((photo) =>
          memoryIds.includes(
            photo.memory_id
          )
        );

      if (partPhotos.length > 0) {
        const filePaths =
          partPhotos.map(
            (photo) =>
              photo.file_path
          );

        await supabase.storage
          .from(PHOTO_BUCKET)
          .remove(filePaths);
      }

      const { error: photoError } =
        await supabase
          .from("memory_photos")
          .delete()
          .in(
            "memory_id",
            memoryIds
          );

      if (photoError) {
        alert(
          "사진 정보 삭제 실패: " +
            photoError.message
        );
        return;
      }

      const { error } =
        await supabase
          .from("memories")
          .delete()
          .eq(
            "part_id",
            editingPart.id
          );

      if (error) {
        alert(
          "메모 삭제 실패: " +
            error.message
        );
        return;
      }
    }

    const { error } =
      await supabase
        .from("memory_parts")
        .delete()
        .eq(
          "id",
          editingPart.id
        );

    if (error) {
      alert(
        "파트 삭제 실패: " +
          error.message
      );
      return;
    }

    setShowPartModal(false);
    setSelectedMemory(null);
    setIsCreating(false);
    setIsEditing(false);
    setTitle("");
    setContent("");
    setPendingPhotos([]);

    await loadData();
  }

  function handlePhotoSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const selectedFiles =
      Array.from(files);

    const validFiles =
      selectedFiles.filter(
        (file) => {
          if (
            !file.type.startsWith(
              "image/"
            )
          ) {
            alert(
              `${file.name}은(는) 이미지 파일이 아닙니다.`
            );
            return false;
          }

          if (
            file.size >
            10 * 1024 * 1024
          ) {
            alert(
              `${file.name}의 용량이 10MB를 초과합니다.`
            );
            return false;
          }

          return true;
        }
      );

    const newPhotos =
      validFiles.map(
        (file) => ({
          id:
            crypto.randomUUID(),
          file,
          previewUrl:
            URL.createObjectURL(
              file
            ),
        })
      );

    setPendingPhotos(
      (current) => [
        ...current,
        ...newPhotos,
      ]
    );

    // 같은 파일을 다시 선택할 수 있도록 초기화
    event.target.value = "";
  }

  function removePendingPhoto(
    photoId: string
  ) {
    setPendingPhotos(
      (current) => {
        const target =
          current.find(
            (photo) =>
              photo.id ===
              photoId
          );

        if (target) {
          URL.revokeObjectURL(
            target.previewUrl
          );
        }

        return current.filter(
          (photo) =>
            photo.id !== photoId
        );
      }
    );
  }

  async function uploadPhotos(
    memoryId: string
  ) {
    if (
      pendingPhotos.length === 0
    ) {
      return true;
    }

    setPhotoLoading(true);

    const uploadedPaths: string[] = [];

    try {
      for (
        const pendingPhoto of pendingPhotos
      ) {
        const file =
          pendingPhoto.file;

        const originalName =
          file.name;

        const extension =
          originalName.includes(".")
            ? originalName
                .split(".")
                .pop()
                ?.toLowerCase() || "jpg"
            : "jpg";

        const filePath =
          `${myUserId}/${memoryId}/${crypto.randomUUID()}.${extension}`;

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(
              filePath,
              file,
              {
                cacheControl:
                  "3600",
                upsert: false,
                contentType:
                  file.type ||
                  "image/jpeg",
              }
            );

        if (uploadError) {
          console.error(
            "사진 업로드 오류:",
            uploadError
          );

          // 앞에서 업로드된 파일 정리
          if (
            uploadedPaths.length >
            0
          ) {
            await supabase.storage
              .from(
                PHOTO_BUCKET
              )
              .remove(
                uploadedPaths
              );
          }

          alert(
            `사진 업로드 실패: ${uploadError.message}`
          );

          return false;
        }

        uploadedPaths.push(
          filePath
        );

        const {
          error: dbError,
        } =
          await supabase
            .from(
              "memory_photos"
            )
            .insert({
              memory_id:
                memoryId,
              file_path:
                filePath,
              file_name:
                originalName,
              created_by:
                myUserId,
            });

        if (dbError) {
          console.error(
            "사진 정보 저장 오류:",
            dbError
          );

          await supabase.storage
            .from(
              PHOTO_BUCKET
            )
            .remove([
              filePath,
            ]);

          // 앞에서 정상 저장된 사진들도 정리
          if (
            uploadedPaths.length >
            1
          ) {
            await supabase.storage
              .from(
                PHOTO_BUCKET
              )
              .remove(
                uploadedPaths.filter(
                  (path) =>
                    path !==
                    filePath
                )
              );
          }

          alert(
            `사진 정보 저장 실패: ${dbError.message}`
          );

          return false;
        }
      }

      return true;
    } finally {
      setPhotoLoading(false);
    }
  }

  async function deletePhoto(
    photo: MemoryPhoto
  ) {
    if (!isEditing) return;

    const confirmed =
      window.confirm(
        "이 사진을 삭제할까요?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error: storageError,
    } =
      await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([
          photo.file_path,
        ]);

    if (storageError) {
      alert(
        "사진 파일 삭제 실패: " +
          storageError.message
      );
      return;
    }

    const { error: dbError } =
      await supabase
        .from("memory_photos")
        .delete()
        .eq("id", photo.id);

    if (dbError) {
      alert(
        "사진 정보 삭제 실패: " +
          dbError.message
      );
      return;
    }

    await loadPhotos();
  }

  async function saveMemory() {
    if (!selectedPart) {
      alert(
        "먼저 메모를 넣을 파트를 선택해주세요."
      );
      return;
    }

    if (!title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      let memoryId = "";

      if (selectedMemory) {
        const { error } =
          await supabase
            .from("memories")
            .update({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              selectedMemory.id
            );

        if (error) {
          alert(
            "메모 수정 실패: " +
              error.message
          );
          return;
        }

        memoryId =
          selectedMemory.id;
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from("memories")
            .insert({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              created_by:
                myUserId,
            })
            .select()
            .single();

        if (error) {
          alert(
            "메모 저장 실패: " +
              error.message
          );
          return;
        }

        if (!data) {
          alert(
            "메모 저장 결과를 가져오지 못했습니다."
          );
          return;
        }

        memoryId = data.id;
      }

      // ★ 메모가 확실히 생성/수정된 후 사진 업로드
      if (
        pendingPhotos.length >
        0
      ) {
        const photoSuccess =
          await uploadPhotos(
            memoryId
          );

        if (!photoSuccess) {
          // 메모 자체는 저장됐지만
          // 사진 저장 실패를 사용자에게 알림
          await loadMemories();
          await loadPhotos();

          const savedMemory =
            memories.find(
              (memory) =>
                memory.id ===
                memoryId
            );

          if (savedMemory) {
            setSelectedMemory(
              savedMemory
            );
          }

          return;
        }
      }

      // Object URL 정리
      pendingPhotos.forEach(
        (photo) => {
          URL.revokeObjectURL(
            photo.previewUrl
          );
        }
      );

      setPendingPhotos([]);

      await loadMemories();
      await loadPhotos();

      const { data: savedMemory } =
        await supabase
          .from("memories")
          .select("*")
          .eq("id", memoryId)
          .single();

      if (savedMemory) {
        setSelectedMemory(
          savedMemory
        );

        setTitle(
          savedMemory.title
        );

        setContent(
          savedMemory.content
        );
      }

      setIsCreating(false);
      setIsEditing(false);

      alert("저장되었습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory() {
    if (!selectedMemory) return;

    const confirmed =
      window.confirm(
        "이 메모를 삭제할까요?"
      );

    if (!confirmed) return;

    const memoryPhotos =
      getMemoryPhotos(
        selectedMemory.id
      );

    if (
      memoryPhotos.length >
      0
    ) {
      const filePaths =
        memoryPhotos.map(
          (photo) =>
            photo.file_path
        );

      const {
        error: storageError,
      } =
        await supabase.storage
          .from(PHOTO_BUCKET)
          .remove(
            filePaths
          );

      if (storageError) {
        console.error(
          "사진 파일 삭제 오류:",
          storageError
        );
      }
    }

    const {
      error: photoError,
    } =
      await supabase
        .from("memory_photos")
        .delete()
        .eq(
          "memory_id",
          selectedMemory.id
        );

    if (photoError) {
      alert(
        "사진 정보 삭제 실패: " +
          photoError.message
      );
      return;
    }

    const { error } =
      await supabase
        .from("memories")
        .delete()
        .eq(
          "id",
          selectedMemory.id
        );

    if (error) {
      alert(
        "메모 삭제 실패: " +
          error.message
      );
      return;
    }

    setSelectedMemory(null);
    setIsCreating(false);
    setIsEditing(false);
    setTitle("");
    setContent("");
    setPendingPhotos([]);

    await loadMemories();
    await loadPhotos();
  }

  function formatDate(
    dateString: string
  ) {
    return new Date(
      dateString
    ).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  }

  function PhotoGallery({
    memoryId,
  }: {
    memoryId: string;
  }) {
    const memoryPhotos =
      getMemoryPhotos(
        memoryId
      );

    if (
      memoryPhotos.length ===
      0
    ) {
      return null;
    }

    return (
      <div className="mt-8">
        <div className="mb-3 text-xs font-semibold text-[#8b9fa9]">
          PHOTOS ·{" "}
          {memoryPhotos.length}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {memoryPhotos.map(
            (photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl bg-[#f1f8fb]"
              >
                <img
                  src={getPhotoUrl(
                    photo.file_path
                  )}
                  alt={
                    photo.file_name
                  }
                  className="aspect-square w-full object-cover"
                  onError={(
                    event
                  ) => {
                    console.error(
                      "사진 표시 실패:",
                      photo.file_path
                    );

                    event.currentTarget.style.display =
                      "none";
                  }}
                />

                {isEditing && (
                  <button
                    type="button"
                    onClick={() =>
                      deletePhoto(
                        photo
                      )
                    }
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white opacity-100 transition hover:bg-red-500"
                  >
                    삭제
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  function PendingPhotoGallery() {
    if (
      pendingPhotos.length ===
      0
    ) {
      return null;
    }

    return (
      <div className="mt-6">
        <div className="mb-3 text-xs font-semibold text-[#8b9fa9]">
          추가할 사진 ·{" "}
          {pendingPhotos.length}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pendingPhotos.map(
            (photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl bg-[#f1f8fb]"
              >
                <img
                  src={
                    photo.previewUrl
                  }
                  alt={
                    photo.file.name
                  }
                  className="aspect-square w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() =>
                    removePendingPhoto(
                      photo.id
                    )
                  }
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  삭제
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eaf6fc] text-[#766b67]">
        Memories를 불러오는 중...
      </main>
    );
  }

  const selectedPartMemories =
    selectedPart
      ? getPartMemories(
          selectedPart.id
        )
      : [];

  return (
    <main className="min-h-screen bg-[#eaf6fc] text-[#3d3532]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 md:px-8">

        <header className="mb-5 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href =
                  "/";
              }}
              className="mb-3 text-sm text-[#8b9fa9] transition hover:text-[#3d3532]"
            >
              ← Home
            </button>

            <h1 className="text-3xl font-bold">
              Memories
            </h1>

            <p className="mt-1 text-sm text-[#8b9fa9]">
              우리의 이야기를 차곡차곡
              기록해요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/70 px-4 py-2 text-sm text-[#7b8d96] shadow-sm md:block">
              {myName}
            </span>

            <button
              onClick={
                createNewMemory
              }
              disabled={!selectedPart}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#3d3532] shadow-sm transition hover:bg-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              + 새 메모
            </button>
          </div>
        </header>

        {/* ================= DESKTOP ================= */}

        <div className="hidden min-h-[720px] flex-1 overflow-hidden rounded-3xl bg-white/90 shadow-sm md:flex">

          {/* PARTS */}

          <aside className="w-56 shrink-0 border-r border-[#d4e8f2] bg-[#f7fcff]">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#d4e8f2] px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-wide text-[#8b9fa9]">
                      PARTS
                    </p>

                    <p className="mt-1 text-xs text-[#a3b4bc]">
                      {parts.length}개의
                      파트
                    </p>
                  </div>

                  <button
                    onClick={
                      openNewPartModal
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg text-[#587582] shadow-sm hover:bg-[#eaf6fc]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {parts.length ===
                0 ? (
                  <div className="px-3 py-10 text-center">
                    <div className="text-3xl">
                      📁
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#8b9fa9]">
                      아직 파트가
                      없어요.
                      <br />
                      파트를 만들어보세요.
                    </p>

                    <button
                      onClick={
                        openNewPartModal
                      }
                      className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#587582] shadow-sm"
                    >
                      + 파트 만들기
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {parts.map(
                      (part) => {
                        const count =
                          getPartMemories(
                            part.id
                          ).length;

                        const active =
                          selectedPart?.id ===
                          part.id;

                        return (
                          <div
                            key={
                              part.id
                            }
                            className={`group flex items-center rounded-xl transition ${
                              active
                                ? "bg-[#dff2fb]"
                                : "hover:bg-[#edf8fc]"
                            }`}
                          >
                            <button
                              onClick={() =>
                                selectPart(
                                  part
                                )
                              }
                              className="min-w-0 flex-1 px-3 py-3 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span>
                                  📁
                                </span>

                                <span
                                  className={`truncate text-sm font-semibold ${
                                    active
                                      ? "text-[#456572]"
                                      : "text-[#665c58]"
                                  }`}
                                >
                                  {
                                    part.name
                                  }
                                </span>
                              </div>

                              <p className="mt-1 pl-6 text-[11px] text-[#9eb0b9]">
                                {count}
                                개
                              </p>
                            </button>

                            <button
                              onClick={() =>
                                openEditPartModal(
                                  part
                                )
                              }
                              className="mr-2 hidden h-7 w-7 items-center justify-center rounded-lg text-xs text-[#8fa3ad] hover:bg-white group-hover:flex"
                            >
                              ···
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-[#d4e8f2] p-4">
                <button
                  onClick={
                    openNewPartModal
                  }
                  className="w-full rounded-xl border border-dashed border-[#bcd9e6] py-2.5 text-xs font-semibold text-[#78929d] hover:bg-white"
                >
                  + 새 파트
                </button>
              </div>
            </div>
          </aside>

          {/* MEMORY LIST */}

          <aside className="w-72 shrink-0 border-r border-[#d4e8f2] bg-white">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#d4e8f2] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#8b9fa9]">
                      SELECTED PART
                    </p>

                    <h2 className="mt-1 truncate text-lg font-bold">
                      {selectedPart
                        ? selectedPart.name
                        : "파트를 선택해주세요"}
                    </h2>
                  </div>

                  <button
                    onClick={
                      createNewMemory
                    }
                    disabled={!selectedPart}
                    className="shrink-0 rounded-xl bg-[#dff2fb] px-3 py-2 text-xs font-semibold text-[#456572] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + 메모
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {!selectedPart ? (
                  <div className="flex min-h-[400px] items-center justify-center text-center">
                    <div>
                      <div className="text-4xl">
                        📁
                      </div>

                      <p className="mt-3 text-sm text-[#8b9fa9]">
                        왼쪽에서
                        파트를
                        <br />
                        선택해주세요.
                      </p>
                    </div>
                  </div>
                ) : selectedPartMemories.length ===
                  0 ? (
                  <div className="flex min-h-[400px] items-center justify-center text-center">
                    <div>
                      <div className="text-4xl">
                        📝
                      </div>

                      <p className="mt-3 text-sm text-[#8b9fa9]">
                        아직 메모가
                        없어요.
                      </p>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="mt-4 rounded-xl bg-[#dff2fb] px-4 py-2 text-xs font-semibold text-[#456572]"
                      >
                        첫 메모 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedPartMemories.map(
                      (memory) => {
                        const active =
                          selectedMemory?.id ===
                          memory.id;

                        const photoCount =
                          getMemoryPhotos(
                            memory.id
                          ).length;

                        return (
                          <button
                            key={
                              memory.id
                            }
                            onClick={() =>
                              selectMemory(
                                memory
                              )
                            }
                            className={`w-full rounded-xl p-4 text-left transition ${
                              active
                                ? "bg-[#e5f5fb]"
                                : "bg-[#f8fcfe] hover:bg-[#edf8fc]"
                            }`}
                          >
                            <p className="truncate text-sm font-semibold">
                              {
                                memory.title
                              }
                            </p>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8b9fa9]">
                              {memory.content ||
                                "내용 없음"}
                            </p>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-[#9eb0b9]">
                              <span>
                                {getAuthorName(
                                  memory.created_by
                                )}
                              </span>

                              <span>
                                {photoCount >
                                  0 && (
                                  <>
                                    📷{" "}
                                    {
                                      photoCount
                                    }{" "}
                                    ·{" "}
                                  </>
                                )}

                                {formatDate(
                                  memory.updated_at
                                )}
                              </span>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* CONTENT */}

          <section className="min-w-0 flex-1 bg-white">
            {!selectedPart ? (
              <div className="flex h-full min-h-[650px] items-center justify-center text-center">
                <div>
                  <div className="text-6xl">
                    📚
                  </div>

                  <h2 className="mt-5 text-xl font-bold">
                    우리의 기억을
                    정리해보세요.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#8b9fa9]">
                    왼쪽에서 파트를
                    선택하면
                    <br />
                    그 안의 메모를 볼 수
                    있어요.
                  </p>
                </div>
              </div>
            ) : isCreating ||
              selectedMemory ? (
              <div className="flex h-full flex-col">

                {/* CONTENT HEADER */}

                <div className="flex items-center justify-between border-b border-[#d4e8f2] px-8 py-4">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-[#8b9fa9]">
                    <span>
                      📁
                    </span>

                    <span>
                      {
                        selectedPart.name
                      }
                    </span>

                    <span>
                      ›
                    </span>

                    <span className="truncate">
                      {selectedMemory
                        ? selectedMemory.title
                        : "새 메모"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">

                    {!isCreating &&
                      selectedMemory &&
                      !isEditing && (
                        <button
                          onClick={
                            startEditing
                          }
                          className="rounded-lg bg-[#dff2fb] px-4 py-2 text-xs font-semibold text-[#456572] hover:bg-[#ccebf7]"
                        >
                          수정
                        </button>
                      )}

                    {isEditing && (
                      <button
                        onClick={
                          cancelMemory
                        }
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-[#8b9fa9] hover:bg-[#edf8fc]"
                      >
                        취소
                      </button>
                    )}

                    {selectedMemory && (
                      <button
                        onClick={
                          deleteMemory
                        }
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-[#fff1f1]"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto px-8 py-10 lg:px-14">

                  <div className="mb-2 text-xs text-[#9eb0b9]">
                    {selectedMemory
                      ? `${getAuthorName(
                          selectedMemory.created_by
                        )} · ${formatDate(
                          selectedMemory.updated_at
                        )}`
                      : `${myName} · 지금 작성`}
                  </div>

                  {isEditing ? (
                    <input
                      autoFocus={
                        isCreating
                      }
                      value={title}
                      onChange={(e) =>
                        setTitle(
                          e.target
                            .value
                        )
                      }
                      placeholder="제목 없음"
                      className="w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-[#3d3532] outline-none placeholder:text-[#d8e4e9]"
                    />
                  ) : (
                    <h1 className="text-4xl font-bold tracking-tight text-[#3d3532]">
                      {
                        selectedMemory?.title
                      }
                    </h1>
                  )}

                  <div className="my-7 h-px bg-[#d4e8f2]" />

                  {isEditing ? (
                    <textarea
                      value={content}
                      onChange={(e) =>
                        setContent(
                          e.target
                            .value
                        )
                      }
                      placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                      className="min-h-[480px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                    />
                  ) : (
                    <div className="min-h-[200px] whitespace-pre-wrap text-[15px] leading-8 text-[#554b47]">
                      {selectedMemory?.content ||
                        "내용 없음"}
                    </div>
                  )}

                  {/* EXISTING PHOTOS */}

                  {selectedMemory && (
                    <PhotoGallery
                      memoryId={
                        selectedMemory.id
                      }
                    />
                  )}

                  {/* NEW PHOTOS */}

                  {isEditing && (
                    <>
                      <div className="mt-8">
                        <label
                          htmlFor="desktop-photo-upload"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#bcd9e6] bg-[#f7fcff] px-4 py-3 text-sm font-semibold text-[#587582] transition hover:bg-[#eaf6fc]"
                        >
                          📷 사진 추가
                        </label>

                        <input
                          id="desktop-photo-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={
                            handlePhotoSelect
                          }
                          className="hidden"
                        />

                        <p className="mt-2 text-xs text-[#a3b4bc]">
                          사진은 최대
                          10MB까지
                          추가할 수
                          있어요.
                        </p>
                      </div>

                      <PendingPhotoGallery />
                    </>
                  )}

                  {isEditing && (
                    <div className="mt-8 flex items-center justify-between border-t border-[#d4e8f2] pt-5">
                      <p className="text-xs text-[#9eb0b9]">
                        {
                          selectedPart.name
                        }
                      </p>

                      <button
                        onClick={
                          saveMemory
                        }
                        disabled={
                          saving ||
                          photoLoading
                        }
                        className="rounded-xl bg-[#dff2fb] px-6 py-3 text-sm font-semibold text-[#456572] transition hover:bg-[#ccebf7] disabled:opacity-50"
                      >
                        {saving ||
                        photoLoading
                          ? "저장 중..."
                          : "저장"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[650px] items-center justify-center text-center">
                <div>
                  <div className="text-5xl">
                    📝
                  </div>

                  <h2 className="mt-5 text-lg font-bold">
                    {
                      selectedPart.name
                    }
                  </h2>

                  <p className="mt-2 text-sm text-[#8b9fa9]">
                    이 파트에 새로운
                    <br />
                    기억을 남겨보세요.
                  </p>

                  <button
                    onClick={
                      createNewMemory
                    }
                    className="mt-5 rounded-xl bg-[#dff2fb] px-5 py-3 text-sm font-semibold text-[#456572]"
                  >
                    + 새 메모 작성
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ================= MOBILE ================= */}

        <div className="md:hidden">

          <div className="rounded-2xl bg-white/90 p-4 shadow-sm">

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">
                파트
              </p>

              <button
                onClick={
                  openNewPartModal
                }
                className="rounded-lg bg-[#dff2fb] px-3 py-2 text-xs font-semibold text-[#456572]"
              >
                + 파트
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {parts.map(
                (part) => (
                  <button
                    key={
                      part.id
                    }
                    onClick={() =>
                      selectPart(
                        part
                      )
                    }
                    className={`shrink-0 rounded-xl px-4 py-2 text-sm ${
                      selectedPart?.id ===
                      part.id
                        ? "bg-[#dff2fb] font-semibold text-[#456572]"
                        : "bg-[#f4f9fb] text-[#766b67]"
                    }`}
                  >
                    📁{" "}
                    {
                      part.name
                    }
                  </button>
                )
              )}
            </div>
          </div>

          {selectedPart && (
            <>
              {!isCreating &&
                !selectedMemory && (
                  <div className="mt-3 rounded-2xl bg-white/90 p-4 shadow-sm">

                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-bold">
                        {
                          selectedPart.name
                        }
                      </h2>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="rounded-lg bg-[#dff2fb] px-3 py-2 text-xs font-semibold text-[#456572]"
                      >
                        + 메모
                      </button>
                    </div>

                    {selectedPartMemories.length ===
                    0 ? (
                      <div className="py-10 text-center">
                        <div className="text-4xl">
                          📝
                        </div>

                        <p className="mt-3 text-sm text-[#8b9fa9]">
                          아직 메모가
                          없어요.
                        </p>

                        <button
                          onClick={
                            createNewMemory
                          }
                          className="mt-4 rounded-xl bg-[#dff2fb] px-4 py-2 text-xs font-semibold text-[#456572]"
                        >
                          첫 메모 작성
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedPartMemories.map(
                          (memory) => {
                            const photoCount =
                              getMemoryPhotos(
                                memory.id
                              ).length;

                            return (
                              <button
                                key={
                                  memory.id
                                }
                                onClick={() =>
                                  selectMemory(
                                    memory
                                  )
                                }
                                className="w-full rounded-xl bg-[#f4f9fb] p-4 text-left transition hover:bg-[#eaf6fc]"
                              >
                                <p className="font-semibold">
                                  {
                                    memory.title
                                  }
                                </p>

                                <p className="mt-1 line-clamp-2 text-xs text-[#8b9fa9]">
                                  {memory.content ||
                                    "내용 없음"}
                                </p>

                                <p className="mt-2 text-[10px] text-[#9eb0b9]">
                                  {getAuthorName(
                                    memory.created_by
                                  )}

                                  {" · "}

                                  {photoCount >
                                    0 && (
                                    <>
                                      📷{" "}
                                      {
                                        photoCount
                                      }{" "}
                                      ·{" "}
                                    </>
                                  )}

                                  {formatDate(
                                    memory.updated_at
                                  )}
                                </p>
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                )}

              {(isCreating ||
                selectedMemory) && (
                <div className="mt-3 rounded-2xl bg-white/90 p-5 shadow-sm">

                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#8b9fa9]">
                        {selectedMemory &&
                        !isEditing
                          ? "MEMORY"
                          : selectedMemory
                            ? "EDIT MEMORY"
                            : "NEW MEMORY"}
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {selectedMemory &&
                        !isEditing
                          ? "메모 보기"
                          : selectedMemory
                            ? "메모 수정"
                            : "새 메모"}
                      </h2>
                    </div>

                    <div className="flex gap-2">
                      {selectedMemory &&
                        !isEditing && (
                          <button
                            onClick={
                              startEditing
                            }
                            className="rounded-lg bg-[#dff2fb] px-3 py-2 text-xs font-semibold text-[#456572]"
                          >
                            수정
                          </button>
                        )}

                      {selectedMemory && (
                        <button
                          onClick={
                            deleteMemory
                          }
                          className="rounded-lg bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-red-400"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <input
                      autoFocus
                      value={title}
                      onChange={(e) =>
                        setTitle(
                          e.target
                            .value
                        )
                      }
                      placeholder="제목을 입력해주세요"
                      className="w-full border-0 bg-transparent text-2xl font-bold text-[#3d3532] outline-none placeholder:text-[#c7d5db]"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-[#3d3532]">
                      {
                        selectedMemory?.title
                      }
                    </h1>
                  )}

                  <div className="my-4 h-px bg-[#d4e8f2]" />

                  {isEditing ? (
                    <textarea
                      value={content}
                      onChange={(e) =>
                        setContent(
                          e.target
                            .value
                        )
                      }
                      placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                      className="min-h-[300px] w-full resize-none border-0 bg-transparent text-sm leading-7 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                    />
                  ) : (
                    <div className="min-h-[150px] whitespace-pre-wrap text-sm leading-7 text-[#554b47]">
                      {selectedMemory?.content ||
                        "내용 없음"}
                    </div>
                  )}

                  {selectedMemory && (
                    <PhotoGallery
                      memoryId={
                        selectedMemory.id
                      }
                    />
                  )}

                  {isEditing && (
                    <>
                      <div className="mt-6">
                        <label
                          htmlFor="mobile-photo-upload"
                          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#bcd9e6] bg-[#f7fcff] px-4 py-3 text-sm font-semibold text-[#587582]"
                        >
                          📷 사진 추가
                        </label>

                        <input
                          id="mobile-photo-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={
                            handlePhotoSelect
                          }
                          className="hidden"
                        />
                      </div>

                      <PendingPhotoGallery />

                      <div className="mt-5 flex gap-2 border-t border-[#d4e8f2] pt-5">

                        <button
                          onClick={
                            cancelMemory
                          }
                          className="flex-1 rounded-xl bg-[#f2f7f9] py-3 text-sm font-semibold text-[#78909a]"
                        >
                          취소
                        </button>

                        <button
                          onClick={
                            saveMemory
                          }
                          disabled={
                            saving ||
                            photoLoading
                          }
                          className="flex-1 rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572] disabled:opacity-50"
                        >
                          {saving ||
                          photoLoading
                            ? "저장 중..."
                            : "저장"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================= PART MODAL ================= */}

      {showPartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
          onClick={() =>
            setShowPartModal(false)
          }
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#8b9fa9]">
                  {editingPart
                    ? "EDIT PART"
                    : "NEW PART"}
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {editingPart
                    ? "파트 수정"
                    : "새 파트 만들기"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setShowPartModal(
                    false
                  )
                }
                className="text-xl text-[#8b9fa9]"
              >
                ×
              </button>
            </div>

            <input
              autoFocus
              value={partName}
              onChange={(e) =>
                setPartName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  savePart();
                }
              }}
              placeholder="예: 여행, 데이트, 맛집"
              className="w-full rounded-xl bg-[#f1f8fb] px-4 py-3 outline-none focus:ring-2 focus:ring-[#dff2fb]"
            />

            <div className="mt-5 flex gap-3">

              {editingPart && (
                <button
                  onClick={
                    deletePart
                  }
                  className="rounded-xl bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-red-400"
                >
                  삭제
                </button>
              )}

              <button
                onClick={() =>
                  setShowPartModal(
                    false
                  )
                }
                className="flex-1 rounded-xl bg-[#f1f6f8] py-3 text-sm font-semibold text-[#78909a]"
              >
                취소
              </button>

              <button
                onClick={
                  savePart
                }
                className="flex-1 rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572]"
              >
                {editingPart
                  ? "수정"
                  : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```
