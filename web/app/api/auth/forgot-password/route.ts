import { NextResponse } from "next/server";
import {
  requestPasswordReset,
  resetPasswordUrl,
  sendPasswordResetEmail,
} from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERIC_MESSAGE = "入力したメールアドレスにアカウントがあれば、再設定用のリンクを送りました。";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const { reset, toEmail } = await requestPasswordReset(body.email ?? "");
    if (reset == null || toEmail == null) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }
    const url = resetPasswordUrl(reset.token);
    const sent = await sendPasswordResetEmail(toEmail, url);
    if (sent) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }
    return NextResponse.json({
      message: "再設定メールの送信設定が無いので、下のリンクを開いてパスワードを変えてください。",
      reset_url: url,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
