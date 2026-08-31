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
  photo_urls?: string[] | null;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const MEMORY_PHOTO_BUCKET = "memory-photos";

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
  const [uploading, setUploading] = useState(false);

  const [showPartModal, setShowPartModal] =
    useState(false);

  const [photoUrls, setPhotoUrls] =
    useState<string[]>([]);

  const [newPhotoFiles, setNewPhotoFiles] =
    useState<File[]>([]);

  const [photoPreviews, setPhotoPreviews] =
    useState<string[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null =
      null;

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

      await loadData();

      if (!mounted) {
        return;
      }

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
      if (!current) {
        return null;
      }

      const updated = nextMemories.find(
        (memory) => memory.id === current.id
      );

      if (!updated) {
        return null;
      }

      setTitle(updated.title);
      setContent(updated.content);
      setPhotoUrls(
        Array.isArray(updated.photo_urls)
          ? updated.photo_urls
          : []
      );

      return updated;
    });
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

  function selectPart(
    part: MemoryPart
  ) {
    setSelectedPart(part);
    setSelectedMemory(null);
    setTitle("");
    setContent("");
    setPhotoUrls([]);
    setNewPhotoFiles([]);
    setPhotoPreviews([]);
  }

  function selectMemory(
    memory: Memory
  ) {
    setSelectedMemory(memory);
    setTitle(memory.title);
    setContent(memory.content);

    setPhotoUrls(
      Array.isArray(memory.photo_urls)
        ? memory.photo_urls
        : []
    );

    setNewPhotoFiles([]);
    setPhotoPreviews([]);
  }

  function createNewMemory() {
    if (!selectedPart) {
      alert(
        "먼저 메모를 넣을 파트를 선택해주세요."
      );
      return;
    }

    setSelectedMemory(null);
    setTitle("");
    setContent("");
    setPhotoUrls([]);
    setNewPhotoFiles([]);
    setPhotoPreviews([]);
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
    }
  }

  async function deletePart() {
    if (!editingPart) {
      return;
    }

    const partMemories =
      getPartMemories(
        editingPart.id
      );

    const message =
      partMemories.length > 0
        ? `"${editingPart.name}" 파트와 안에 있는 ${partMemories.length}개의 메모를 모두 삭제할까요?`
        : `"${editingPart.name}" 파트를 삭제할까요?`;

    if (!window.confirm(message)) {
      return;
    }

    if (partMemories.length > 0) {
      const { error: memoryError } =
        await supabase
          .from("memories")
          .delete()
          .eq(
            "part_id",
            editingPart.id
          );

      if (memoryError) {
        alert(
          "메모 삭제 실패: " +
            memoryError.message
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
    setTitle("");
    setContent("");
    setPhotoUrls([]);
    setNewPhotoFiles([]);
    setPhotoPreviews([]);

    await loadData();
  }

  function handlePhotoSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter(
      (file) =>
        file.type.startsWith("image/")
    );

    if (
      imageFiles.length !==
      files.length
    ) {
      alert(
        "사진 파일만 첨부할 수 있습니다."
      );
    }

    const totalCount =
      photoUrls.length +
      newPhotoFiles.length +
      imageFiles.length;

    if (totalCount > 10) {
      alert(
        "메모 하나당 최대 10장까지 첨부할 수 있습니다."
      );
      return;
    }

    const previews =
      imageFiles.map((file) =>
        URL.createObjectURL(file)
      );

    setNewPhotoFiles((current) => [
      ...current,
      ...imageFiles,
    ]);

    setPhotoPreviews((current) => [
      ...current,
      ...previews,
    ]);

    event.target.value = "";
  }

  function removeNewPhoto(
    index: number
  ) {
    setNewPhotoFiles((current) =>
      current.filter(
        (_, i) => i !== index
      )
    );

    setPhotoPreviews((current) =>
      current.filter(
        (_, i) => i !== index
      )
    );
  }

  async function uploadPhotos(
    memoryId: string
  ) {
    if (newPhotoFiles.length === 0) {
      return [];
    }

    setUploading(true);

    const uploadedUrls: string[] = [];

    try {
      for (
        let i = 0;
        i < newPhotoFiles.length;
        i++
      ) {
        const file =
          newPhotoFiles[i];

        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase() || "jpg";

        const filePath =
          `${myUserId}/${memoryId}/${Date.now()}-${i}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from(
              MEMORY_PHOTO_BUCKET
            )
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
          throw uploadError;
        }

        uploadedUrls.push(filePath);
      }

      return uploadedUrls;
    } finally {
      setUploading(false);
    }
  }

  async function getSignedPhotoUrl(
    path: string
  ) {
    const { data, error } =
      await supabase.storage
        .from(
          MEMORY_PHOTO_BUCKET
        )
        .createSignedUrl(
          path,
          60 * 60
        );

    if (error) {
      console.error(
        "사진 URL 생성 오류:",
        error
      );
      return null;
    }

    return data.signedUrl;
  }

  async function getPhotoDisplayUrls(
    paths: string[]
  ) {
    const urls =
      await Promise.all(
        paths.map((path) =>
          getSignedPhotoUrl(path)
        )
      );

    return urls.filter(
      (url): url is string =>
        Boolean(url)
    );
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
      let memoryId =
        selectedMemory?.id ||
        null;

      if (selectedMemory) {
        const { error } =
          await supabase
            .from("memories")
            .update({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              photo_urls:
                photoUrls,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              selectedMemory.id
            );

        if (error) {
          throw error;
        }
      } else {
        const { data, error } =
          await supabase
            .from("memories")
            .insert({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              created_by:
                myUserId,
              photo_urls: [],
            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        if (data) {
          memoryId = data.id;
          setSelectedMemory(data);
        }
      }

      if (!memoryId) {
        throw new Error(
          "메모 ID를 가져오지 못했습니다."
        );
      }

      if (newPhotoFiles.length > 0) {
        const uploaded =
          await uploadPhotos(
            memoryId
          );

        const allPhotoPaths = [
          ...photoUrls,
          ...uploaded,
        ];

        const { error } =
          await supabase
            .from("memories")
            .update({
              photo_urls:
                allPhotoPaths,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              memoryId
            );

        if (error) {
          throw error;
        }

        setPhotoUrls(
          allPhotoPaths
        );
      }

      setNewPhotoFiles([]);
      setPhotoPreviews([]);

      await loadMemories();

      alert("메모가 저장되었습니다.");
    } catch (error) {
      console.error(
        "메모 저장 오류:",
        error
      );

      alert(
        "메모 저장 실패: " +
          (error instanceof Error
            ? error.message
            : "알 수 없는 오류")
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExistingPhoto(
    path: string
  ) {
    if (
      !window.confirm(
        "이 사진을 삭제할까요?"
      )
    ) {
      return;
    }

    const { error: storageError } =
      await supabase.storage
        .from(
          MEMORY_PHOTO_BUCKET
        )
        .remove([path]);

    if (storageError) {
      alert(
        "사진 삭제 실패: " +
          storageError.message
      );
      return;
    }

    const nextPaths =
      photoUrls.filter(
        (photo) =>
          photo !== path
      );

    setPhotoUrls(nextPaths);

    if (selectedMemory) {
      const { error } =
        await supabase
          .from("memories")
          .update({
            photo_urls:
              nextPaths,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            selectedMemory.id
          );

      if (error) {
        alert(
          "메모 업데이트 실패: " +
            error.message
        );
        return;
      }

      await loadMemories();
    }
  }

  async function deleteMemory() {
    if (!selectedMemory) {
      return;
    }

    if (
      !window.confirm(
        "이 메모를 삭제할까요?"
      )
    ) {
      return;
    }

    const paths =
      Array.isArray(
        selectedMemory.photo_urls
      )
        ? selectedMemory.photo_urls
        : [];

    if (paths.length > 0) {
      await supabase.storage
        .from(
          MEMORY_PHOTO_BUCKET
        )
        .remove(paths);
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
    setTitle("");
    setContent("");
    setPhotoUrls([]);
    setNewPhotoFiles([]);
    setPhotoPreviews([]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#f4f9fc] text-[#71828d]">
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
    <main className="min-h-screen bg-[#f4f9fc] text-[#3d4b55]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 md:px-8">

        <header className="mb-5 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href =
                  "/";
              }}
              className="mb-3 text-sm text-[#87a4b5] hover:text-[#63899d]"
            >
              ← Home
            </button>

            <h1 className="text-3xl font-bold text-[#3d4b55]">
              Memories
            </h1>

            <p className="mt-1 text-sm text-[#91a5b1]">
              우리의 이야기를 차곡차곡 기록해요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white px-4 py-2 text-sm text-[#78909c] shadow-sm md:block">
              {myName}
            </span>

            <button
              onClick={
                createNewMemory
              }
              className="rounded-xl bg-[#dceef8] px-4 py-3 text-sm font-semibold text-[#4d7185] shadow-sm transition hover:bg-[#cfe7f4]"
            >
              + 새 메모
            </button>
          </div>
        </header>

        <div className="flex min-h-[720px] flex-1 overflow-hidden rounded-3xl bg-white shadow-sm">

          {/* 왼쪽 파트 */}
          <aside className="hidden w-56 shrink-0 border-r border-[#e1edf3] bg-[#f8fbfd] md:block">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#e1edf3] px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-wide text-[#87a0ae]">
                      PARTS
                    </p>

                    <p className="mt-1 text-xs text-[#a7b7c0]">
                      {parts.length}개의 파트
                    </p>
                  </div>

                  <button
                    onClick={
                      openNewPartModal
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4f2f9] text-lg text-[#5e8498] shadow-sm hover:bg-[#d6ebf5]"
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

                    <p className="mt-3 text-xs leading-5 text-[#91a5b1]">
                      아직 파트가 없어요.
                      <br />
                      파트를 만들어보세요.
                    </p>

                    <button
                      onClick={
                        openNewPartModal
                      }
                      className="mt-4 rounded-lg bg-[#e4f2f9] px-3 py-2 text-xs font-semibold text-[#587b8e]"
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
                            key={part.id}
                            className={`group flex items-center rounded-xl transition ${
                              active
                                ? "bg-[#e6f3fa]"
                                : "hover:bg-[#eef7fb]"
                            }`}
                          >
                            <button
                              onClick={() => {
                                selectPart(
                                  part
                                );
                              }}
                              className="min-w-0 flex-1 px-3 py-3 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  📁
                                </span>

                                <span
                                  className={`truncate text-sm font-semibold ${
                                    active
                                      ? "text-[#4b7185]"
                                      : "text-[#657984]"
                                  }`}
                                >
                                  {part.name}
                                </span>
                              </div>

                              <p className="mt-1 pl-6 text-[11px] text-[#a4b3bb]">
                                {count}개
                              </p>
                            </button>

                            <button
                              onClick={() => {
                                openEditPartModal(
                                  part
                                );
                              }}
                              className="mr-2 hidden h-7 w-7 items-center justify-center rounded-lg text-xs text-[#9badb6] hover:bg-white group-hover:flex"
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

              <div className="border-t border-[#e1edf3] p-4">
                <button
                  onClick={
                    openNewPartModal
                  }
                  className="w-full rounded-xl border border-dashed border-[#bcd4df] py-2.5 text-xs font-semibold text-[#7c98a6] hover:bg-[#eef7fb]"
                >
                  + 새 파트
                </button>
              </div>
            </div>
          </aside>

          {/* 가운데 메모 목록 */}
          <aside className="w-full shrink-0 border-r border-[#e1edf3] bg-white md:w-72">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#e1edf3] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#8ba1ae]">
                      SELECTED PART
                    </p>

                    <h2 className="mt-1 truncate text-lg font-bold text-[#42535d]">
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
                    className="shrink-0 rounded-xl bg-[#dceef8] px-3 py-2 text-xs font-semibold text-[#4d7185] disabled:opacity-40"
                  >
                    + 메모
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {!selectedPart ? (
                  <div className="flex h-full min-h-[400px] items-center justify-center text-center">
                    <div>
                      <div className="text-4xl">
                        📁
                      </div>

                      <p className="mt-3 text-sm text-[#91a5b1]">
                        왼쪽에서 파트를
                        <br />
                        선택해주세요.
                      </p>
                    </div>
                  </div>
                ) : selectedPartMemories.length ===
                  0 ? (
                  <div className="flex h-full min-h-[400px] items-center justify-center text-center">
                    <div>
                      <div className="text-4xl">
                        📝
                      </div>

                      <p className="mt-3 text-sm text-[#91a5b1]">
                        아직 메모가 없어요.
                      </p>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="mt-4 rounded-xl bg-[#dceef8] px-4 py-2 text-xs font-semibold text-[#4d7185]"
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

                        const hasPhotos =
                          Array.isArray(
                            memory.photo_urls
                          ) &&
                          memory.photo_urls.length >
                            0;

                        return (
                          <button
                            key={memory.id}
                            onClick={() => {
                              selectMemory(
                                memory
                              );
                            }}
                            className={`w-full rounded-2xl p-4 text-left transition ${
                              active
                                ? "bg-[#e9f5fa] shadow-sm"
                                : "bg-[#f8fbfd] hover:bg-[#eef7fb]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  active
                                    ? "text-[#426b80]"
                                    : "text-[#53656f]"
                                }`}
                              >
                                {memory.title}
                              </p>

                              {hasPhotos && (
                                <span className="shrink-0 text-xs">
                                  📷
                                </span>
                              )}
                            </div>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#91a2ab]">
                              {memory.content ||
                                "내용 없음"}
                            </p>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-[#a5b3ba]">
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

          {/* 오른쪽 에디터 */}
          <section className="hidden min-w-0 flex-1 md:block">
            {!selectedPart ? (
              <div className="flex h-full min-h-[650px] items-center justify-center text-center">
                <div>
                  <div className="text-6xl">
                    📚
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-[#42535d]">
                    우리의 기억을
                    정리해보세요.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#91a2ab]">
                    왼쪽에서 파트를 선택하면
                    <br />
                    그 안의 메모를 볼 수 있어요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">

                <div className="flex items-center justify-between border-b border-[#e1edf3] px-8 py-4">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-[#91a3ad]">
                    <span>📁</span>

                    <span>
                      {selectedPart.name}
                    </span>

                    {selectedMemory && (
                      <>
                        <span>›</span>

                        <span className="truncate">
                          {selectedMemory.title}
                        </span>
                      </>
                    )}
                  </div>

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

                {!selectedMemory &&
                !title &&
                !content &&
                photoUrls.length ===
                  0 ? (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <div>
                      <div className="text-5xl">
                        📝
                      </div>

                      <h2 className="mt-5 text-lg font-bold text-[#42535d]">
                        {selectedPart.name}
                      </h2>

                      <p className="mt-2 text-sm text-[#91a2ab]">
                        이 파트에 새로운
                        <br />
                        기억을 남겨보세요.
                      </p>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="mt-5 rounded-xl bg-[#dceef8] px-5 py-3 text-sm font-semibold text-[#4d7185]"
                      >
                        + 새 메모 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col overflow-y-auto px-8 py-10 lg:px-14">

                    <div className="mb-2 text-xs text-[#a0afb6]">
                      {selectedMemory
                        ? `${getAuthorName(
                            selectedMemory.created_by
                          )} · ${formatDate(
                            selectedMemory.updated_at
                          )}`
                        : `${myName} · 지금 작성`}
                    </div>

                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(
                          e.target.value
                        );
                      }}
                      placeholder="제목 없음"
                      className="w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-[#3d4b55] outline-none placeholder:text-[#ccd7dc]"
                    />

                    <div className="my-7 h-px bg-[#e1edf3]" />

                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(
                          e.target.value
                        );
                      }}
                      placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                      className="min-h-[300px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#53656f] outline-none placeholder:text-[#bdcbd2]"
                    />

                    {/* 사진 */}
                    <div className="mt-6">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#607985]">
                          📷 사진
                        </p>

                        <label className="cursor-pointer rounded-xl bg-[#e6f3fa] px-4 py-2 text-xs font-semibold text-[#56798c] transition hover:bg-[#d8edf6]">
                          + 사진 추가
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={
                              handlePhotoSelect
                            }
                            className="hidden"
                          />
                        </label>
                      </div>

                      {(photoUrls.length >
                        0 ||
                        photoPreviews.length >
                          0) && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {photoUrls.map(
                            (
                              path
                            ) => (
                              <PhotoCard
                                key={path}
                                path={
                                  path
                                }
                                onDelete={() =>
                                  deleteExistingPhoto(
                                    path
                                  )
                                }
                              />
                            )
                          )}

                          {photoPreviews.map(
                            (
                              preview,
                              index
                            ) => (
                              <div
                                key={
                                  preview
                                }
                                className="group relative aspect-square overflow-hidden rounded-2xl bg-[#edf5f8]"
                              >
                                <img
                                  src={
                                    preview
                                  }
                                  alt="새 사진"
                                  className="h-full w-full object-cover"
                                />

                                <button
                                  onClick={() =>
                                    removeNewPhoto(
                                      index
                                    )
                                  }
                                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-sm text-white"
                                >
                                  ×
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-[#e1edf3] pt-5">
                      <p className="text-xs text-[#9cabb2]">
                        {selectedPart.name}
                      </p>

                      <button
                        onClick={
                          saveMemory
                        }
                        disabled={
                          saving ||
                          uploading
                        }
                        className="rounded-xl bg-[#d4ebf5] px-6 py-3 text-sm font-semibold text-[#4d7185] transition hover:bg-[#c7e4f0] disabled:opacity-50"
                      >
                        {uploading
                          ? "사진 업로드 중..."
                          : saving
                          ? "저장 중..."
                          : "저장"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* 모바일 */}
        <div className="mt-4 md:hidden">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[#526771]">
                파트
              </p>

              <button
                onClick={
                  openNewPartModal
                }
                className="rounded-lg bg-[#e4f2f9] px-3 py-2 text-xs font-semibold text-[#56798c]"
              >
                + 파트
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {parts.map((part) => (
                <button
                  key={part.id}
                  onClick={() => {
                    selectPart(part);
                  }}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm ${
                    selectedPart?.id ===
                    part.id
                      ? "bg-[#dceef8] font-semibold text-[#4d7185]"
                      : "bg-[#f3f8fa] text-[#71828c]"
                  }`}
                >
                  📁 {part.name}
                </button>
              ))}
            </div>
          </div>

          {selectedPart && (
            <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-[#52636d]">
                  {selectedPart.name}
                </h2>

                <button
                  onClick={
                    createNewMemory
                  }
                  className="rounded-lg bg-[#dceef8] px-3 py-2 text-xs font-semibold text-[#4d7185]"
                >
                  + 메모
                </button>
              </div>

              <div className="space-y-2">
                {selectedPartMemories.map(
                  (memory) => (
                    <button
                      key={memory.id}
                      onClick={() => {
                        selectMemory(
                          memory
                        );
                      }}
                      className="w-full rounded-xl bg-[#f6fafc] p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[#52636d]">
                          {memory.title}
                        </p>

                        {Array.isArray(
                          memory.photo_urls
                        ) &&
                          memory.photo_urls
                            .length >
                            0 && (
                            <span>
                              📷
                            </span>
                          )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-[#91a2ab]">
                        {memory.content ||
                          "내용 없음"}
                      </p>
                    </button>
                  )
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7fbfd] p-4">
                <p className="mb-3 text-xs font-semibold text-[#718792]">
                  메모 작성
                </p>

                <input
                  value={title}
                  onChange={(e) =>
                    setTitle(
                      e.target.value
                    )
                  }
                  placeholder="제목"
                  className="w-full rounded-xl border border-[#dce9ef] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#a9cfdf]"
                />

                <textarea
                  value={content}
                  onChange={(e) =>
                    setContent(
                      e.target.value
                    )
                  }
                  placeholder="내용을 입력해주세요."
                  className="mt-3 min-h-[180px] w-full resize-none rounded-xl border border-[#dce9ef] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#a9cfdf]"
                />

                <div className="mt-4">
                  <label className="flex cursor-pointer items-center justify-center rounded-xl bg-[#e5f3f9] py-3 text-xs font-semibold text-[#58798b]">
                    📷 사진 추가
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={
                        handlePhotoSelect
                      }
                      className="hidden"
                    />
                  </label>
                </div>

                {(photoUrls.length >
                  0 ||
                  photoPreviews.length >
                    0) && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {photoUrls.map(
                      (path) => (
                        <PhotoCard
                          key={path}
                          path={path}
                          onDelete={() =>
                            deleteExistingPhoto(
                              path
                            )
                          }
                        />
                      )
                    )}

                    {photoPreviews.map(
                      (
                        preview,
                        index
                      ) => (
                        <div
                          key={
                            preview
                          }
                          className="relative aspect-square overflow-hidden rounded-xl"
                        >
                          <img
                            src={
                              preview
                            }
                            alt="새 사진"
                            className="h-full w-full object-cover"
                          />

                          <button
                            onClick={() =>
                              removeNewPhoto(
                                index
                              )
                            }
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <button
                  onClick={
                    saveMemory
                  }
                  disabled={
                    saving ||
                    uploading
                  }
                  className="mt-4 w-full rounded-xl bg-[#d4ebf5] py-3 text-sm font-semibold text-[#4d7185] disabled:opacity-50"
                >
                  {uploading
                    ? "사진 업로드 중..."
                    : saving
                    ? "저장 중..."
                    : "메모 저장"}
                </button>

                {selectedMemory && (
                  <button
                    onClick={
                      deleteMemory
                    }
                    className="mt-2 w-full rounded-xl bg-[#fff1f1] py-3 text-xs font-semibold text-red-400"
                  >
                    메모 삭제
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 파트 모달 */}
      {showPartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
          onClick={() => {
            setShowPartModal(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#8da1ac]">
                  {editingPart
                    ? "EDIT PART"
                    : "NEW PART"}
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#465862]">
                  {editingPart
                    ? "파트 수정"
                    : "새 파트 만들기"}
                </h2>
              </div>

              <button
                onClick={() => {
                  setShowPartModal(false);
                }}
                className="text-xl text-[#91a3ad]"
              >
                ×
              </button>
            </div>

            <input
              autoFocus
              value={partName}
              onChange={(e) => {
                setPartName(
                  e.target.value
                );
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  savePart();
                }
              }}
              placeholder="예: 여행, 데이트, 맛집"
              className="w-full rounded-xl bg-[#f3f8fa] px-4 py-3 outline-none focus:ring-2 focus:ring-[#d9edf5]"
            />

            <div className="mt-5 flex gap-3">
              {editingPart && (
                <button
                  onClick={
                    deletePart
                  }
                  className="rounded-xl bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-red-500"
                >
                  삭제
                </button>
              )}

              <button
                onClick={() => {
                  setShowPartModal(
                    false
                  );
                }}
                className="flex-1 rounded-xl bg-[#edf4f7] py-3 text-sm font-semibold text-[#72848e]"
              >
                취소
              </button>

              <button
                onClick={savePart}
                className="flex-1 rounded-xl bg-[#dceef8] py-3 text-sm font-semibold text-[#4d7185]"
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

function PhotoCard({
  path,
  onDelete,
}: {
  path: string;
  onDelete: () => void;
}) {
  const [url, setUrl] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let mounted = true;

    async function loadUrl() {
      const { data, error } =
        await supabase.storage
          .from("memory-photos")
          .createSignedUrl(
            path,
            60 * 60
          );

      if (
        !error &&
        data?.signedUrl &&
        mounted
      ) {
        setUrl(data.signedUrl);
      }
    }

    loadUrl();

    return () => {
      mounted = false;
    };
  }, [path]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-2xl bg-[#edf5f8]">
      {url ? (
        <img
          src={url}
          alt="메모 사진"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-[#9aaeb8]">
          사진 불러오는 중...
        </div>
      )}

      <button
        onClick={onDelete}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-sm text-white opacity-0 transition group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
