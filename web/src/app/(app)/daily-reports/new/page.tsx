"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Session } from "next-auth";
import { getReportWeekdayCode, reportDateBy29hRule } from "@/lib/time";
import { Button } from "@/components/ui/button";

type AutoMeta = {
  date: string;
  weekday: string;
  name: string;
  email: string;
  slackUserId?: string;
  slackTeamId?: string;
  channelId: string;
};

type FormState = {
  satisfactionToday: string;
  doneToday: string;
  goodMoreBackground: string;
  moreNext: string;
  todoTomorrow: string;
  wishTomorrow: string;
  personalNews: string;
  tags: string;
};

export default function DailyReportNewPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const [formState, setFormState] = useState<FormState>({
    satisfactionToday: "",
    doneToday: "",
    goodMoreBackground: "",
    moreNext: "",
    todoTomorrow: "",
    wishTomorrow: "",
    personalNews: "",
    tags: "",
  });

  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (isMounted) {
          setSession(data);
        }
      } catch (error) {
        console.error("daily-reports.session.fetch.error", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentDate = useMemo(() => {
    const { dateISO, isPreviousDay } = reportDateBy29hRule();
    const weekday = getReportWeekdayCode(dateISO);
    return { iso: dateISO, weekday, isPreviousDay };
  }, []);

  const autoMeta = useMemo<AutoMeta>(() => {
    const slackUserId =
      typeof session?.user?.slackUserId === "string"
        ? session.user.slackUserId
        : undefined;
    const slackTeamId =
      typeof session?.user?.slackTeamId === "string"
        ? session.user.slackTeamId
        : undefined;

    return {
      date: currentDate.iso,
      weekday: currentDate.weekday,
      name: session?.user?.name ?? "",
      email: session?.user?.email ?? "",
      slackUserId,
      slackTeamId,
      channelId: "C0957N7D0MP",
    };
  }, [session, currentDate]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setStatus("idle");

    try {
      const response = await fetch("/api/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          satisfactionToday: formState.satisfactionToday,
          doneToday: formState.doneToday,
          goodMoreBackground: formState.goodMoreBackground,
          moreNext: formState.moreNext,
          todoTomorrow: formState.todoTomorrow,
          wishTomorrow: formState.wishTomorrow,
          personalNews: formState.personalNews,
          tags: formState.tags
            .split(" ")
            .map((tag) => tag.replace(/^#/, "").trim())
            .filter(Boolean),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result?.error || "送信に失敗しました";
        throw new Error(errorMessage);
      }

      setMessage("デイリーレポートを送信しました。Slack投稿はサーバ側で実行されます。");
      setStatus("success");
      setFormState({
        satisfactionToday: "",
        doneToday: "",
        goodMoreBackground: "",
        moreNext: "",
        todoTomorrow: "",
        wishTomorrow: "",
        personalNews: "",
        tags: "",
      });
    } catch (error) {
      console.error("daily-reports.submit.error", error);
      setMessage((error as Error).message);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="space-y-6">セッション情報を取得しています…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#3d3128]">デイリーレポートを投稿</h1>
        <p className="mt-1 text-sm text-[#7f6b5a]">
          Slackへ本人として投稿し、Google Sheetsに保存されます。文章項目のみ入力してください。
        </p>
      </div>

      <section className="rounded-2xl border border-[#ead8c4] bg-[#fffaf5] px-6 py-5 shadow-[0_12px_30px_-24px_rgba(173,122,70,0.65)]">
        <h2 className="text-sm font-semibold text-[#ad7a46]">自動取得メタ情報（送信されません）</h2>
        <dl className="mt-3 grid gap-4 text-sm text-[#5b4c40] md:grid-cols-2">
          <div>
            <dt className="font-medium text-[#7f6b5a]">対象日</dt>
            <dd>
              {autoMeta.date}
              {currentDate.isPreviousDay ? "（前日扱い）" : ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">曜日</dt>
            <dd>{autoMeta.weekday}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">ユーザー名</dt>
            <dd>{autoMeta.name || "-"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">メールアドレス</dt>
            <dd>{autoMeta.email || "-"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">Slack ユーザーID</dt>
            <dd>{autoMeta.slackUserId ?? "-"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">Slack チームID</dt>
            <dd>{autoMeta.slackTeamId ?? "-"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#7f6b5a]">投稿チャンネル</dt>
            <dd>{autoMeta.channelId}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <TextareaField
            id="satisfactionToday"
            label="昨日の3,4,5を踏まえて今日の満足度"
            value={formState.satisfactionToday}
            onChange={handleChange}
          />
          <TextareaField
            id="doneToday"
            label="今日やったこと（Done）"
            value={formState.doneToday}
            onChange={handleChange}
            required
          />
          <TextareaField
            id="goodMoreBackground"
            label="今日のGood / More とその背景"
            value={formState.goodMoreBackground}
            onChange={handleChange}
          />
          <TextareaField
            id="moreNext"
            label="今日のMore Next"
            value={formState.moreNext}
            onChange={handleChange}
          />
          <TextareaField
            id="todoTomorrow"
            label="明日やるべきこと（タスク）"
            value={formState.todoTomorrow}
            onChange={handleChange}
          />
          <TextareaField
            id="wishTomorrow"
            label="明日やりたいこと（非タスク）"
            value={formState.wishTomorrow}
            onChange={handleChange}
          />
          <TextareaField
            id="personalNews"
            label="個人的ニュース"
            value={formState.personalNews}
            onChange={handleChange}
          />
          <div className="flex flex-col gap-1 text-sm">
            <label className="text-xs font-medium text-[#ad7a46]" htmlFor="tags">
              タグ（スペース区切り）
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              value={formState.tags}
              onChange={handleChange}
              placeholder="#sales #cs"
              className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "送信中..." : "Slackへ投稿して保存"}
          </Button>
          {message && (
            <span
              className={`text-sm ${
                status === "success" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

const TextareaField = ({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  required?: boolean;
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="text-xs font-medium text-[#ad7a46]" htmlFor={id}>
      {label}
    </label>
    <textarea
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      rows={5}
      required={required}
      className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
    />
  </div>
);
