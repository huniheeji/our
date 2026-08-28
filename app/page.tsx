"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Photo = {
  id: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
  url: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

type Memory = {
  id: string;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
};

type Message = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

const YOUNGHUN_ID =
  "c2e77c6f-0c9a-403c-a66d-234e021357b0";

const HEEJI_ID =
  "92dac467-922d-4ef4-b353-eb84593d9761";

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [upcomingEvent, setUpcomingEvent] =
    useState<CalendarEvent | null>(null);
  const [latestMemory, setLatestMemory] =
    useState<Memory | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myUserId, setMyUserId] = useState("");

  const channelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  function getOtherUserId(userId: string) {
    if (userId === YOUNGHUN_ID) {
      return HEEJI_ID;
    }

    if (userId === HEEJI_ID) {
      return YOUNGHUN_ID;
    }

    return "";
  }

  function formatToday() {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  /*
   * =====================================================
   * 사진
   * =====================================================
   */
  async function loadRecentPhotos() {
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, file_name, uploaded_by, created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(3);

    if (error) {
      console.error("사진 조회 오류:", error);
      return;
    }

    if (!data) {
      setPhotos([]);
      return;
    }

    const result: Photo[] = [];

    for (const photo of data) {
      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from("photos")
        .createSignedUrl(
          photo.file_name,
          60 * 60
        );

      if (signedError) {
        console.error(
          "사진 URL 오류:",
          signedError
        );
        continue;
      }

      if (signedData?.signedUrl) {
        result.push({
          id: photo.id,
          file_name: photo.file_name,
          uploaded_by: photo.uploaded_by,
          created_at: photo.created_at,
          url: signedData.signedUrl,
        });
      }
    }

    setPhotos(result);
  }

  /*
   * =====================================================
   * 가장 가까운 미래 일정
   * =====================================================
   */
  async function loadUpcomingEvent() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id, title, description, start_at, end_at, all_day"
      )
      .gte("start_at", now)
      .order("start_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("일정 조회 오류:", error);
      return;
    }

    setUpcomingEvent(data);
  }

  /*
   * =====================================================
   * 가장 최근 메모리 1개
   * =====================================================
   */
  async function loadLatestMemory() {
    const { data, error } = await supabase
      .from("memories")
      .select(
        "id, title, content, created_by, created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("메모리 조회 오류:", error);
      return;
    }

    setLatestMemory(data);
  }

  /*
   * =====================================================
   * 읽지 않은 메시지 수
   * =====================================================
   *
   * 중요:
   *
   * chat_read_status를 기준으로 계산하지 않습니다.
   *
   * 실제 messages 테이블에서
   *
   * 1. 상대방이 보낸 메시지
   * 2. read_at이 NULL
   *
   * 인 메시지만 계산합니다.
   *
   * 따라서 채팅방에서 실제 읽음 처리된 상태와
   * 홈 화면의 배지가 동일하게 움직입니다.
   */
  async function loadUnreadCount(
    userId: string
  ) {
    const otherUserId =
      getOtherUserId(userId);

    if (!otherUserId) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", otherUserId)
      .is("read_at", null);

    if (error) {
      console.error(
        "읽지 않은 메시지 조회 오류:",
        error
      );
      return;
    }

    setUnreadCount(count ?? 0);
  }

  /*
   * =====================================================
   * 초기화
   * =====================================================
   */
  useEffect(() => {
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

      await Promise.all([
        loadRecentPhotos(),
        loadUpcomingEvent(),
        loadLatestMemory(),
        loadUnreadCount(user.id),
      ]);

      if (!mounted) {
        return;
      }

      /*
       * =================================================
       * Realtime
       * =================================================
       */
      /*
 * =================================================
 * Supabase Realtime
 * =================================================
 */

const channel = supabase
  .channel("home-realtime")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
    },
    async (payload) => {
      console.log(
        "🔥 HOME 새 메시지 수신:",
        payload
      );

      const message =
        payload.new as Message;

      /*
       * 상대방이 보낸 메시지라면
       * 읽지 않은 메시지 수 다시 계산
       */
      if (
        message.user_id !== user.id
      ) {
        await loadUnreadCount(
          user.id
        );
      }
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "chat_read_status",
    },
    async (payload) => {
      console.log(
        "🔥 HOME 읽음 상태 변경:",
        payload
      );

      await loadUnreadCount(
        user.id
      );
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "photos",
    },
    async () => {
      await loadRecentPhotos();
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "calendar_events",
    },
    async () => {
      await loadUpcomingEvent();
    }
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "memories",
    },
    async () => {
      await loadLatestMemory();
    }
  );

channelRef.current =
  channel;

await channel.subscribe(
  (status) => {
    console.log(
      "🔥 HOME realtime 상태:",
      status
    );
  }
);
    }

    initialize();

    return () => {
      mounted = false;

      if (channelRef.current) {
        supabase.removeChannel(
          channelRef.current
        );

        channelRef.current = null;
      }
    };
  }, []);

  /*
   * =====================================================
   * 1초 보정
   * =====================================================
   *
   * Realtime이 누락되어도
   * 최대 1초 안에 숫자가 맞도록 합니다.
   */
  useEffect(() => {
    if (!myUserId) {
      return;
    }

    const interval =
      window.setInterval(() => {
        loadUnreadCount(myUserId);
      }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [myUserId]);

  return (
    <main className="min-h-screen bg-[#f3f8fc] text-[#26384c]">

      <div className="mx-auto flex min-h-screen max-w-7xl">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside className="hidden w-60 shrink-0 border-r border-[#dce8f0] bg-white px-5 py-8 md:block">

          <div className="mb-10 px-3">
            <h1 className="text-xl font-semibold tracking-tight text-[#26384c]">
              Home
            </h1>
          </div>

          <nav className="space-y-1.5">

            {/* Home */}

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="flex w-full items-center rounded-xl bg-[#e5f2fa] px-4 py-3 text-left text-sm font-semibold text-[#4e87ad]"
            >
              Home
            </button>

            {/* Messenger */}

            <button
              onClick={() => {
                window.location.href = "/chat";
              }}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-[#687b8c] transition hover:bg-[#f3f8fc]"
            >
              <span>
                Messenger
              </span>

              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#68a3cd] px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}
            </button>

            {/* Photos */}

            <button
              onClick={() => {
                window.location.href =
                  "/photos";
              }}
              className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm text-[#687b8c] transition hover:bg-[#f3f8fc]"
            >
              Photos
            </button>

            {/* Calendar */}

            <button
              onClick={() => {
  window.location.href = "/calendar";
}}
              className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm text-[#687b8c] transition hover:bg-[#f3f8fc]"
            >
              Calendar
            </button>

            {/* Memories */}

            <button
              onClick={() => {
                window.location.href =
                  "/memories";
              }}
              className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm text-[#687b8c] transition hover:bg-[#f3f8fc]"
            >
              Memories
            </button>

          </nav>
        </aside>

        {/* =================================================
            MAIN
        ================================================= */}

        <section className="flex-1 px-5 py-7 md:px-9 md:py-9">

          {/* HEADER */}

          <header className="mb-7 flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-[#7890a3]">
                {formatToday()}
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#26384c]">
                Today
              </h2>
            </div>

            {/* Messenger + unread badge */}

            <div className="flex items-center gap-2">

              <button
                onClick={() => {
                  window.location.href =
                    "/chat";
                }}
                className="relative rounded-full border border-[#d4e3ec] bg-white px-5 py-2.5 text-sm font-medium text-[#526d82] shadow-sm transition hover:border-[#a9c9dd]"
              >
                Messenger
              </button>

              {unreadCount > 0 && (
                <span
                  className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#68a3cd] px-2 text-xs font-bold text-white shadow-sm"
                  title={`${unreadCount}개의 읽지 않은 메시지`}
                >
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}

            </div>

          </header>

          {/* =================================================
              PHOTOS
          ================================================= */}

          <section className="mb-5 rounded-[26px] border border-[#dce8f0] bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <h2 className="text-lg font-semibold text-[#30475b]">
                  Photos
                </h2>

                <p className="mt-1 text-xs text-[#9aabb8]">
                  함께 남긴 순간
                </p>
              </div>

              <button
                onClick={() => {
                  window.location.href =
                    "/photos";
                }}
                className="text-xs font-medium text-[#6393b5]"
              >
                View all
              </button>

            </div>

            {photos.length === 0 ? (

              <button
                onClick={() => {
                  window.location.href =
                    "/photos";
                }}
                className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-[#cbdde8] bg-[#f8fbfd] text-sm text-[#9aabb8]"
              >
                Add your first photo
              </button>

            ) : (

              <div className="grid grid-cols-3 gap-3">

                {photos.map(
                  (photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        window.location.href =
                          "/photos";
                      }}
                      className="group aspect-[4/3] overflow-hidden rounded-2xl bg-[#edf5fa]"
                    >
                      <img
                        src={photo.url}
                        alt="Photo"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </button>
                  )
                )}

              </div>

            )}

          </section>

          {/* =================================================
              MEMORY + CALENDAR
          ================================================= */}

          <div className="grid items-stretch gap-5 lg:grid-cols-2">

            {/* MEMORY */}

            <section className="flex min-h-[240px] flex-col rounded-[26px] border border-[#dce8f0] bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center justify-between">

                <h2 className="text-lg font-semibold text-[#30475b]">
                  Memories
                </h2>

                <button
                  onClick={() => {
                    window.location.href =
                      "/memories";
                  }}
                  className="text-xs font-medium text-[#6393b5]"
                >
                  View all
                </button>

              </div>

              <div className="flex flex-1 items-center">

                {latestMemory ? (

                  <button
                    onClick={() => {
                      window.location.href =
                        "/memories";
                    }}
                    className="w-full rounded-2xl border border-[#e0ebf2] bg-[#f7fbfe] p-5 text-left transition hover:border-[#c5dce9]"
                  >

                    <p className="text-xs text-[#91a5b4]">
                      {new Date(
                        latestMemory.created_at
                      ).toLocaleDateString(
                        "ko-KR",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-[#30475b]">
                      {latestMemory.title}
                    </h3>

                    {latestMemory.content && (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#71899b]">
                        {latestMemory.content}
                      </p>
                    )}

                  </button>

                ) : (

                  <div className="flex min-h-28 w-full items-center justify-center rounded-2xl border border-dashed border-[#cbdde8] bg-[#f8fbfd] text-sm text-[#9aabb8]">
                    아직 기록된 메모리가 없습니다.
                  </div>

                )}

              </div>

            </section>

            {/* CALENDAR */}

            <section className="flex min-h-[240px] flex-col rounded-[26px] border border-[#dce8f0] bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center justify-between">

                <div>

                  <h2 className="text-lg font-semibold text-[#30475b]">
                    Calendar
                  </h2>

                  <p className="mt-1 text-xs text-[#9aabb8]">
                    가장 가까운 일정
                  </p>

                </div>

                <button
                  onClick={() => {
  window.location.href = "/calendar";
}}
                  className="text-xs font-medium text-[#6393b5]"
                >
                  Open
                </button>

              </div>

              <div className="flex flex-1 items-center">

                {upcomingEvent ? (

                  <div className="w-full rounded-2xl bg-[#edf6fc] p-5">

                    <p className="text-xs font-medium text-[#6c98b7]">
                      {new Date(
                        upcomingEvent.start_at
                      ).toLocaleDateString(
                        "ko-KR",
                        {
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        }
                      )}
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-[#30475b]">
                      {upcomingEvent.title}
                    </h3>

                    <p className="mt-1 text-sm text-[#7892a5]">

                      {upcomingEvent.all_day
                        ? "하루 종일"
                        : new Date(
                            upcomingEvent.start_at
                          ).toLocaleTimeString(
                            "ko-KR",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            }
                          )}

                    </p>

                    {upcomingEvent.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#71899b]">
                        {
                          upcomingEvent.description
                        }
                      </p>
                    )}

                  </div>

                ) : (

                  <div className="flex min-h-28 w-full items-center justify-center rounded-2xl border border-dashed border-[#cbdde8] bg-[#f8fbfd] text-sm text-[#9aabb8]">
                    예정된 일정이 없습니다.
                  </div>

                )}

              </div>

            </section>

          </div>

        </section>

      </div>

    </main>
  );
}

