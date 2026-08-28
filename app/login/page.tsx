"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setMessage("");

    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage("로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf7f5] px-5">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#3d3532]">
            OUR HOME <span className="text-[#e58b8b]">♥</span>
          </h1>

          <p className="mt-2 text-sm text-[#9b8f8a]">
            우리 둘만의 작은 공간
          </p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">

          <h2 className="text-2xl font-bold text-[#3d3532]">
            로그인
          </h2>

          <p className="mt-2 text-sm text-[#9b8f8a]">
            우리만의 공간에 들어오세요.
          </p>

          <div className="mt-7">

            <label className="text-sm font-medium text-[#766b67]">
              이메일
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              className="mt-2 w-full rounded-xl border border-[#eee5e1] px-4 py-3 outline-none focus:border-[#e8b7b0]"
            />

          </div>

          <div className="mt-5">

            <label className="text-sm font-medium text-[#766b67]">
              비밀번호
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="mt-2 w-full rounded-xl border border-[#eee5e1] px-4 py-3 outline-none focus:border-[#e8b7b0]"
            />

          </div>

          {message && (
            <p className="mt-4 text-sm text-[#c96f6f]">
              {message}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-7 w-full rounded-xl bg-[#e8b7b0] py-3.5 font-semibold text-white transition hover:bg-[#d99f97] disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <p className="mt-6 text-center text-sm text-[#9b8f8a]">
            처음 오셨나요?{" "}
            <span className="font-semibold text-[#c47c76]">
              회원가입
            </span>
          </p>

        </div>

      </div>
    </main>
  );
}