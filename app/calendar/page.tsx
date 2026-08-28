"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type CalendarEvent = {
id: string;
title: string;
description: string | null;
start_at: string;
end_at: string | null;
all_day: boolean;
created_by: string | null;
created_at: string;
updated_at: string;
};

const YOUNGHUN_ID = "c2e77c6f-0c9a-403c-a66d-234e021357b0";
const HEEJI_ID = "92dac467-922d-4ef4-b353-eb84593d9761";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
const [events, setEvents] = useState<CalendarEvent[]>([]);
const [currentDate, setCurrentDate] = useState(new Date());
const [selectedDate, setSelectedDate] = useState(new Date());

const [showModal, setShowModal] = useState(false);
const [editingEvent, setEditingEvent] =
useState<CalendarEvent | null>(null);

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [allDay, setAllDay] = useState(false);
const [startTime, setStartTime] = useState("18:00");
const [endTime, setEndTime] = useState("19:00");

const [myUserId, setMyUserId] = useState("");
const [myName, setMyName] = useState("");
const [loading, setLoading] = useState(true);

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

  if (!mounted) return;

  setMyUserId(user.id);

  if (user.id === YOUNGHUN_ID) {
    setMyName("영훈");
  } else if (user.id === HEEJI_ID) {
    setMyName("희지");
  } else {
    setMyName("우리");
  }

  await loadEvents();

  if (!mounted) return;

  channel = supabase
    .channel("calendar-events-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "calendar_events",
      },
      async (payload) => {
        console.log("🔥 Calendar Realtime 수신:", payload);
        await loadEvents();
      }
    )
    .subscribe((status) => {
      console.log("🔥 Calendar Realtime 상태:", status);
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

async function loadEvents() {
const { data, error } = await supabase
.from("calendar_events")
.select("*")
.order("start_at", { ascending: true });


if (error) {
  console.error("Calendar 일정 조회 오류:", error);
  return;
}

setEvents(data || []);


}

const monthDays = useMemo(() => {
const year = currentDate.getFullYear();
const month = currentDate.getMonth();


const firstDay = new Date(year, month, 1).getDay();
const lastDate = new Date(year, month + 1, 0).getDate();

const days: Date[] = [];

for (let i = firstDay - 1; i >= 0; i--) {
  days.push(new Date(year, month - 1, new Date(year, month, 0).getDate() - i));
}

for (let day = 1; day <= lastDate; day++) {
  days.push(new Date(year, month, day));
}

let nextDay = 1;

while (days.length < 42) {
  days.push(new Date(year, month + 1, nextDay));
  nextDay++;
}

return days;


}, [currentDate]);

function isSameDay(a: Date, b: Date) {
return (
a.getFullYear() === b.getFullYear() &&
a.getMonth() === b.getMonth() &&
a.getDate() === b.getDate()
);
}

function isCurrentMonth(date: Date) {
return (
date.getFullYear() === currentDate.getFullYear() &&
date.getMonth() === currentDate.getMonth()
);
}

function getEventsForDate(date: Date) {
return events.filter((event) =>
isSameDay(new Date(event.start_at), date)
);
}

function formatMonth() {
return currentDate.toLocaleDateString("ko-KR", {
year: "numeric",
month: "long",
});
}

function formatTime(dateString: string) {
return new Date(dateString).toLocaleTimeString("ko-KR", {
hour: "2-digit",
minute: "2-digit",
hour12: false,
});
}

function dateToInput(date: Date) {
return (
date.getFullYear() +
"-" +
String(date.getMonth() + 1).padStart(2, "0") +
"-" +
String(date.getDate()).padStart(2, "0")
);
}
  function seoulTimeToUTC(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour - 9, minute)
  ).toISOString();
}

function openAddModal(date = selectedDate) {
setEditingEvent(null);
setTitle("");
setDescription("");
setAllDay(false);
setStartTime("18:00");
setEndTime("19:00");
setSelectedDate(date);
setShowModal(true);
}

function openEditModal(event: CalendarEvent) {
const date = new Date(event.start_at);


setEditingEvent(event);
setTitle(event.title);
setDescription(event.description || "");
setAllDay(event.all_day);

setStartTime(
  date
    .toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .slice(0, 5)
);

if (event.end_at) {
setEndTime(
  new Date(event.end_at)
    .toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .slice(0, 5)
);
}

setSelectedDate(date);
setShowModal(true);


}

async function saveEvent() {
if (!title.trim()) {
alert("일정 제목을 입력해주세요.");
return;
}


if (!myUserId) {
  alert("로그인 정보를 확인해주세요.");
  return;
}

const date = dateToInput(selectedDate);

function koreaToUTC(dateString: string, timeString: string) {
  const local = new Date(`${dateString}T${timeString}:00+09:00`);
  return local.toISOString();
}

const startAt = allDay
  ? koreaToUTC(date, "00:00")
  : koreaToUTC(date, startTime);

const endAt = allDay
  ? koreaToUTC(date, "23:59")
  : koreaToUTC(date, endTime);

if (editingEvent) {
  const { error } = await supabase
    .from("calendar_events")
    .update({
      title: title.trim(),
      description: description.trim() || null,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editingEvent.id);

  if (error) {
    console.error("일정 수정 오류:", error);
    alert("일정 수정 실패: " + error.message);
    return;
  }
} else {
  const { error } = await supabase
    .from("calendar_events")
    .insert({
      title: title.trim(),
      description: description.trim() || null,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      created_by: myUserId,
    });

  if (error) {
    console.error("일정 추가 오류:", error);
    alert("일정 추가 실패: " + error.message);
    return;
  }
}

setShowModal(false);
await loadEvents();


}

async function deleteEvent() {
if (!editingEvent) return;


if (!window.confirm("이 일정을 삭제할까요?")) return;

const { error } = await supabase
  .from("calendar_events")
  .delete()
  .eq("id", editingEvent.id);

if (error) {
  console.error("일정 삭제 오류:", error);
  alert("일정 삭제 실패: " + error.message);
  return;
}

setShowModal(false);
await loadEvents();


}

function goPreviousMonth() {
setCurrentDate(
new Date(
currentDate.getFullYear(),
currentDate.getMonth() - 1,
1
)
);
}

function goNextMonth() {
setCurrentDate(
new Date(
currentDate.getFullYear(),
currentDate.getMonth() + 1,
1
)
);
}

function goToday() {
const today = new Date();
setCurrentDate(today);
setSelectedDate(today);
}

if (loading) {
return ( <main className="flex min-h-screen items-center justify-center bg-[#f3f8fc] text-[#766b67]">
캘린더를 불러오는 중... </main>
);
}

const selectedEvents = getEventsForDate(selectedDate);

return ( <main className="min-h-screen bg-[#f3f8fc] text-[#3d3532]"> <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">


    <header className="mb-6">
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
            Calendar
          </h1>

          <p className="mt-1 text-sm text-[#9b8f8a]">
            우리 둘의 일정을 함께 관리해요
          </p>
        </div>

        <button
            onClick={() => openAddModal()}
  className="rounded-2xl bg-[#edf6fc] px-5 py-3 text-sm font-semibold text-[#30475b] shadow-sm transition hover:opacity-90"
>
  + 일정 추가
</button>
      </div>
    </header>

    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-6">

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goPreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl hover:bg-[#faf3f1]"
            >
              ‹
            </button>

            <button
              onClick={goNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl hover:bg-[#faf3f1]"
            >
              ›
            </button>

            <h2 className="ml-2 text-xl font-bold md:text-2xl">
              {formatMonth()}
            </h2>
          </div>

          <button
            onClick={goToday}
            className="rounded-xl border border-[#eee5e1] px-4 py-2 text-sm font-semibold hover:bg-[#f3f8fc]"
          >
            오늘
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-[#eee5e1]">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`py-3 text-center text-sm font-semibold ${
                index === 0
                  ? "text-[#df8d8d]"
                  : index === 6
                  ? "text-[#7894c7]"
                  : "text-[#766b67]"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDays.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const today = isSameDay(date, new Date());
            const selected = isSameDay(date, selectedDate);

            return (
              <div
                key={
                  date.getFullYear() +
                  "-" +
                  date.getMonth() +
                  "-" +
                  date.getDate() +
                  "-" +
                  index
                }
                onClick={() => setSelectedDate(date)}
                className={`min-h-[105px] cursor-pointer border-b border-r border-[#f0e9e6] p-2 transition hover:bg-[#fdf8f6] md:min-h-[125px] ${
                  !isCurrentMonth(date)
                    ? "bg-[#fcfaf9] text-[#c9bfbb]"
                    : ""
                } ${
                  selected
                    ? "bg-[#fff9f7]"
                    : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      today
                        ? "bg-[#edf6fc] font-bold text-white"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-[#c47c76]">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(event);
                      }}
                      className="block w-full truncate rounded-md bg-[#f3dcd7] px-1.5 py-1 text-left text-[10px] font-medium text-[#8e625c] hover:bg-[#ecd0ca] md:text-xs"
                    >
                      {!event.all_day && (
                        <span>
                          {formatTime(event.start_at)}{" "}
                        </span>
                      )}
                      {event.title}
                    </button>
                  ))}

                  {dayEvents.length > 3 && (
                    <div className="px-1 text-[10px] text-[#a0948f]">
                      +{dayEvents.length - 3}개 더보기
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="rounded-3xl bg-white p-5 shadow-sm">

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#a0948f]">
              SELECTED DATE
            </p>

            <h3 className="mt-1 text-xl font-bold">
              {selectedDate.toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </h3>
          </div>

          <button
            onClick={() => openAddModal(selectedDate)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9e8e5] text-xl text-[#c47c76]"
          >
            +
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="rounded-2xl bg-[#f3f8fc] px-4 py-10 text-center">
            <div className="text-3xl">♥</div>

            <p className="mt-3 text-sm font-semibold">
              일정이 없어요
            </p>

            <p className="mt-1 text-xs text-[#a0948f]">
              이 날짜에 약속을 추가해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => openEditModal(event)}
                className="w-full rounded-2xl bg-[#f3f8fc] p-4 text-left transition hover:bg-[#f5ebe8]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {event.title}
                    </p>

                    <p className="mt-1 text-xs text-[#a0948f]">
                      {event.all_day
                        ? "종일"
                        : formatTime(event.start_at) +
                          (event.end_at
                            ? " ~ " + formatTime(event.end_at)
                            : "")}
                    </p>

                    {event.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-[#766b67]">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <span className="text-[#edf6fc]">
                    ♥
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-[#f3f8fc] p-4">
          <p className="text-xs text-[#a0948f]">
            현재 로그인
          </p>

          <p className="mt-1 font-semibold">
            {myName}
          </p>

          <p className="mt-2 text-xs text-[#b0a39e]">
            일정은 두 사람에게 실시간으로 반영됩니다.
          </p>
        </div>
      </aside>
    </div>
  </div>

  {showModal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setShowModal(false)}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {editingEvent ? "일정 수정" : "새 일정"}
          </h2>

          <button
            onClick={() => setShowModal(false)}
            className="text-2xl text-[#a0948f]"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">

          <div>
            <label className="mb-1 block text-sm font-semibold">
              제목
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 저녁 데이트"
              className="w-full rounded-xl bg-[#faf6f4] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              날짜
            </label>

            <input
              type="date"
              value={dateToInput(selectedDate)}
              onChange={(e) => {
                const value = e.target.value;
                const parts = value.split("-");

                if (parts.length === 3) {
                  setSelectedDate(
                    new Date(
                      Number(parts[0]),
                      Number(parts[1]) - 1,
                      Number(parts[2])
                    )
                  );
                }
              }}
              className="w-full rounded-xl bg-[#faf6f4] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4"
            />

            <span className="text-sm font-medium">
              종일 일정
            </span>
          </label>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                  시작
                </label>

                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl bg-[#faf6f4] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                  종료
                </label>

                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl bg-[#faf6f4] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold">
              메모
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="장소나 약속 내용을 적어주세요."
              rows={3}
              className="w-full resize-none rounded-xl bg-[#faf6f4] px-4 py-3 outline-none focus:ring-2 focus:ring-[#edf6fc]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            {editingEvent && (
              <button
                onClick={deleteEvent}
                className="rounded-xl bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-red-500"
              >
                삭제
              </button>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="flex-1 rounded-xl bg-[#f4ebe8] py-3 text-sm font-semibold text-[#766b67]"
            >
              취소
            </button>

            <button
              onClick={saveEvent}
              className="flex-1 rounded-xl bg-[#edf6fc] py-3 text-sm font-semibold text-white"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
</main>


);
}
