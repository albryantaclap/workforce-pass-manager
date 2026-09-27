// ── WHO performed each attendance punch ──
//
// Attendance records store the authenticated account ID behind every punch
// (first_in_by_user_id, first_out_by_user_id, second_in_by_user_id,
// final_out_by_user_id). The account name is resolved HERE, from the User
// entity, in ONE batched query per request — never one lookup per attendance
// row — so the Scanned By column costs a single extra read no matter how many
// rows a page holds.
//
// A punch that was never attributed stays empty and is displayed as "—": no
// legacy record is ever assigned to an admin or supervisor after the fact. For
// rows written before the per-punch IDs existed, the account email that the
// old flows already stored (checked_in_by / checked_out_by) is used, because
// that email does identify the authenticated account that performed the punch.

export type UserDirectory = { byId: Map<string, string>; byEmail: Map<string, string> };

export type ScannedBy = {
  label: string;
  names: { first_in: string; first_out: string; second_in: string; final_out: string };
  detail: { stage: string; name: string }[];
};

// One query for the whole page/report: User id → full name, and email → full name.
export async function loadUserDirectory(base44: any): Promise<UserDirectory> {
  // One query for the whole request (the platform caps an entity list at 10k).
  const users = await base44.asServiceRole.entities.User.list("-created_date", 10000);
  const byId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const u of users || []) {
    const name = String(u?.full_name || "").trim();
    if (!name) continue;
    if (u.id) byId.set(u.id, name);
    if (u.email) byEmail.set(String(u.email).toLowerCase(), name);
  }
  return { byId, byEmail };
}

// Resolves the operator of every punch on ONE attendance record.
//   label  — the compact table value: the name when every attributed punch was
//            performed by the same account, "Multiple" when different accounts
//            handled the punches, "—" when nothing at all is stored.
//   names  — the per-punch names, for exports.
//   detail — the per-punch breakdown (only punches that exist), for the tooltip.
export function resolveScannedBy(record: any, dir: UserDirectory): ScannedBy {
  const byId = (id?: string) => (id ? dir.byId.get(id) || "" : "");
  const byEmail = (email?: string) =>
    email ? dir.byEmail.get(String(email).toLowerCase()) || "" : "";

  const stages: { stage: string; punch: string; name: string }[] = [
    {
      stage: "First In",
      punch: record?.first_in_at || record?.check_in_at || "",
      name: byId(record?.first_in_by_user_id) || byEmail(record?.checked_in_by),
    },
    {
      stage: "First Out",
      punch: record?.first_out_at || "",
      name: byId(record?.first_out_by_user_id),
    },
    {
      stage: "Second In",
      punch: record?.second_in_at || "",
      name: byId(record?.second_in_by_user_id),
    },
    {
      stage: "Final Out",
      punch: record?.final_out_at || record?.check_out_at || "",
      name: byId(record?.final_out_by_user_id) || byEmail(record?.checked_out_by),
    },
  ];

  const detail = stages
    .filter((s) => !!s.punch)
    .map(({ stage, name }) => ({ stage, name: name || "" }));

  const distinct = Array.from(new Set(detail.map((d) => d.name).filter(Boolean)));
  const label = distinct.length > 1 ? "Multiple" : distinct[0] || "—";

  return {
    label,
    names: {
      first_in: stages[0].name || "",
      first_out: stages[1].name || "",
      second_in: stages[2].name || "",
      final_out: stages[3].name || "",
    },
    detail,
  };
}

// True when any row on the page carries a punch — used to skip the directory
// query entirely on pages where nobody punched.
export function needsUserDirectory(records: any[]): boolean {
  return (records || []).some(
    (r) => !!(r?.first_in_at || r?.check_in_at || r?.first_out_at || r?.second_in_at || r?.final_out_at || r?.check_out_at)
  );
}