export type Department = "A" | "B" | "C" | "D" | "E";

// 1) 社内の一意キー: userSlug → 部署
export const DEPARTMENT_OF_USER: Record<string, Department> = {
  yamamoto: "A",
  tanaka: "B",
  hoshikawa: "C",
  murakami: "A",
  // ここに追記していく
};

// 2) 任意: SlackユーザーID → userSlug
export const USER_SLUG_OF_SLACK = {
  // "U0ABCDEF12": "yamamoto",
  "U09HVFPNX1P": "murakami",
} as const satisfies Record<string, string>;

export function resolveUserSlug(input: {
  userSlug?: string | null;
  slackUserId?: string | null;
  email?: string | null;
}): string | null {
  const normalizedSlug = input.userSlug?.toLowerCase?.() ?? null;
  if (normalizedSlug && DEPARTMENT_OF_USER[normalizedSlug]) {
    return normalizedSlug;
  }

  if (input.slackUserId && USER_SLUG_OF_SLACK[input.slackUserId]) {
    return USER_SLUG_OF_SLACK[input.slackUserId];
  }

  if (input.email) {
    const guess = input.email.split("@")[0].toLowerCase();
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
