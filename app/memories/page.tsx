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

type PhotoPreview = {
  id?: string;
  file?: File;
  file_path?: string;
  file_name: string;
  preview_url: string;
  existing: boolean;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const STORAGE_BUCKET = "memory-photos";

export default function MemoriesPage() {
  const [parts, setParts] = useState<MemoryPart[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);

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

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

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
            await loadMemoryPhotos();
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
            await loadMemoryPhotos();
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
      loadMemoryPhotos(),
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

      /*
       * 읽기/수정 중에 실시간 업데이트가 들어오더라도
       * 사용자가 입력 중인 내용을 강제로 덮어쓰지 않도록
       * 보기 모드일 때만 값을 갱신합니다.
       */
      if (!isEditing && !isCreating) {
        setTitle(updated.title);
        setContent(updated.content);
      }

      return updated;
    });
  }

  async function loadMemoryPhotos() {
    const { data, error } = await supabase
      .from("memory_photos")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "사진 정보 조회 오류:",
        error
      );
      return;
    }

    setMemoryPhotos(data || []);
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
    return memoryPhotos.filter(
      (photo) =>
        photo.memory_id === memoryId
    );
  }

  function getPhotoUrl(
    filePath: string
  ) {
    const {
      data,
    } = supabase.storage
      .from(STORAGE_BUCKET)
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
    setPhotos([]);
  }

  function selectMemory(memory: Memory) {
    setSelectedMemory(memory);
    setIsCreating(false);
    setIsEditing(false);
    setTitle(memory.title);
    setContent(memory.content);

    const existingPhotos =
      getMemoryPhotos(memory.id).map(
        (photo) => ({
          id: photo.id,
          file_path: photo.file_path,
          file_name: photo.file_name,
          preview_url: getPhotoUrl(
            photo.file_path
          ),
          existing: true,
        })
      );

    setPhotos(existingPhotos);
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

    const existingPhotos =
      getMemoryPhotos(
        selectedMemory.id
      ).map((photo) => ({
        id: photo.id,
        file_path: photo.file_path,
        file_name: photo.file_name,
        preview_url: getPhotoUrl(
          photo.file_path
        ),
        existing: true,
      }));

    setPhotos(existingPhotos);
  }

  function cancelMemory() {
    if (isCreating) {
      setSelectedMemory(null);
      setIsCreating(false);
      setIsEditing(false);
      setTitle("");
      setContent("");
      setPhotos([]);
      return;
    }

    if (selectedMemory) {
      setTitle(selectedMemory.title);
      setContent(selectedMemory.content);

      const existingPhotos =
        getMemoryPhotos(
          selectedMemory.id
        ).map((photo) => ({
          id: photo.id,
          file_path: photo.file_path,
          file_name: photo.file_name,
          preview_url: getPhotoUrl(
            photo.file_path
          ),
          existing: true,
        }));

      setPhotos(existingPhotos);
    }

    setIsEditing(false);
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

    /*
     * 파트 안의 메모 사진도 먼저 삭제
     */
    for (const memory of partMemories) {
      const photosToDelete =
        getMemoryPhotos(memory.id);

      for (const photo of photosToDelete) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([photo.file_path]);
      }

      if (photosToDelete.length > 0) {
        await supabase
          .from("memory_photos")
          .delete()
          .eq(
            "memory_id",
            memory.id
          );
      }
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

  /*
   * 사진 선택
   */
  async function handlePhotoSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    if (!myUserId) {
      alert(
        "로그인 정보를 확인할 수 없습니다."
      );
      return;
    }

    setUploadingPhoto(true);

    try {
      const selectedFiles =
        Array.from(files);

      const newPhotos: PhotoPreview[] =
        [];

      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          alert(
            `${file.name}은(는) 이미지 파일이 아닙니다.`
          );
          continue;
        }

        /*
         * 파일명 중복 방지
         */
        const extension =
          file.name.split(".").pop() ||
          "jpg";

        const safeFileName =
          `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 10)}.${extension}`;

        /*
         * 로그인 사용자별 폴더
         */
        const filePath =
          `${myUserId}/${safeFileName}`;

        const {
          error,
        } = await supabase.storage
          .from(STORAGE_BUCKET)
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
          console.error(
            "사진 업로드 오류:",
            error
          );

          alert(
            `${file.name} 업로드 실패\n${error.message}`
          );

          continue;
        }

        const {
          data: publicUrlData,
        } =
          supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(
              filePath
            );

        newPhotos.push({
          file_path: filePath,
          file_name: file.name,
          preview_url:
            publicUrlData.publicUrl,
          existing: false,
        });
      }

      setPhotos((current) => [
        ...current,
        ...newPhotos,
      ]);
    } finally {
      setUploadingPhoto(false);

      /*
       * 같은 파일을 다시 선택할 수 있도록 초기화
       */
      event.target.value = "";
    }
  }

  /*
   * 사진 삭제
   */
  async function removePhoto(
    index: number
  ) {
    const photo = photos[index];

    if (!photo) return;

    /*
     * 이미 DB에 저장되어 있는 사진
     */
    if (
      photo.existing &&
      photo.id &&
      photo.file_path
    ) {
      const confirmed =
        window.confirm(
          "이 사진을 삭제할까요?"
        );

      if (!confirmed) return;

      const {
        error: storageError,
      } = await supabase.storage
        .from(STORAGE_BUCKET)
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
        .eq("id", photo.id);

      if (dbError) {
        alert(
          "사진 정보 삭제 실패: " +
            dbError.message
        );
        return;
      }

      setPhotos((current) =>
        current.filter(
          (_, i) => i !== index
        )
      );

      await loadMemoryPhotos();
      return;
    }

    /*
     * 아직 DB에 연결되지 않은 새 사진
     */
    if (photo.file_path) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([
          photo.file_path,
        ]);
    }

    setPhotos((current) =>
      current.filter(
        (_, i) => i !== index
      )
    );
  }

  /*
   * 메모 저장
   */
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

      /*
       * 기존 메모 수정
       */
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
      }

      /*
       * 새 메모 생성
       */
      else {
        const {
          data,
          error,
        } = await supabase
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

        if (!data) {
          alert(
            "메모가 생성되지 않았습니다."
          );
          return;
        }

        memoryId = data.id;
        setSelectedMemory(data);
      }

      /*
       * ★ 핵심 ★
       *
       * 업로드된 사진을 memory_photos 테이블에
       * 실제 memory_id와 연결합니다.
       *
       * 이 부분이 있어야 "사진은 업로드됐는데
       * 메모에 첨부가 안 되는 문제"가 해결됩니다.
       */
      if (memoryId) {
        const existingPhotoIds =
          getMemoryPhotos(
            memoryId
          ).map(
            (photo) => photo.id
          );

        const photosToInsert =
          photos.filter(
            (photo) =>
              !photo.existing &&
              photo.file_path
          );

        if (
          photosToInsert.length > 0
        ) {
          const rows =
            photosToInsert.map(
              (photo) => ({
                memory_id:
                  memoryId,
                file_path:
                  photo.file_path!,
                file_name:
                  photo.file_name,
                created_by:
                  myUserId,
              })
            );

          const {
            error: photoDbError,
          } = await supabase
            .from("memory_photos")
            .insert(rows);

          if (photoDbError) {
            console.error(
              "사진 DB 연결 오류:",
              photoDbError
            );

            alert(
              "메모는 저장되었지만 사진 연결에 실패했습니다.\n" +
                photoDbError.message
            );
          }
        }
      }

      await loadMemories();
      await loadMemoryPhotos();

      /*
       * 저장 후 해당 메모를 다시 찾아서
       * 읽기 모드로 전환
       */
      if (memoryId) {
        const {
          data: savedMemory,
        } = await supabase
          .from("memories")
          .select("*")
          .eq(
            "id",
            memoryId
          )
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

          const {
            data: savedPhotos,
          } =
            await supabase
              .from("memory_photos")
              .select("*")
              .eq(
                "memory_id",
                memoryId
              )
              .order(
                "created_at",
                {
                  ascending: true,
                }
              );

          setPhotos(
            (savedPhotos || []).map(
              (photo) => ({
                id: photo.id,
                file_path:
                  photo.file_path,
                file_name:
                  photo.file_name,
                preview_url:
                  getPhotoUrl(
                    photo.file_path
                  ),
                existing: true,
              })
            )
          );
        }
      }

      setIsCreating(false);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory() {
    if (!selectedMemory) return;

    const confirmed =
      window.confirm(
        "이 메모를 삭제할까요?\n사진도 함께 삭제됩니다."
      );

    if (!confirmed) return;

    const photosToDelete =
      getMemoryPhotos(
        selectedMemory.id
      );

    /*
     * Storage 사진 삭제
     */
    for (const photo of photosToDelete) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([
          photo.file_path,
        ]);
    }

    /*
     * 사진 DB 삭제
     */
    await supabase
      .from("memory_photos")
      .delete()
      .eq(
        "memory_id",
        selectedMemory.id
      );

    /*
     * 메모 삭제
     */
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
    await loadMemoryPhotos();
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

  function renderPhotos(
    memoryId: string
  ) {
    const photos =
      getMemoryPhotos(memoryId);

    if (photos.length === 0) {
      return null;
    }

    return (
      <div className="mt-8">
        <div className="mb-3 text-xs font-semibold text-[#8b9fa9]">
          PHOTOS · {photos.length}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={getPhotoUrl(
                photo.file_path
              )}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl bg-[#f4f9fb]"
            >
              <img
                src={getPhotoUrl(
                  photo.file_path
                )}
                alt={
                  photo.file_name
                }
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      </div>
    );
  }

  function renderEditPhotos() {
    if (photos.length === 0) {
      return null;
    }

    return (
      <div className="mt-7">
        <div className="mb-3 text-xs font-semibold text-[#8b9fa9]">
          PHOTOS · {photos.length}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map(
            (photo, index) => (
              <div
                key={
                  photo.id ||
                  `${photo.file_path}-${index}`
                }
                className="group relative overflow-hidden rounded-2xl bg-[#f4f9fb]"
              >
                <img
                  src={
                    photo.preview_url
                  }
                  alt={
                    photo.file_name
                  }
                  className="aspect-square w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() =>
                    removePhoto(
                      index
                    )
                  }
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-lg text-white opacity-100 transition hover:bg-black/70"
                >
                  ×
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
              우리의 이야기를 차곡차곡 기록해요
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

        {/* PC */}
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
                    disabled={
                      !selectedPart
                    }
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

                              <span className="flex items-center gap-2">
                                {photoCount >
                                  0 && (
                                  <span>
                                    📷{" "}
                                    {
                                      photoCount
                                    }
                                  </span>
                                )}

                                <span>
                                  {formatDate(
                                    memory.updated_at
                                  )}
                                </span>
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
            ) : isCreating ||
              selectedMemory ? (
              <div className="flex h-full flex-col">

                {/* 상단 */}
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
                      !isEditing &&
                      selectedMemory && (
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

                {/* 보기 모드 */}
                {!isEditing &&
                !isCreating &&
                selectedMemory ? (
                  <div className="flex-1 overflow-y-auto px-8 py-10 lg:px-14">

                    <div className="mb-3 text-xs text-[#9eb0b9]">
                      {getAuthorName(
                        selectedMemory.created_by
                      )}{" "}
                      ·{" "}
                      {formatDate(
                        selectedMemory.updated_at
                      )}
                    </div>

                    <h1 className="text-4xl font-bold tracking-tight text-[#3d3532]">
                      {
                        selectedMemory.title
                      }
                    </h1>

                    <div className="my-7 h-px bg-[#d4e8f2]" />

                    <div className="whitespace-pre-wrap text-[15px] leading-8 text-[#554b47]">
                      {
                        selectedMemory.content ||
                        "내용 없음"
                      }
                    </div>

                    {renderPhotos(
                      selectedMemory.id
                    )}

                    <div className="mt-10 flex justify-end">
                      <button
                        onClick={
                          startEditing
                        }
                        className="rounded-xl bg-[#dff2fb] px-6 py-3 text-sm font-semibold text-[#456572] hover:bg-[#ccebf7]"
                      >
                        ✏️ 수정하기
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 수정/작성 모드 */
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

                    <input
                      autoFocus
                      value={
                        title
                      }
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
                      value={
                        content
                      }
                      onChange={(e) =>
                        setContent(
                          e.target.value
                        )
                      }
                      placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                      className="min-h-[480px] w-full resize-none border-0 bg-transparent text-[15px] leading-8 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                    />

                    {renderEditPhotos()}

                    <div className="mt-5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#bcd9e6] bg-[#f7fcff] px-4 py-3 text-sm font-semibold text-[#587582] hover:bg-[#eaf6fc]">
                        📷{" "}
                        {uploadingPhoto
                          ? "사진 업로드 중..."
                          : "사진 추가"}

                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={
                            handlePhotoSelect
                          }
                          disabled={
                            uploadingPhoto
                          }
                          className="hidden"
                        />
                      </label>

                      <p className="mt-2 text-xs text-[#a3b4bc]">
                        여러 장을 한 번에 선택할 수 있어요.
                      </p>
                    </div>

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
                          uploadingPhoto
                        }
                        className="rounded-xl bg-[#dff2fb] px-6 py-3 text-sm font-semibold text-[#456572] transition hover:bg-[#ccebf7] disabled:opacity-50"
                      >
                        {saving
                          ? "저장 중..."
                          : "저장"}
                      </button>
                    </div>
                  </div>
                )}
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
                          (
                            memory
                          ) => (
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

                  {/* 모바일 상단 */}
                  <div className="mb-5 flex items-center justify-between">

                    <div>
                      <p className="text-xs text-[#8b9fa9]">
                        {isCreating
                          ? "NEW MEMORY"
                          : isEditing
                          ? "EDIT MEMORY"
                          : "MEMORY"}
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {isCreating
                          ? "새 메모"
                          : selectedMemory?.title}
                      </h2>
                    </div>

                    <div className="flex gap-2">

                      {!isCreating &&
                        !isEditing &&
                        selectedMemory && (
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

                  {/* 모바일 읽기 */}
                  {!isEditing &&
                  !isCreating &&
                  selectedMemory ? (
                    <>
                      <p className="mb-4 text-xs text-[#9eb0b9]">
                        {getAuthorName(
                          selectedMemory.created_by
                        )}{" "}
                        ·{" "}
                        {formatDate(
                          selectedMemory.updated_at
                        )}
                      </p>

                      <h1 className="text-2xl font-bold text-[#3d3532]">
                        {
                          selectedMemory.title
                        }
                      </h1>

                      <div className="my-5 h-px bg-[#d4e8f2]" />

                      <div className="whitespace-pre-wrap text-sm leading-7 text-[#554b47]">
                        {
                          selectedMemory.content ||
                          "내용 없음"
                        }
                      </div>

                      {renderPhotos(
                        selectedMemory.id
                      )}

                      <button
                        onClick={
                          startEditing
                        }
                        className="mt-8 w-full rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572]"
                      >
                        ✏️ 수정하기
                      </button>
                    </>
                  ) : (
                    /* 모바일 수정 */
                    <>
                      <input
                        autoFocus
                        value={
                          title
                        }
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
                        value={
                          content
                        }
                        onChange={(e) =>
                          setContent(
                            e.target.value
                          )
                        }
                        placeholder="기억하고 싶은 이야기를 자유롭게 적어보세요..."
                        className="min-h-[300px] w-full resize-none border-0 bg-transparent text-sm leading-7 text-[#554b47] outline-none placeholder:text-[#b7c8cf]"
                      />

                      {renderEditPhotos()}

                      <label className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#bcd9e6] bg-[#f7fcff] py-3 text-sm font-semibold text-[#587582]">
                        📷{" "}
                        {uploadingPhoto
                          ? "사진 업로드 중..."
                          : "사진 추가"}

                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={
                            handlePhotoSelect
                          }
                          disabled={
                            uploadingPhoto
                          }
                          className="hidden"
                        />
                      </label>

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
                            uploadingPhoto
                          }
                          className="flex-1 rounded-xl bg-[#dff2fb] py-3 text-sm font-semibold text-[#456572] disabled:opacity-50"
                        >
                          {saving
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

      {/* PART MODAL */}
      {showPartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
          onClick={() =>
            setShowPartModal(
              false
            )
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
              value={
                partName
              }
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
