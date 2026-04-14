"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Zap, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface WorkflowJob {
  id: string;
  trigger_type: string;
  preset_label: string;
  campaign_id: string | null;
  campaign_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Preset {
  preset_type: string;
  label: string;
  description: string;
  channels: string[];
}

interface WorkflowSchedule {
  id: string;
  preset_type: string;
  preset_label: string;
  cron_expression: string;
  timezone_name: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
}

type RepeatMode = "daily" | "weekly";

const CHANNEL_LABELS: Record<string, string> = {
  facebook_post: "Facebook",
  email: "Email",
  video_script: "Video",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock size={14} className="text-yellow-500" />,
  running: <Loader2 size={14} className="text-blue-500 animate-spin" />,
  done: <CheckCircle2 size={14} className="text-green-600" />,
  failed: <XCircle size={14} className="text-red-500" />,
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  done: "Hoàn thành",
  failed: "Thất bại",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-yellow-50 text-yellow-700 border-yellow-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Thứ 2" },
  { value: "2", label: "Thứ 3" },
  { value: "3", label: "Thứ 4" },
  { value: "4", label: "Thứ 5" },
  { value: "5", label: "Thứ 6" },
  { value: "6", label: "Thứ 7" },
  { value: "0", label: "Chủ nhật" },
];

const PRESET_TIME_HINTS: Record<string, string> = {
  weekly_promo: "Nên đặt buổi sáng (07:30-09:00) để có thời gian duyệt nội dung trước giờ cao điểm bán hàng.",
  remind_old_customers: "Nên đặt giờ hành chính (08:00-10:00) để email gửi khi khách hàng bắt đầu làm việc.",
  new_product_launch: "Nên đặt đầu tuần (Thứ 2/3) để có đủ thời gian tối ưu và chạy truyền thông đa kênh.",
  monthly_newsletter: "Nên đặt ngày đầu tháng hoặc đầu tuần để bản tin dễ được chú ý hơn.",
};

function buildCronFromForm(runTime: string, repeatMode: RepeatMode, weekday: string): string | null {
  const [hourStr, minuteStr] = runTime.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (repeatMode === "daily") return `${minute} ${hour} * * *`;
  return `${minute} ${hour} * * ${weekday}`;
}

function cronToReadable(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minute, hour, , , weekday] = parts;
  const timeText = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (weekday === "*") return `Mỗi ngày lúc ${timeText}`;
  const day = WEEKDAY_OPTIONS.find((d) => d.value === weekday)?.label ?? `Thứ ${weekday}`;
  return `${day} lúc ${timeText}`;
}

export default function WorkflowPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [newSchedulePreset, setNewSchedulePreset] = useState("");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("weekly");
  const [weekday, setWeekday] = useState("1");
  const [runTime, setRunTime] = useState("08:00");
  const [formError, setFormError] = useState("");
  const [triggering, setTriggering] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  function loadJobs() {
    setLoading(true);
    api
      .get<WorkflowJob[]>("/workflow/jobs")
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }

  function loadSchedules() {
    api
      .get<WorkflowSchedule[]>("/workflow/schedules")
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }

  useEffect(() => {
    api.get<Preset[]>("/workflow/presets").then(setPresets).catch(() => setPresets([]));
    loadJobs();
    loadSchedules();
  }, []);

  async function handleTrigger(preset_type: string) {
    setTriggering(preset_type);
    setMessages((m) => ({ ...m, [preset_type]: "" }));
    try {
      const res = await api.post<{ campaign_name: string; campaign_id: string }>(
        "/workflow/trigger",
        { preset_type }
      );
      setMessages((m) => ({
        ...m,
        [preset_type]: `Đang tạo chiến dịch "${res.campaign_name}"... AI sẽ soạn nội dung trong giây lát.`,
      }));
      loadJobs();
      // Poll once after a few seconds so running status appears
      setTimeout(loadJobs, 4000);
    } catch (err: unknown) {
      const detail =
        err instanceof Error ? err.message : "Kích hoạt thất bại. Vui lòng thử lại.";
      setMessages((m) => ({ ...m, [preset_type]: detail }));
    } finally {
      setTriggering(null);
    }
  }

  async function handleCreateSchedule() {
    setFormError("");
    if (!newSchedulePreset) {
      setFormError("Vui lòng chọn kịch bản trước khi tạo lịch.");
      return;
    }
    const cronExpression = buildCronFromForm(runTime, repeatMode, weekday);
    if (!cronExpression) {
      setFormError("Giờ chạy không hợp lệ. Vui lòng chọn lại.");
      return;
    }
    try {
      await api.post("/workflow/schedules", {
        preset_type: newSchedulePreset,
        cron_expression: cronExpression,
      });
      loadSchedules();
      setRunTime("08:00");
      setRepeatMode("weekly");
      setWeekday("1");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Tạo lịch thất bại";
      setFormError(detail);
    }
  }

  async function handleToggleSchedule(id: string) {
    await api.patch(`/workflow/schedules/${id}/toggle`);
    loadSchedules();
  }

  async function handleDeleteSchedule(id: string) {
    await api.delete(`/workflow/schedules/${id}`);
    loadSchedules();
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Zap size={20} className="text-gray-500" />
            Tự động hoá
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Chọn một kịch bản — AI sẽ tự tạo chiến dịch và soạn nội dung cho bạn
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobs}
            className="btn-secondary flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Preset cards */}
      <section>
        <h2 className="mb-3">Kịch bản tự động</h2>
        {presets.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presets.map((preset) => {
              const isRunning = triggering === preset.preset_type;
              const msg = messages[preset.preset_type];
              return (
                <div key={preset.preset_type} className="card space-y-3">
                  <div>
                    <p className="font-medium text-sm">{preset.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                    <div className="flex gap-1 mt-2">
                      {preset.channels.map((ch) => (
                        <span key={ch} className="badge bg-gray-100 text-gray-600 text-xs">
                          {CHANNEL_LABELS[ch] ?? ch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrigger(preset.preset_type)}
                    disabled={isRunning || triggering !== null}
                    className="btn-primary text-xs py-1.5 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <Zap size={13} />
                        Chạy ngay
                      </>
                    )}
                  </button>
                  {msg && (
                    <p
                      className={cn(
                        "text-xs px-2 py-1 rounded",
                        msg.includes("thất bại") || msg.includes("Không thể")
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                      )}
                    >
                      {msg}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Job history */}
      <section>
        <h2 className="mb-3">Lịch sử chạy</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            Chưa có tác vụ nào được chạy.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Kịch bản</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Chiến dịch tạo ra</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {job.preset_label}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border",
                          STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
                        {STATUS_ICON[job.status]}
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      {job.error_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={job.error_message}>
                          {job.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {job.campaign_id ? (
                        <Link
                          href={`/campaigns/${job.campaign_id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {job.campaign_name || "Xem chiến dịch"} →
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2>Lịch chạy tự động</h2>
          <HelpDialogButton
            title="Hướng dẫn lịch chạy tự động"
            summary="Mục này giúp bạn đặt giờ hệ thống tự tạo đợt quảng bá. Bạn chỉ cần chọn giờ và tần suất, không cần nhập cron."
            steps={[
              "Chọn kịch bản phù hợp ở ô 'Chọn kịch bản'.",
              "Chọn tần suất chạy: mỗi ngày hoặc mỗi tuần.",
              "Chọn giờ chạy và (nếu theo tuần) chọn thứ chạy.",
              "Bấm 'Tạo lịch' để lưu.",
              "Khi tới 'Lần chạy tới', hệ thống tự tạo chiến dịch và đẩy qua AI pipeline.",
            ]}
            tips={[
              "Nên đặt giờ chạy vào lúc bạn thường duyệt nội dung (ví dụ 08:00 sáng).",
              "Giờ chạy là thời điểm hệ thống bắt đầu tạo chiến dịch, không phải giờ đăng bài cuối cùng.",
            ]}
          />
        </div>
        <div className="card mb-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">1) Chọn kịch bản</label>
              <select
                className="input"
                value={newSchedulePreset}
                onChange={(e) => setNewSchedulePreset(e.target.value)}
              >
                <option value="">Chọn kịch bản</option>
                {presets.map((p) => (
                  <option key={p.preset_type} value={p.preset_type}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">2) Tần suất chạy</label>
              <select className="input" value={repeatMode} onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}>
                <option value="weekly">Mỗi tuần</option>
                <option value="daily">Mỗi ngày</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">3) Giờ chạy hệ thống</label>
              <input
                type="time"
                className="input"
                value={runTime}
                onChange={(e) => setRunTime(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Đây là giờ hệ thống bắt đầu tạo chiến dịch tự động.
              </p>
            </div>
            <div>
              <label className="label">4) Ngày chạy trong tuần</label>
              <select
                className="input"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                disabled={repeatMode === "daily"}
              >
                {WEEKDAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Nếu chọn "Mỗi ngày" thì trường này sẽ được bỏ qua.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
            <p>
              Lịch dự kiến:{" "}
              <strong>
                {cronToReadable(buildCronFromForm(runTime, repeatMode, weekday) || "*")}
              </strong>
            </p>
            {newSchedulePreset && PRESET_TIME_HINTS[newSchedulePreset] && (
              <p className="text-xs mt-1 text-blue-700">
                Gợi ý cho kịch bản này: {PRESET_TIME_HINTS[newSchedulePreset]}
              </p>
            )}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end">
            <button className="btn-primary" onClick={handleCreateSchedule}>
              Tạo lịch
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Kịch bản</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Lịch chạy</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Lần chạy tới</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5">{s.preset_label}</td>
                  <td className="px-4 py-2.5 text-gray-600">{cronToReadable(s.cron_expression)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.next_run_at ? formatDate(s.next_run_at) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary text-xs py-1" onClick={() => handleToggleSchedule(s.id)}>
                        {s.is_active ? "Tạm dừng" : "Bật lại"}
                      </button>
                      <button className="btn-secondary text-xs py-1" onClick={() => handleDeleteSchedule(s.id)}>
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Chưa có lịch tự động.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
