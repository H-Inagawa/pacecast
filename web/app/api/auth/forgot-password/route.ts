import { NextResponse } from "next/server";
import { PASSWORD_RESET_SENT_MESSAGE } from "../../../../lib/auth";
import {
  requestPasswordReset,
  resetPasswordUrl,
  sendPasswordResetEmail,
} from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const { reset, toEmail } = await requestPasswordReset(body.email ?? "");
    if (reset == null || toEmail == null) {
      return NextResponse.json({ message: PASSWORD_RESET_SENT_MESSAGE });
    }
    const url = resetPasswordUrl(reset.token);
    await sendPasswordResetEmail(toEmail, url);
    return NextResponse.json({ message: PASSWORD_RESET_SENT_MESSAGE });
  } catch (error) {
    return toErrorResponse(error);
  }
}
