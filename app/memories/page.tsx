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

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

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

  const [showPartModal, setShowPartModal] =
    useState(false);

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
          async (payload) => {
            console.log(
              "🔥 Memories Realtime:",
              payload
            );

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
          async (payload) => {
            console.log(
              "🔥 Memory Parts Realtime:",
              payload
            );

            await loadParts();
          }
        )
        .subscribe((status) => {
          console.log(
            "🔥 Memories Realtime 상태:",
            status
          );
        });

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
      console.error(
        "파트 조회 오류:",
        error
      );
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
      console.error(
        "메모 조회 오류:",
        error
      );
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
  }

  function selectMemory(
    memory: Memory
  ) {
    setSelectedMemory(memory);
    setTitle(memory.title);
    setContent(memory.content);
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
        console.error(
          "파트 수정 오류:",
          error
        );

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
      console.error(
        "파트 생성 오류:",
        error
      );

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

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
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
        console.error(
          "파트 메모 삭제 오류:",
          memoryError
        );

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
      console.error(
        "파트 삭제 오류:",
        error
      );

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

    if (selectedMemory) {
      const { error } =
        await supabase
          .from("memories")
          .update({
            title: title.trim(),
            content: content,
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
        console.error(
          "메모 수정 오류:",
          error
        );

        alert(
          "메모 수정 실패: " +
            error.message
        );

        setSaving(false);
        return;
      }
    } else {
      const { data, error } =
        await supabase
          .from("memories")
          .insert({
            title: title.trim(),
            content: content,
            part_id:
              selectedPart.id,
            created_by: myUserId,
          })
          .select()
          .single();

      if (error) {
        console.error(
          "메모 저장 오류:",
          error
        );

        alert(
          "메모 저장 실패: " +
            error.message
        );

        setSaving(false);
        return;
      }

      if (data) {
        setSelectedMemory(data);
      }
    }

    await loadMemories();

    setSaving(false);
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
      console.error(
        "메모 삭제 오류:",
        error
      );

      alert(
        "메모 삭제 실패: " +
          error.message
      );

      return;
    }

    setSelectedMemory(null);
    setTitle("");
    setContent("");

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
      <main className="flex min-h-screen items-center justify-center bg-[#ffffff] text-[#766b67]">
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
    <main className="min-h-screen bg-[#ffffff] text-[#3d3532]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 md:px-8">

        <header className="mb-5 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                window.location.href =
                  "/";
              }}
              className="mb-3 text-sm text-[#a0948f]"
            >
              ← Home
            </button>

            <h1 className="text-3xl font-bold">
              Memories
            </h1>

            <p className="mt-1 text-sm text-[#9b8f8a]">
              우리의 이야기를 차곡차곡 기록해요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white px-4 py-2 text-sm text-[#8d807b] shadow-sm md:block">
              {myName}
            </span>

            <button
              onClick={
                createNewMemory
              }
              className="rounded-xl bg-[#ffffff] px-4 py-3 text-sm font-semibold text-[#3d3532] shadow-sm transition hover:opacity-90"
            >
              + 새 메모
            </button>
          </div>
        </header>

        <div className="flex min-h-[720px] flex-1 overflow-hidden rounded-3xl bg-white shadow-sm">

          {/* 왼쪽 파트 */}
          <aside className="hidden w-56 shrink-0 border-r border-[#dcecf6] bg-[#ffffff] md:block">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#dcecf6] px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-wide text-[#a0948f]">
                      PARTS
                    </p>

                    <p className="mt-1 text-xs text-[#b0a39e]">
                      {parts.length}개의 파트
                    </p>
                  </div>

                  <button
                    onClick={
                      openNewPartModal
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg text-[#3d3532] shadow-sm hover:bg-[#ffffff]"
                    title="새 파트"
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

                    <p className="mt-3 text-xs leading-5 text-[#a0948f]">
                      아직 파트가 없어요.
                      <br />
                      파트를 만들어보세요.
                    </p>

                    <button
                      onClick={
                        openNewPartModal
                      }
                      className="mt-4 rounded-lg bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#3d3532]"
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
                                ? "bg-[#ffffff]"
                                : "hover:bg-[#ffffff]"
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
                                      ? "text-[#3d3532]"
                                      : "text-[#665c58]"
                                  }`}
                                >
                                  {part.name}
                                </span>
                              </div>

                              <p className="mt-1 pl-6 text-[11px] text-[#b0a39e]">
                                {count}개
                              </p>
                            </button>

                            <button
                              onClick={() => {
                                openEditPartModal(
                                  part
                                );
                              }}
                              className="mr-2 hidden h-7 w-7 items-center justify-center rounded-lg text-xs text-[#b0a39e] hover:bg-white group-hover:flex"
                              title="파트 관리"
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

              <div className="border-t border-[#dcecf6] p-4">
                <button
                  onClick={
                    openNewPartModal
                  }
                  className="w-full rounded-xl border border-dashed border-[#d9ccc7] py-2.5 text-xs font-semibold text-[#9d8d87] hover:bg-white"
                >
                  + 새 파트
                </button>
              </div>
            </div>
          </aside>

          {/* 가운데 메모 목록 */}
          <aside className="w-full shrink-0 border-r border-[#dcecf6] md:w-72">
            <div className="flex h-full flex-col">

              <div className="border-b border-[#dcecf6] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#a0948f]">
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
                    className="shrink-0 rounded-xl bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#3d3532] disabled:opacity-40"
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

                      <p className="mt-3 text-sm text-[#a0948f]">
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

                      <p className="mt-3 text-sm text-[#a0948f]">
                        아직 메모가 없어요.
                      </p>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="mt-4 rounded-xl bg-[#ffffff] px-4 py-2 text-xs font-semibold text-[#3d3532]"
                      >
                        첫 메모 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selectedPartMemories.map(
                      (memory) => {
                        const active =
                          selectedMemory?.id ===
                          memory.id;

                        return (
                          <button
                            key={memory.id}
                            onClick={() => {
                              selectMemory(
                                memory
                              );
                            }}
                            className={`w-full rounded-xl p-4 text-left transition ${
                              active
                                ? "bg-[#ffffff]"
                                : "hover:bg-[#ffffff]"
                            }`}
                          >
                            <p
                              className={`truncate text-sm font-semibold ${
                                active
                                  ? "text-[#3d3532]"
                                  : "text-[#554b47]"
                              }`}
                            >
                              {memory.title}
                            </p>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#a0948f]">
                              {memory.content ||
                                "내용 없음"}
                            </p>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-[#b0a39e]">
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

          {/* 오른쪽 노션 스타일 에디터 */}
          <section className="hidden min-w-0 flex-1 md:block">
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

                  <p className="mt-2 text-sm leading-6 text-[#a0948f]">
                    왼쪽에서 파트를 선택하면
                    <br />
                    그 안의 메모를 볼 수 있어요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">

                <div className="flex items-center justify-between border-b border-[#dcecf6] px-8 py-4">
                  <div className="flex items-center gap-2 text-xs text-[#a0948f]">
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
                !content ? (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <div>
                      <div className="text-5xl">
                        📝
                      </div>

                      <h2 className="mt-5 text-lg font-bold">
                        {selectedPart.name}
                      </h2>

                      <p className="mt-2 text-sm text-[#a0948f]">
                        이 파트에 새로운
                        <br />
                        기억을 남겨보세요.
                      </p>

                      <button
                        onClick={
                          createNewMemory
                        }
                        className="mt-5 rounded-xl bg-[#ffffff] px-5 py-3 text-sm font-semibold text-[#3d3532]"
                      >
                        + 새 메모 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col overflow-y-auto px-8 py-10 lg:px-14">

                    <div className="mb-2 text-xs text-[#b0a39e]">
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
                      className="w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-[#3d3532] outline-none placeholder:text-[#d8cfcb]"
                    />

                    <div className="my-7 h-px bg-[#dcecf6]" />

                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(
                          e.target.value
                        );
                      }}
                      placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                      className="min-h-[480px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#554b47] outline-none placeholder:text-[#c8bfbb]"
                    />

                    <div className="mt-6 flex items-center justify-between border-t border-[#dcecf6] pt-5">
                      <p className="text-xs text-[#b0a39e]">
                        {selectedPart.name}
                      </p>

                      <button
                        onClick={
                          saveMemory
                        }
                        disabled={saving}
                        className="rounded-xl bg-[#ffffff] px-6 py-3 text-sm font-semibold text-[#3d3532] transition hover:opacity-90 disabled:opacity-50"
                      >
                        {saving
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
              <p className="text-sm font-bold">
                파트
              </p>

              <button
                onClick={
                  openNewPartModal
                }
                className="rounded-lg bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#3d3532]"
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
                      ? "bg-[#ffffff] font-semibold text-[#3d3532]"
                      : "bg-[#ffffff] text-[#766b67]"
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
                <h2 className="font-bold">
                  {selectedPart.name}
                </h2>

                <button
                  onClick={
                    createNewMemory
                  }
                  className="rounded-lg bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#3d3532]"
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
                      className="w-full rounded-xl bg-[#ffffff] p-4 text-left"
                    >
                      <p className="font-semibold">
                        {memory.title}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs text-[#a0948f]">
                        {memory.content ||
                          "내용 없음"}
                      </p>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 파트 생성 / 수정 모달 */}
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
                <p className="text-xs text-[#a0948f]">
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
                onClick={() => {
                  setShowPartModal(false);
                }}
                className="text-xl text-[#a0948f]"
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
              className="w-full rounded-xl bg-[#f8f5f3] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
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
                className="flex-1 rounded-xl bg-[#f4ebe8] py-3 text-sm font-semibold text-[#766b67]"
              >
                취소
              </button>

              <button
                onClick={savePart}
                className="flex-1 rounded-xl bg-[#ffffff] py-3 text-sm font-semibold text-[#3d3532]"
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