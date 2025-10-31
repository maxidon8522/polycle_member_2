import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import { env } from "@/config/env";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

let sheetsClient: sheets_v4.Sheets | null = null;

const createServiceAccountClient = (): JWT => {
  if (!env.server.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured. Provide service account credentials.",
    );
  }

  if (!env.server.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY is not configured. Provide service account credentials.",
    );
  }

  return new google.auth.JWT({
    email: env.server.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.server.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
};

export const createSheetsClient = async (): Promise<sheets_v4.Sheets> => {
  const auth = createServiceAccountClient();
  return google.sheets({ version: "v4", auth });
};

export const getSheetsClient = async (): Promise<sheets_v4.Sheets> => {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient();
  }

  return sheetsClient;
};
