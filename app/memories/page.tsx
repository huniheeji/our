"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
  photo_urls: string[] | null;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const PART_COLORS = [
  {
    bg: "bg-[#eaf6ff]",
    border: "border-[#cfeaff]",
    active: "bg-[#d9efff]",
    text: "text-[#5d87a3]",
  },
  {
    bg: "bg-[#eef9f4]",
    border: "border-[#d2eee1]",
    active: "bg-[#dcf2e8]",
    text: "text-[#5d8b78]",
  },
  {
    bg: "bg-[#fff5ec]",
    border: "border-[#f7dfc8]",
    active: "bg-[#ffead5]",
    text: "text-[#9b7654]",
  },
  {
    bg: "bg-[#f4f0ff]",
    border: "border-[#e2d9fa]",
    active: "bg-[#e9e0ff]",
    text: "text-[#77649e]",
  },
  {
    bg: "bg-[#fff0f4]",
    border: "border-[#f7d8e1]",
    active: "bg-[#ffe1e9]",
    text: "text-[#a56d7d]",
  },
];

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

  const [showEditor, setShowEditor] =
    useState(false);

  const [photos, setPhotos] = useState<string[]>([]);

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

    const nextMemories = (data || []) as Memory[];

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
      setPhotos(updated.photo_urls || []);

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

  function getPartColor(index: number) {
    return PART_COLORS[index % PART_COLORS.length];
  }

  function getPartIndex(partId: string) {
    return Math.max(
      0,
      parts.findIndex(
        (part) => part.id === partId
      )
    );
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
    setTitle("");
    setContent("");
    setPhotos([]);
    setShowEditor(false);
  }

  function selectMemory(memory: Memory) {
    setSelectedMemory(memory);
    setTitle(memory.title);
    setContent(memory.content);
    setPhotos(memory.photo_urls || []);
    setShowEditor(true);
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
    setPhotos([]);
    setShowEditor(true);
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
      setShowEditor(false);
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

    const confirmed = window.confirm(
      partMemories.length > 0
        ? `"${editingPart.name}" 파트와 안에 있는 ${partMemories.length}개의 메모를 모두 삭제할까요?`
        : `"${editingPart.name}" 파트를 삭제할까요?`
    );

    if (!confirmed) {
      return;
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
    setTitle("");
    setContent("");
    setPhotos([]);
    setShowEditor(false);

    await loadData();
  }

  async function uploadPhotos(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);

    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const extension =
          file.name.split(".").pop() ||
          "jpg";

        const fileName =
          `${crypto.randomUUID()}.${extension}`;

        const filePath =
          `${myUserId}/${fileName}`;

        const { error } =
          await supabase.storage
            .from("memory-photos")
            .upload(
              filePath,
              file,
              {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type,
              }
            );

        if (error) {
          throw error;
        }

        const { data } =
          supabase.storage
            .from("memory-photos")
            .getPublicUrl(
              filePath
            );

        uploadedUrls.push(
          data.publicUrl
        );
      }

      setPhotos((current) => [
        ...current,
        ...uploadedUrls,
      ]);
    } catch (error) {
      console.error(
        "사진 업로드 오류:",
        error
      );

      alert(
        "사진 업로드에 실패했습니다."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) =>
      current.filter(
        (_, i) => i !== index
      )
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
      if (selectedMemory) {
        const { error } =
          await supabase
            .from("memories")
            .update({
              title: title.trim(),
              content,
              part_id:
                selectedPart.id,
              photo_urls: photos,
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
              photo_urls: photos,
            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        if (data) {
          setSelectedMemory(
            data as Memory
          );
        }
      }

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

  async function deleteMemory() {
    if (!selectedMemory) {
      return;
    }

    const confirmed =
      window.confirm(
        "이 메모를 삭제할까요?"
      );

    if (!confirmed) {
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
    setTitle("");
    setContent("");
    setPhotos([]);
    setShowEditor(false);

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

  const selectedPartMemories =
    useMemo(
      () =>
        selectedPart
          ? getPartMemories(
              selectedPart.id
            )
          : [],
      [selectedPart, memories]
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#edf8ff] text-[#7894a5]">
        Memories를 불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf8ff] text-[#3d4d56]">
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 md:px-8 md:py-7">

        {/* HEADER */}
        <header className="mb-5 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="mb-3 text-sm font-medium text-[#8aa5b4] hover:text-[#587c90]"
            >
              ← Home
            </button>

            <h1 className="text-3xl font-bold tracking-tight text-[#405762]">
              Memories
            </h1>

            <p className="mt-1 text-sm text-[#88a1ae]">
              우리의 이야기를 차곡차곡 기록해요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#d6edf8] bg-white/80 px-4 py-2 text-sm text-[#7893a1] shadow-sm md:block">
              {myName}
            </span>

            <button
              onClick={createNewMemory}
              className="rounded-xl bg-[#8fc8e8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#78b9dc]"
            >
              + 새 메모
            </button>
          </div>
        </header>

        {/* DESKTOP */}
        <div className="hidden min-h-[720px] overflow-hidden rounded-3xl border border-[#d9edf7] bg-white/70 shadow-[0_10px_40px_rgba(91,153,184,0.08)] md:flex">

          {/* PARTS */}
          <aside className="w-56 shrink-0 border-r border-[#dceff7] bg-[#f6fbfe]">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#dceff7] px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-wide text-[#7895a4]">
                      PARTS
                    </p>

                    <p className="mt-1 text-xs text-[#9eb3bd]">
                      {parts.length}개의 파트
                    </p>
                  </div>

                  <button
                    onClick={openNewPartModal}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dff2fc] text-lg font-medium text-[#6292aa] hover:bg-[#cfeafa]"
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

                    <p className="mt-3 text-xs leading-5 text-[#91a7b1]">
                      아직 파트가 없어요.
                      <br />
                      파트를 만들어보세요.
                    </p>

                    <button
                      onClick={openNewPartModal}
                      className="mt-4 rounded-lg bg-[#dff2fc] px-3 py-2 text-xs font-semibold text-[#638da2]"
                    >
                      + 파트 만들기
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {parts.map(
                      (part, index) => {
                        const count =
                          getPartMemories(
                            part.id
                          ).length;

                        const active =
                          selectedPart?.id ===
                          part.id;

                        const color =
                          getPartColor(
                            index
                          );

                        return (
                          <div
                            key={part.id}
                            className={`group flex items-center rounded-2xl border transition ${
                              active
                                ? `${color.active} ${color.border}`
                                : `${color.bg} ${color.border}`
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
                                <span className="text-base">
                                  📁
                                </span>

                                <span
                                  className={`truncate text-sm font-semibold ${
                                    active
                                      ? color.text
                                      : "text-[#667983]"
                                  }`}
                                >
                                  {part.name}
                                </span>
                              </div>

                              <p className="mt-1 pl-6 text-[11px] text-[#91a5af]">
                                {count}개
                              </p>
                            </button>

                            <button
                              onClick={() =>
                                openEditPartModal(
                                  part
                                )
                              }
                              className="mr-2 hidden h-7 w-7 items-center justify-center rounded-lg text-xs text-[#8da2ac] hover:bg-white/70 group-hover:flex"
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

              <div className="border-t border-[#dceff7] p-4">
                <button
                  onClick={openNewPartModal}
                  className="w-full rounded-xl border border-dashed border-[#c8e4f1] bg-white/60 py-2.5 text-xs font-semibold text-[#7898a8] hover:bg-white"
                >
                  + 새 파트
                </button>
              </div>
            </div>
          </aside>

          {/* MEMORY LIST */}
          <aside className="w-72 shrink-0 border-r border-[#dceff7] bg-white/75">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#dceff7] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#91a5af]">
                      SELECTED PART
                    </p>

                    <h2 className="mt-1 truncate text-lg font-bold text-[#4d626c]">
                      {selectedPart
                        ? selectedPart.name
                        : "파트를 선택해주세요"}
                    </h2>
                  </div>

                  <button
                    onClick={createNewMemory}
                    disabled={!selectedPart}
                    className="shrink-0 rounded-xl bg-[#dff2fc] px-3 py-2 text-xs font-semibold text-[#638da2] disabled:opacity-40"
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

                      <p className="mt-3 text-sm text-[#94a8b2]">
                        왼쪽에서 파트를
                        <br />
                        선택해주세요.
                      </p>
                    </div>
                  </div>
                ) : selectedPartMemories.length === 0 ? (
                  <div className="flex h-full min-h-[400px] items-center justify-center text-center">
                    <div>
                      <div className="text-4xl">
                        📝
                      </div>

                      <p className="mt-3 text-sm text-[#94a8b2]">
                        아직 메모가 없어요.
                      </p>

                      <button
                        onClick={createNewMemory}
                        className="mt-4 rounded-xl bg-[#dff2fc] px-4 py-2 text-xs font-semibold text-[#638da2]"
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
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              active
                                ? "border-[#c9e7f5] bg-[#eaf7fd]"
                                : "border-transparent bg-[#f8fcfe] hover:border-[#dceef6] hover:bg-[#f0f9fd]"
                            }`}
                          >
                            <p className="truncate text-sm font-semibold text-[#50636c]">
                              {memory.title}
                            </p>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8fa1aa]">
                              {memory.content ||
                                "내용 없음"}
                            </p>

                            {memory.photo_urls &&
                              memory.photo_urls.length >
                                0 && (
                                <p className="mt-2 text-xs text-[#75a5bd]">
                                  📷{" "}
                                  {
                                    memory
                                      .photo_urls
                                      .length
                                  }
                                  장
                                </p>
                              )}

                            <div className="mt-3 flex items-center justify-between text-[10px] text-[#a1b2ba]">
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

          {/* EDITOR */}
          <section className="min-w-0 flex-1 bg-white/85">
            {!selectedPart ? (
              <div className="flex h-full min-h-[650px] items-center justify-center text-center">
                <div>
                  <div className="text-6xl">
                    📚
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-[#50636c]">
                    우리의 기억을
                    정리해보세요.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#91a5af]">
                    왼쪽에서 파트를 선택하면
                    <br />
                    그 안의 메모를 볼 수 있어요.
                  </p>
                </div>
              </div>
            ) : !showEditor ? (
              <div className="flex h-full min-h-[650px] items-center justify-center text-center">
                <div>
                  <div className="text-5xl">
                    📝
                  </div>

                  <h2 className="mt-5 text-lg font-bold text-[#50636c]">
                    {selectedPart.name}
                  </h2>

                  <p className="mt-2 text-sm text-[#91a5af]">
                    이 파트에 새로운
                    <br />
                    기억을 남겨보세요.
                  </p>

                  <button
                    onClick={createNewMemory}
                    className="mt-5 rounded-xl bg-[#8fc8e8] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#78b9dc]"
                  >
                    + 새 메모 작성
                  </button>
                </div>
              </div>
            ) : (
              <EditorContent
                selectedPart={selectedPart}
                selectedMemory={selectedMemory}
                title={title}
                content={content}
                photos={photos}
                myName={myName}
                saving={saving}
                uploading={uploading}
                setTitle={setTitle}
                setContent={setContent}
                saveMemory={saveMemory}
                deleteMemory={deleteMemory}
                uploadPhotos={uploadPhotos}
                removePhoto={removePhoto}
                formatDate={formatDate}
                getAuthorName={getAuthorName}
              />
            )}
          </section>
        </div>

        {/* MOBILE */}
        <div className="md:hidden">
          <div className="rounded-3xl border border-[#d8edf7] bg-white/80 p-4 shadow-sm">

            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-wide text-[#7895a4]">
                  PARTS
                </p>

                <p className="mt-1 text-xs text-[#9eb1ba]">
                  {parts.length}개의 파트
                </p>
              </div>

              <button
                onClick={openNewPartModal}
                className="rounded-xl bg-[#dff2fc] px-3 py-2 text-xs font-semibold text-[#638da2]"
              >
                + 파트
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {parts.map(
                (part, index) => {
                  const color =
                    getPartColor(
                      index
                    );

                  const active =
                    selectedPart?.id ===
                    part.id;

                  return (
                    <button
                      key={part.id}
                      onClick={() =>
                        selectPart(
                          part
                        )
                      }
                      className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm transition ${
                        active
                          ? `${color.active} ${color.border} font-semibold ${color.text}`
                          : `${color.bg} ${color.border} text-[#687b84]`
                      }`}
                    >
                      📁 {part.name}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {selectedPart && !showEditor && (
            <div className="mt-3 rounded-3xl border border-[#d8edf7] bg-white/80 p-4 shadow-sm">

              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#91a5af]">
                    SELECTED PART
                  </p>

                  <h2 className="mt-1 font-bold text-[#50636c]">
                    {selectedPart.name}
                  </h2>
                </div>

                <button
                  onClick={createNewMemory}
                  className="rounded-xl bg-[#8fc8e8] px-3 py-2 text-xs font-semibold text-white"
                >
                  + 메모
                </button>
              </div>

              <div className="space-y-2">
                {selectedPartMemories.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-4xl">
                      📝
                    </div>

                    <p className="mt-3 text-sm text-[#94a8b2]">
                      아직 메모가 없어요.
                    </p>

                    <button
                      onClick={createNewMemory}
                      className="mt-4 rounded-xl bg-[#dff2fc] px-4 py-2 text-xs font-semibold text-[#638da2]"
                    >
                      첫 메모 작성
                    </button>
                  </div>
                ) : (
                  selectedPartMemories.map(
                    (memory) => (
                      <button
                        key={memory.id}
                        onClick={() =>
                          selectMemory(
                            memory
                          )
                        }
                        className="w-full rounded-2xl border border-[#e0eff6] bg-[#f8fcfe] p-4 text-left"
                      >
                        <p className="font-semibold text-[#50636c]">
                          {memory.title}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#8fa1aa]">
                          {memory.content ||
                            "내용 없음"}
                        </p>

                        {memory.photo_urls &&
                          memory.photo_urls.length >
                            0 && (
                            <p className="mt-2 text-xs text-[#75a5bd]">
                              📷{" "}
                              {
                                memory
                                  .photo_urls
                                  .length
                              }
                              장
                            </p>
                          )}
                      </button>
                    )
                  )
                )}
              </div>
            </div>
          )}

          {selectedPart && showEditor && (
            <div className="mt-3">
              <EditorContent
                selectedPart={selectedPart}
                selectedMemory={selectedMemory}
                title={title}
                content={content}
                photos={photos}
                myName={myName}
                saving={saving}
                uploading={uploading}
                setTitle={setTitle}
                setContent={setContent}
                saveMemory={saveMemory}
                deleteMemory={deleteMemory}
                uploadPhotos={uploadPhotos}
                removePhoto={removePhoto}
                formatDate={formatDate}
                getAuthorName={getAuthorName}
                mobile
                onBack={() => {
                  setShowEditor(false);
                  setSelectedMemory(null);
                  setTitle("");
                  setContent("");
                  setPhotos([]);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* PART MODAL */}
      {showPartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#496879]/30 p-5 backdrop-blur-sm"
          onClick={() =>
            setShowPartModal(false)
          }
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[#d9edf7] bg-white p-6 shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#91a5af]">
                  {editingPart
                    ? "EDIT PART"
                    : "NEW PART"}
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#50636c]">
                  {editingPart
                    ? "파트 수정"
                    : "새 파트 만들기"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setShowPartModal(false)
                }
                className="text-xl text-[#91a5af]"
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
              className="w-full rounded-xl border border-[#dceef6] bg-[#f4fbfe] px-4 py-3 text-[#50636c] outline-none focus:border-[#9dcde4] focus:ring-2 focus:ring-[#e4f4fb]"
            />

            <div className="mt-5 flex gap-3">
              {editingPart && (
                <button
                  onClick={deletePart}
                  className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm font-semibold text-red-400"
                >
                  삭제
                </button>
              )}

              <button
                onClick={() =>
                  setShowPartModal(false)
                }
                className="flex-1 rounded-xl bg-[#eef6f9] py-3 text-sm font-semibold text-[#78909b]"
              >
                취소
              </button>

              <button
                onClick={savePart}
                className="flex-1 rounded-xl bg-[#8fc8e8] py-3 text-sm font-semibold text-white"
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

type EditorContentProps = {
  selectedPart: MemoryPart;
  selectedMemory: Memory | null;
  title: string;
  content: string;
  photos: string[];
  myName: string;
  saving: boolean;
  uploading: boolean;
  setTitle: (value: string) => void;
  setContent: (value: string) => void;
  saveMemory: () => void;
  deleteMemory: () => void;
  uploadPhotos: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  removePhoto: (index: number) => void;
  formatDate: (value: string) => string;
  getAuthorName: (
    userId: string | null
  ) => string;
  mobile?: boolean;
  onBack?: () => void;
};

function EditorContent({
  selectedPart,
  selectedMemory,
  title,
  content,
  photos,
  myName,
  saving,
  uploading,
  setTitle,
  setContent,
  saveMemory,
  deleteMemory,
  uploadPhotos,
  removePhoto,
  formatDate,
  getAuthorName,
  mobile = false,
  onBack,
}: EditorContentProps) {
  return (
    <div
      className={`flex flex-col rounded-3xl border border-[#d9edf7] bg-white/90 ${
        mobile
          ? "min-h-[650px]"
          : "h-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#e0eff6] px-5 py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-2 text-xs text-[#91a5af]">
          {mobile && onBack && (
            <button
              onClick={onBack}
              className="mr-2 rounded-lg bg-[#eef8fc] px-2 py-1.5 text-[#7297a8]"
            >
              ←
            </button>
          )}

          <span>📁</span>

          <span className="truncate">
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
            onClick={deleteMemory}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-[#fff1f1]"
          >
            삭제
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-8 md:px-10 md:py-10 lg:px-14">

        <div className="mb-2 text-xs text-[#a1b2ba]">
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
          onChange={(e) =>
            setTitle(
              e.target.value
            )
          }
          placeholder="제목 없음"
          className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-[#465b65] outline-none placeholder:text-[#c9d8df] md:text-4xl"
        />

        <div className="my-6 h-px bg-[#e1eff5]" />

        <textarea
          value={content}
          onChange={(e) =>
            setContent(
              e.target.value
            )
          }
          placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
          className="min-h-[260px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#5b6d75] outline-none placeholder:text-[#b8c8cf] md:min-h-[400px]"
        />

        {/* PHOTO */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#60757f]">
                📷 사진
              </p>

              <p className="mt-1 text-xs text-[#9aadb5]">
                이 기억과 함께 남기고 싶은 사진을
                추가해보세요.
              </p>
            </div>

            <label className="cursor-pointer rounded-xl bg-[#e3f4fb] px-3 py-2 text-xs font-semibold text-[#6491a5] hover:bg-[#d6eef8]">
              {uploading
                ? "업로드 중..."
                : "+ 사진 추가"}

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={
                  uploadPhotos
                }
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map(
                (url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="group relative overflow-hidden rounded-2xl border border-[#dceef5] bg-[#f4fbfe]"
                  >
                    <img
                      src={url}
                      alt={`메모 사진 ${
                        index + 1
                      }`}
                      className="aspect-square w-full object-cover"
                    />

                    <button
                      onClick={() =>
                        removePhoto(
                          index
                        )
                      }
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-sm text-white opacity-100"
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[#e1eff5] pt-5">
          <p className="text-xs text-[#9aadb5]">
            {selectedPart.name}
          </p>

          <button
            onClick={saveMemory}
            disabled={
              saving || uploading
            }
            className="rounded-xl bg-[#8fc8e8] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#78b9dc] disabled:opacity-50"
          >
            {saving
              ? "저장 중..."
              : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
