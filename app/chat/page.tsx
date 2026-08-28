"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [myUserId, setMyUserId] = useState("");
  const [myName, setMyName] = useState("");
  const [loading, setLoading] = useState(true);

  const channelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const myUserIdRef = useRef("");

  /*
   * =====================================================
   * 사용자
   * =====================================================
   */

  function getUserName(userId: string) {
    if (userId === YOUNGHUN_ID) {
      return "영훈";
    }

    if (userId === HEEJI_ID) {
      return "희지";
    }

    return "사용자";
  }

  function getOtherUserId(userId: string) {
    if (userId === YOUNGHUN_ID) {
      return HEEJI_ID;
    }

    if (userId === HEEJI_ID) {
      return YOUNGHUN_ID;
    }

    return "";
  }

  /*
   * =====================================================
   * 시간
   * =====================================================
   */

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString(
      "ko-KR",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    );
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }
    );
  }

  /*
   * =====================================================
   * 스크롤
   * =====================================================
   */

  function scrollToBottom(
    behavior: ScrollBehavior = "auto"
  ) {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: "end",
      });
    }, 100);
  }

  /*
   * =====================================================
   * 메시지 조회
   * =====================================================
   */

  async function fetchMessages() {
    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .select(
        "id, user_id, message, created_at, read_at"
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "메시지 조회 오류:",
        error
      );

      return null;
    }

    return (data || []) as Message[];
  }

  /*
   * =====================================================
   * DB → 화면 동기화
   * =====================================================
   */

  async function reloadMessages() {
    const result = await fetchMessages();

    if (result) {
      setMessages(result);
    }

    return result;
  }

  /*
   * =====================================================
   * 읽음 처리
   *
   * 현재 로그인한 사용자가 채팅방을 보고 있으면
   * 상대방이 보낸 메시지를 읽음 처리한다.
   *
   * RPC 사용
   * =====================================================
   */

  async function markMessagesAsRead(
    userId: string
  ) {
    if (!userId) {
      return;
    }

    /*
     * DB 함수에서 auth.uid()를 사용하여
     * 현재 사용자와 상대방을 구분한다.
     */
    const {
      error,
    } = await supabase.rpc(
      "mark_messages_as_read"
    );

    if (error) {
      console.error(
        "읽음 처리 오류:",
        error
      );

      return;
    }

    /*
     * DB에 반영된 실제 값을 다시 가져온다.
     */
    const result = await reloadMessages();

    if (!result) {
      return;
    }

    /*
     * 상대방 화면에 읽음 알림
     */
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "chat-read",
        payload: {
          user_id: userId,
          last_read_at:
            new Date().toISOString(),
        },
      });
    }
  }

  /*
   * =====================================================
   * 1 표시
   *
   * 핵심:
   *
   * 내가 보낸 메시지
   * + read_at이 null
   *
   * 이 두 조건일 때만 1을 표시한다.
   * =====================================================
   */

  function shouldShowUnread(
    item: Message
  ) {
    if (!myUserId) {
      return false;
    }

    /*
     * 내가 보낸 메시지가 아니면
     * 절대로 1을 표시하지 않는다.
     */
    if (item.user_id !== myUserId) {
      return false;
    }

    /*
     * read_at이 null일 때만
     * 상대방이 아직 읽지 않은 상태
     */
    return item.read_at === null;
  }

  /*
   * =====================================================
   * 초기화
   * =====================================================
   */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      /*
       * 로그인 확인
       */
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      if (!mounted) {
        return;
      }

      myUserIdRef.current = user.id;

      setMyUserId(user.id);
      setMyName(getUserName(user.id));

      /*
       * 최초 메시지 조회
       */
      const initialMessages =
        await fetchMessages();

      if (!mounted) {
        return;
      }

      setMessages(
        initialMessages || []
      );

      /*
       * =================================================
       * Realtime 채널
       * =================================================
       */

      const channel =
        supabase.channel(
          "couple-chat-room",
          {
            config: {
              broadcast: {
                self: false,
              },
            },
          }
        );

      /*
       * =================================================
       * 새 메시지 DB INSERT
       * =================================================
       */

      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMessage =
            payload.new as Message;

          /*
           * 화면에 추가
           */
          setMessages(
            (current) => {
              if (
                current.some(
                  (item) =>
                    item.id ===
                    newMessage.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                newMessage,
              ];
            }
          );

          /*
           * 상대방이 보낸 메시지라면
           * 현재 채팅방을 보고 있으므로
           * 즉시 읽음 처리
           */
          if (
            newMessage.user_id !==
            myUserIdRef.current
          ) {
            await markMessagesAsRead(
              myUserIdRef.current
            );
          }

          scrollToBottom("smooth");
        }
      );

      /*
       * =================================================
       * 메시지 UPDATE
       *
       * read_at 변경을 실시간 반영
       * =================================================
       */

      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMessage =
            payload.new as Message;

          setMessages(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  updatedMessage.id
                    ? updatedMessage
                    : item
              )
          );
        }
      );

      /*
       * =================================================
       * 읽음 Broadcast
       *
       * 상대방이 읽었다는 신호가 오면
       * 그 시간 이전의 내 메시지를
       * 화면에서 즉시 읽음 처리
       * =================================================
       */

      channel.on(
        "broadcast",
        {
          event: "chat-read",
        },
        ({ payload }) => {
          if (
            !payload ||
            !payload.user_id ||
            !payload.last_read_at
          ) {
            return;
          }

          /*
           * payload.user_id는
           * 읽은 사람의 ID
           *
           * 현재 사용자의 상대방이어야 한다.
           */
          if (
            payload.user_id !==
            getOtherUserId(
              myUserIdRef.current
            )
          ) {
            return;
          }

          const readAt =
            new Date(
              payload.last_read_at
            ).getTime();

          /*
           * 상대방이 읽은 시점 이전의
           * 내가 보낸 메시지를
           * 모두 읽음 처리
           */
          setMessages(
            (current) =>
              current.map(
                (item) => {
                  if (
                    item.user_id ===
                      myUserIdRef.current &&
                    new Date(
                      item.created_at
                    ).getTime() <=
                      readAt
                  ) {
                    return {
                      ...item,
                      read_at:
                        payload.last_read_at,
                    };
                  }

                  return item;
                }
              )
          );
        }
      );

      /*
       * =================================================
       * Broadcast 새 메시지
       * =================================================
       *
       * DB INSERT와 중복될 수 있으므로
       * ID로 중복 방지
       */

      channel.on(
        "broadcast",
        {
          event: "new-message",
        },
        ({ payload }) => {
          if (!payload) {
            return;
          }

          const newMessage =
            payload as Message;

          setMessages(
            (current) => {
              if (
                current.some(
                  (item) =>
                    item.id ===
                    newMessage.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                newMessage,
              ];
            }
          );

          scrollToBottom("smooth");
        }
      );

      /*
       * =================================================
       * 채널 등록
       * =================================================
       */

      channelRef.current = channel;

      await channel.subscribe(
        (status) => {
          console.log(
            "채팅 Realtime:",
            status
          );
        }
      );

      if (!mounted) {
        return;
      }

      setLoading(false);

      /*
       * =================================================
       * 채팅방 진입 = 읽음 처리
       * =================================================
       */

      if (
        initialMessages &&
        initialMessages.length > 0
      ) {
        await markMessagesAsRead(
          user.id
        );
      }

      scrollToBottom("auto");
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
   * 메시지 개수 변경 → 최하단
   * =====================================================
   */

  useEffect(() => {
    if (!loading) {
      scrollToBottom("smooth");
    }
  }, [messages.length]);

  /*
   * =====================================================
   * 메시지 전송
   * =====================================================
   */

  async function sendMessage() {
    const text = message.trim();

    if (!text) {
      return;
    }

    if (!myUserId) {
      alert(
        "로그인 정보를 확인하는 중입니다."
      );

      return;
    }

    /*
     * 새 메시지는 반드시 read_at = null
     */
    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .insert({
        user_id: myUserId,
        message: text,
        read_at: null,
      })
      .select(
        "id, user_id, message, created_at, read_at"
      )
      .single();

    if (error) {
      console.error(
        "메시지 전송 오류:",
        error
      );

      alert(
        "메시지 전송 실패: " +
          error.message
      );

      return;
    }

    if (!data) {
      return;
    }

    const newMessage =
      data as Message;

    /*
     * 내 화면에 즉시 추가
     */
    setMessages(
      (current) => {
        if (
          current.some(
            (item) =>
              item.id ===
              newMessage.id
          )
        ) {
          return current;
        }

        return [
          ...current,
          newMessage,
        ];
      }
    );

    /*
     * 상대방에게 전달
     */
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "new-message",
        payload: newMessage,
      });
    }

    setMessage("");

    scrollToBottom("smooth");
  }

  /*
   * =====================================================
   * Loading
   * =====================================================
   */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f9fd] text-[#71849a]">
        채팅을 불러오는 중...
      </main>
    );
  }

  /*
   * =====================================================
   * 화면
   * =====================================================
   */

  return (
    <main className="h-screen overflow-hidden bg-[#f4f9fd] text-[#26384c]">

      <div className="mx-auto flex h-screen max-w-4xl flex-col">

        {/* HEADER */}

        <header className="shrink-0 border-b border-[#dbe8f2] bg-white px-5 py-4 md:px-8">

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="mb-3 text-sm text-[#8194a7] hover:text-[#527493]"
          >
            ← Home
          </button>

          <div className="flex items-center justify-between">

            <div>

              <h1 className="text-xl font-bold text-[#26384c]">
                Messenger
              </h1>

              <p className="mt-1 text-xs text-[#9aabba]">
                private chat
              </p>

            </div>

            <div className="rounded-full bg-[#e1f0fb] px-4 py-2 text-xs font-semibold text-[#527493]">
              {myName}
            </div>

          </div>

        </header>

        {/* CHAT AREA */}

        <section className="flex min-h-0 flex-1 flex-col px-3 py-3 md:px-5">

          {/* MESSAGE LIST */}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[#d8e7f2] bg-white px-4 py-5 shadow-sm md:px-6">

            {messages.length === 0 ? (

              <div className="flex h-full items-center justify-center">

                <div className="text-center">

                  <div className="text-4xl">
                    💬
                  </div>

                  <p className="mt-4 font-semibold text-[#42566c]">
                    대화를 시작해보세요.
                  </p>

                  <p className="mt-1 text-sm text-[#9aabba]">
                    첫 메시지를 보내보세요.
                  </p>

                </div>

              </div>

            ) : (

              <div className="space-y-4">

                {messages.map(
                  (
                    item,
                    index
                  ) => {

                    const isMine =
                      item.user_id ===
                      myUserId;

                    const previous =
                      index > 0
                        ? messages[
                            index - 1
                          ]
                        : null;

                    const showDate =
                      !previous ||
                      new Date(
                        previous.created_at
                      ).toDateString() !==
                        new Date(
                          item.created_at
                        ).toDateString();

                    const showUnread =
                      shouldShowUnread(
                        item
                      );

                    return (
                      <div
                        key={item.id}
                      >

                        {showDate && (
                          <div className="my-6 text-center text-xs text-[#9aabba]">
                            {formatDate(
                              item.created_at
                            )}
                          </div>
                        )}

                        <div
                          className={`flex ${
                            isMine
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >

                          <div
                            className={`flex max-w-[78%] flex-col ${
                              isMine
                                ? "items-end"
                                : "items-start"
                            }`}
                          >

                            {!isMine && (
                              <span className="mb-1 px-1 text-[11px] text-[#8b9cac]">
                                {getUserName(
                                  item.user_id
                                )}
                              </span>
                            )}

                            <div
                              className={`flex items-end gap-1.5 ${
                                isMine
                                  ? "flex-row-reverse"
                                  : "flex-row"
                              }`}
                            >

                              <div
                                className={`rounded-2xl px-4 py-3 ${
                                  isMine
                                    ? "rounded-br-md bg-[#82b7dc] text-white"
                                    : "rounded-bl-md bg-[#edf5fb] text-[#33475b]"
                                }`}
                              >

                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {item.message}
                                </p>

                              </div>

                              <div className="flex shrink-0 flex-col items-end">

                                {showUnread && (
                                  <span className="mb-0.5 text-[11px] font-bold text-[#4d91c3]">
                                    1
                                  </span>
                                )}

                                <span className="text-[9px] text-[#9aabba]">
                                  {formatTime(
                                    item.created_at
                                  )}
                                </span>

                              </div>

                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

                <div
                  ref={messagesEndRef}
                  className="h-1"
                />

              </div>

            )}

          </div>

          {/* INPUT */}

          <div className="shrink-0 pt-3">

            <div className="flex items-center gap-2 rounded-3xl border border-[#c7dceb] bg-[#e2f0fa] p-2.5 shadow-sm">

              <input
                type="text"
                value={message}
                onChange={(event) => {
                  setMessage(
                    event.target.value
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    if (
                      message.trim()
                    ) {
                      sendMessage();
                    }
                  }
                }}
                placeholder="메시지를 입력하세요..."
                className="min-w-0 flex-1 rounded-2xl border border-[#c7d9e8] bg-white px-4 py-3 text-sm text-[#33475b] outline-none placeholder:text-[#a4b2c0] focus:border-[#78acd1] focus:ring-2 focus:ring-[#d3e8f6]"
              />

              <button
                onClick={sendMessage}
                disabled={
                  !message.trim()
                }
                className="shrink-0 rounded-2xl bg-[#78afd6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#639fce] disabled:cursor-not-allowed disabled:opacity-40"
              >
                보내기
              </button>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}