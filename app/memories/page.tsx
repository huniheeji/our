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

type PhotoWithUrl = MemoryPhoto & {
  url: string;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const PHOTO_BUCKET = "memory-photos";

export default function MemoriesPage() {
  const [parts, setParts] = useState<MemoryPart[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

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
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [showPartModal, setShowPartModal] =
    useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [photos, setPhotos] = useState<PhotoWithUrl[]>(
    []
  );

  const [photoInputKey, setPhotoInputKey] =
    useState(0);

  useEffect(() => {
    let mounted = true;

    let channel: ReturnType<typeof supabase.channel> | null =
      null;

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
            if (selectedMemory) {
              await loadPhotos(selectedMemory.id);
            }
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
  }, [selectedMemory?.id]);

  async function loadData() {
    await Promise.all([
      loadParts(),
      loadMemories(),
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

  async function loadPhotos(memoryId: string) {
    const { data, error } = await supabase
      .from("memory_photos")
      .select("*")
      .eq("memory_id", memoryId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("사진 조회 오류:", error);
      return;
    }

    if (!data || data.length === 0) {
      setPhotos([]);
      return;
    }

    const photoPaths = data.map(
      (photo: MemoryPhoto) => photo.file_path
    );

    const { data: signedUrls, error: urlError } =
      await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(
          photoPaths,
          60 * 60 * 24
        );

    if (urlError) {
      console.error(
        "사진 URL 생성 오류:",
        urlError
      );

      setPhotos([]);
      return;
    }

    const photosWithUrls: PhotoWithUrl[] =
      data.map(
        (
          photo: MemoryPhoto,
          index: number
        ) => ({
          ...photo,
          url:
            signedUrls?.[index]?.signedUrl || "",
        })
      );

    setPhotos(
      photosWithUrls.filter(
        (photo) => photo.url
      )
    );
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
          new Date(
            b.updated_at
          ).getTime() -
          new Date(
            a.updated_at
          ).getTime()
      );
  }

  function selectPart(part: MemoryPart) {
    setSelectedPart(part);
    setSelectedMemory(null);
    setIsCreating(false);
    setIsEditing(false);
    setTitle("");
    setContent("");
    setPhotos([]);
  }

  async function selectMemory(memory: Memory) {
    setSelectedMemory(memory);
    setIsCreating(false);
    setIsEditing(false);

    setTitle(memory.title);
    setContent(memory.content);

    await loadPhotos(memory.id);
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
    setPhotos([]);
  }

  function startEditing() {
    if (!selectedMemory) return;

    setIsEditing(true);
    setTitle(selectedMemory.title);
    setContent(selectedMemory.content);
  }

  function cancelMemory() {
    if (selectedMemory) {
      setIsEditing(false);
      setIsCreating(false);

      setTitle(selectedMemory.title);
      setContent(selectedMemory.content);

      loadPhotos(selectedMemory.id);

      return;
    }

    setSelectedMemory(null);
    setIsCreating(false);
    setIsEditing(false);
    setTitle("");
    setContent("");
    setPhotos([]);
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

    for (const memory of partMemories) {
      await deleteMemoryPhotos(
        memory.id
      );
    }

    if (partMemories.length > 0) {
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
    setPhotos([]);

    await loadData();
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

        const updatedMemory = {
          ...selectedMemory,
          title: title.trim(),
          content,
          part_id: selectedPart.id,
          updated_at:
            new Date().toISOString(),
        };

        setSelectedMemory(
          updatedMemory
        );
      } else {
        const { data, error } =
          await supabase
            .from("memories")
            .insert({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              created_by: myUserId,
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

        if (data) {
          setSelectedMemory(data);
        }
      }

      setIsCreating(false);
      setIsEditing(false);

      await loadMemories();
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhotos(
    files: FileList | File[]
  ) {
    if (!selectedMemory) {
      alert(
        "먼저 메모를 저장해주세요."
      );
      return;
    }

    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    setUploadingPhoto(true);

    try {
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) {
          alert(
            `${file.name}은 이미지 파일이 아닙니다.`
          );
          continue;
        }

        const extension =
          file.name.includes(".")
            ? file.name
                .split(".")
                .pop()
                ?.toLowerCase() || "jpg"
            : "jpg";

        const safeFileName =
          `${crypto.randomUUID()}.${extension}`;

        const filePath =
          `${myUserId}/${selectedMemory.id}/${safeFileName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(
            filePath,
            file,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                file.type,
            }
          );

        if (uploadError) {
          console.error(
            "사진 업로드 오류:",
            uploadError
          );

          alert(
            `${file.name} 업로드 실패: ${uploadError.message}`
          );

          continue;
        }

        const {
          error: insertError,
        } = await supabase
          .from("memory_photos")
          .insert({
            memory_id:
              selectedMemory.id,
            file_path: filePath,
            file_name:
              file.name,
            created_by:
              myUserId,
          });

        if (insertError) {
          console.error(
            "사진 정보 저장 오류:",
            insertError
          );

          await supabase.storage
            .from(PHOTO_BUCKET)
            .remove([filePath]);

          alert(
            `${file.name} 정보 저장 실패: ${insertError.message}`
          );
        }
      }

      await loadPhotos(
        selectedMemory.id
      );

      setPhotoInputKey(
        (value) => value + 1
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(
    photo: PhotoWithUrl
  ) {
    const confirmed =
      window.confirm(
        "이 사진을 삭제할까요?"
      );

    if (!confirmed) return;

    const {
      error: storageError,
    } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([
        photo.file_path,
      ]);

    if (storageError) {
      console.error(
        "Storage 사진 삭제 오류:",
        storageError
      );
    }

    const {
      error: dbError,
    } = await supabase
      .from("memory_photos")
      .delete()
      .eq(
        "id",
        photo.id
      );

    if (dbError) {
      alert(
        "사진 정보 삭제 실패: " +
          dbError.message
      );
      return;
    }

    if (selectedMemory) {
      await loadPhotos(
        selectedMemory.id
      );
    }
  }

  async function deleteMemoryPhotos(
    memoryId: string
  ) {
    const { data, error } =
      await supabase
        .from("memory_photos")
        .select("file_path")
        .eq(
          "memory_id",
          memoryId
        );

    if (error) {
      console.error(
        "사진 목록 삭제 조회 오류:",
        error
      );
      return;
    }

    if (data && data.length > 0) {
      const paths = data.map(
        (photo) =>
          photo.file_path
      );

      await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(paths);
    }

    await supabase
      .from("memory_photos")
      .delete()
      .eq(
        "memory_id",
        memoryId
      );
  }

  async function deleteMemory() {
    if (!selectedMemory) return;

    const confirmed =
      window.confirm(
        "이 메모를 삭제할까요?"
      );

    if (!confirmed) return;

    await deleteMemoryPhotos(
      selectedMemory.id
    );

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
    setPhotos([]);

    await loadMemories();
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

        {/* HEADER */}
        <header className="mb-5 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="mb-3 text-sm text-[#8b9fa9] transition hover:text-[#3d3532]"
            >
              ← Home
            </button>

            <h1 className="text-3xl font-bold">
              Memories
            </h1>

            <p className="mt-1 text-sm text-[#8b9fa9]">
              우리의 이야기를 차곡차곡 기록해요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/70 px-4 py-2 text-sm text-[#7b8d96] shadow-sm md:block">
              {myName}
            </span>

            <button
              onClick={createNewMemory}
              disabled={!selectedPart}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#3d3532] shadow-sm transition hover:bg-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              + 새 메모
            </button>
          </div>
        </header>

        {/* DESKTOP */}
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
                      {parts.length}개의 파트
                    </p>
                  </div>

                  <button
                    onClick={openNewPartModal}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg text-[#587582] shadow-sm hover:bg-[#eaf6fc]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {parts.length === 0 ? (
                  <div className="px-3 py-10 text-center">
                    <div className="text-3xl">
                      📁
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#8b9fa9]">
                      아직 파트가 없어요.
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
                    {parts.map((part) => {
                      const count =
                        getPartMemories(
                          part.id
                        ).length;

                      const active =
                        selectedPart?.id ===
                        part.id;

                      return (
                        <div
                          key={part.id}
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
                              <span>📁</span>

                              <span
                                className={`truncate text-sm font-semibold ${
                                  active
                                    ? "text-[#456572]"
                                    : "text-[#665c58]"
                                }`}
                              >
                                {part.name}
                              </span>
                            </div>

                            <p className="mt-1 pl-6 text-[11px] text-[#9eb0b9]">
                              {count}개
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
                    })}
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
                        왼쪽에서 파트를
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
                        아직 메모가 없어요.
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

                        return (
                          <button
                            key={memory.id}
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
                              {memory.title}
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
                    왼쪽에서 파트를 선택하면
                    <br />
                    그 안의 메모를 볼 수 있어요.
                  </p>
                </div>
              </div>

            ) : isCreating || selectedMemory ? (

              <div className="flex h-full flex-col">

                {/* CONTENT HEADER */}
                <div className="flex items-center justify-between border-b border-[#d4e8f2] px-8 py-4">

                  <div className="flex min-w-0 items-center gap-2 text-xs text-[#8b9fa9]">
                    <span>📁</span>

                    <span>
                      {selectedPart.name}
                    </span>

                    <span>›</span>

                    <span className="truncate">
                      {selectedMemory
                        ? selectedMemory.title
                        : "새 메모"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">

                    {selectedMemory &&
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

                    {(isEditing ||
                      isCreating) && (
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

                {/* CONTENT */}
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

                  {isEditing ||
                  isCreating ? (
                    <>
                      <input
                        autoFocus={
                          isCreating
                        }
                        value={title}
                        onChange={(e) =>
                          setTitle(
                            e.target.value
                          )
                        }
                        placeholder="제목 없음"
                        className="w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-[#3d3532] outline-none placeholder:text-[#d8e4e9]"
                      />

                      <div className="my-7 h-px bg-[#d4e8f2]" />

                      <textarea
                        value={content}
                        onChange={(e) =>
                          setContent(
                            e.target.value
                          )
                        }
                        placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                        className="min-h-[300px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                      />

                      {/* PHOTO UPLOAD */}
                      {selectedMemory && (
                        <div className="mt-8">

                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[#554b47]">
                              사진
                            </p>

                            <label className="cursor-pointer rounded-xl bg-[#dff2fb] px-4 py-2 text-xs font-semibold text-[#456572] hover:bg-[#ccebf7]">
                              {uploadingPhoto
                                ? "업로드 중..."
                                : "+ 사진 추가"}

                              <input
                                key={
                                  photoInputKey
                                }
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                disabled={
                                  uploadingPhoto
                                }
                                onChange={(
                                  e
                                ) => {
                                  if (
                                    e.target
                                      .files
                                  ) {
                                    uploadPhotos(
                                      e.target
                                        .files
                                    );
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {photos.length >
                            0 && (
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {photos.map(
                                (photo) => (
                                  <div
                                    key={
                                      photo.id
                                    }
                                    className="group relative overflow-hidden rounded-2xl bg-[#f4f9fb]"
                                  >
                                    <img
                                      src={
                                        photo.url
                                      }
                                      alt={
                                        photo.file_name
                                      }
                                      className="aspect-square w-full object-cover"
                                    />

                                    <button
                                      onClick={() =>
                                        deletePhoto(
                                          photo
                                        )
                                      }
                                      className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {photos.length ===
                            0 && (
                            <div className="rounded-2xl border border-dashed border-[#cfe4ed] px-4 py-8 text-center text-xs text-[#9eb0b9]">
                              아직 사진이 없어요.
                              <br />
                              위의 사진 추가 버튼으로
                              사진을 넣어보세요.
                            </div>
                          )}

                        </div>
                      )}

                      <div className="mt-8 flex items-center justify-between border-t border-[#d4e8f2] pt-5">
                        <p className="text-xs text-[#9eb0b9]">
                          {selectedPart.name}
                        </p>

                        <button
                          onClick={
                            saveMemory
                          }
                          disabled={saving}
                          className="rounded-xl bg-[#dff2fb] px-6 py-3 text-sm font-semibold text-[#456572] transition hover:bg-[#ccebf7] disabled:opacity-50"
                        >
                          {saving
                            ? "저장 중..."
                            : "저장"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* READ ONLY VIEW */}
                      <h2 className="text-4xl font-bold tracking-tight text-[#3d3532]">
                        {selectedMemory?.title}
                      </h2>

                      <div className="my-7 h-px bg-[#d4e8f2]" />

                      <div className="whitespace-pre-wrap text-[15px] leading-8 text-[#554b47]">
                        {selectedMemory?.content ||
                          "내용 없음"}
                      </div>

                      {/* PHOTOS */}
                      {photos.length >
                        0 && (
                        <div className="mt-10">

                          <p className="mb-4 text-sm font-semibold text-[#554b47]">
                            사진
                          </p>

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {photos.map(
                              (photo) => (
                                <a
                                  key={
                                    photo.id
                                  }
                                  href={
                                    photo.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block overflow-hidden rounded-2xl bg-[#f4f9fb]"
                                >
                                  <img
                                    src={
                                      photo.url
                                    }
                                    alt={
                                      photo.file_name
                                    }
                                    className="aspect-square w-full object-cover transition hover:scale-[1.02]"
                                  />
                                </a>
                              )
                            )}
                          </div>

                        </div>
                      )}

                      <div className="mt-10 border-t border-[#d4e8f2] pt-5">
                        <p className="text-xs text-[#9eb0b9]">
                          {selectedPart.name}
                        </p>
                      </div>
                    </>
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
                    {selectedPart.name}
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

        {/* MOBILE */}
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
              {parts.map((part) => (
                <button
                  key={part.id}
                  onClick={() =>
                    selectPart(part)
                  }
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm ${
                    selectedPart?.id ===
                    part.id
                      ? "bg-[#dff2fb] font-semibold text-[#456572]"
                      : "bg-[#f4f9fb] text-[#766b67]"
                  }`}
                >
                  📁 {part.name}
                </button>
              ))}
            </div>
          </div>

          {selectedPart && (
            <>
              {!isCreating &&
                !selectedMemory && (
                  <div className="mt-3 rounded-2xl bg-white/90 p-4 shadow-sm">

                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-bold">
                        {selectedPart.name}
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
                          아직 메모가 없어요.
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
                          (memory) => (
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
                                {memory.title}
                              </p>

                              <p className="mt-1 line-clamp-2 text-xs text-[#8b9fa9]">
                                {memory.content ||
                                  "내용 없음"}
                              </p>

                              <p className="mt-2 text-[10px] text-[#9eb0b9]">
                                {getAuthorName(
                                  memory.created_by
                                )}{" "}
                                ·{" "}
                                {formatDate(
                                  memory.updated_at
                                )}
                              </p>
                            </button>
                          )
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
                        {selectedMemory
                          ? isEditing
                            ? "EDIT MEMORY"
                            : "VIEW MEMORY"
                          : "NEW MEMORY"}
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {selectedMemory
                          ? isEditing
                            ? "메모 수정"
                            : "메모"
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

                  {isEditing ||
                  isCreating ? (
                    <>
                      <input
                        autoFocus
                        value={title}
                        onChange={(e) =>
                          setTitle(
                            e.target.value
                          )
                        }
                        placeholder="제목을 입력해주세요"
                        className="w-full border-0 bg-transparent text-2xl font-bold text-[#3d3532] outline-none placeholder:text-[#c7d5db]"
                      />

                      <div className="my-4 h-px bg-[#d4e8f2]" />

                      <textarea
                        value={content}
                        onChange={(e) =>
                          setContent(
                            e.target.value
                          )
                        }
                        placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                        className="min-h-[300px] w-full resize-none border-0 bg-transparent text-sm leading-7 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                      />

                      {selectedMemory && (
                        <div className="mt-6">

                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[#554b47]">
                              사진
                            </p>

                            <label className="cursor-pointer rounded-lg bg-[#dff2fb] px-3 py-2 text-xs font-semibold text-[#456572]">
                              {uploadingPhoto
                                ? "업로드 중..."
                                : "+ 사진 추가"}

                              <input
                                key={
                                  photoInputKey
                                }
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                disabled={
                                  uploadingPhoto
                                }
                                onChange={(
                                  e
                                ) => {
                                  if (
                                    e.target
                                      .files
                                  ) {
                                    uploadPhotos(
                                      e.target
                                        .files
                                    );
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {photos.length >
                            0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {photos.map(
                                (photo) => (
                                  <div
                                    key={
                                      photo.id
                                    }
                                    className="relative overflow-hidden rounded-xl"
                                  >
                                    <img
                                      src={
                                        photo.url
                                      }
                                      alt={
                                        photo.file_name
                                      }
                                      className="aspect-square w-full object-cover"
                                    />

                                    <button
                                      onClick={() =>
                                        deletePhoto(
                                          photo
                                        )
                                      }
                                      className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                        </div>
                      )}

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
                          disabled={saving}
                          className="flex-1 rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572] disabled:opacity-50"
                        >
                          {saving
                            ? "저장 중..."
                            : "저장"}
                        </button>

                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-[#3d3532]">
                        {selectedMemory?.title}
                      </h2>

                      <div className="my-4 h-px bg-[#d4e8f2]" />

                      <div className="whitespace-pre-wrap text-sm leading-7 text-[#554b47]">
                        {selectedMemory?.content ||
                          "내용 없음"}
                      </div>

                      {photos.length >
                        0 && (
                        <div className="mt-7">

                          <p className="mb-3 text-sm font-semibold">
                            사진
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {photos.map(
                              (photo) => (
                                <a
                                  key={
                                    photo.id
                                  }
                                  href={
                                    photo.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="overflow-hidden rounded-xl"
                                >
                                  <img
                                    src={
                                      photo.url
                                    }
                                    alt={
                                      photo.file_name
                                    }
                                    className="aspect-square w-full object-cover"
                                  />
                                </a>
                              )
                            )}
                          </div>

                        </div>
                      )}

                      <div className="mt-6 flex gap-2 border-t border-[#d4e8f2] pt-5">

                        <button
                          onClick={
                            startEditing
                          }
                          className="flex-1 rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572]"
                        >
                          수정
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

      {/* PART MODAL */}
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
                  setShowPartModal(false)
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
                  e.key === "Enter"
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
                  setShowPartModal(false)
                }
                className="flex-1 rounded-xl bg-[#f1f6f8] py-3 text-sm font-semibold text-[#78909a]"
              >
                취소
              </button>

              <button
                onClick={savePart}
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

