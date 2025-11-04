export type Department =
  | "Information Systems Department"
  | "Content & Media Department"
  | "TAPIPASS"
  | "People Experience"
  | "CEO";

// 1) 社内の一意キー: userSlug → 部署
export const DEPARTMENT_OF_USER: Record<string, Department> = {
  "murakami-makishi": "Information Systems Department",
  "hello-polycle": "Information Systems Department",
  "otsuka-himawari": "Content & Media Department",
  "yokoe-hinami": "Content & Media Department",
  "imamura-hinano": "Content & Media Department",
  "ikeda-hiromasa": "CEO",
  "nakashima-umi": "People Experience",
  "matsushima-rin": "Information Systems Department",
  "nakamine-rin": "Content & Media Department",
  "abe-shinnosuke": "People Experience",
  "abe-shotaro": "Content & Media Department",
  "yuji-miyajima": "TAPIPASS",
  "mizoguchi-yuki": "TAPIPASS",
  "uehara-taiyo": "People Experience",
};

// 2) 任意: SlackユーザーID → userSlug
export const USER_SLUG_OF_SLACK: Record<string, string> = {
  // "U0ABCDEF12": "yamamoto",
  "U09HVFPNX1P": "murakami-makishi",
  "U09A5ENUWP9": "hello-polycle",
  "U0979RZ6K41": "otsuka-himawari",
  "U08GT7K93N0": "yokoe-hinami",
  "U08H513206S": "imamura-hinano",
  "U09AW7GCSD7": "ikeda-hiromasa",
  "U095GPQQCEA": "nakashima-umi",
  "U0954G9B9HC": "matsushima-rin",
  "U095CN00HGU": "nakamine-rin",
  "U095792SGAW": "abe-shinnosuke",
  "U094YS526CT": "uehara-taiyo",
  "U04T93W0UUR": "abe-shotaro",
  "U0950JGPHNE": "yuji-miyajima",
  "U05DZ52MLBY": "mizoguchi-yuki"
};

export function resolveUserSlug(input: {
  userSlug?: string | null;
  slackUserId?: string | null;
  email?: string | null;
}): string | null {
  const normalize = (raw: string): string =>
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const normalizedSlug =
    input.userSlug && typeof input.userSlug === "string"
      ? normalize(input.userSlug)
      : null;
  if (normalizedSlug && DEPARTMENT_OF_USER[normalizedSlug]) {
    return normalizedSlug;
  }

  if (input.slackUserId && USER_SLUG_OF_SLACK[input.slackUserId]) {
    const slug = normalize(USER_SLUG_OF_SLACK[input.slackUserId]);
    if (slug && DEPARTMENT_OF_USER[slug]) {
      return slug;
    }
    return slug || USER_SLUG_OF_SLACK[input.slackUserId];
  }

  if (input.email) {
    const guess = normalize(input.email.split("@")[0] ?? "");
    if (guess && DEPARTMENT_OF_USER[guess]) {
      return guess;
    }
  }

  return null;
}

export function resolveDepartment(args: {
  userSlug?: string | null;
  slackUserId?: string | null;
  email?: string | null;
}): Department | null {
  const slug = resolveUserSlug(args);
  if (!slug) return null;
  return DEPARTMENT_OF_USER[slug] ?? null;
}
